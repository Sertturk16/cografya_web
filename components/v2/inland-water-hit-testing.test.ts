import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * THE LAKES MUST NOT EAT A CLICK.
 *
 * PR2 moved `INLAND_WATER_SHAPES` to paint AFTER the province layer on every Türkiye map,
 * because the province fill is opaque or near-opaque in every state and was covering the water
 * entirely. That order is correct and stays. What it costs is hit-testing: SVG takes the
 * LAST-PAINTED element under the pointer, so on `v2-game-screen.tsx` — whose `onClick`/`onKeyDown`
 * sit on each PROVINCE PATH, not on the `<svg>` — a tap on Van Gölü, Tuz Gölü, Beyşehir or
 * Eğirdir landed on a lake path with no handler and the answer was silently lost, in both the
 * province and the region round, on mouse and on touch. The five maps that were safe were safe by
 * accident: their water is a `<g>` that already carried `pointer-events-none`.
 *
 * So the attribute is the invariant, not the layer order, and this file holds it by WALKING
 * `components/` and `app/` rather than from a list — a ninth map cannot be written without being
 * checked, which is the same construction `lib/map/tr-inland-water-jrc.test.ts` uses for the
 * licence credit and `components/css-module-dark-safety.test.ts` uses for the stylesheets.
 *
 * WHAT THIS DOES NOT COVER, said plainly so nobody reads more into a green run:
 *
 *  - It does NOT prove the water paints after the interactive layer, nor that the siblings in
 *    that `<svg>` are interactive at all. Vitest runs in the node environment with no jsdom and
 *    no layout, so document order, painting and hit-testing cannot be observed here; expressing
 *    "an interactive sibling exists" by static scan would mean guessing which `<path>` in a
 *    1400-line component is a sibling of which `<g>`, and a guard that guesses is worse than the
 *    narrower one it replaces.
 *  - It does NOT check the OTHER layers. A future decorative overlay painted last with handlers
 *    underneath is the same defect and this file will not see it.
 *  - It is a SOURCE scan. A `pointer-events-none` that arrives through a variable, a `clsx` call
 *    or a computed class string is invisible to it, and so is one cancelled by a later
 *    `pointer-events-auto` on a child.
 *
 * What it does prove is the thing that was actually wrong and the thing that is cheap to keep
 * true: every place in the tree that renders `INLAND_WATER_SHAPES` names `pointer-events-none`
 * on the element that paints it, or on the `<g>` wrapping it.
 */

const ROOTS = ["components/", "app/"].map((dir) =>
  fileURLToPath(new URL(`../../${dir}`, import.meta.url)),
);

const REPO = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });
}

/**
 * The source text of one `INLAND_WATER_SHAPES.map(...)` render site, including a `<g>` that wraps
 * it and nothing else.
 *
 * Both shapes ship today and both are legitimate, so the region has to cover both:
 *
 *   `<g className="… pointer-events-none">{INLAND_WATER_SHAPES.map((w) => <path … />)}</g>`
 *   `{INLAND_WATER_SHAPES.map((w) => <path className="… pointer-events-none" />)}`
 *
 * The end is found by matching parentheses from `.map(`, SKIPPING quoted spans — a class string
 * here reads `fill-[var(--map-sea)]`, so parens inside strings are real and an unbalanced one in
 * some future literal would otherwise run the region to the end of the file.
 *
 * The start widens backwards to a preceding `<g …>` only when the text between that tag's `>` and
 * the call is whitespace and an opening brace, i.e. when the call IS that group's body. Comments
 * are stripped before any of this runs, so a `<g>` mentioned in prose above the call cannot
 * capture it, and a real `<g>` that has a JSX comment between itself and the call collapses to
 * `{ }` — which contains `}` and so fails the test, falling back to the narrower region rather
 * than silently swallowing a sibling's attribute.
 */
export function renderRegionAt(source: string, at: number): string {
  const open = source.indexOf("(", at);
  if (open === -1) return source.slice(at);
  let depth = 0;
  let quote: string | null = null;
  let end = source.length - 1;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]!;
    if (quote !== null) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  let start = at;
  const gStart = source.lastIndexOf("<g", at);
  if (gStart !== -1) {
    const gEnd = source.indexOf(">", gStart);
    if (gEnd !== -1 && gEnd < at && /^[\s{]*$/.test(source.slice(gEnd + 1, at))) start = gStart;
  }
  return source.slice(start, end + 1);
}

const CALL = "INLAND_WATER_SHAPES.map(";

