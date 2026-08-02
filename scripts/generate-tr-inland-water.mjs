// @ts-check
/**
 * Build-time generator: TR inland-water GeoJSON → inline SVG `<path>` data.
 *
 * Reads the committed ODbL snapshot `data/tr-inland-water.geojson` (see `data/README.md`
 * and `scripts/fetch-tr-inland-water.mjs`) and emits `lib/map/tr-inland-water.generated.ts`:
 * one simplified path per drawn water body, in the SAME pinned frame as the province
 * outlines (`scripts/lib/tr-frame.mjs`).
 *
 * Run once and COMMIT the output (`pnpm generate:water`). CI/runtime never invoke it; the
 * app imports the committed artifact, and the raw GeoJSON never reaches the client
 * (SPEC §5.2 / DEC 2026-07-10). `pnpm generate:water:check` is the drift gate.
 *
 * ## This generator NEVER reads province geometry
 *
 * Own snapshot, own generator, own artifact, zero coupling (→ DEC 2026-08-02k md. 1). The
 * boundary segments that run across a lake are hidden by PAINT ORDER — water is drawn
 * opaque, after the provinces — not by any geometric intersection. That is also the
 * convention every published Türkiye political map follows.
 *
 * ## What decides whether a body is drawn
 *
 * One number: `MIN_AREA_KM2`, applied to `areaKm2`, which the fetch step measured on the
 * VERBATIM source rings (outer − inner). The owner rules this number from rendered samples
 * at 40 / 30 / 10 km² (the ladder in DEC 2026-08-02k md. 3); the snapshot holds every body
 * down to 10 km² so switching rungs is a regenerate, not a network round trip.
 *
 * NOTHING numeric leaves this file. No area, no name, no tier reaches the artifact, the
 * messages files or any component (→ DEC 2026-08-01r-4): the measurements live in this
 * console report, in the snapshot's own properties and in `data/README.md`. The artifact
 * carries an OSM id purely as a stable React key and traceability handle.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePath } from "./lib/path-encode.mjs";
import { TR_FRAME, TR_VIEWBOX, assertInsideFrame, projectToFrame } from "./lib/tr-frame.mjs";
import { measureRingAreaKm2, simplifyRing } from "./lib/water-geometry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "data", "tr-inland-water.geojson");
const OUT = join(ROOT, "lib", "map", "tr-inland-water.generated.ts");

/**
 * Drawing threshold in km², measured on the source rings.
 *
 * 40 km² is the published-map floor: HGM's 1:2 000 000 political sheet and the international
 * atlas convention both show Sapanca (45 km²) and Marmara Gölü (39 km²), so ~40 is where a
 * reader stops expecting to see a body. The env override exists ONLY to render the owner's
 * threshold-ladder samples; it is never set in CI or in `generate:water:check`, so the
 * committed artifact is deterministic.
 */
const MIN_AREA_KM2 = readThreshold();

