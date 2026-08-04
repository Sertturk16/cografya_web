// @ts-check
/**
 * Build-time generator: TR inland-water GeoJSON → inline SVG `<path>` data.
 *
 * Reads TWO committed, separately licensed snapshots and emits ONE artifact
 * (`lib/map/tr-inland-water.generated.ts`): one simplified path per drawn water body, in the
 * SAME pinned frame as the province outlines (`scripts/lib/tr-frame.mjs`).
 *
 *   data/tr-inland-water.geojson       ODbL, OpenStreetMap   scripts/fetch-tr-inland-water.mjs
 *   data/tr-inland-water-jrc.geojson   Copernicus, EC JRC    scripts/fetch-tr-jrc-water.mjs
 *
 * ## Why two files and not one (→ DEC 2026-08-01r-1, and the reason it is worth the code)
 *
 * ODbL's share-alike applies to a derived DATABASE: merging the JRC geometry into the ODbL
 * file would pull the merged result under ODbL, which the Copernicus terms do not grant.
 * Rendering both into one SVG is a *produced work* and carries no such obligation. So the
 * two databases meet HERE, in code, and never on disk. `data/README.md` records both.
 *
 * The consequence for this file: the hybrid decision — which OSM bodies the JRC class
 * replaces — lives in `SUPERSEDED_BY_JRC` below. It is a list of ids in a program, not a
 * column in a data file, which is exactly what keeps each data file single-licensed.
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
 * One number: `MIN_AREA_KM2`, applied to `areaKm2`, which each fetch step measured on its
 * OWN source geometry. The owner rules this number from rendered samples at 40 / 30 / 10 km²
 * (the ladder in DEC 2026-08-02k md. 3); the snapshot holds every body down to 10 km² so
 * switching rungs is a regenerate, not a network round trip.
 *
 * **The rung is applied PER SOURCE** (→ DEC 2026-08-03c, Q9): a JRC body is measured against
 * its JRC area, an OSM body against its OSM area. There is no third, reconciled figure to
 * measure against — the whole point of the hybrid is that the two sources answer "how big is
 * this lake" differently, and a seasonal lake's honest answer is the 41-year one.
 *
 * NOTHING numeric leaves this file. No area, no name, no tier reaches the artifact, the
 * messages files or any component (→ DEC 2026-08-01r-4): the measurements live in this
 * console report, in the snapshots' own properties and in `data/README.md`. The artifact
 * carries a source id purely as a stable React key and traceability handle — `r36995` /
 * `w852912181` for OSM, `gsw-01`… for JRC (→ DEC 2026-08-03c, Q8).
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
const SRC_OSM = join(ROOT, "data", "tr-inland-water.geojson");
/**
 * The JRC snapshot. `JRC_SOURCE` exists ONLY to render an owner variant (a different
 * component rule or closing radius) from a file produced into `.jrc-cache/variants/`; it is
 * never set in CI, so `generate:water:check` always compares against the committed recipe.
 */
const SRC_JRC = process.env.JRC_SOURCE ?? join(ROOT, "data", "tr-inland-water-jrc.geojson");
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
 * written). The same sweep over all 50 bodies ABOVE THE RUNG — the 49 drawn plus Hoyran, i.e.
 * the set as it stood before this exclusion — found NO other pair overlapping by more
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

/**
 * The HYBRID: which JRC body replaces which OSM record, and which replaces none.
 *
 * ## Why only these nine, and why the dams and permanent lakes stay on OSM
 *
 * GSW's `occurrence` is the share of 1984–2024 observations that were water. For a body that
 * IS water every year that number is ~100 and the source barely matters (Van Gölü moves
 * 0.8 % across the whole 1–75 % threshold range). For a body that fills and dries it is the
 * only honest description we have, and OSM — a single traced satellite moment — is not.
 *
 * The same statistic is why reservoirs must NOT come from GSW: a dam impounded in 2018 has
 * been water for six of the forty-one years, so its occurrence is low everywhere. Measured:
 * Ilısu 286.0 → 22.2 km² (→ DEC 2026-08-02q §D). The denominator is the trap.
 *
 * ## What the values mean
 *
 * `null` = this JRC body replaces nothing; the map has never drawn it (Yay Gölü).
 * Otherwise the OSM record is dropped from the DRAWING, not from the snapshot — same rule as
 * `DRAWN_DUPLICATES`, same reason: `data/tr-inland-water.geojson` is the faithful record of
 * the ODbL sweep and stays complete.
 *
 * Two of the superseded records are BELOW the rung today and therefore not drawn either way
 * (Seyfe 21.8 km², Acıgöl 18.6 km²). They are listed anyway: if the rung ever moves down,
 * the same water must not arrive twice from two sources.
 *
 * This map is also the JRC ROSTER. A body in the data file that is not a key here throws —
 * a nine-body registry and an eight-entry map is precisely the drift that would draw a lake
 * on top of the OSM record it was supposed to replace.
 */
