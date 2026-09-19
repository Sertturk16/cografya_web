import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";

/**
 * A CENSUS OF EVERY FIXED-`px` INLINE-AXIS DECLARATION IN THE TEN SURVIVING CSS MODULES.
 *
 * ## What this is for
 *
 * `pnpm sweep:overflow` catches horizontal overflow in a real browser and is the only thing
 * that can see rendered geometry. It also needs a server, a browser and a human who remembers
 * to run it — and T-047's own report predicted, correctly, that it will be run on tasks whose
 * brief says "responsive" and skipped on the tasks that wrote the recorded defects, because
 * none of those tasks thought it was making a geometric change.
 *
 * This is the cheap half of that gap. `climate.module.css`'s `.chartFrame` scrolled
 * `/turkiye/istanbul` 21px sideways at 320 because of ONE declaration: `min-width: 300px`.
 * That declaration is plain text in a file vitest can read, so the moment it is written the
 * census below stops matching and `pnpm test` — the one command every task already runs —
 * goes red naming the file and the declaration. No browser, no server, no remembering.
 *
 * ## What it is NOT
 *
 * NOT a prohibition. A fixed px width is often right: `site-search.module.css`'s `min-width:
 * 44px` is the pointer-target floor, `.swatch`'s `width: 20px` is a legend chip, and every
 * `width: 1px` here is a visually-hidden clip rect. The rule is that the POPULATION is
 * known — adding to it costs one line here and forces one question ("does this floor fit
 * inside 288px of content box at 320?"), which is exactly the question nobody asked about
 * `.chartFrame`.
 *
 * NOT a replacement for the sweep, and the coverage claim is narrower than it looks. Of the
 * three recorded defects this census would have fired on exactly ONE:
 *   - `.chartFrame`'s `min-width: 300px` — caught, proven by mutation below;
 *   - T-038's ECMWF licence notice — NOT caught. It overflowed because a mandated string had
 *     no wrapping opportunity, not because of any declaration; `marine.module.css` has no px
 *     rule behind it;
 *   - T-046's `shrink-0` badge row — NOT caught. It is a Tailwind class in JSX and not in a
 *     CSS Module at all.
 * Saying "two of three" would be the comfortable version and it is not true. One of three,
 * running automatically, is still the difference between a defect caught in `pnpm test` and a
 * defect caught in review two rounds later.
 *
 * ## Scope: the inline axis only
 *
 * `height`, `min-height`, `top` and their siblings are excluded deliberately, not forgotten:
 * a vertical px value cannot widen a document. What is counted is what can — `width`,
 * `min-width`, `max-width`, `flex-basis`, the `flex` shorthand's basis, and
 * `grid-template-columns`, whose track sizes are the one place a grid stops collapsing.
 *
 * At-rule PRELUDES are stripped before scanning, so `@media (max-width: 700px)` is not read
 * as a declaration. Declarations INSIDE those blocks are counted, with their file — several
 * of the entries below live under `@media (min-width: 1024px)` and are harmless there, which
 * the census records rather than judges.
 */

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

const walk = (dir: string, match: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full, match);
    return match(entry.name) ? [full] : [];
  });

/** The inline-axis sizing properties. Only these can make a document scroll sideways. */
const INLINE_AXIS = [
  "min-width",
  "max-width",
  "width",
  "flex-basis",
  "flex",
  "grid-template-columns",
];

const DECLARATION = new RegExp(`(?:^|[;{}\\s])(${INLINE_AXIS.join("|")})\\s*:\\s*([^;}]*)`, "g");

/**
 * Remove at-rule preludes (`@media (max-width: 700px)`, `@supports (…)`) so their own
 * `max-width:` is not mistaken for a declaration. The trailing `{` is kept, so block
 * structure — and every declaration inside — survives.
 */