/**
 * SIZE-AWARE Douglas–Peucker tolerance: `ε = clamp(β · √areaInUnits², ε_min, ε_max)`,
 * in svg units.
 *
 * ## Why not one constant, the way the province generator does it
 *
 * The provinces are all roughly the same size, so a single tolerance treats them equally.
 * Water bodies span three orders of magnitude — Van Gölü is 1 262 units², Karamık is 14 —
 * and a constant tolerance therefore does something very unequal: √A for the smallest drawn
 * bodies is under 4 units, so a 0.8-unit tolerance is a fifth of their RADIUS and shaves
 * them into polygons. Measured on the real snapshot at ε = 0.8: Salda Gölü loses **26 % of
 * its area**, Boyabat 16 %. That is not a smoothness class, it is a different lake.
 *
 * Scaling the tolerance with the square root of the body's area holds the RELATIVE error
 * roughly constant instead, which is what "the map looks like one drawing" actually means
 * once the subjects differ in size. It also spends bytes where they buy something: the
 * dendritic reservoirs that dominate the vertex count (Keban, Atatürk, Karakaya) are large,
 * so they sit at the coarse end.
 *
 * ## The numbers, and why these numbers
 *
 * Measured on the committed snapshot, 40 km² cut, whole artifact:
 *
 *   constant 0.80  →  11.2 kB · worst body −26.3 %      ← the tolerance DEC 2026-08-02k assumed
 *   constant 0.45  →  17.1 kB · worst body  −8.4 %
 *   constant 0.25  →  28.6 kB · worst body  −7.0 %
 *   ADAPTIVE below →  35.9 kB · worst body  −4.3 %
 *   adaptive β 0.0127 → 45.1 kB · worst body −4.3 %     (no further fidelity for +9 kB)
 *
 * DEC 2026-08-02k md. 2 lifted the ≤20 kB cap and budgeted "~0.8 units, ~35 kB". The byte
 * half of that prediction was based on an estimated 6 500 km of shoreline; the real figure
 * is 10 137 km, but Douglas–Peucker is far more effective on a lake shore than the linear
 * estimate assumed, so 0.8 units actually costs 11 kB, not 35. This setting SPENDS the
 * ruled budget (35.9 kB) and buys the quality the ruling was after — six times less area
 * distortion on the small bodies than the tolerance the ruling named.
 *
 * `ε_max` 0.50 keeps the biggest bodies at the province generator's own smoothness class
 * (0.45); `ε_min` 0.12 is where extra fidelity stops changing the picture (see the last row
 * above: dropping to 0.0127 β buys 9 kB of nothing).
 */
const EPSILON_BETA = 0.02;
const EPSILON_MIN = 0.12;
const EPSILON_MAX = 0.5;

/**
 * Area of one square svg unit, in km².
 *
 * One unit of y is `1 / scale` degrees of latitude. One unit of x is `1 / (cosLat · scale)`
 * degrees of longitude, and a degree of longitude at the reference latitude is
 * `kmPerDegree · cosLat` km — the two `cosLat` cancel, which is precisely what the
 * projection's cos-correction is for: at the reference latitude the map is equal-scale in
 * both axes. So one unit ≈ 1.677 km in either direction and one unit² ≈ 2.814 km².
 */
const KM2_PER_UNIT2 = (() => {
  const kmPerDegreeLat = 111.19492664455873; // 2πR / 360, R = 6371.0088 km
  const kmPerUnit = kmPerDegreeLat / TR_FRAME.scale;
  return kmPerUnit * kmPerUnit;
})();

/**
 * Smallest ring worth drawing, in svg units² (≈ 0.29 km² at 1 unit ≈ 1.68 km).
 *
 * Applies to individual RINGS, not to bodies: a reservoir's detached backwater or a lake's
 * satellite pond below this size renders as a sub-pixel speck — visually indistinguishable
 * from dirt on the screen, and pure payload. The body's own area is unaffected (it was
 * measured on the source), so no threshold moves; the largest ring of every drawn body is
 * always kept, whatever its size.
 */
const MIN_RING_AREA_UNITS2 = 0.35;

/**
 * How far a body may sit outside the pinned viewBox before the generator refuses.
 *
 * Not zero, on purpose: the coastline the provinces draw is simplified at 0.45 units, and a
 * coastal lagoon traced at full resolution can legitimately fall a fraction of a unit
 * outside it. 1.5 units (≈ 2.5 km) is the plan's reporting threshold — anything larger means
 * the layer is drawing something that is not in Türkiye, or the frame moved.
 */
const FRAME_TOLERANCE = 1.5;

function readThreshold() {
  return readNumberEnv("WATER_MIN_AREA_KM2", 40);
}