const SUPERSEDED_BY_JRC = new Map([
  ["gsw-01", "r2411676"], // Tuz Gölü — three OSM fragments, one GSW basin
  ["gsw-02", "r16862988"], // Akşehir Gölü
  ["gsw-03", "r2385434"], // Eber Gölü
  ["gsw-04", "r17069201"], // Tersakan Gölü — SHRINKS under GSW
  ["gsw-05", "r1761470"], // Marmara Gölü
  ["gsw-06", "r17083287"], // Karamık Gölü — SHRINKS under GSW
  ["gsw-07", "r1721352"], // Seyfe Gölü — below the rung on OSM, drawn under GSW
  ["gsw-08", "w492757813"], // Acıgöl (Denizli). NOT w19325134, a different lake of the same name
  ["gsw-09", null], // Yay Gölü — no OSM counterpart in our snapshot
]);

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

/** @param {string} path */
function readCollection(path) {
  const collection = JSON.parse(readFileSync(path, "utf8"));
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error(`Unexpected GeoJSON: ${path}`);
  }
  return collection;
}

const snapshot = readCollection(SRC_OSM);
const jrc = readCollection(SRC_JRC);

// The licence separation is a property of the DATA, so it is checked against the data rather
// than trusted from the scripts that wrote it: a merge would most plausibly arrive as someone
// "helpfully" copying features between the two files.
if (snapshot.metadata?.licence === jrc.metadata?.licence) {
  throw new Error(
    `${SRC_OSM} and ${SRC_JRC} declare the same licence. These are two separately licensed ` +
      `databases that must never be merged (→ DEC 2026-08-01r-1); if they now agree, one of ` +
      `them has been overwritten with the other's provenance.`,
  );
}

/**
 * Both sources, normalised to what the drawing loop needs.
 *
 * OSM features key on `osmId`, JRC features on `id`; every other field the two files carry is
 * ignored here. `sourceLabel` exists only for the console report — no source name reaches the
 * artifact any more than an area does.
 *
 * @typedef {{ type: string, coordinates: number[][][] | number[][][][] }} SourceGeometry
 * @type {{ id: string, name: string, areaKm2: number, geometry: SourceGeometry, source: "osm" | "jrc" }[]}
 */
const bodies = [];
for (const feature of snapshot.features) {
  const properties = feature.properties ?? {};
  if (typeof properties.osmId !== "string" || typeof properties.areaKm2 !== "number") {
    throw new Error(
      `Snapshot feature without osmId/areaKm2 — the snapshot is not the one this generator expects.`,
    );
  }
  bodies.push({
    id: properties.osmId,
    name: properties.name ?? "(unnamed)",
    areaKm2: properties.areaKm2,
    geometry: feature.geometry,
    source: "osm",
  });
}
for (const feature of jrc.features) {
  const properties = feature.properties ?? {};
  if (typeof properties.id !== "string" || typeof properties.areaKm2 !== "number") {
    throw new Error(
      `JRC feature without id/areaKm2 — ${SRC_JRC} is not the one this generator expects.`,
    );
  }
  if (!SUPERSEDED_BY_JRC.has(properties.id)) {
    throw new Error(
      `${properties.id} is in ${SRC_JRC} but not in SUPERSEDED_BY_JRC. Every JRC body must ` +
        `declare which OSM record it replaces (or \`null\` for none) before it can be drawn — ` +
        `otherwise the same water can arrive twice from two sources.`,
    );
  }
  bodies.push({
    id: properties.id,
    name: properties.name ?? "(unnamed)",
    areaKm2: properties.areaKm2,
    geometry: feature.geometry,
    source: "jrc",
  });
}

// Every JRC body the roster promises must actually be in the data file. Without this a
// truncated or half-written JRC snapshot would silently drop a lake AND silently un-supersede
// its OSM record, which is the same defect in both directions at once.
for (const jrcId of SUPERSEDED_BY_JRC.keys()) {
  if (!bodies.some((body) => body.source === "jrc" && body.id === jrcId)) {
    throw new Error(`${jrcId} is declared in SUPERSEDED_BY_JRC but missing from ${SRC_JRC}.`);
  }
}