const stripAtRulePreludes = (css: string): string => css.replace(/@[a-zA-Z-]+[^;{]*/g, " ");

const scan = (file: string): string[] => {
  const css = stripAtRulePreludes(stripCssComments(readFileSync(file, "utf8")));
  const found: string[] = [];
  for (const match of css.matchAll(DECLARATION)) {
    const property = match[1] as string;
    const value = (match[2] as string).trim().replace(/\s+/g, " ");
    if (!/\d(?:\.\d+)?px/.test(value)) continue;
    found.push(`${property}: ${value}`);
  }
  return found;
};

const stylesheets = ["app", "components"]
  .flatMap((root) => walk(join(repoRoot, root), (name) => name.endsWith(".module.css")))
  .sort();

const census = Object.fromEntries(
  stylesheets.map((file) => [file.slice(repoRoot.length), scan(file)] as const),
);

/**
 * THE PINNED POPULATION. Regenerate deliberately, never to make a red go away:
 * a new entry is a new fixed inline-axis floor, and the question it owes an answer to is
 * whether it fits inside 288px of content box at a 320px viewport.
 */
const EXPECTED: Record<string, string[]> = {
  "app/[locale]/(site)/kitaplar/[slug]/book-detail.module.css": [
    "width: 180px",
    "flex: 1 1 320px",
    "grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
    "grid-template-columns: repeat(auto-fit, minmax(min(88px, 100%), 1fr))",
    "width: 1px",
  ],
  "components/air/air-pollution.module.css": ["max-width: 720px", "max-width: 420px"],
  "components/book/book-video.module.css": [
    "max-width: 560px",
    "max-width: 560px",
    "width: 24px",
    "max-width: 560px",
    "max-width: 560px",
    "width: 1px",
  ],
  "components/climate/climate.module.css": [
    "flex: 1 1 420px",
    // The T-046 fix itself. If this line ever reads `min-width: 300px` again, this suite is
    // where it stops — which is the entire reason this file exists.
    "min-width: min(300px, 100%)",
    "flex: 1 1 220px",
    "min-width: 200px",
    "width: 20px",
    "max-width: 560px",
    "min-width: 320px",
    // The three below live under `@media (min-width: 1024px)`, where a 300px floor inside a
    // ~640px rail cannot overflow anything.
    "flex: 1 1 420px",
    "min-width: 300px",
    "flex: 1 1 220px",
    "min-width: 280px",
  ],
  "components/earthquake/earthquake.module.css": ["min-width: 520px"],
  "components/map/locator-map.module.css": ["width: min(100%, 460px)", "width: min(100%, 560px)"],
  "components/marine/marine.module.css": [
    // The remaining floor sits on a table inside an `overflow-x: auto` container, which is
    // what `docs/design.md` permits and what keeps it off the document's scroll width.
    "min-width: 860px",
    "grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 520px))",
    "width: 1px",
  ],
  "components/site-search/site-search.module.css": [
    "min-width: 28px",
    "min-width: 32px",
    "width: 1px",
    "width: 420px",
  ],
};

describe("fixed-px inline-axis declarations in the surviving CSS Modules", () => {
  it("scans every module, and only modules", () => {
    // Anti-vacuity: a scan that found no files would agree with any expectation.
    expect(stylesheets.length).toBe(8);
    expect(Object.keys(census).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("matches the pinned population exactly", () => {
    expect(census).toEqual(EXPECTED);
  });

  /**
   * 46 across ten modules when this was pinned; 44 across nine after T-042 deleted
   * `tools.module.css` (`min-width: 44px`, `width: 1px`), 37 across EIGHT after fix round 1
   * deleted `home.module.css` — seven of its own, the largest single block in the census — and
   * 34 after T-033 deleted `marine.module.css`'s 42 classes with no call site (the `/deniz`
   * hub's `.basinGrid` and `.valuesTable` floors and the explainer chevron's `width: 9px`).
   * Every step down is a DELETION of rules no route reached, not a narrowing that was fixed;
   * the population is what it measures, so it is re-measured rather than carried.
   */
  it("counts 34 declarations in total", () => {
    const total = Object.values(census).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(34);
  });

  it("does not read an at-rule prelude as a declaration", () => {
    // `climate.module.css` has three `@media` blocks, two of them `(max-width: 700px)`. If
    // the prelude strip regressed, those would appear in the census as `max-width: 700px`
    // and every entry after them would shift.
    expect(census["components/climate/climate.module.css"]).not.toContain("max-width: 700px");
    expect(census["components/climate/climate.module.css"]).not.toContain("min-width: 1024px");
  });

  it("reads declarations, not comments", () => {
    // `climate.module.css`'s `.chartFrame` docblock spells out the rejected `min-width: 300px`
    // in prose, immediately above the live `min(300px, 100%)`. Counting that comment would
    // make this suite green on the explanation after someone shipped the defect — the exact
    // false positive `docs/conventions.md` records four independent arrivals at.
    const raw = readFileSync(join(repoRoot, "components/climate/climate.module.css"), "utf8");
    expect(raw).toContain("`min(300px, 100%)`, not a bare 300px");
    expect(
      census["components/climate/climate.module.css"]?.filter((d) => d === "min-width: 300px"),
    ).toHaveLength(1);
  });
});
