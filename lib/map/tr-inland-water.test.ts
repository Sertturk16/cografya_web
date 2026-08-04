import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INLAND_WATER_SHAPES } from "./tr-inland-water.generated";
import { MAP_VIEWBOX } from "./tr-provinces.generated";

/**
 * Structural invariants of the generated TR inland-water geometry.
 *
 * These assert SHAPE, not FACTS. No lake name, no area figure and no body count sourced from
 * the data is written down here: whether Van Gölü is 3 571 km² is a source-data question the
 * ODbL snapshot answers, and hard-coding it would turn a cartography decision into a test
 * failure. What a test can own is the set of rules a future regeneration, retuning or
 * threshold change could silently break.
 *
 * The rule this file exists for above all others is **CO-REGISTRATION**. The water layer and
 * the province layer are two independent artifacts, produced by two generators, from two
 * snapshots, and they are drawn into ONE `<svg>` on four different surfaces. Nothing about
 * that arrangement is self-correcting: if the shared frame ever moves under one of them, the
 * lakes slide off their shores and every page still renders, still passes typecheck, and
 * still looks like a map. The frame is pinned in `scripts/lib/tr-frame.mjs` for that reason,
 * and the assertion below is the runtime half of the pin — it reads the province artifact's
 * own `MAP_VIEWBOX` rather than a literal, so the two cannot be updated apart.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT COVER. That the layer is painted LAST (which is what
 * hides the boundary across a lake and what makes a mid-lake click inert) is a DOM ordering
 * property, and the repo runs a single `node` vitest environment with no jsdom — the same
 * constraint `world-shapes.test.ts` and `game-map.nav-guard.test.ts` document. The source
 * contract for it is pinned in `components/map/inland-water-layer.contract.test.ts`, and the
 * empirical proof is the PR's rendered samples, including a mid-lake click that leaves the
 * URL unchanged.
 */

type Point = readonly [number, number];

/**
 * Parse the `M`/`m`/`l`/`Z` subset the generator emits into absolute subpaths. Deliberately
 * strict: it THROWS on any other command, which is what makes the "still relatively encoded"
 * assertion below meaningful rather than decorative.
 */
function toSubpaths(d: string): Point[][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const subpaths: Point[][] = [];
  let current: Point[] | null = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command: string | null = null;
  let i = 0;
  const next = (): number => {
    const raw = tokens[i++];
    const value = raw === undefined ? Number.NaN : Number.parseFloat(raw);
    if (Number.isNaN(value)) throw new Error(`Expected a number at token ${i - 1}`);
    return value;
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (token !== undefined && /[A-Za-z]/.test(token)) {
      command = token;
      i++;
    }
    if (command === "Z") {
      x = startX;
      y = startY;
      command = null;
      continue;
    }
    if (command === "M" || command === "m") {
      const a = next();
      const b = next();
      x = command === "M" ? a : x + a;
      y = command === "M" ? b : y + b;
      startX = x;
      startY = y;
      current = [[x, y]];
      subpaths.push(current);
      command = "l";
      continue;
    }
    if (command === "l") {
      x += next();
      y += next();
      current?.push([x, y]);
      continue;
    }
    throw new Error(`Unsupported path command "${command}" in inland-water geometry`);
  }
  return subpaths;
}

/** `[id, areaKm2]` for every feature of a snapshot, keyed by whichever id field it uses. */
function readAreas(relative: string, idField: "osmId" | "id"): [string, number][] {
  const collection: unknown = JSON.parse(
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"),
  );
  const features = (collection as { features?: unknown[] }).features ?? [];
  return features
    .map((feature) => (feature as { properties?: Record<string, unknown> }).properties ?? {})
    .map((properties): [string, number] => [
      String(properties[idField]),
      Number(properties.areaKm2 ?? 0),
    ])
    .filter(([id]) => id !== "undefined");
}

const VIEWBOX = MAP_VIEWBOX.split(" ").map(Number);
const VIEW_WIDTH = VIEWBOX[2] ?? Number.NaN;
const VIEW_HEIGHT = VIEWBOX[3] ?? Number.NaN;

/**
 * Slack on the VIEWBOX-containment check below — which, read literally, is all this guards.
 *
 * The comparison is against the province artifact's own `MAP_VIEWBOX`, so the effective slack
 * is `padding + tolerance = 6 + 1.5 = 7.5 units` (~12.6 km): the landmass only spans
 * `[6, 994] × [6, 422.9]` inside a `[0, 1000] × [0, 429]` box. That is deliberate and it is a
 * CO-REGISTRATION detector, not a shoreline check — its job is to fail loudly if the two
 * artifacts ever stop sharing a coordinate space, and a frame drift is measured in tens of
 * units, not tenths. Measured on the committed artifact: overshoot is **0.000** against the
 * viewBox and **0.000** against the province artifact's own bounding box.
 *
 * How far a lagoon reaches past the simplified COASTLINE is a different quantity — point
 * against polygon, not point against box — and neither this test nor the generator computes
 * it, because P6 never reads province geometry (→ DEC 2026-08-02k md. 1). It is measured by
 * hand from the rendered samples. Do not report the two under one name (PR #39 review
 * `cr-frame-tolerance-semantics`). Mirrors the generator's own `FRAME_TOLERANCE`.
 */