/** @param {string} name @param {number} fallback */
function readNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number, got ${JSON.stringify(raw)}`);
  }
  return value;
}

// --- Load ---------------------------------------------------------------------
const snapshot = JSON.parse(readFileSync(SRC, "utf8"));
if (snapshot.type !== "FeatureCollection" || !Array.isArray(snapshot.features)) {
  throw new Error(`Unexpected GeoJSON: ${SRC}`);
}

/** @type {{ id: string, name: string, areaKm2: number, d: string, vertices: number, rings: number, droppedRings: number, areaLossPct: number, overshoot: number }[]} */
const drawn = [];
let skipped = 0;
let maxOvershoot = 0;

for (const feature of snapshot.features) {
  const properties = feature.properties ?? {};
  const osmId = properties.osmId;
  const areaKm2 = properties.areaKm2;
  if (typeof osmId !== "string" || typeof areaKm2 !== "number") {
    throw new Error(`Snapshot feature without osmId/areaKm2 — the snapshot is not the one this generator expects.`);
  }
  if (areaKm2 < MIN_AREA_KM2) {
    skipped++;
    continue;
  }

  const geometry = feature.geometry;
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];

  // One tolerance per BODY, not per ring: a reservoir's small detached arm belongs to the
  // same drawing as its main basin and must not be rendered at a different fidelity.
  const epsilon = Math.min(
    EPSILON_MAX,
    Math.max(EPSILON_MIN, EPSILON_BETA * Math.sqrt(areaKm2 / KM2_PER_UNIT2)),
  );

  /** @type {{ points: [number, number][], area: number, sourceArea: number }[]} */
  const candidates = [];
  for (const polygon of polygons) {
    // Ring 0 is the outer ring; holes (islands) are deliberately NOT drawn — they were
    // already subtracted from the body's area, and at this scale Akdamar is ~0.24 units²,
    // invisible at 1000 px and pure payload (plan §11 A2, approved).
    const ring = polygon[0];
    if (!Array.isArray(ring) || ring.length < 4) continue;
    const simplified = simplifyRing(ring, epsilon, projectToFrame);
    if (simplified.length < 4) continue;
    // Drop the repeated closing vertex: `Z` closes the subpath, so re-stating it is waste.
    const points = simplified.slice(0, -1).map((lonLat) => projectToFrame(lonLat));
    candidates.push({
      points,
      area: Math.abs(shoelace(points)),
      sourceArea: measureRingAreaKm2(ring),
    });
  }
  if (candidates.length === 0) {
    throw new Error(`${osmId}: every ring collapsed at ε=${epsilon} although the body is above the threshold.`);
  }

  candidates.sort((a, b) => b.area - a.area);
  const kept = candidates.filter((candidate, index) => index === 0 || candidate.area >= MIN_RING_AREA_UNITS2);

  const points = kept.flatMap((candidate) => candidate.points);
  const { maxOvershoot: overshoot } = assertInsideFrame(points, {
    label: `${osmId} (${properties.name ?? "unnamed"})`,
    tolerance: FRAME_TOLERANCE,
  });
  if (overshoot > maxOvershoot) maxOvershoot = overshoot;

  // Simplification loss, measured the honest way: the drawn polygon's area against the
  // SOURCE ring's area, in the same units, per body.
  const drawnKm2 = kept.reduce((sum, candidate) => sum + candidate.area, 0) * KM2_PER_UNIT2;
  const sourceKm2 = candidates.reduce((sum, candidate) => sum + candidate.sourceArea, 0);

  drawn.push({
    id: osmId,
    name: properties.name ?? "(unnamed)",
    areaKm2,
    d: encodePath(kept.map((candidate) => candidate.points)),
    vertices: points.length,
    rings: kept.length,
    droppedRings: candidates.length - kept.length,
    areaLossPct: sourceKm2 > 0 ? ((sourceKm2 - drawnKm2) / sourceKm2) * 100 : 0,
    overshoot,
  });
}

if (drawn.length === 0) {
  throw new Error(`No water body cleared MIN_AREA_KM2=${MIN_AREA_KM2} — refusing to emit an empty layer.`);
}

// Largest first: the paint order inside the layer is then "big bodies underneath", which is
// what a reader expects when two bodies touch, and it makes the artifact readable.
drawn.sort((a, b) => b.areaKm2 - a.areaKm2);

/** Planar shoelace area of a projected ring, in svg units². */
function shoelace(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    sum += (b[0] + a[0]) * (b[1] - a[1]);
  }
  return sum / 2;
}


// --- Emit ---------------------------------------------------------------------
const body = drawn
  .map((shape) => `  { id: ${JSON.stringify(shape.id)}, d: ${JSON.stringify(shape.d)} },`)
  .join("\n");

const out = `// AUTO-GENERATED by scripts/generate-tr-inland-water.mjs — DO NOT EDIT BY HAND.
// Source: data/tr-inland-water.geojson (© OpenStreetMap katkıcıları, ODbL).
// Regenerate with: pnpm generate:water
//
// Türkiye's inland water bodies — natural lakes and reservoirs — as inline SVG paths in the
// SAME pinned frame as lib/map/tr-provinces.generated.ts (scripts/lib/tr-frame.mjs), so the
// two artifacts are co-registered by construction rather than by coincidence. Drawn OPAQUE
// and AFTER the province outlines: that is what hides the administrative boundary segments
// running across a lake, which is the convention every published Türkiye political map
// follows (→ DEC 2026-08-01r-3).
//
// This file carries NO name, NO area and NO tier — only geometry and a stable key
// (→ DEC 2026-08-01r-4). The measurements that decided which bodies are here live in the
// generator's console report, in the snapshot's own properties and in data/README.md.
//
// ODbL: this data is never merged with the public-domain Natural Earth sea/neighbour layer.
// The attribution already rendered next to every map surface covers it.

