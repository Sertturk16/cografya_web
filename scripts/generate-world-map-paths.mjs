// @ts-check
/**
 * Build-time generator: world (regional) country boundary GeoJSON → inline SVG `<path>`.
 *
 * Reads the committed snapshot `data/world-countries.geojson` (Natural Earth Admin-0,
 * Public Domain — see `data/README.md`) and emits `lib/map/world-countries.generated.ts`:
 * one simplified SVG path per country, keyed by ISO 3166-1 alpha-2 code, in a single
 * shared viewBox.
 *
 * SCOPE (Faz-2 pilot): only the 8 seeded pilot countries have live `/dunya/{slug}` pages,
 * so this is a REGIONAL map framed on those 8 (Balkans → Caucasus → Middle East), not a
 * full 195-country world map. The map draws the 8 covered countries plus a curated set of
 * geographic-context neighbours (Türkiye is the central anchor) as inert backdrop — exactly
 * the same active-vs-inert pattern the Türkiye il map uses for seeded-vs-unseeded provinces.
 * Which countries render interactively is decided at request time by the API's
 * country-map-summary (a shape lights up only when its ISO code is seeded), so this artifact
 * carries NO seeded/interactive state — it is pure geometry. A future full-world map is a
 * follow-up (needs full-world GeoJSON sourcing + the pending sovereignty-recognition
 * rulings; none of the 5 contested entities is in this region, so this pilot is unblocked).
 *
 * Run once and COMMIT the output (`pnpm generate:world-map`). CI/runtime never invoke this —
 * the app imports the committed artifact. The raw GeoJSON never reaches the client (same
 * discipline as the Türkiye map, → SPEC §5.2 / DEC 2026-07-10): only the produced SVG
 * paths ship.
 *
 * Projection: equirectangular with a cos(reference-latitude) x-correction, framed on the
 * bounding box of the SEEDED-8 only (context countries project into the same frame and
 * clip at its edges — the outer <svg> clips overflow). This Faz-2 map is navigation CHROME,
 * not a data encoding, so a precise cartographic projection is not required (same doctrine
 * note as the Türkiye map).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "data", "world-countries.geojson");
const OUT = join(ROOT, "lib", "map", "world-countries.generated.ts");

/**
 * The 8 seeded pilot countries (ISO 3166-1 alpha-2). The shared viewBox is framed on the
 * bounding box of THESE only, so the map centres on the covered region; context countries
 * fall outside and clip at the frame edges. Keep in sync with the API's seeded set — this
 * is only the FRAMING hint, never the interactivity gate (that is API-driven at runtime).
 */
const FRAME_ISO = new Set(["GR", "BG", "GE", "AM", "AZ", "IR", "IQ", "SY"]);

// --- Projection + simplification tuning ---------------------------------------
const VIEW_WIDTH = 1000; // shared viewBox width (svg units)
const PADDING = 8; // inset so the framed countries are not flush against the edge
const SIMPLIFY_EPSILON = 0.4; // Douglas-Peucker tolerance, in projected svg units
const DECIMALS = 1; // coordinate rounding in the emitted path data

/** Perpendicular distance from point p to the line segment a→b. */
function perpDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Iterative Douglas-Peucker line simplification (avoids deep recursion). */
function simplify(points, epsilon) {
  if (points.length < 3) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const dist = perpDistance(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > epsilon && index !== -1) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function round(n) {
  return Number(n.toFixed(DECIMALS));
}

/** Visit every [lon, lat] pair in a Polygon / MultiPolygon geometry. */
function eachCoord(geometry, fn) {
  const polys = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  for (const poly of polys) for (const ring of poly) for (const pt of ring) fn(pt);
}

/** Outer rings of a geometry (drops holes; each MultiPolygon member is an island). */
function outerRings(geometry) {
  const polys = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  return polys.map((poly) => poly[0]);
}

// --- Load + first pass: bounding box of the FRAMED (seeded-8) countries only ----
const geojson = JSON.parse(readFileSync(SRC, "utf8"));
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error(`Unexpected GeoJSON: ${SRC}`);
}