/**
 * OSM records the JRC class replaces. Built from the roster, and every one of them is
 * verified to EXIST in the ODbL snapshot: a refreshed snapshot that renumbered or dropped an
 * id would otherwise turn its override into a silent no-op and draw both bodies.
 *
 * @type {Map<string, string>} osm id → the JRC id that replaces it
 */
const supersededOsmIds = new Map();
for (const [jrcId, osmId] of SUPERSEDED_BY_JRC) {
  if (osmId === null) continue;
  if (!snapshot.features.some((feature) => feature.properties?.osmId === osmId)) {
    throw new Error(
      `${jrcId} supersedes ${osmId}, but ${osmId} is not in ${SRC_OSM}. The override would ` +
        `be a no-op — re-check SUPERSEDED_BY_JRC against the refreshed snapshot.`,
    );
  }
  supersededOsmIds.set(osmId, jrcId);
}

/** @type {{ id: string, name: string, source: string, areaKm2: number, d: string, vertices: number, rings: number, droppedRings: number, areaLossPct: number, overshoot: number }[]} */
const drawn = [];
let skipped = 0;
let maxOvershoot = 0;
/** @type {string[]} */
const excludedDuplicates = [];
/** @type {string[]} */
const excludedSuperseded = [];

// A duplicate may only be dropped while the body that ABSORBS it is itself above the
// threshold and present in the snapshot. Without this, a future re-source that removes or
// shrinks Eğirdir would silently delete real water from the map instead of a double count —
// the exclusion would still fire, and nothing downstream would notice.
//
// Scoped to the rung ON PURPOSE: if the duplicate itself is below MIN_AREA_KM2 it is not
// drawn either way, so the exclusion cannot remove anything and demanding a drawn survivor
// would only fail the owner's threshold-ladder renders (WATER_MIN_AREA_KM2) for no gain.
for (const [duplicateId, keptId] of DRAWN_DUPLICATES) {
  const duplicate = snapshot.features.find((feature) => feature.properties?.osmId === duplicateId);
  if (duplicate === undefined || (duplicate.properties?.areaKm2 ?? 0) < MIN_AREA_KM2) continue;
  const kept = snapshot.features.find((feature) => feature.properties?.osmId === keptId);
  if (kept === undefined || (kept.properties?.areaKm2 ?? 0) < MIN_AREA_KM2) {
    throw new Error(
      `${duplicateId} is excluded as a duplicate of ${keptId}, but ${keptId} is not drawn ` +
        `(missing from the snapshot or below MIN_AREA_KM2=${MIN_AREA_KM2}). Dropping it now ` +
        `would remove the water itself, not the double count — re-check DRAWN_DUPLICATES.`,
    );
  }
}

/**
 * A superseded OSM record may only be dropped while its JRC replacement is ITSELF drawn.
 *
 * Without this, a JRC body that falls under the rung takes its OSM twin down with it and the
 * lake vanishes from all four surfaces in silence: the artifact loses two rows, and
 * `tr-inland-water.test.ts`'s id-set derivation shrinks in lockstep, so the suite stays green
 * while the map loses a lake. Karamık is one radius choice away from this — 37.8 km² against
 * a 30 km² rung — and the owner's sample gate is currently offering radius variants.
 *
 * This is the exact twin of the `DRAWN_DUPLICATES` pre-check above, for the exact same
 * reason: an exclusion must never be able to remove the water itself instead of the
 * double count.
 */
for (const [jrcId, osmId] of SUPERSEDED_BY_JRC) {
  if (osmId === null) continue;
  const replacement = bodies.find((body) => body.source === "jrc" && body.id === jrcId);
  if (replacement !== undefined && replacement.areaKm2 >= MIN_AREA_KM2) continue;
  const superseded = bodies.find((body) => body.source === "osm" && body.id === osmId);
  if (superseded === undefined || superseded.areaKm2 < MIN_AREA_KM2) continue;
  throw new Error(
    `${osmId} is superseded by ${jrcId}, but ${jrcId} measures ` +
      `${replacement?.areaKm2?.toFixed(1) ?? "—"} km² and does not clear ` +
      `MIN_AREA_KM2=${MIN_AREA_KM2}, while ${osmId} (${superseded.areaKm2.toFixed(1)} km²) ` +
      `does. Dropping it now would remove the lake from the map entirely rather than replace ` +
      `it — re-check the recipe or SUPERSEDED_BY_JRC before regenerating.`,
  );
}

