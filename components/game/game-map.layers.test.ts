import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURE, NOT FACTS — "one plaka kodu, two painted twins, one tab stop per ANSWERABLE
 * shape" (an unseeded plate is backdrop: it gets no hit twin and therefore no tab stop).
 *
 * The game map draws each province ONCE (a classless `<path>` in `<defs>`) and paints it
 * through `<use>` twins: the base layer carries the fill, the hit layer carries every line
 * and every control attribute (`game-map.tsx`). That split is what fixed the owner's
 * complaint — a hovered province's border being thick on one side and a hairline on the
 * other, because neighbours painted after it ate the inner half.
 *
 * It also introduces one specific, silent way to break the page: `data-plate` now appears
 * TWICE per province, so an unscoped `svg.querySelectorAll("[data-plate]")` returns 162
 * elements where it used to return 81. The island has two such loops and they need
 * DIFFERENT halves of that — `role`/`tabindex`/`aria-label` on the hit twin ONLY (or the tab
 * order doubles and every province is announced twice), `data-state` on BOTH (or an answer
 * renders its fill without its line, or its line without its fill). Neither mistake produces
 * a type error, a lint error or a build failure; the only symptom of the first is 162 tab
 * stops, which nobody counts by hand twice.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. The repo's vitest environment is `node` with no
 * jsdom, `GameMap` is an async Server Component that reaches the api, and `GameIsland` is a
 * client island that drives real DOM attributes — rendering either would mean standing up a
 * harness this PR does not own. `game-map.nav-guard.test.ts` established the source-scan
 * pattern in this folder for exactly this situation, and the empirical half of the proof is
 * the rendered-sample and curl pass every PR on this surface runs anyway.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip comments before scanning. Both files are heavily annotated and their prose quotes the
 * very selectors and attributes asserted below, so an unstripped scan would pass on a rule
 * that exists only in a note (the sibling guards in this folder strip for the same reason).
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const MAP = code(sourceOf("./game-map.tsx"));
const ISLAND = code(sourceOf("./game-island.tsx"));
const CSS = code(sourceOf("./game-map.module.css")).replace(/\s+/g, " ");

/**
 * The three layers, in the order they must paint: fills, then silhouettes, then lines.
 *
 * NOT the whole paint order of this `<svg>`: `<InlandWaterLayer>` sits ABOVE all three and is
 * pinned in `components/map/inland-water-layer.contract.test.ts`, because that position is the
 * water layer's own contract (it is what makes a mid-lake click score nothing). Do not read
 * the list below as "these are all the children" — it is the twin split and nothing else.
 */
const LAYERS = ["base", "region", "hit"] as const;

/**
 * The source of ONE layer group: from its marker attribute up to the next one (the last block
 * runs to the end of the FILE, which today is the end of the render plus the water call).
 * Positional, because the invariants being pinned are positional — which attributes live in
 * which layer is the whole point.
 */