const FRAME_TOLERANCE = 1.5;

/**
 * How many bodies the artifact must contain.
 *
 * A COUNT, not a fact: it says nothing about what any lake is or how big it is, only that
 * regenerating did not silently change what the map draws. Without it the only assertion was
 * `length > 0`, so a source refresh or a stray env override could halve the layer and every
 * test would stay green (PR #39 review T4). `world-shapes.test.ts`'s `HOLE_CENSUS` is the
 * same instrument.
 *
 * 51 = the OSM bodies at the owner-ruled 30 km² rung (S1, 2026-08-02), minus the one held back
 * as a duplicate (`DRAWN_DUPLICATES`, → DEC 2026-08-02q md. A), minus the six replaced by a JRC
 * body, plus the eight JRC bodies (→ DEC 2026-08-02q §D, DEC 2026-08-03c). The cross-check
 * below is what ties the number to those rulings rather than leaving it a magic constant to be
 * bumped whenever it goes red.
 *
 * It was 52 until the sample gate ruled Acıgöl out (→ DEC 2026-08-04h) — a ninth JRC body whose
 * GSW basin measured 3.7× the published figure. Note what did NOT happen: the OSM Acıgöl record
 * is 18.6 km², under the rung, so the drawn set lost exactly one row and no lake left the map.
 */
const EXPECTED_BODY_COUNT = 51;

/** The owner-ruled drawing threshold in km² — mirrors `MIN_AREA_KM2` in the generator. */
const MIN_AREA_KM2 = 30;

/**
 * Bodies present in the snapshot and above the threshold that the generator deliberately does
 * NOT draw — mirrors `DRAWN_DUPLICATES` in `scripts/generate-tr-inland-water.mjs`, the same
 * way `MIN_AREA_KM2` above mirrors its threshold.
 *
 * `r7336746` "Hoyran Gölü" is 99.94 % inside `r1410914` "Eğirdir Gölü": OSM's Eğirdir relation
 * already covers that lobe, so drawing both painted ~138 km² of water twice and, because the
 * two bodies simplify at different tolerances, drew the shared shoreline twice a fraction of a
 * unit apart. The snapshot keeps the feature — it is a real OSM object and the file is the
 * faithful record of the sweep — so this is a DRAWING rule, and the test has to know it or the
 * id-set equality below would be asserting a rule the generator does not implement.
 */
const NOT_DRAWN: ReadonlySet<string> = new Set(["r7336746"]);

/**
 * OSM records the JRC water class replaces — mirrors `SUPERSEDED_BY_JRC` in
 * `scripts/generate-tr-inland-water.mjs`, the same way `MIN_AREA_KM2` mirrors its threshold.
 *
 * The seasonal and salt lakes are drawn from JRC Global Surface Water instead of OSM, because a
 * body that fills and dries is described by a 41-year occurrence statistic and not by the single
 * satellite moment an OSM outline freezes (→ DEC 2026-08-02q §D). The ODbL snapshot KEEPS these
 * features — it is the faithful record of its own sweep — so this is a DRAWING rule, and the
 * id-set equality below has to know it.
 *
 * Only SIX appear here rather than the eight JRC bodies: Seyfe sits below the rung on the OSM
 * side (21.8 km²) so it was never drawn, and Yay Gölü has no OSM counterpart at all. Listing
 * only what is actually superseded AND drawn is what lets the arithmetic below stay a
 * derivation instead of a fudge.
 */
const SUPERSEDED_BY_JRC: ReadonlySet<string> = new Set([
  "r2411676",
  "r16862988",
  "r2385434",
  "r17069201",
  "r1761470",
  "r17083287",
]);

