import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

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

/**
 * ONE component now, not three.
 *
 * V1 stacked its licence notices inline in `turkey-map-section.tsx`, `game-map.tsx` and
 * `tool-map.tsx`, so this file named all three and counted their lines. T-032 PR4 deleted them
 * and gave every V2 map surface a single shared `V2MapAttribution` — a stronger position for this
 * rule, because there is now one place to get it wrong instead of three (and, before PR4, eight
 * surfaces with no credit at all).
 *
 * The rule is unchanged and it caught a live regression on the way: the first draft of
 * `V2MapAttribution` separated its lines with a flex `gap-x-2` and no whitespace expression. That
 * looks right on screen and is wrong everywhere else — `textContent` re-welds the runs into
 * "…ODbLMevsimlik göl sınırları:…" for a screen reader, a copy-paste and a crawler alike, which is
 * precisely the `<br>` defect this file was written for, arriving by a new route.
 */
const CASES = [
  {
    name: "v2-map-attribution.tsx",
    url: new URL("./v2-map-attribution.tsx", import.meta.url),
    // Four: OSM boundaries, the JRC inland-water layer, the Natural Earth CONTEXT shapes a map
    // of Türkiye draws around its subject, and the Natural Earth WORLD-country layer. The last
    // is a separate line and not a reuse of `context`, because "Komşu ülke sınırları" is false
    // on a map of the whole world.
    lineCount: 4,
  },
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
 * Both assertions therefore run against CODE ONLY, through the shared scanner: no ordering of
 * two `String.replace` calls gets both a `//` inside a URL and a `/*` inside a line comment right.
 */
function codeOnly(url: URL): string {
  return stripComments(readFileSync(url, "utf8").replace(/\r\n/g, "\n"));
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
    // `}{" "}` — the separator sits between the conditional line blocks, which is exactly where
    // a flex gap would silently replace it. It matches the CLOSING BRACE of a block rather than
    // `)}` specifically: Prettier keeps a one-line block as `{world && <span>…</span>}` and
    // wraps a multi-line one as `…)}`, and which shape a line has is a formatting accident
    // while the separator after it is the rule.
    const separatorPattern = /\}\s*\{" "\}/g;
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
    // One conditional block per source, each its own element: boundaries, the JRC inland-water
    // layer, the Natural Earth context shapes and the Natural Earth world-country layer.
    const lineBlocks = source.match(/\{(?:boundaries|inlandWater|context|world) && \(?/g) ?? [];
    expect(lineBlocks).toHaveLength(lineCount);
  });
});

/**
 * `marine-map.tsx` is DELIBERATELY NOT a `CASES` row above (FEN121-I1, fix round, → plan
 * `pr121-duzeltme-turu` §5.2). Its credit paragraph joins the OSM/ODbL line and the JRC line
 * with a bare `<br />`, not the `.attributionLine`/`{" "}` pattern the shared `describe.each`
 * loop requires — `marine.module.css` declares no `.attributionLine` class at all (that class
 * exists only in `map.module.css`), so folding this surface into `CASES` would need a new CSS
 * rule minted plus a three-block-span rewrite of the whole paragraph: a visible layout change
 * with its own render-sample obligation, not a small test-only change. That `<br />` itself is
 * `FEN121-PE1`, out of scope for this fix round and not reopened here.
 *
 * What FEN121-I1 actually needed — closed here, by a different remedy (Option C, plan §5.2):
 * a reader could read the bare OSM/ODbL credit as covering the WHOLE map, when the map also
 * draws Natural-Earth-sourced neighbouring-country context the OSM credit never licensed. The
 * fix scopes the OSM line's own claim with a new, `/deniz`-only label
 * (`Map.attributionProvinceLabel`, "İl sınırları:" / "Province boundaries:") rather than adding
 * a third line — mirroring the JRC line's own already-established scoping pattern in the same
 * paragraph. This guard is deliberately narrow: it watches the one thing that regresses the
 * fix (the scope label silently dropping back to a bare, unscoped credit), not the whole
 * paragraph's markup.
 */
describe("the OSM/ODbL credit line carries its own scope label (FEN121-I1)", () => {
  const source = codeOnly(new URL("./v2-map-attribution.tsx", import.meta.url));
  const SCOPED = /\(inlandWater \|\| context \|\| world\) &&[\s\S]{0,60}attributionProvinceLabel/;

  it("labels the boundary credit whenever another scoped line stands beside it", () => {
    // A bare "© OpenStreetMap katkıcıları, ODbL" next to "Mevsimlik göl sınırları: …" reads as
    // covering the lakes too — it claims OSM as the source of JRC and Natural Earth geometry.
    expect(source).toMatch(SCOPED);
  });

  it("positive control: the pre-fix, unscoped shape fails the pattern above", () => {
    expect(SCOPED.test('{t("attribution")}')).toBe(false);
  });
});