for (const body of bodies) {
  const { id, name, areaKm2 } = body;
  // PER-SOURCE rung (→ DEC 2026-08-03c, Q9): `areaKm2` is whichever source measured this
  // body, so the comparison needs no branch — the branchlessness IS the rule.
  if (areaKm2 < MIN_AREA_KM2) {
    skipped++;
    continue;
  }
  const supersededBy = supersededOsmIds.get(id);
  if (supersededBy !== undefined) {
    excludedSuperseded.push(`${id} (${name}) → ${supersededBy}`);
    continue;
  }
  const duplicateOf = DRAWN_DUPLICATES.get(id);
  if (duplicateOf !== undefined) {
    excludedDuplicates.push(`${id} (${name}) ⊂ ${duplicateOf}`);
    continue;
  }

  const geometry = body.geometry;
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
      `${id}: every ring collapsed at ε=${epsilon} although the body is above the threshold.`,
    );
  }

  candidates.sort((a, b) => b.area - a.area);
  const kept = candidates.filter(
    (candidate, index) => index === 0 || candidate.area >= MIN_RING_AREA_UNITS2,
  );

  const points = kept.flatMap((candidate) => candidate.points);
  const { maxOvershoot: overshoot } = assertInsideFrame(points, {
    label: `${id} (${name})`,
    tolerance: FRAME_TOLERANCE,
  });
  if (overshoot > maxOvershoot) maxOvershoot = overshoot;

  // Simplification loss, measured the honest way: the drawn polygon's area against the
  // SOURCE ring's area, in the same units, per body.
  const drawnKm2 = kept.reduce((sum, candidate) => sum + candidate.area, 0) * KM2_PER_UNIT2;
  const sourceKm2 = candidates.reduce((sum, candidate) => sum + candidate.sourceArea, 0);

  drawn.push({
    id,
    name,
    source: body.source,
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
// Sources: data/tr-inland-water.geojson (© OpenStreetMap katkıcıları, ODbL)
//          data/tr-inland-water-jrc.geojson (JRC Global Surface Water — Source: EC JRC/Google)
// Regenerate with: pnpm generate:water
//
// Türkiye's inland water bodies — natural lakes and reservoirs — as inline SVG paths in the
// SAME pinned frame as lib/map/tr-provinces.generated.ts (scripts/lib/tr-frame.mjs), so the
// two artifacts are co-registered by construction rather than by coincidence. Drawn OPAQUE
// and AFTER the province outlines: that is what hides the administrative boundary segments
// running across a lake, which is the convention every published Türkiye political map
// follows (→ DEC 2026-08-01r-3).
//
// HYBRID SOURCING (→ DEC 2026-08-02q). Dams and permanent lakes come from OSM; the seasonal
// and salt lakes come from JRC Global Surface Water, whose 41-year occurrence statistic is
// the only honest description of a body that fills and dries. The two databases are NEVER
// merged on disk — they meet only here and, as pixels, in one rendered SVG.
//
// This file carries NO name, NO area and NO tier — only geometry and a stable key
// (→ DEC 2026-08-01r-4). The measurements that decided which bodies are here live in the
// generator's console report, in the snapshots' own properties and in data/README.md.
//
// Neither source is ever merged with the public-domain Natural Earth sea/neighbour layer.
// The attribution rendered next to every map surface covers both.

/** One inland water body in the shared \`MAP_VIEWBOX\` coordinate space. */
export interface InlandWaterShape {
  /**
   * Stable source key — \`"r36995"\` / \`"w852912181"\` for OpenStreetMap, \`"gsw-01"\` for a
   * JRC Global Surface Water body (→ DEC 2026-08-03c, Q8). Used as the React key and as the
   * traceability handle back into the snapshot it came from. NEVER displayed.
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
  sources          : ${SRC_OSM.replace(`${ROOT}/`, "")} (ODbL) + ${SRC_JRC.replace(`${ROOT}/`, "")} (EC JRC/Google)
  bodies drawn     : ${drawn.length} (OSM ${drawn.filter((s) => s.source === "osm").length} · JRC ${drawn.filter((s) => s.source === "jrc").length}) (tier A ${counts.A} · B ${counts.B} · C ${counts.C}) · ${skipped} below threshold
  superseded       : ${excludedSuperseded.length} of ${[...SUPERSEDED_BY_JRC.values()].filter((id) => id !== null).length} mapped OSM records were above the rung and are now replaced${excludedSuperseded.map((entry) => `\n      ${entry}`).join("")}
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
          `  ${s.areaKm2.toFixed(1).padStart(8)} km²  ${s.source.padEnd(4)} ${s.id.padEnd(12)} ${String(s.vertices).padStart(5)} v  ` +
          `${s.areaLossPct.toFixed(2).padStart(6)}%  ${s.name}`,
      )
      .join("\n"),
  );
}
