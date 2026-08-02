// @ts-check
/**
 * MANUAL, NETWORK step: refresh `data/tr-inland-water.geojson` from OpenStreetMap.
 *
 * Run by hand — `node scripts/fetch-tr-inland-water.mjs` — and COMMIT the result. It is
 * deliberately NOT a `package.json` script: CI must never reach the network, and nobody
 * should run it by tab-completing `pnpm generate:`. The offline half of the pipeline is
 * `scripts/generate-tr-inland-water.mjs`, which turns this snapshot into the committed
 * artifact and IS wired to `pnpm generate:water`.
 *
 * ## Why a script instead of a README paragraph
 *
 * The query is the provenance. A paragraph can drift from what was actually run; an
 * executable cannot. Re-sourcing (Yusufeli is still filling, → su-referans-envanteri §6 R8)
 * is then one command, not an archaeology exercise.
 *
 * ## Selection is ID-PINNED (→ DEC 2026-08-02d md. 4)
 *
 * Never by name: "Acıgöl" is two different lakes, "Karakaya" is mistagged in other sources,
 * and a name-based query silently changes its result set as mappers rename things. The IDs
 * below were produced by a MEASURED sweep, not by hand-picking:
 *
 *   1. every `natural=water` way/relation inside the OSM area for Türkiye, `out ids bb`
 *      (21 838 features, 2026-08-02);
 *   2. keep those whose BOUNDING BOX is ≥ 7 km² — a bbox is an upper bound on area, so this
 *      cannot drop anything ≥ 10 km² (561 features);
 *   3. fetch tags, keep `water ∈ {lake, reservoir, lagoon, pond, ∅}` (331 features);
 *   4. fetch geometry, stitch rings, measure spherical area outer−inner;
 *   5. keep ≥ 10 km² — the widest rung of the owner's threshold ladder (→ DEC 2026-08-02k
 *      md. 3), so all three rungs (40 / 30 / 10) can be rendered from ONE snapshot.
 *
 * The sweep queries are recorded verbatim in `data/README.md` so step 1–5 is reproducible.
 * Everything the map may ever draw is therefore in this file, and what it DRAWS is decided
 * offline by the generator's threshold — no owner question costs a network round trip.
 *
 * ## The snapshot is a VERTEX SUBSET of the source, not a rewrite
 *
 * Verbatim, the 107 bodies below are 1.42 MILLION nodes / ~34 MB: OSM traces reservoir
 * shorelines at ~10 m from imagery (Keban alone is 215 488 nodes). That is three orders of
 * magnitude finer than this map can render — the whole viewBox is 1000 units wide and one
 * unit is ~1.68 km — and ~140× the province snapshot it has to register against (81
 * provinces, 5 990 nodes, 241 kB). So the snapshot is reduced at fetch time by
 * Douglas–Peucker at `SNAPSHOT_EPSILON` svg units, which is a SUBSET SELECTION: every
 * coordinate written here is an unmodified 7-decimal OSM coordinate, none is rounded,
 * averaged or invented. Only vertices the frame can never resolve are dropped.
 *
 * Two consequences are handled explicitly rather than hidden:
 *   - `areaKm2` on each feature is measured on the VERBATIM rings, BEFORE reduction, so the
 *     threshold ladder is decided by the source's own geometry (plan §11 A3) and cannot
 *     wobble across a rung because a tolerance changed;
 *   - the reduction tolerance is 16× finer than the drawing tolerance, so re-simplifying
 *     this file at any epsilon the map would plausibly use gives the same result as
 *     re-simplifying the raw source.
 *
 * Licence: ODbL. This file's data is NEVER merged with the public-domain Natural Earth
 * sea/neighbour layer — separate source, separate file, separate artifact
 * (→ DEC 2026-08-01r-1). Attribution ("© OpenStreetMap katkıcıları, ODbL") is already
 * rendered next to every map surface; no new attribution surface is required.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projectToFrame } from "./lib/tr-frame.mjs";
import { measureRingAreaKm2, simplifyRing, stitchRings } from "./lib/water-geometry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "data", "tr-inland-water.geojson");

/**
 * Overpass endpoints, tried in order with retries. The public instances return a 200 with an
 * HTML "server is probably too busy" body rather than an error status, so the caller checks
 * the payload, not the status code.
 */
const SERVERS = [
  "https://gall.openstreetmap.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lambert.openstreetmap.de/api/interpreter",
];
const ATTEMPTS_PER_SERVER = 3;

