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
import { loopArea } from "./lib/map-topology.mjs";
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
 * **30 km² — OWNER RULING, 2026-08-02 (S1 of the P6 sample gate).** The owner reviewed the
 * 40 / 30 / 10 km² ladder rendered from this snapshot and took the middle rung. 50 snapshot
 * bodies clear it and 49 are drawn (one of them is a duplicate — see `DRAWN_DUPLICATES`), for
 * a 42.2 kB artifact, and it is what closes the curriculum-parity gaps that the
 * published-map floor left open — Marmara Gölü (38.6 km²), Suğla, Seyhan, Sır and Balık Gölü
 * all sit between the two rungs, and a Türkiye map without Marmara Gölü reads as a mistake to
 * a reader who was taught it.
 *
 * 40 km² was the pre-ruling default and the reasoning behind it still holds as cartography —
 * HGM's 1:2 000 000 political sheet and the international atlas convention both stop around
 * there — but this product is taught-curriculum-first, and the owner ruled accordingly.
 *
 * The env override exists ONLY to render the owner's threshold-ladder samples; it is never
 * set in CI or in `generate:water:check`, so the committed artifact is deterministic.
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
 * The tolerance comparison below was measured at the **40 km² cut**, the rung in force when
 * it was chosen. The rows are kept at that cut on purpose: the choice between them does not
 * depend on the rung, and re-deriving three configurations this generator no longer emits
 * would produce numbers nobody can reproduce from the shipped code.
 *
 *   constant 0.80  →  11.2 kB · worst body −26.3 %      ← the tolerance DEC 2026-08-02k assumed
 *   constant 0.45  →  17.1 kB · worst body  −8.4 %
 *   constant 0.25  →  28.6 kB · worst body  −7.0 %
 *   ADAPTIVE below →  35.9 kB · worst body  −4.3 %
 *   adaptive β 0.0127 → 45.1 kB · worst body −4.3 %     (no further fidelity for +9 kB)
 *
 * **What ships today** is the ADAPTIVE row at the owner-ruled 30 km² cut, less the one
 * duplicate: **42.2 kB, 49 bodies, worst body −4.32 % (Hotamış Depolaması)**. Run the
 * generator to reproduce it — the report prints all three numbers.
 *
 * DEC 2026-08-02k md. 2 lifted the ≤20 kB cap and budgeted "~0.8 units, ~35 kB". The byte
 * half of that prediction was based on an estimated 6 500 km of shoreline; the real figure
 * is 10 137 km, but Douglas–Peucker is far more effective on a lake shore than the linear
 * estimate assumed, so 0.8 units actually costs 11 kB, not 35. This setting SPENDS the
 * ruled budget and buys the quality the ruling was after — six times less area distortion on
 * the small bodies than the tolerance the ruling named. The 42.2 kB it now costs is above the
 * ruled estimate because the OWNER later ruled the rung directly (30 km², S1); the estimate
 * was superseded by the ruling it was estimating for, and the wire cost that actually governs
 * CWV is gzip, measured separately.
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
 * Smallest ring worth drawing, in svg units².
 *
 * **0.35 units² ≈ 0.985 km²** at this frame's 2.8141 km²/unit² (re-derive it from
 * `KM2_PER_UNIT2` below rather than trusting this line — an earlier version of this docblock
 * said "≈ 0.29 km²", understating by 3.4× how large a ring the generator silently drops).
 * Just under a square kilometre is still a sub-pixel speck at the 1000 px render width: one
 * unit is ~1.68 km, so such a ring is under 0.6 px across.
 *
 * Applies to individual RINGS, not to bodies: a reservoir's detached backwater or a lake's
 * satellite pond below this size renders as a speck — visually indistinguishable from dirt on
 * the screen, and pure payload. The body's own area is unaffected (it was measured on the
 * source), so no threshold moves; the largest ring of every drawn body is always kept,
 * whatever its size.
 */
const MIN_RING_AREA_UNITS2 = 0.35;

/**
 * Extra slack, in svg units, on the VIEWBOX-containment check — which is the only thing this
 * constant guards. Read that literally: `assertInsideFrame()` compares projected points
 * against the pinned `[0, 1000] × [0, 429]` box, NOT against the landmass and NOT against the
 * coastline.
 *
 * So the real slack before this throws is `padding + tolerance = 6 + 1.5 = 7.5 units`
 * (~12.6 km), because the landmass itself only spans `[6, 994] × [6, 422.9]`. It is a
 * catastrophe detector — "this layer is drawing something that is not in Türkiye, or the
 * frame moved" — and it is deliberately nowhere near tight enough to police a shoreline.
 * Measured on the committed snapshot: true viewBox overshoot is **0.000 for every body**, and
 * so is the overshoot past the province artifact's own bounding box.
 *
 * WHAT IT DOES NOT MEASURE. How far a lagoon reaches past the simplified COASTLINE is a
 * different quantity — point-against-polygon, not point-against-box — and this generator
 * cannot compute it, because it never reads province geometry (→ DEC 2026-08-02k md. 1).
 * That number is measured by hand from the rendered samples; last measured value **0.99 units
 * (Akyatan Gölü)**, and nothing gates it. Do not conflate the two: they were reported under
 * one name once already (PR #39 review `cr-frame-tolerance-semantics`).
 */
const FRAME_TOLERANCE = 1.5;

