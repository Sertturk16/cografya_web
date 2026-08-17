import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The map attribution's TEXT-RUN SEPARATION (UX tour B26, → PR #47 review CR-S2).
 *
 * ## What broke, and why the obvious fix was not one
 *
 * The Türkiye map stacks two licence notices in one `<p>`. On that surface the `<p>` is
 * absolutely positioned over the map, so it HAS to be one element — a second `<p>` would land
 * on top of the first. (On the game surface it no longer has to be: design tour A1 moved that
 * credit out of the stage into normal flow. It stays one `<p>` there because the two notices
 * are one credit, not because the layout forces it.) Split by a `<br>`, the notices were a
 * SINGLE text run: `textContent` read "…ODbLMevsimlik göl sınırları:…", welding the OSM/ODbL
 * credit to the JRC one.
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
 * ## Why it now guards TWO files
 *
 * The fix above landed on `turkey-map-section.tsx` and this test was written to watch exactly
 * that one file. The game map carries its own copy of the same two-notice markup in its own
 * component (`components/game/game-map.tsx` — a deliberately separate surface, see its
 * docblock), and that copy never got the `{" "}`: measured on the running build,
 * `/oyun/81-il` served `ODbL</span><span …>Mevsimlik` while `/turkiye` served
 * `ODbL</span> <span …>Mevsimlik`. A guard that covers one of two identical surfaces reports
 * the wrong thing about the other, so the case list below is what the test iterates — adding
 * a third stacked-notice surface means adding a row, not writing a second file.
 */

/** Every component that stacks the two licence notices in one `<p>`. */
const CASES = [
  { name: "turkey-map-section.tsx", url: new URL("./turkey-map-section.tsx", import.meta.url) },
  { name: "game-map.tsx", url: new URL("../game/game-map.tsx", import.meta.url) },
] as const;

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

describe.each(CASES)("map attribution text-run separation — $name", ({ url }) => {
  const source = codeOnly(url);

  it("keeps an explicit whitespace expression between the two attribution lines", () => {
    // Matches `</span>{" "}` followed by the second `.attributionLine` span, tolerating the
    // line breaks Prettier may introduce around it.
    const separated = /<\/span>\s*\{" "\}\s*<span className=\{styles\.attributionLine\}>/.test(
      source,
    );

    expect(
      separated,
      'The `{" "}` between the two `.attributionLine` spans is load-bearing: without it ' +
        '`textContent` re-welds the ODbL and JRC notices into "…ODbLMevsimlik…". It renders ' +
        "nothing, so removing it is invisible on screen. See this file's docblock.",
    ).toBe(true);
  });

  it("does not reintroduce a <br> between them", () => {
    // The `<br>` version is what produced the single run in the first place.
    expect(/<br\s*\/?>/.test(source)).toBe(false);
  });

  it("still renders both notices as separate block spans", () => {
    const lineSpans = source.match(/<span className=\{styles\.attributionLine\}>/g) ?? [];
    expect(lineSpans).toHaveLength(2);
  });
});
