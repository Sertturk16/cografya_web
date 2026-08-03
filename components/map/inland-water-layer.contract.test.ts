import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "water swallows the click, and is invisible to assistive tech".
 *
 * The owner's ruling (2026-08-02, pinned as DEC 2026-08-02k md. 5) is that clicking a lake
 * must do NOTHING, on every surface: no navigation on `/turkiye`, no answer in the game, no
 * hover card anywhere. What makes that true today is a THREE-PART structural coincidence,
 * and each part is one careless edit away from breaking silently:
 *
 *   1. the game answers only when `event.target.closest("[data-plate]")` matches, and the
 *      water layer emits no `data-plate` — so no attempt is counted and the question's score
 *      is never halved;
 *   2. the hover card opens only when `closest("[data-shape]")` matches, and the water layer
 *      emits no `data-shape` — so the card never opens over a lake;
 *   3. the layer contains no `<a>` and no `href`, so a mid-lake click cannot navigate.
 *
 * Nothing about that is expressed as a type. Add `data-plate` to the water paths "so the
 * layer can be styled per province" and every lake becomes a wrong answer, with no test
 * failing and no visual difference. This file is that missing failure.
 *
 * The mirror image matters too: `pointer-events: none` on the layer would make the click
 * fall THROUGH to the province underneath — navigating to a province the user did not aim
 * at, or scoring an answer they did not give. It looks like a harmless cleanup ("the layer
 * is decorative, so it should not take pointer events") and it inverts the ruling exactly.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. The repo runs a single `node` vitest environment
 * with no jsdom, and the consumers are async Server Components that reach the api — the same
 * constraint `game-map.nav-guard.test.ts` and `world-shapes.test.ts` document. A source
 * invariant is the honest version of the same guard: it runs today, costs nothing, and fails
 * on the exact edit it is meant to stop. It does NOT claim to prove what the DOM ends up
 * looking like; that is the PR's rendered mid-lake-click sample.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip block comments and whole-line `//` comments, so the files' own prose about
 * `data-plate` and `pointer-events` — which they must be free to explain — is not mistaken
 * for code.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const LAYER = code(sourceOf("./inland-water-layer.tsx"));
const STYLES = code(sourceOf("./inland-water.module.css"));

describe("the inland water layer component", () => {
  it("carries no province hit-testing hook", () => {
    // Part 1 + 2 of the ruling. `closest()` walks ANCESTORS, so it is enough that neither
    // the <g> nor the <path> declares these.
    expect(LAYER).not.toMatch(/data-plate/);
    expect(LAYER).not.toMatch(/data-shape/);
  });

  it("renders no link of any kind", () => {
    expect(LAYER).not.toMatch(/<a[\s>]/);
    expect(LAYER).not.toMatch(/<Link[\s>]/);
    expect(LAYER).not.toMatch(/\bhref\b/);
    expect(LAYER).not.toMatch(/xlink:href/);
  });

  it("adds no tab stop and no interactive role", () => {
    // The layer must not change the tab order or the accessible-name tree of any surface it
    // is dropped into — the `<a>` count on `/turkiye` is an SEO surface, not just a11y.
    expect(LAYER).not.toMatch(/tabIndex/);
    expect(LAYER).not.toMatch(/\brole=/);
    expect(LAYER).not.toMatch(/aria-label/);
  });

  it("hides itself from assistive tech", () => {
    expect(LAYER).toMatch(/aria-hidden="true"/);
  });
});

describe("the inland water stylesheet", () => {
  it("never disables pointer events", () => {
    // The inversion guard. `pointer-events: auto` is required; `none` is forbidden.
    expect(STYLES).toMatch(/pointer-events:\s*auto/);
    expect(STYLES).not.toMatch(/pointer-events:\s*none/);
  });

  it("keeps the water fully opaque", () => {
    // The layer's job is to MASK the administrative boundary running across a lake. Any
    // transparency puts that line back on screen as a ghost.
    //
    // ALL THREE spellings, because the two that matter most are the two the stylesheet's own
    // comment forbids BY NAME. The first version of this guard was `/(^|[^-])opacity:/`,
    // whose `[^-]` alternative requires a non-hyphen character immediately before the
    // property — which is exactly what makes `fill-opacity:` and `stroke-opacity:` incapable
    // of matching it. It passed on `opacity: 1` and failed to see `fill-opacity: 0.5`, i.e.
    // it was blind to the softening someone would actually reach for (PR #39 review T1).
    const TRANSPARENCY = /(^|[\s;{])(fill-|stroke-)?opacity\s*:/;
    expect(STYLES).not.toMatch(TRANSPARENCY);
    // Self-check: the pattern must be able to see all three forms, or the assertion above is
    // decorative again. A guard nobody has watched fail is a guard nobody has tested.
    for (const declaration of ["opacity: 1", "  fill-opacity: 0.5", "; stroke-opacity:0.5"]) {
      expect(declaration).toMatch(TRANSPARENCY);
    }
  });

  it("takes its tone from a token, never a literal hex", () => {
    expect(STYLES).toMatch(/fill:\s*var\(--map-water\)/);
    expect(STYLES).toMatch(/stroke:\s*var\(--map-water-line\)/);
    expect(STYLES).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("the surfaces that consume the layer", () => {
  const SURFACES = [
    "../map/turkey-map-section.tsx",
    "../game/game-map.tsx",
    "../marine/marine-map.tsx",
  ] as const;

  /**
   * The subset of those surfaces that paint through the layered `<use>` architecture, i.e.
   * that have something between the province loop and the water. `marine-map.tsx` is
   * deliberately absent: it still draws one flat province layer, so for it "after the
   * shapes" and "after the hit layer" are the same statement.
   */
  const LAYERED_SURFACES = ["../map/turkey-map-section.tsx", "../game/game-map.tsx"] as const;

  it("is rendered by every file that draws the TR frame", () => {
    // THREE files, FOUR surfaces: `game-map.tsx` serves both the full-country round and the
    // region rounds — same component, different viewBox — so the file count and the surface
    // count are deliberately not the same number.
    //
    // `/deniz` is the one that is easy to forget and the one where the omission reads worst:
    // a lake-less Türkiye on the water page (→ DEC 2026-08-02k md. 4).
    expect(SURFACES).toHaveLength(3);
    for (const surface of SURFACES) {
      expect(code(sourceOf(surface))).toMatch(/<InlandWaterLayer[\s/>]/);
    }
  });

  it("clips the layer to the drawn land wherever the surface draws only part of the country", () => {
    // The game's REGION rounds narrow the viewBox to the region's bounding box, and a
    // bounding box is not the region: Keban, Karakaya and Atatürk fall inside Doğu Anadolu's
    // box while lying in provinces the round does not draw, so without a clip they render as
    // blue filaments on empty background. Dropping the clip is a plausible "simplification"
    // that reintroduces exactly that, so it is pinned here.
    const game = code(sourceOf("../game/game-map.tsx"));
    // THE PAYLOAD, not the syntax. Asserting only the shape of the call — that a clip is
    // passed when `isSubset` — is satisfied by `clip={isSubset ? { paths: [], id } : …}`,
    // which is the defect wearing the fix's clothes (PR #39 review T2). What has to be true
    // is that the clip region IS the province set this surface draws, so that is what is
    // matched: the same `shapes` array the `<path>` loop above it consumes.
    expect(game).toMatch(
      /clip=\{\s*isSubset\s*\?\s*\{\s*paths:\s*shapes\.map\(\(shape\)\s*=>\s*shape\.d\)\s*,/,
    );
    expect(game).toMatch(/const isSubset = viewBox !== MAP_VIEWBOX;/);
    // The full-country surfaces must NOT clip: every body in the artifact is Turkish and the
    // whole country is on screen, so a clip there is ~57 kB of markup that changes no pixel.
    for (const surface of ["../map/turkey-map-section.tsx", "../marine/marine-map.tsx"]) {
      expect(code(sourceOf(surface))).not.toMatch(/\bclip=/);
    }
  });

  it("renders it after the province shapes on every surface", () => {
    // Paint order IS the feature: it hides the boundary across a lake and it puts the water
    // above the province links in hit-testing order. A future refactor that hoists the layer
    // to the top of the <svg> would break both at once, invisibly in code review.
    //
    // KEEP READING — since the layered restructure this assertion alone is NOT enough; the
    // one below it is the load-bearing half.
    for (const surface of SURFACES) {
      const source = code(sourceOf(surface));
      const shapes = source.indexOf("PROVINCE_SHAPES.map");
      const gameShapes = source.indexOf("shapes.map");
      const provinces = shapes === -1 ? gameShapes : shapes;
      expect(provinces).toBeGreaterThan(-1);
      expect(source.indexOf("<InlandWaterLayer")).toBeGreaterThan(provinces);
    }
  });

  it("renders it after the HIT layer on every surface that has one", () => {
    // WHY THIS EXISTS, and it is a real hole that was found by review, not a nicety.
    //
    // The assertion above anchors on the FIRST `…SHAPES.map` in the file. When each surface
    // drew its provinces in one loop that first occurrence WAS the paint site, so the probe
    // was tight. The layered restructure emits that same loop three times — `<defs>`, the
    // base layer, the hit layer — and `indexOf` still finds the `<defs>` one. Every position
    // after `<defs>` then satisfies it, INCLUDING water slid between base and hit: the exact
    // edit that silently un-does the owner's ruling (a mid-lake click would land on the hit
    // twin again and navigate on /turkiye or score an answer in the game). The guard was
    // still green while the thing it guards was one line-move from broken.
    //
    // So the anchor here is the layer that actually has to stay UNDER the water:
    // `data-map-layer="hit"`, whose `<use>` carries `pointer-events: all` over the shape's
    // whole interior. Requiring the marker to EXIST (rather than skipping a surface that
    // does not declare it) is deliberate — a rename of the attribute must fail loudly here
    // instead of quietly turning this test back into a no-op.
    for (const surface of LAYERED_SURFACES) {
      const source = code(sourceOf(surface));
      const hit = source.indexOf('data-map-layer="hit"');
      expect(hit).toBeGreaterThan(-1);
      expect(source.indexOf("<InlandWaterLayer")).toBeGreaterThan(hit);
    }
  });
});