/** Douglas–Peucker tolerance for the snapshot, in svg units of the pinned TR frame. */
const SNAPSHOT_EPSILON = 0.05; // ≈ 84 m; the drawing epsilon is 16× coarser

/**
 * ID-pinned selection — measured sweep of 2026-08-02 (see header). Every water body in
 * Türkiye measuring ≥ 10 km², plus a short curriculum tail below that floor.
 *
 * DELIBERATE EXCLUSION: `relation/1142386` (Teşrin / خزان مياه تشرين, 134.6 km²) is inside
 * the Türkiye area query but is a SYRIAN reservoir. It would have cleared the top tier.
 * Ruling this set by ID rather than by an area query is what keeps it out
 * (→ su-referans-envanteri §6 R4).
 */
const PINNED_RELATIONS = [
  // ≥ 10 km², descending by measured area
  36995, 2411676, 370829, 207124, 179390, 1410914, 1319095, 10111983, 1103056, 1028112,
  1272910, 7336746, 371040, 395698, 1273044, 1808092, 1224893, 2436188, 16862988, 398079,
  2385434, 2249464, 1869452, 272008, 313352, 385113, 2347892, 2842328, 1186573, 16122782,
  17069201, 1139094, 11765142, 1342720, 3546627, 12914685, 1956206, 397126, 17083287, 1761470,
  1302039, 158172, 313351, 158163, 2861302, 2452970, 1280088, 16915457, 13999262, 961325,
  4011904, 17537232, 15986627, 2874388, 7416160, 2332911, 1721352, 2296756, 1175859, 2352113,
  1226863, 2436693, 1846315, 7412623, 1225132, 2330005, 2337254, 1236868, 947703, 17045554,
  2977, 2890, 10840590, 1748801, 2455077, 3535085, 14487587, 1820911, 10886357, 1319084,
  385686, 1395031, 3531544, 1811482, 2626775, 11165611, 4195201, 2436305, 7757527, 10888383,
  13799311, 9548064, 9535125, 14018346, 946949, 17531565, 10413981, 1273043, 10952370, 2583204,
  // Curriculum tail — below every rung of the ladder, carried so an owner question about
  // formation types (crater / landslide-dammed / karstic) does not cost another fetch.
  10166504, 5471859,
];

/**
 * Way-based bodies. Several nationally known lakes are a single closed `way`, not a
 * relation — Salda (Tier B, 43.9 km²) is the important one: a relation-only query drops it
 * silently (→ su-referans-envanteri §6 R1).
 */
const PINNED_WAYS = [
  // ≥ 10 km²
  852912181, 173041876, 492757813, 891302999, 812881054, 15429110, 963242511,
  // Curriculum tail
  185089127, 19786571, 34138478, 19325134, 693769980,
];

/** `water` values accepted as an inland water BODY (→ su-referans-envanteri §6 R4/R5). */
const ALLOWED_WATER = new Set(["lake", "reservoir", "lagoon", "pond"]);

function buildQuery() {
  return [
    "[out:json][timeout:900];",
    "(",
    `  relation(id:${PINNED_RELATIONS.join(",")});`,
    `  way(id:${PINNED_WAYS.join(",")});`,
    ");",
    "out geom meta;",
    "",
  ].join("\n");
}

/** POST the query, retrying across endpoints. Overpass wants form-encoded `data=`. */
async function runQuery(query) {
  let lastBody = "";
  for (let attempt = 1; attempt <= ATTEMPTS_PER_SERVER; attempt++) {
    for (const server of SERVERS) {
      process.stdout.write(`  → ${server} (attempt ${attempt}) … `);
      let text;
      try {
        const response = await fetch(server, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Overpass mirrors answer Node's default agent with `406 Not Acceptable`.
            // Identifying the caller is also the API's own usage-policy expectation.
            "User-Agent": "cografya-web-inland-water-fetch/1.0 (+https://github.com/Sertturk16/cografya_web)",
          },
          body: new URLSearchParams({ data: query }),
        });
        text = await response.text();
      } catch (error) {
        console.log(`network error (${String(error)})`);
        continue;
      }
      if (text.trimStart().startsWith("{")) {
        console.log(`ok (${(text.length / 1e6).toFixed(1)} MB)`);
        return JSON.parse(text);
      }
      lastBody = text;
      console.log("busy / error page");
      await new Promise((resolve) => setTimeout(resolve, 8000));
    }
  }
  throw new Error(`Overpass returned no JSON from any endpoint. Last body:\n${lastBody.slice(0, 500)}`);
}

