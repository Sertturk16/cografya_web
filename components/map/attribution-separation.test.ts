import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The map attribution's TEXT-RUN SEPARATION (UX tour B26, → PR #47 review CR-S2).
 *
 * ## What broke, and why the obvious fix was not one
 *
 * The Türkiye map stacks two licence notices in one absolutely-positioned `<p>` (it has to be
 * one element — a second `<p>` would land on top of the first). Split by a `<br>`, they were a
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
 * This test is the tripwire. It reads the source rather than rendering, because the component
 * is an async server component that reaches for `getTranslations`, and the repo's vitest
 * environment is node with no jsdom — the same reason
 * `lib/climate/attribution-notice.test.ts` asserts its licence block by source read.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts the separator exists between the two
 * lines, never what the notices say.
 */

/**
 * The component's source with every COMMENT removed — and that is not a detail.
 *
 * The file documents at length why the `<br>` had to go, so a naive scan of the raw text finds
 * "`<br>`" in the prose and fails a passing build (which is exactly what happened on the first
 * CI run of this file). The inverse is the more dangerous version of the same bug: a scan that
 * counts the `{" "}` mentioned in a comment would report the separator present after someone
 * deleted the real one.
 *
 * Both assertions therefore run against CODE ONLY. Block comments go first, so the `//` inside
 * any URL they contain is gone before line comments are stripped.
 */
const source = readFileSync(new URL("./turkey-map-section.tsx", import.meta.url), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^[ \t]*\/\/.*$/gm, " ");

describe("map attribution text-run separation", () => {
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