let minLon = Infinity;
let maxLon = -Infinity;
let minLat = Infinity;
let maxLat = -Infinity;
for (const feature of geojson.features) {
  if (!FRAME_ISO.has(feature.properties?.iso)) continue;
  eachCoord(feature.geometry, ([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
}
if (!Number.isFinite(minLon)) {
  throw new Error("No framed (seeded-8) features found — check FRAME_ISO vs the snapshot.");
}

const refLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
const cosLat = Math.cos(refLat);
// Raw (pre-scale) projected extent of the FRAME → scale so its width fills the viewBox.
const rawW = (maxLon - minLon) * cosLat;
const rawH = maxLat - minLat;
const scale = (VIEW_WIDTH - 2 * PADDING) / rawW;
const viewHeight = Math.round(rawH * scale + 2 * PADDING);

/** [lon, lat] → [x, y] in the shared viewBox (north up). Context countries may land
 *  outside [0, VIEW_WIDTH]×[0, viewHeight] — the outer <svg> clips that overflow. */
function project([lon, lat]) {
  const x = PADDING + (lon - minLon) * cosLat * scale;
  const y = PADDING + (maxLat - lat) * scale;
  return [x, y];
}

// --- Second pass: build one simplified path per country -----------------------
/** @type {{ iso: string, geoName: string, d: string }[]} */
const shapes = [];
for (const feature of geojson.features) {
  const iso = feature.properties?.iso;
  const geoName = feature.properties?.name;
  if (typeof iso !== "string" || iso.length !== 2) {
    throw new Error(`Feature has no valid ISO alpha-2 code: ${JSON.stringify(feature.properties)}`);
  }
  const subpaths = [];
  for (const ring of outerRings(feature.geometry)) {
    const projected = ring.map(project);
    const simplified = simplify(projected, SIMPLIFY_EPSILON);
    if (simplified.length < 3) continue; // tiny islands that collapse — dropped
    const d = simplified
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`)
      .join("");
    subpaths.push(`${d}Z`);
  }
  if (subpaths.length === 0) continue;
  shapes.push({ iso, geoName, d: subpaths.join("") });
}

shapes.sort((a, b) => a.iso.localeCompare(b.iso));

// --- Emit -------------------------------------------------------------------
const body = shapes
  .map(
    (s) =>
      `  { iso: ${JSON.stringify(s.iso)}, geoName: ${JSON.stringify(
        s.geoName,
      )}, d: ${JSON.stringify(s.d)} },`,
  )
  .join("\n");

const out = `// AUTO-GENERATED by scripts/generate-world-map-paths.mjs — DO NOT EDIT BY HAND.
// Source: data/world-countries.geojson (Natural Earth Admin-0, Public Domain).
// Regenerate with: pnpm generate:world-map
//
// Inline SVG path data for the regional world map (Balkans → Caucasus → Middle East),
// projected + simplified at build time. The raw GeoJSON never ships to the client (same
// discipline as the Türkiye map, → SPEC §5.2 / DEC 2026-07-10) — only these produced
// paths do. Keyed by ISO 3166-1 alpha-2; join to live API country data by ISO code
// (\`geoName\` is a build-time label only, never shown — the API's nameTr is the display
// name). A country is interactive/linked ONLY when the API's map-summary carries its ISO
// code; the rest render as inert backdrop, same as unseeded provinces on the Türkiye map.

/** One country outline in the shared \`WORLD_MAP_VIEWBOX\` coordinate space. */
export interface CountryShape {
  /** ISO 3166-1 alpha-2 (uppercase) — the stable join key to API country data. */
  readonly iso: string;
  /** Source Natural Earth label (build-time provenance only; UI shows the API nameTr). */
  readonly geoName: string;
  /** SVG path \`d\` (one or more closed subpaths for countries with islands). */
  readonly d: string;
}

/** Shared SVG viewBox all ${shapes.length} paths are projected into (framed on the seeded 8). */
export const WORLD_MAP_VIEWBOX = "0 0 ${VIEW_WIDTH} ${viewHeight}" as const;

export const COUNTRY_SHAPES: readonly CountryShape[] = [
${body}
];
`;

writeFileSync(OUT, out, "utf8");
const bytes = Buffer.byteLength(out, "utf8");
console.log(
  `generate:world-map → ${OUT}\n  ${shapes.length} countries · viewBox 0 0 ${VIEW_WIDTH} ${viewHeight} · ${(
    bytes / 1024
  ).toFixed(1)} kB`,
);