/**
 * Resolve the display name: `name:tr` → `name:en` → `name` (→ su-envanteri N1). Faz-1 draws
 * no labels, but the file must already carry the right string so the label layer, when it
 * lands, does not inherit "Saksak Dagi".
 */
function resolveName(tags) {
  return tags["name:tr"] ?? tags["name:en"] ?? tags.name ?? null;
}

// --- run ---------------------------------------------------------------------

const query = buildQuery();
const pinned = new Set([
  ...PINNED_RELATIONS.map((id) => `r${id}`),
  ...PINNED_WAYS.map((id) => `w${id}`),
]);
console.log(`fetch:water → ${pinned.size} pinned ids`);
const payload = await runQuery(query);
const timestamp = payload.osm3s?.timestamp_osm_base ?? null;
if (typeof timestamp !== "string") {
  throw new Error("Overpass response carries no timestamp_osm_base — provenance would be unrecordable.");
}

const features = [];
const seen = new Set();
const rejected = [];

for (const element of payload.elements ?? []) {
  if (element.type !== "way" && element.type !== "relation") continue;
  const osmId = `${element.type[0]}${element.id}`;
  if (!pinned.has(osmId)) {
    // Cannot happen with an id-pinned query; treated as a hard error rather than ignored,
    // because "the query returned something I did not ask for" means the query changed.
    throw new Error(`Unpinned feature ${osmId} in the response — the query no longer matches the pin list.`);
  }
  seen.add(osmId);
  const tags = element.tags ?? {};

  // F4 — tag whitelist. Rivers, canals, basins and wastewater ponds dominate the
  // largest-feature list if they are not excluded.
  if (tags.natural !== "water") {
    rejected.push(`${osmId} (${resolveName(tags) ?? "unnamed"}): natural=${tags.natural ?? "∅"}`);
    continue;
  }
  // F2 — `water=dry_lake`: Tuz Gölü has three large unnamed seasonal aprons tagged this way
  // (→ su-referans-envanteri §6 R3). Drawing them puts three anonymous blots next to it.
  if (tags.water !== undefined && !ALLOWED_WATER.has(tags.water)) {
    rejected.push(`${osmId} (${resolveName(tags) ?? "unnamed"}): water=${tags.water}`);
    continue;
  }

  // F5 — ring assembly. `stitchRings` throws on a ring that will not close rather than
  // silently dropping the open piece, which would leave a body with a bite taken out of it.
  const rings =
    element.type === "way"
      ? { outer: [element.geometry.map((point) => [point.lon, point.lat])], inner: [] }
      : stitchRings(element.members ?? [], osmId);
  if (rings.outer.length === 0) {
    throw new Error(`${osmId}: no outer ring — the relation is unusable, not empty.`);
  }

  // Area on the VERBATIM rings, before reduction (plan §11 A3): the threshold ladder must
  // be a property of the source, not of whatever tolerance we happen to be using.
  const areaKm2 =
    rings.outer.reduce((sum, ring) => sum + measureRingAreaKm2(ring), 0) -
    rings.inner.reduce((sum, ring) => sum + measureRingAreaKm2(ring), 0);

  const verbatimNodes = [...rings.outer, ...rings.inner].reduce((sum, ring) => sum + ring.length, 0);

  // Hole → shell assignment happens on the VERBATIM rings, where the topology is exact.
  // Doing it after reduction is what a naive pipeline gets wrong: simplification moves a
  // shell's edge by up to ε, which is enough to leave a hole hugging that edge formally
  // outside its own parent (measured on Atatürk Baraj Gölü, whose islands sit in narrow
  // flooded valleys).
  const holeOwner = rings.inner.map((hole) => findShell(rings.outer, hole, osmId));

  const reduce = (ring) => simplifyRing(ring, SNAPSHOT_EPSILON, projectToFrame);
  const outer = rings.outer.map(reduce);
  const inner = rings.inner.map(reduce);
  // A ring the frame cannot resolve at all collapses below 4 vertices; it is dropped from
  // the SHAPE but its area was already counted above, so no threshold moves.
  const groups = outer.map((ring) => (ring.length >= 4 ? [ring] : null));
  inner.forEach((hole, index) => {
    if (hole.length < 4) return;
    const group = groups[holeOwner[index]];
    if (group) group.push(hole);
  });
  const coordinates = groups.filter((group) => group !== null);
  if (coordinates.length === 0) {
    throw new Error(`${osmId}: every ring collapsed at ε=${SNAPSHOT_EPSILON} — nothing to store.`);
  }
  const keptNodes = coordinates.reduce(
    (sum, group) => sum + group.reduce((inner2, ring) => inner2 + ring.length, 0),
    0,
  );

  features.push({
    type: "Feature",
    properties: {
      osmId,
      name: resolveName(tags),
      water: tags.water ?? null,
      wikidata: tags.wikidata ?? null, // second verification key for the name (N3)
      intermittent: tags.intermittent === "yes" ? true : null,
      areaKm2: Number(areaKm2.toFixed(4)),
      verbatimNodes,
      snapshotNodes: keptNodes,
    },
    // GeoJSON ring order: each polygon is [outer, ...holes]. A body with several outer
    // rings (Van's satellite basins, a reservoir's detached arms) is a MultiPolygon.
    geometry:
      coordinates.length === 1
        ? { type: "Polygon", coordinates: coordinates[0] }
        : { type: "MultiPolygon", coordinates },
  });
}