/** Every `INLAND_WATER_SHAPES.map(` in `source`, as its own render region. */
export function renderRegions(source: string): string[] {
  const regions: string[] = [];
  for (let at = source.indexOf(CALL); at !== -1; at = source.indexOf(CALL, at + CALL.length)) {
    regions.push(renderRegionAt(source, at));
  }
  return regions;
}

const SITES = ROOTS.flatMap(walk)
  .map((file) => ({
    file: file.slice(REPO.length),
    source: stripComments(readFileSync(file, "utf8")),
  }))
  .flatMap(({ file, source }) =>
    renderRegions(source).map((region, nth) => ({ file, nth, region })),
  );

describe("the inland-water layer never takes a click", () => {
  it("finds the render sites at all — anti-vacuity", () => {
    // A walk that found nothing would pass the next case for free, and finding the sites IS the
    // construction. Seven ship today (game board, tool workbench, three explorers, two locator
    // maps); `toBeGreaterThan(4)` is the same floor the sibling licence guard uses, so retiring
    // one map does not force an edit here while deleting the walk still reds.
    expect(SITES.length, "components rendering INLAND_WATER_SHAPES").toBeGreaterThan(4);
  });

  it.each(SITES)("$file site $nth carries pointer-events-none", ({ region }) => {
    expect(
      region,
      "an INLAND_WATER_SHAPES layer without `pointer-events-none`. It paints AFTER the " +
        "interactive layer on every Türkiye map, and SVG hit-testing takes the last-painted " +
        "element: on the play board that swallows the province click and loses the answer.",
    ).toContain("pointer-events-none");
  });
});

/**
 * The extractor is the whole test, so it is exercised against sources this file owns rather than
 * against the tree it is meant to police — the tree is currently all-passing, which is exactly
 * the state in which a broken extractor is indistinguishable from a clean tree.
 */
describe("the region extractor — positive controls", () => {
  const WRAPPED_OK = `const a = (
    <g className="fill-[var(--map-sea)] stroke-[0.5] pointer-events-none">
      {INLAND_WATER_SHAPES.map((lake) => (
        <path key={lake.id} d={lake.d} />
      ))}
    </g>
  );`;
  const WRAPPED_BAD = WRAPPED_OK.replace(" pointer-events-none", "");
  const BARE_OK = `const a = (
    <>
      {INLAND_WATER_SHAPES.map((water) => (
        <path key={water.id} d={water.d} className="fill-[var(--map-sea)] pointer-events-none" />
      ))}
    </>
  );`;
  const BARE_BAD = BARE_OK.replace(" pointer-events-none", "");

  it("reads the attribute off a wrapping <g>", () => {
    expect(renderRegions(WRAPPED_OK)[0]).toContain("pointer-events-none");
  });

  it("reds when that <g> loses it", () => {
    expect(renderRegions(WRAPPED_BAD)[0]).not.toContain("pointer-events-none");
  });

  it("reads the attribute off a bare <path> inside the callback", () => {
    expect(renderRegions(BARE_OK)[0]).toContain("pointer-events-none");
  });

  it("reds when that <path> loses it — the exact defect this file was written for", () => {
    expect(renderRegions(BARE_BAD)[0]).not.toContain("pointer-events-none");
  });

  it("does not borrow a NEIGHBOUR group's attribute", () => {
    // The failure mode that would make this guard green on the bug it exists for: a sibling
    // layer above the call already says `pointer-events-none` on nearly every one of these maps.
    const borrowed = `const a = (
      <>
        <g className="fill-accent pointer-events-none">
          {SEA_LABELS.map((s) => (
            <text key={s.name}>{s.name}</text>
          ))}
        </g>
        {INLAND_WATER_SHAPES.map((water) => (
          <path key={water.id} d={water.d} className="fill-[var(--map-sea)]" />
        ))}
      </>
    );`;
    expect(renderRegions(borrowed)[0]).not.toContain("pointer-events-none");
  });

  it("finds every call in a file, not just the first", () => {
    expect(renderRegions(`${BARE_OK}\n${WRAPPED_OK}`)).toHaveLength(2);
  });

  it("stops at the end of the callback, not at a paren inside a class string", () => {
    // `fill-[var(--map-sea)]` puts a balanced pair inside a quoted span; the scanner skips
    // quotes, so the region ends at the callback's own `)` and not one paren early.
    const region = renderRegions(BARE_OK)[0]!;
    expect(region.endsWith(")")).toBe(true);
    expect(region).not.toContain("</>");
  });
});