/** One inland water body in the shared \`MAP_VIEWBOX\` coordinate space. */
export interface InlandWaterShape {
  /**
   * Stable OpenStreetMap key — \`"r36995"\` (relation) or \`"w852912181"\` (way). Used as the
   * React key and as the traceability handle back into the snapshot. NEVER displayed.
   */
  readonly id: string;
  /** SVG path \`d\` (one closed subpath per drawn ring; islands are not drawn). */
  readonly d: string;
}

/**
 * The drawn bodies, largest first. The viewBox is \`MAP_VIEWBOX\` from
 * lib/map/tr-provinces.generated.ts — one frame, pinned in scripts/lib/tr-frame.mjs.
 */
export const INLAND_WATER_SHAPES: readonly InlandWaterShape[] = [
${body}
];
`;

writeFileSync(OUT, out, "utf8");

// --- Report -------------------------------------------------------------------
const bytes = Buffer.byteLength(out, "utf8");
const pathBytes = drawn.reduce((sum, shape) => sum + shape.d.length, 0);
const vertices = drawn.reduce((sum, shape) => sum + shape.vertices, 0);
const worstLoss = [...drawn].sort((a, b) => b.areaLossPct - a.areaLossPct).slice(0, 5);
const tier = (areaKm2) => (areaKm2 >= 100 ? "A" : areaKm2 >= 40 ? "B" : "C");
const counts = { A: 0, B: 0, C: 0 };
for (const shape of drawn) counts[tier(shape.areaKm2)]++;

console.log(`generate:water → ${OUT}
  threshold        : ${MIN_AREA_KM2} km²  ·  epsilon β=${EPSILON_BETA} clamped to [${EPSILON_MIN}, ${EPSILON_MAX}] svg units
  bodies drawn     : ${drawn.length} (tier A ${counts.A} · B ${counts.B} · C ${counts.C}) · ${skipped} below threshold
  vertices         : ${vertices} · ${(pathBytes / vertices).toFixed(2)} B/vertex
  path data        : ${(pathBytes / 1024).toFixed(1)} kB · whole artifact ${(bytes / 1024).toFixed(1)} kB
  viewBox          : ${TR_VIEWBOX}
  frame overshoot  : max ${maxOvershoot.toFixed(2)} svg units (tolerance ${FRAME_TOLERANCE})
  worst area loss  : ${worstLoss.map((s) => `${s.name} ${s.areaLossPct.toFixed(2)}%`).join(" · ")}
  rings dropped    : ${drawn.reduce((sum, s) => sum + s.droppedRings, 0)} below ${MIN_RING_AREA_UNITS2} units²
`);

if (process.env.WATER_REPORT === "full") {
  console.log(
    drawn
      .map(
        (s) =>
          `  ${s.areaKm2.toFixed(1).padStart(8)} km²  ${s.id.padEnd(12)} ${String(s.vertices).padStart(5)} v  ` +
          `${s.areaLossPct.toFixed(2).padStart(6)}%  ${s.name}`,
      )
      .join("\n"),
  );
}