// F1 — every pinned id must come back. A silently missing id is how a lake disappears from
// the map without anyone noticing; same discipline as NAME_TO_PLATE in the province
// generator.
const missing = [...pinned].filter((id) => !seen.has(id));
if (missing.length > 0) {
  throw new Error(`Pinned ids missing from the Overpass response: ${missing.join(", ")}`);
}

/**
 * Index of the outer ring that owns `hole`. Several of the hole's own vertices are tested
 * rather than just the first, because a hole traced along a shell's edge can have individual
 * vertices land ambiguously on it; an orphan hole is an error, never a silent drop.
 */
function findShell(outerRings, hole, label) {
  const probes = [0, Math.floor(hole.length / 4), Math.floor(hole.length / 2), Math.floor((3 * hole.length) / 4)];
  for (const probe of probes) {
    const point = hole[probe];
    if (!point) continue;
    const index = outerRings.findIndex((ring) => ringContainsPoint(ring, point));
    if (index !== -1) return index;
  }
  throw new Error(`${label}: inner ring (${hole.length} points) is not inside any outer ring.`);
}

/** Ray casting in lon/lat — adequate at these scales for hole↔shell assignment. */
function ringContainsPoint(ring, point) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

features.sort((a, b) => b.properties.areaKm2 - a.properties.areaKm2);

const collection = {
  type: "FeatureCollection",
  metadata: {
    source: "OpenStreetMap via Overpass API",
    licence: "ODbL — © OpenStreetMap katkıcıları",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/",
    note:
      "ODbL. NEVER merge this file with the public-domain Natural Earth sea/neighbour data — " +
      "separate source, separate file, separate artifact (DEC 2026-08-01r-1).",
    timestampOsmBase: timestamp,
    fetchedAt: new Date().toISOString(),
    selection: "id-pinned; see scripts/fetch-tr-inland-water.mjs and data/README.md",
    snapshotEpsilonSvgUnits: SNAPSHOT_EPSILON,
    reduction:
      "Douglas–Peucker vertex SUBSET in the pinned TR frame. Every coordinate is an " +
      "unmodified OSM value; areaKm2 is measured on the verbatim rings, before reduction.",
    query,
  },
  features,
};

// Serialised by hand: the metadata block is pretty-printed so the provenance header is
// readable in a diff, while each feature is ONE line. `JSON.stringify(…, null, 1)` would put
// every coordinate number on its own line and triple the file for zero human benefit — a
// 47 000-vertex geometry is not read by eye either way.
const serialised = [
  "{",
  '"type": "FeatureCollection",',
  `"metadata": ${JSON.stringify(collection.metadata, null, 2)},`,
  '"features": [',
  collection.features.map((feature) => JSON.stringify(feature)).join(",\n"),
  "]",
  "}",
  "",
].join("\n");
writeFileSync(OUT, serialised, "utf8");

const verbatimTotal = features.reduce((sum, f) => sum + f.properties.verbatimNodes, 0);
const keptTotal = features.reduce((sum, f) => sum + f.properties.snapshotNodes, 0);
const bytes = Buffer.byteLength(readFileSync(OUT));
console.log(`
fetch:water → ${OUT}
  timestamp_osm_base : ${timestamp}
  bodies kept        : ${features.length} of ${pinned.size} pinned
  rejected by filter : ${rejected.length}${rejected.map((r) => `\n      ${r}`).join("")}
  nodes              : ${verbatimTotal.toLocaleString("en-US")} verbatim → ${keptTotal.toLocaleString("en-US")} at ε=${SNAPSHOT_EPSILON} (${((1 - keptTotal / verbatimTotal) * 100).toFixed(1)}% dropped)
  file size          : ${(bytes / 1024 / 1024).toFixed(2)} MB
`);
