import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";

/**
 * A CENSUS OF EVERY FIXED-`px` INLINE-AXIS DECLARATION IN THE SURVIVING CSS MODULES.
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
 * NOT a prohibition. A fixed px width is often right: `earthquake.module.css`'s `min-width:
 * 520px` is what makes a wide table scroll instead of squeezing, and every `width: 1px` here is a
 * visually-hidden clip rect. The rule is that the POPULATION is
 * known — adding to it costs one line here and forces one question ("does this floor fit
 * inside 288px of content box at 320?"), which is exactly the question nobody asked about
 * `.chartFrame`.
 *
 * NOT a replacement for the sweep, and the coverage claim is narrower than it looks. Of the
 * three recorded defects this census would have fired on exactly ONE:
 *   - `.chartFrame`'s `min-width: 300px` — caught, proven by mutation below;
 *   - T-038's ECMWF licence notice — NOT caught. It overflowed because a mandated string had
 *     no wrapping opportunity, not because of any declaration; the marine stylesheet had no px
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

/**
 * The scanner, split so the two meta-rules at the bottom of this file can exercise it against a
 * LITERAL stylesheet rather than against whichever module happens to survive. They used to use
 * `climate.module.css`, which carried both an at-rule prelude and a px value in prose; T-033
 * retired it, and re-pointing them at another module would have made them hostage to the next
 * deletion for no gain. A literal fixture also carries its own positive control, which a real
 * file never did.
 */
const scanCss = (source: string): string[] => {
  const css = stripAtRulePreludes(stripCssComments(source));
  const found: string[] = [];
  for (const match of css.matchAll(DECLARATION)) {
    const property = match[1] as string;
    const value = (match[2] as string).trim().replace(/\s+/g, " ");
    if (!/\d(?:\.\d+)?px/.test(value)) continue;
    found.push(`${property}: ${value}`);
  }
  return found;
};

const scan = (file: string): string[] => scanCss(readFileSync(file, "utf8"));

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
  "components/book/book-video.module.css": [
    "max-width: 560px",
    "max-width: 560px",
    "width: 24px",
    "max-width: 560px",
    "max-width: 560px",
    "width: 1px",
  ],
  "components/earthquake/earthquake.module.css": ["min-width: 520px"],
  "components/map/locator-map.module.css": ["width: min(100%, 460px)", "width: min(100%, 560px)"],
};

describe("fixed-px inline-axis declarations in the surviving CSS Modules", () => {
  it("scans every module, and only modules", () => {
    // Anti-vacuity: a scan that found no files would agree with any expectation.
    expect(stylesheets.length).toBe(4);
    expect(Object.keys(census).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("matches the pinned population exactly", () => {
    expect(census).toEqual(EXPECTED);
  });

  /**
   * 46 across ten modules when this was pinned; 44 across nine after T-042 deleted
   * `tools.module.css` (`min-width: 44px`, `width: 1px`), 37 across EIGHT after fix round 1
   * deleted `home.module.css` — seven of its own, the largest single block in the census —
   * 34 after T-033 deleted `marine.module.css`'s 42 classes with no call site (the `/deniz`
   * hub's `.basinGrid` and `.valuesTable` floors and the explainer chevron's `width: 9px`),
   * 31 across SEVEN once that file went too, and 29 across SIX once T-033 converted
   * `air-pollution.module.css` (the chart frame's `max-width: 720px` and the year table's
   * `max-width: 420px`), and 18 across FIVE once it converted `climate.module.css`, the largest
   * block left in the census at eleven. Every step down is a DELETION of rules no route reached,
   * or a conversion that moved the floor out of a stylesheet, not a narrowing that was fixed; the
   * population is what it measures, so it is re-measured rather than carried.
   *
   * The three that left with the file are NOT gone from the product: the `11ch 1fr` value
   * grid and the `minmax(min(280px, 100%), 520px)` block track are now Tailwind arbitrary
   * values in `province-marine-section.tsx`, where this census cannot see them. Air
   * pollution's two are the same case — `max-w-[720px]` on the chart frame and
   * `max-w-[420px]` on the disclosure, in `pm25-chart.tsx` and `pm25-table.tsx`. That is the
   * coverage note below, restated: a Tailwind class in JSX is not in a CSS Module at all, and
   * `pnpm sweep:overflow` is what still covers it.
   *
   * **Climate's eleven are the sharpest case of that, because ONE of them is the defect this
   * file exists for.** `.chartFrame`'s `min-width: min(300px, 100%)` — T-046's fix for the 36px
   * overflow at 320 — is now `min-w-[min(300px,100%)]` in `climate-chart.tsx`: the same
   * declaration, in a place this census cannot read. So the docblock's "caught, proven by
   * mutation" claim is now about the RULE, not about that file, and
   * `pnpm sweep:overflow -- --filter=/turkiye/istanbul` at 320 is what covers the frame itself.
   */
  it("counts 14 declarations in total", () => {
    const total = Object.values(census).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(14);
  });

  it("does not read an at-rule prelude as a declaration", () => {
    // The fixture is the retired `climate.module.css`'s shape, which is why this rule exists:
    // two `(max-width: 700px)` blocks and one `(min-width: 1024px)`. If the prelude strip
    // regressed, the preludes would enter the census as declarations and every entry after them
    // would shift.
    const found = scanCss(
      [
        "@media (max-width: 700px) { .a { min-width: 320px; } }",
        "@media (min-width: 1024px) { .b { flex: 1 1 420px; } }",
      ].join("\n"),
    );
    // Positive control first: declarations INSIDE those blocks are still counted, which is what
    // makes the two absences below mean anything.
    expect(found).toEqual(["min-width: 320px", "flex: 1 1 420px"]);
    expect(found).not.toContain("max-width: 700px");
    expect(found).not.toContain("min-width: 1024px");
  });

  it("reads declarations, not comments", () => {
    // Again the retired stylesheet's shape: its `.chartFrame` docblock spelled out the REJECTED
    // `min-width: 300px` in prose, immediately above the live `min(300px, 100%)`. Counting the
    // comment would make this suite green on the explanation after someone shipped the defect —
    // the exact false positive `docs/conventions.md` records four independent arrivals at.
    const found = scanCss(
      [
        "/* `min(300px, 100%)`, not a bare 300px: a bare min-width: 300px was the defect. */",
        ".chartFrame { min-width: min(300px, 100%); }",
      ].join("\n"),
    );
    expect(found).toEqual(["min-width: min(300px, 100%)"]);
    expect(found.filter((d) => d === "min-width: 300px")).toHaveLength(0);
  });
});
