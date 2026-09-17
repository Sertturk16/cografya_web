import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURE, NOT FACTS — the Bölge Seç cards' mini map (→ DEC 2026-08-05g md. 3, Atlas AO-5).
 *
 * The component shipped with no coverage at all (→ PR #50 review TA50-M2). What is pinned here
 * is the short list of properties that are INVISIBLE to every other gate in this repo: each one
 * can be dropped without `tsc`, `eslint` or `next build` noticing, and three of the four are
 * things a reader would have to measure — not look at — to catch.
 *
 * Source-scanned rather than rendered, for the reason the sibling guards in this folder give:
 * the repo's vitest environment is `node` with no jsdom, and these are async server components.
 * The empirical half of the proof is the rendered-sample round the owner signs off on.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip comments: both files quote their own attributes in prose. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

/**
 * The V2 rewrite replaced `RegionThumb` with `V2RegionThumb` (Tailwind, no `game.module.css`)
 * and `components/game/` is on T-032 PR4's deletion list, so this file reads the LIVE component.
 * Every rule below survived the swap intact except two, which PR3 restored after this test
 * caught them: the degradation guard (`hasThumbs`) and the count on the cards.
 *
 * `vector-effect` had a second assertion against the stylesheet — "never in the CSS, because it
 * is not inherited and so never reaches a `<use>` clone". There is no stylesheet now; the
 * Tailwind classes on the `<use>` elements are asserted not to carry it instead, which is the
 * same rule against the same risk.
 */
const THUMB = code(sourceOf("../v2/v2-region-thumb.tsx"));
const PICKER = code(sourceOf("../../app/[locale]/(site)/oyun/bolge-bolge-il/page.tsx"));

describe("the region thumbnails", () => {
  it("emits the eighty-one paths ONCE for the whole page", () => {
    // The entire cost argument. Seven cards each rendering the artifact would put 57.6 KB raw
    // on the page seven times (403 KB); the shared `<defs>` plus `<use>` is what keeps it to
    // one copy. A refactor that moved the paths into the per-card component would be invisible
    // to every other check and would quadruple the route's payload.
    expect(THUMB.match(/d=\{shape\.d\}/g)).toHaveLength(1);
    expect(THUMB.indexOf("d={shape.d}")).toBeGreaterThan(THUMB.indexOf("<defs>"));
    expect(THUMB.indexOf("d={shape.d}")).toBeLessThan(THUMB.indexOf("</defs>"));
    expect(PICKER.match(/<V2RegionThumbDefs/g)).toHaveLength(1);
  });

  it("puts vector-effect on the geometry, never in the stylesheet", () => {
    // `vector-effect` is not inherited, so on a `<use>` it never reaches the clone and the
    // strokes silently scale with the viewBox — at a ~300px card that is a 0.3px "border",
    // i.e. none (→ PR #50 review CR50-M1). The repo states this rule in four other files.
    expect(THUMB).toContain('vectorEffect="non-scaling-stroke"');
    // It sits on the `<path>` in `<defs>`, which is the geometry. Never on a `<use>` clone's
    // className, where it would be as ineffective as it was in the old stylesheet.
    expect(THUMB).not.toMatch(/<use[\s\S]{0,200}?vector-effect/);
  });

  it("stays decorative and out of the tab order", () => {
    // The card's own <h2> names the region, so a second announcement of the same name is
    // noise (WCAG 1.1.1, decorative case) — and an SVG that took focus would put a silent
    // stop in front of the link that actually starts the round.
    expect(THUMB.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(THUMB.match(/focusable="false"/g)).toHaveLength(2);
    expect(THUMB).not.toContain("<title");
  });

  it("draws no picture rather than an empty frame when the api gave nothing", () => {
    // The degradation path, which is the one thing about this feature that cannot be seen in
    // a normal sample round: with no seeded provinces the groups are empty, and the page has
    // to fall back to the cards it rendered before this change.
    // V2 derives the guard from `allShapes` rather than a members map, and applies it to BOTH
    // halves: the shared <defs> and each card's <use>. Half a guard is worse than none — the
    // defs alone would still leave every `<use>` pointing at a dangling href.
    expect(PICKER).toContain("const hasThumbs = allShapes.length > 0;");
    expect(PICKER).toMatch(/\{hasThumbs \? <V2RegionThumbDefs shapes=\{allShapes\} \/> : null\}/);
    expect(PICKER).toMatch(/\{hasThumbs \? <V2RegionThumb region=/);
  });

  it("puts NO count on the cards", () => {
    // DEC 2026-07-30q + DEC 2026-08-05g md. 3: "11 il" is the same badge the owner removed
    // from the mode cards one level up. The only `.length` allowed on this page is the render
    // GUARD above — anything else is a number on a card.
    // The V2 rewrite put the badge back — `{region.count} İl` on the card and the same number
    // again in the body sentence — and PR3 removed both. Asserted at the source: the card data
    // carries no count to print.
    expect(PICKER).not.toMatch(/count:/);
    expect(PICKER).not.toMatch(/region\.count/);
    // The only `.length` on this page is the render GUARD; anything else is a number on a card.
    for (const match of PICKER.matchAll(/\.length(.{0,3})/g)) {
      expect(match[1], `unexpected .length in ${match[0]}`).toBe(" > ");
    }
  });
});