/**
 * Bodies that are NOT drawn although they clear the threshold, because the snapshot already
 * contains the same water under another id. Keyed by the excluded id → the id that keeps it.
 *
 * ## The one case, and how it was measured
 *
 * `r7336746` "Hoyran Gölü" (138.01 km²) is the northern lobe of `r1410914` "Eğirdir Gölü"
 * (453.02 km²), and OSM's Eğirdir relation already covers that lobe: sampling Hoyran's
 * interior on a 900 × 900 grid puts **99.94 % of it inside Eğirdir**, i.e. ~137.9 km² of this
 * layer's drawn area was the same water counted twice (→ DEC 2026-08-02q md. A; the ruling's
 * figure was reproduced independently from the committed snapshot before this exclusion was
 * written). The same sweep over all 50 drawn bodies found NO other pair overlapping by more
 * than 1 %, so this is one measured defect, not a class — which is why this is a pinned list
 * and not a geometric de-duplication pass.
 *
 * ## Why it was VISIBLE, not just double bookkeeping
 *
 * Two bodies get two tolerances (ε ≈ 0.14 for Hoyran, ≈ 0.25 for Eğirdir, see EPSILON_BETA),
 * so the shared shoreline was drawn twice, a fraction of a unit apart: a doubled, muddy shore
 * along the north lobe plus a spurious dark line running across open water at the strait.
 * Half of the "the shoreline is too thick" report this exclusion ships with was this.
 *
 * ## Why HERE and not in the snapshot
 *
 * `data/tr-inland-water.geojson` is the faithful record of the ≥ 10 km² sweep and Hoyran is a
 * real OSM object in it; deleting the feature by hand would contradict the file's own
 * `metadata.query` (which still lists the id it was fetched with), and re-fetching to drop one
 * id would refresh every other body's geometry from today's OSM inside a two-line fix. WHAT
 * GETS DRAWN is this generator's decision — the same class of decision as MIN_AREA_KM2 and
 * MIN_RING_AREA_UNITS2 — so the exclusion lives with them. The fetch script keeps the id
 * pinned on purpose: the snapshot must stay complete.
 */
const DRAWN_DUPLICATES = new Map([["r7336746", "r1410914"]]);

function readThreshold() {
  return readNumberEnv("WATER_MIN_AREA_KM2", 30);
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
/** @type {string[]} */
const excludedDuplicates = [];

// A duplicate may only be dropped while the body that ABSORBS it is itself above the
// threshold and present in the snapshot. Without this, a future re-source that removes or
// shrinks Eğirdir would silently delete real water from the map instead of a double count —
// the exclusion would still fire, and nothing downstream would notice.
for (const [duplicateId, keptId] of DRAWN_DUPLICATES) {
  const kept = snapshot.features.find((feature) => feature.properties?.osmId === keptId);
  if (kept === undefined || (kept.properties?.areaKm2 ?? 0) < MIN_AREA_KM2) {
    throw new Error(
      `${duplicateId} is excluded as a duplicate of ${keptId}, but ${keptId} is not drawn ` +
        `(missing from the snapshot or below MIN_AREA_KM2=${MIN_AREA_KM2}). Dropping it now ` +
        `would remove the water itself, not the double count — re-check DRAWN_DUPLICATES.`,
    );
  }
}

for (const feature of snapshot.features) {
  const properties = feature.properties ?? {};
  const osmId = properties.osmId;
  const areaKm2 = properties.areaKm2;
  if (typeof osmId !== "string" || typeof areaKm2 !== "number") {
    throw new Error(
      `Snapshot feature without osmId/areaKm2 — the snapshot is not the one this generator expects.`,
    );
  }
  if (areaKm2 < MIN_AREA_KM2) {
    skipped++;
    continue;
  }
  const duplicateOf = DRAWN_DUPLICATES.get(osmId);
  if (duplicateOf !== undefined) {
    excludedDuplicates.push(`${osmId} (${properties.name ?? "unnamed"}) ⊂ ${duplicateOf}`);
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
      area: loopArea(points),
      sourceArea: measureRingAreaKm2(ring),
    });
  }
  if (candidates.length === 0) {
    throw new Error(
      `${osmId}: every ring collapsed at ε=${epsilon} although the body is above the threshold.`,
    );
  }

  candidates.sort((a, b) => b.area - a.area);
  const kept = candidates.filter(
    (candidate, index) => index === 0 || candidate.area >= MIN_RING_AREA_UNITS2,
  );

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
  throw new Error(
    `No water body cleared MIN_AREA_KM2=${MIN_AREA_KM2} — refusing to emit an empty layer.`,
  );
}

// Largest first: the paint order inside the layer is then "big bodies underneath", which is
// what a reader expects when two bodies touch, and it makes the artifact readable.
drawn.sort((a, b) => b.areaKm2 - a.areaKm2);

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
  duplicates held  : ${excludedDuplicates.length} above threshold but not drawn${excludedDuplicates.map((entry) => `\n      ${entry}`).join("")}
  vertices         : ${vertices} · ${(pathBytes / vertices).toFixed(2)} B/vertex
  path data        : ${(pathBytes / 1024).toFixed(1)} kB · whole artifact ${(bytes / 1024).toFixed(1)} kB
  viewBox          : ${TR_VIEWBOX}
  viewBox overshoot: max ${maxOvershoot.toFixed(2)} svg units outside ${TR_VIEWBOX} (tolerance ${FRAME_TOLERANCE}; coastal overspill is NOT this number — see FRAME_TOLERANCE)
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
