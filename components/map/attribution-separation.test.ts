import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The map attribution's TEXT-RUN SEPARATION (UX tour B26, → PR #47 review CR-S2).
 *
 * ## What broke, and why the obvious fix was not one
 *
 * The Türkiye map stacks two licence notices in one `<p>`. When this guard was written that
 * `<p>` was absolutely positioned over the map and HAD to be one element — a second `<p>`
 * would have landed on top of the first. No surface is forced into it any more: design tour A1
 * moved the game's credit into normal flow, the tool pages followed, and `/turkiye` did too
 * (`FU-TURKIYE-ATIF-ORTUSU` → DEC 2026-08-21d md.2). All three keep one `<p>` because the two
 * notices are ONE credit for ONE water layer, not because the layout forces it — which is why
 * this guard reads the same on all three rows and is indifferent to placement. Split by a
 * `<br>`, the notices were a SINGLE text run: `textContent` read "…ODbLMevsimlik göl
 * sınırları:…", welding the OSM/ODbL credit to the JRC one.
 *
 * Replacing the `<br>` with two `display: block` spans looked like the fix and was not —
 * measured on the running build, `textContent` still concatenated, because it ignores layout
 * entirely. What actually separates the runs is the **whitespace expression between the two
 * spans**, and that is a bare `{" "}`: the smallest, most deletable-looking token in the file,
 * guarding a licence-attribution property. It renders nothing (whitespace between two
 * block-level boxes is collapsed away), so nothing on screen would change if it disappeared.
 *
 * This test is the tripwire. It reads the source rather than rendering, because the components
 * are async server components that reach for `getTranslations`, and the repo's vitest
 * environment is node with no jsdom — the same reason
 * `lib/climate/attribution-notice.test.ts` asserts its licence block by source read.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts the separator exists between the two
 * lines, never what the notices say.
 *
 * ## Why it guards a LIST of files
 *
 * The fix above landed on `turkey-map-section.tsx` and this test was written to watch exactly
 * that one file. The game map carries its own copy of the same two-notice markup in its own
 * component (`components/game/game-map.tsx` — a deliberately separate surface, see its
 * docblock), and that copy never got the `{" "}`: measured on the running build,
 * `/oyun/81-il` served `ODbL</span><span …>Mevsimlik` while `/turkiye` served
 * `ODbL</span> <span …>Mevsimlik`. A guard that covers one of two identical surfaces reports
 * the wrong thing about the other, so the case list below is what the test iterates — adding
 * a stacked-notice surface means adding a row, not writing a second file.
 *
 * `components/tools/tool-map.tsx` is the third row (→ PR #73 review `TEST73-I2`), and it is
 * the one where the defect travels furthest: `components/tools/tool-png.ts` bakes the same
 * band into a downloaded PNG that leaves the site with it (SPEC §9.3).
 *
 * THE PATTERNS BELOW NAME NO IMPORT IDENTIFIER. The first two surfaces import their stylesheet
 * as `styles`; the tool map imports the shared map sheet as `mapStyles`, so a row added under a
 * `styles.`-hardcoded pattern would have failed on a correct file. The identifier is matched as
 * a local binding name, which is the part of the expression that is genuinely free.
 *
 * `turkey-map-section.tsx` GAINED A THIRD `.attributionLine` (turkiye-yenileme PR-B, plan
 * §5.7 recommendation 1): the widened map now draws Natural Earth country boundaries as its
 * geographic context, so it reuses `WorldMap.attribution`'s exact bytes as a third block span
 * in the same credit paragraph — three notices now, still one `<p>`. Its row below carries an
 * explicit `lineCount: 3` rather than silently inheriting the other two rows' `2`, which is
 * why `describe.each` reads `lineCount` per row instead of a single module-level constant.
 */

/** Every component that stacks two-or-more licence notices in one `<p>`, and how many. */
const CASES = [
  {
    name: "turkey-map-section.tsx",
    url: new URL("./turkey-map-section.tsx", import.meta.url),
    lineCount: 3,
  },
  { name: "game-map.tsx", url: new URL("../game/game-map.tsx", import.meta.url), lineCount: 2 },
  { name: "tool-map.tsx", url: new URL("../tools/tool-map.tsx", import.meta.url), lineCount: 2 },
] as const;

/** `{styles.attributionLine}` / `{mapStyles.attributionLine}` — any local module binding. */
const ATTRIBUTION_LINE_CLASS = String.raw`\{[A-Za-z_$][\w$]*\.attributionLine\}`;

/**
 * The component's source with every COMMENT removed — and that is not a detail.
 *
 * Both files document at length why the `<br>` had to go, so a naive scan of the raw text finds
 * "`<br>`" in the prose and fails a passing build (which is exactly what happened on the first
 * CI run of this file). The inverse is the more dangerous version of the same bug: a scan that
 * counts the `{" "}` mentioned in a comment would report the separator present after someone
 * deleted the real one — and `game-map.tsx`'s comment names the token explicitly, so this is
 * not a hypothetical.
 *
 * Both assertions therefore run against CODE ONLY. Block comments go first, so the `//` inside
 * any URL they contain is gone before line comments are stripped.
 */
function codeOnly(url: URL): string {
  return readFileSync(url, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

describe.each(CASES)("map attribution text-run separation — $name", ({ url, lineCount }) => {
  const source = codeOnly(url);

  it("keeps an explicit whitespace expression between EVERY pair of attribution lines", () => {
    // Matches `</span>{" "}` followed by the NEXT `.attributionLine` span, tolerating the line
    // breaks Prettier may introduce around it. Counted rather than merely `.test()`-ed, so a
    // 3-line surface (turkey-map-section.tsx, turkiye-yenileme PR-B) proves BOTH separators —
    // one `.test()` call would already pass on the FIRST pair alone and say nothing about
    // whether the second line-to-line join re-welds two runs the same way the original `<br>`
    // defect did.
    const separatorPattern = new RegExp(
      String.raw`</span>\s*\{" "\}\s*<span className=${ATTRIBUTION_LINE_CLASS}>`,
      "g",
    );
    const separatorCount = source.match(separatorPattern)?.length ?? 0;

    expect(
      separatorCount,
      'Every `{" "}` between consecutive `.attributionLine` spans is load-bearing: without it ' +
        '`textContent` re-welds adjacent notices into one run (e.g. "…ODbLMevsimlik…"). It ' +
        "renders nothing, so removing it is invisible on screen. See this file's docblock.",
    ).toBe(lineCount - 1);
  });

  it("does not reintroduce a <br> between them", () => {
    // The `<br>` version is what produced the single run in the first place.
    expect(/<br\s*\/?>/.test(source)).toBe(false);
  });

  it("still renders every notice as its own separate block span", () => {
    const lineSpans =
      source.match(new RegExp(String.raw`<span className=${ATTRIBUTION_LINE_CLASS}>`, "g")) ?? [];
    expect(lineSpans).toHaveLength(lineCount);
  });
});