describe("the generated inland-water artifact", () => {
  it("draws exactly the pinned number of bodies", () => {
    // A threshold typo (`300` for `30`) would empty the layer, and an empty `<g>` renders
    // perfectly happily. The generator throws on this too; this is the artifact-side pin.
    expect(INLAND_WATER_SHAPES.length).toBe(EXPECTED_BODY_COUNT);
  });

  it("draws exactly the two snapshots' bodies that clear the ruled threshold, and no others", () => {
    // WHY the count is what it is, so a future red does not get "fixed" by editing the
    // number. The rung is an owner ruling; this asserts the artifact is its faithful image.
    //
    // Deliberately an ID-SET equality rather than the tier split that was suggested: the
    // artifact carries no area and no tier (DEC 2026-08-01r-4), so a tier assertion would
    // have to re-implement the generator's own tier function inside the test — a copy that
    // can drift. Pinning WHICH bodies are drawn subsumes pinning how many fall in each band.
    //
    // The rung is applied PER SOURCE (→ DEC 2026-08-03c, Q9): each body is measured against
    // the area its OWN source measured, because the whole point of the hybrid is that the two
    // sources answer "how big is this lake" differently for a body that fills and dries.
    const osmEligible = readAreas("../../data/tr-inland-water.geojson", "osmId")
      .filter(([, areaKm2]) => areaKm2 >= MIN_AREA_KM2)
      .map(([id]) => id);
    const jrcEligible = readAreas("../../data/tr-inland-water-jrc.geojson", "id")
      .filter(([, areaKm2]) => areaKm2 >= MIN_AREA_KM2)
      .map(([id]) => id);

    const expected = [
      ...osmEligible.filter((id) => !NOT_DRAWN.has(id) && !SUPERSEDED_BY_JRC.has(id)),
      ...jrcEligible,
    ];

    // Each exclusion is asserted to still be EXACTLY as large as it claims to be, so a
    // snapshot refresh that drops one of its targets turns this red instead of silently
    // making the exclusion a no-op.
    expect(osmEligible.filter((id) => NOT_DRAWN.has(id))).toHaveLength(NOT_DRAWN.size);
    expect(osmEligible.filter((id) => SUPERSEDED_BY_JRC.has(id))).toHaveLength(
      SUPERSEDED_BY_JRC.size,
    );
    expect(expected).toHaveLength(EXPECTED_BODY_COUNT);
    expect([...INLAND_WATER_SHAPES.map((shape) => shape.id)].sort()).toEqual([...expected].sort());
  });

  it("keys every body with a unique, stable OSM id", () => {
    const ids = INLAND_WATER_SHAPES.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(ids.length);
    // OSM keys or JRC keys — the artifact is fed by two snapshots (→ DEC 2026-08-03c, Q8).
    for (const id of ids) expect(id).toMatch(/^([rw]\d+|gsw-\d{2})$/);
  });

  it("emits no name, area or other prose in the artifact", () => {
    // DEC 2026-08-01r-4: no measured or published figure leaves the generator. The artifact
    // is geometry plus a key — a shape with a second data field is the first step back
    // toward publishing "Van Gölü, 3 571 km²" off a number nobody verified.
    for (const shape of INLAND_WATER_SHAPES) {
      expect(Object.keys(shape).sort()).toEqual(["d", "id"]);
    }
  });

  it("emits non-empty, closed, relatively encoded path data", () => {
    for (const shape of INLAND_WATER_SHAPES) {
      expect(shape.d.startsWith("M")).toBe(true);
      expect(shape.d.endsWith("Z")).toBe(true);
      // Exactly one absolute move-to: every later subpath hops relatively from the previous
      // one. A regression to absolute encoding costs ~40 % more bytes for zero benefit.
      expect(shape.d.match(/M/g)).toHaveLength(1);
      expect(() => toSubpaths(shape.d)).not.toThrow();
    }
  });

  it("gives every subpath enough vertices to enclose an area", () => {
    for (const shape of INLAND_WATER_SHAPES) {
      for (const subpath of toSubpaths(shape.d)) {
        expect(subpath.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("places every vertex inside the province artifact's own viewBox", () => {
    // CO-REGISTRATION — the one that matters. Read from `MAP_VIEWBOX`, never a literal.
    for (const shape of INLAND_WATER_SHAPES) {
      for (const subpath of toSubpaths(shape.d)) {
        for (const [x, y] of subpath) {
          expect(x).toBeGreaterThanOrEqual(-FRAME_TOLERANCE);
          expect(x).toBeLessThanOrEqual(VIEW_WIDTH + FRAME_TOLERANCE);
          expect(y).toBeGreaterThanOrEqual(-FRAME_TOLERANCE);
          expect(y).toBeLessThanOrEqual(VIEW_HEIGHT + FRAME_TOLERANCE);
        }
      }
    }
  });

  it("spreads the bodies across the whole country, not one corner", () => {
    // Cheap catastrophe detector: a projection or frame mistake typically collapses every
    // body into a small patch while leaving all the assertions above green. Türkiye is
    // ~988 units wide, so real inland water must span a large fraction of it.
    const xs: number[] = [];
    const ys: number[] = [];
    for (const shape of INLAND_WATER_SHAPES) {
      for (const subpath of toSubpaths(shape.d)) {
        for (const [x, y] of subpath) {
          xs.push(x);
          ys.push(y);
        }
      }
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(VIEW_WIDTH * 0.6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(VIEW_HEIGHT * 0.4);
  });
});
