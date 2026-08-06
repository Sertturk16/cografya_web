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
 * The layers, in the order they must paint: fills, then silhouettes, then lines, then the
 * solved marks.
 *
 * `mark` is I1's "check" variant (→ DEC 2026-08-05g md. 1). It is pinned at the SAME strength
 * as the other three rather than left unguarded because it is a variant: if the owner picks
 * it, its position is load bearing (a tick under the hit layer would be crossed out by the
 * answer's own line); if the owner picks "hatch" instead, this layer and this entry are
 * deleted together (→ Atlas AO-2). What must never happen is the layer surviving with nothing
 * asserting where it sits.
 *
 * NOT the whole paint order of this `<svg>`: `<InlandWaterLayer>` sits ABOVE all three and is
 * pinned in `components/map/inland-water-layer.contract.test.ts`, because that position is the
 * water layer's own contract (it is what makes a mid-lake click score nothing). Do not read
 * the list below as "these are all the children" — it is the twin split and nothing else.
 */
const LAYERS = ["base", "region", "hit", "mark"] as const;

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
  it("declares every layer exactly once, in paint order", () => {
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
    // Neither does the mark layer, and that is a different reason: its marks are keyed by
    // TARGET, so in bölge mode there are seven of them, not eighty-one. `data-plate` there
    // would put the island's twin queries back to "all three layers" AND make the region
    // mode draw eleven ticks for one answer.
    expect(layerBlock("mark")).not.toContain("data-plate");
    expect(layerBlock("mark")).toContain("data-target={targetId}");
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
    // THREE now: the two twin queries plus I1's solved-mark query, which is scoped to its own
    // layer and keyed by target rather than by plate. The count is asserted so that a fourth,
    // unnamed query cannot appear without this file being read.
    const queries = ISLAND.match(/svg\.querySelectorAll\(/g) ?? [];
    expect(queries).toHaveLength(3);
  });

  it("addresses the solved marks by target, inside their own layer", () => {
    expect(ISLAND).toContain(`const MARK_SHAPES = '[data-map-layer="mark"] [data-target]';`);
    // The marks say ONE thing — solved — so they must not be driven by `deriveShapeState`,
    // which also answers `wrong` and `reveal`. A tick that flickers on a wrong click would be
    // telling the player they had just solved the thing they got wrong.
    expect(ISLAND).toMatch(
      /querySelectorAll\(MARK_SHAPES\)[\s\S]{0,500}?solved\.has\(targetId\)[\s\S]{0,200}?setAttribute\("data-state", "correct"\)/,
    );
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
      // A stroke on the base twin is the paint-order defect PR #40 removed. (The hit twin's
      // FILL is no longer forbidden: I1's "hatch" variant deliberately paints a pattern into
      // it — see the solved-mark block below, which pins that rule to its own variant.)
      expect(CSS).not.toMatch(new RegExp(`\\.province\\[data-state="${state}"\\] \\{[^}]*stroke:`));
    }
  });
});

/**
 * REGRESSION SHIELD — I1 / D6: A SOLVED REGION KEEPS ITS COLOUR.
 *
 * The defect this pins is subtle enough that it shipped once and survived a live tour before
 * anyone could name it. The region tints were written `:not([data-state])`, so `correct` —
 * the one permanent state — took the fill with it. Every solved region turned
 * `--game-correct`, and a completed bölge round showed seven regions in ONE green: the mode
 * erased its own lesson at the moment the player finished learning it.
 *
 * Nothing about that is visible in a type check, a lint pass or a screenshot of a round in
 * progress. It is only visible at the END of a round, which is exactly when nobody is looking
 * at the map any more, so it is pinned here instead.
 */
describe("the solved-region tint (I1 / D6)", () => {
  const REGION_TINT =
    /\.stage\[data-game-mode="regions"\]\s*\.province\[data-region="[A-Z_]+"\]([^{]*)\{\s*fill: var\(--region-[a-z-]+\);\s*\}/g;

  it("keeps every region tint out of the way of ONLY the transient states", () => {
    const matches = [...CSS.matchAll(REGION_TINT)];
    // One rule per coğrafi bölge. A missing rule is an untinted region; the count is what
    // makes "every" in this test's name true.
    expect(matches).toHaveLength(7);
    for (const match of matches) {
      const guard = match[1] ?? "";
      // `wrong` and `reveal` are about the CLICK and last a second or two — they replace the
      // area on screen and should. `correct` is about the AREA and is permanent, so it must
      // never appear here.
      expect(guard).toContain(':not([data-state="wrong"])');
      expect(guard).toContain(':not([data-state="reveal"])');
      expect(guard).not.toMatch(/:not\(\[data-state\]\)/);
      expect(guard).not.toContain("correct");
    }
  });

  it("gives solved-ness a second signal that is not the fill", () => {
    // Whichever variant the owner keeps, "solved" must still be SAID somewhere on the map —
    // otherwise removing the green fill from the tint rule would just delete the feedback.
    const hatch =
      /\.stage\[data-solved-mark="hatch"\] \.hitEdge\[data-state="correct"\] \{[^}]*fill: url\(/.test(
        CSS,
      );
    const check =
      /\.markLayer \[data-target\]\[data-state="correct"\] \{[^}]*display: inline;/.test(CSS);
    expect(hatch || check).toBe(true);
  });
});