function layerBlock(name: (typeof LAYERS)[number]): string {
  const start = MAP.indexOf(`data-map-layer="${name}"`);
  expect(start).toBeGreaterThan(-1);
  const rest = MAP.slice(start);
  const next = rest.indexOf('data-map-layer="', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("the game map's paint layers", () => {
  it("declares the three layers exactly once each, in paint order", () => {
    let previous = -1;
    for (const layer of LAYERS) {
      const occurrences = MAP.match(new RegExp(`data-map-layer="${layer}"`, "g")) ?? [];
      expect(occurrences).toHaveLength(1);
      const at = MAP.indexOf(`data-map-layer="${layer}"`);
      // Order is not cosmetic: SVG has no z-index, so "above" means "later in the document".
      // Silhouettes over the fills (an outline under them would show only its outward half),
      // lines over both.
      expect(at).toBeGreaterThan(previous);
      previous = at;
    }
  });

  it("emits the path geometry once, and only inside <defs>", () => {
    // The whole economy of the design: three layers, one copy of the `d`. Emitting it again
    // would triple the page's largest payload and is the regression this pins.
    expect(MAP.match(/d=\{shape\.d\}/g)).toHaveLength(1);
    expect(MAP.indexOf("d={shape.d}")).toBeLessThan(MAP.indexOf("</defs>"));
    expect(MAP.indexOf("d={shape.d}")).toBeGreaterThan(MAP.indexOf("<defs>"));
  });

  it("puts vector-effect on the geometry, never in the stylesheet", () => {
    // `vector-effect` is NOT an inherited property, so a `<use>` clone cannot pick it up from
    // the `<use>` element. Declared in CSS it silently does nothing and every border thickens
    // with zoom (measured: a 1px border became a ~12px band at 12×).
    expect(MAP).toContain('vectorEffect="non-scaling-stroke"');
    expect(CSS).not.toContain("vector-effect");
  });

  it("carries the plaka kodu on both painted twins and on neither silhouette", () => {
    expect(layerBlock("base")).toContain("data-plate={shape.plateCode}");
    expect(layerBlock("hit")).toContain("data-plate={shape.plateCode}");
    // The silhouette layer re-uses the same geometry a third time. If it ever carried
    // `data-plate`, the island's "both twins" query would silently become "all three".
    expect(layerBlock("region")).not.toContain("data-plate");
  });

  it("gives only ANSWERABLE shapes a hit twin", () => {
    // `shape.target` is the seeded/unseeded discriminator. An unseeded plate is backdrop: it
    // can never be a question or an answer, so it must not be a tab stop or a click target.
    expect(layerBlock("hit")).toMatch(/shapes\.map\(\(shape\) =>\s*shape\.target \?/);
    expect(layerBlock("base")).toContain("shape.target ? styles.province : styles.provinceInert");
  });
});

/**
 * REGRESSION SHIELD — the bölge-mode water exception (owner live tour, 2026-08-05, #5).
 *
 * Two halves, each invisible on its own if the other is deleted, and both silent:
 *
 *   1. the game's own `<g className={styles.waterHost}>` around the shared layer. Remove it
 *      as "a pointless wrapper" and the CSS rule below matches nothing — clicking a lake in
 *      bölge mode goes back to doing nothing at all, with no test failing;
 *   2. `data-game-mode`, SERVER-rendered on the stage. It used to be written by the island
 *      after mount; the rule needs it in the first response, and the region tints need it
 *      at all. Delete the attribute and the whole bölge mode renders untinted.
 *
 * The scope is asserted too: the exception must stay pinned to `regions`. Unscoped, it would
 * invert DEC 2026-08-02k md. 5 for the two il modes — a mid-lake click would answer the
 * question there, which is exactly what the owner did NOT ask for.
 */
describe("the bölge mode's transparent water", () => {
  it("wraps the shared layer in a game-owned host element", () => {
    expect(MAP).toContain("<g className={styles.waterHost}>");
    // The wrapper is the game's; the shared layer keeps its own clip and its own group.
    expect(MAP.indexOf("styles.waterHost")).toBeLessThan(MAP.indexOf("<InlandWaterLayer"));
  });

  it("server-renders the mode on the stage", () => {
    expect(MAP).toContain("data-game-mode={mode}");
    // The island must not write it a second time: two writers, one attribute, no way to tell
    // which one is stale.
    expect(ISLAND).not.toContain("dataset.gameMode");
  });

  it("lifts pointer events off the water ONLY in the region mode", () => {
    // `> *`, not the wrapper itself. The shared layer declares `pointer-events: auto` on its
    // own group, and an INHERITED `none` loses to it — the first version of this rule sat on
    // the wrapper, passed every check, and changed nothing on screen. Only the rendered
    // sample caught it, so the shape of the selector is pinned here.
    expect(CSS).toMatch(
      /\.stage\[data-game-mode="regions"\] \.waterHost > \* \{[^}]*pointer-events: none;/,
    );
    // No unscoped escape hatch: every `.waterHost` rule that disables pointer events has to
    // name the mode it applies to, or the two il modes lose DEC 2026-08-02k md. 5.
    const unscoped = CSS.match(/(^|})[^{}]*\.waterHost[^{}]*\{[^}]*pointer-events: none;/g) ?? [];
    for (const rule of unscoped) {
      expect(rule).toContain('data-game-mode="regions"');
    }
  });
});

describe("the game island's two shape queries", () => {
  it("scopes the control attributes to the hit layer alone", () => {
    expect(ISLAND).toContain(`const HIT_SHAPES = '[data-map-layer="hit"] [data-plate]';`);
    // The 162-tab-stop defect, pinned: role/tabindex/aria-label must be written inside the
    // HIT_SHAPES loop and nowhere else.
    expect(ISLAND).toMatch(
      /querySelectorAll\(HIT_SHAPES\)[\s\S]{0,900}?shape\.setAttribute\("tabindex", "0"\)/,
    );
    expect(ISLAND).not.toMatch(
      /querySelectorAll\(PAINTED_SHAPES\)[\s\S]{0,900}?setAttribute\("tabindex"/,
    );
  });

  it("writes the answer state to BOTH painted twins", () => {
    expect(ISLAND).toContain(`'[data-map-layer="base"] [data-plate], [data-map-layer="hit"]`);
    // The fill lives on the base twin and the line on the hit twin, so a single-twin write
    // renders every answer half-way.
    expect(ISLAND).toMatch(
      /querySelectorAll\(PAINTED_SHAPES\)[\s\S]{0,600}?shape\.setAttribute\("data-state", state\)/,
    );
  });

  it("leaves no unscoped shape query behind", () => {
    // The regression this whole file exists for: an unscoped query returns both twins, which
    // is right for exactly one of the two loops and wrong for the other.
    expect(ISLAND).not.toMatch(/querySelectorAll\(\s*["'`]\[data-plate\]/);
    const queries = ISLAND.match(/svg\.querySelectorAll\(/g) ?? [];
    expect(queries).toHaveLength(2);
  });
});

describe("the stylesheet's half of the split", () => {
  it("makes the base layer inert and the hit layer hittable", () => {
    expect(CSS).toMatch(/\.mapBase \{[^}]*pointer-events: none;/);
    expect(CSS).toMatch(/\.hitEdge \{[^}]*pointer-events: all;/);
    expect(CSS).toMatch(/\.hitEdge \{[^}]*fill: none;/);
    expect(CSS).toMatch(/\.hitEdge \{[^}]*stroke: none;/);
  });

  it("paints each answer state's fill on the base twin and its line on the hit twin", () => {
    for (const state of ["correct", "wrong", "reveal"]) {
      expect(CSS).toMatch(
        new RegExp(`\\.province\\[data-state="${state}"\\] \\{[^}]*fill: var\\(`),
      );
      expect(CSS).toMatch(
        new RegExp(`\\.hitEdge\\[data-state="${state}"\\] \\{[^}]*stroke: var\\(`),
      );
      // A fill on the hit twin would wash out the state colour underneath it; a stroke on the
      // base twin is the paint-order defect this PR removed.
      expect(CSS).not.toMatch(new RegExp(`\\.province\\[data-state="${state}"\\] \\{[^}]*stroke:`));
    }
  });
});
