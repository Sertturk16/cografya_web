// @ts-check
/**
 * Build-time generator: full-world country boundary GeoJSON → inline SVG `<path>`.
 *
 * Reads the committed snapshot `data/world-countries.geojson` (Natural Earth Admin-0
 * 1:50m, Public Domain — see `data/README.md`) and emits `lib/map/world-countries.generated.ts`:
 * one simplified SVG path per country, keyed by ISO 3166-1 alpha-2 code, in a single
 * shared viewBox.
 *
 * SCOPE (full world): every Natural Earth Admin-0 entity is projected — ~190 seeded
 * countries plus the de-facto backdrop. Which countries render interactively is decided at
 * request time by the api's country-map-summary (a shape lights up as a real crawlable
 * `<a>` only when its ISO code is seeded); everything else is inert backdrop. So this
 * artifact carries NO seeded/interactive state — it is pure geometry — and new countries
 * light up automatically as the api seeds them, exactly the active-vs-inert grammar the
 * Türkiye il map uses for seeded-vs-unseeded provinces.
 *
 * Contested borders follow **Option A — Natural Earth's default / de-facto rendering**
 * (→ DEC 2026-07-13): not the Türkiye-POV variant, not neutral disputed-shading. Under this
 * de-facto view Natural Earth splits Cyprus into two separate features — "Cyprus" (ISO CY,
 * the internationally-recognised government, southern polygon) and "Northern Cyprus" (no
 * ISO in the source; remapped to the api's private-use `QN` at snapshot build → DEC
 * 2026-07-13). Both therefore render as independently hoverable/clickable regions once each
 * is seeded, satisfying the owner's split-island map requirement without faking geometry.
 *
 * Antarctica is the one entity deliberately not drawn (`DRAW_EXCLUDE`): a ~5k-vertex
 * full-width polar polygon that is not a navigable country — the standard web-world-map
 * omission. It stays in the snapshot for provenance; only the render step skips it.
 *
 * Run once and COMMIT the output (`pnpm generate:world-map`). CI/runtime never invoke this —
 * the app imports the committed artifact. The raw GeoJSON never reaches the client (same
 * discipline as the Türkiye map, → SPEC §5.2 / DEC 2026-07-10): only the produced SVG
 * paths ship.
 *
 * Projection: plate carrée (equirectangular, standard parallel 0 — no per-latitude
 * x-correction: a single cos(lat) factor is meaningless across a full 142° latitude span,
 * so the familiar unprojected world outline is used). Framed on the bounding box of the
 * DRAWN features (Antarctica excluded). This map is navigation CHROME, not a data encoding,
 * so a precise cartographic projection is not required (same doctrine as the Türkiye map).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "data", "world-countries.geojson");
const OUT = join(ROOT, "lib", "map", "world-countries.generated.ts");

/**
 * ISO codes present in the snapshot but deliberately NOT drawn. Antarctica (AQ) is a
 * ~5k-vertex, full-longitude-width polar cap — not a navigable country and the standard
 * omission on web world maps; drawing it would balloon the artifact and the viewBox height
 * for zero navigation value. If the api ever seeds it, it simply stays unrendered (a
 * documented, deliberate gap — not a soft-404: there is no shape, hence no link).
 */
const DRAW_EXCLUDE = new Set(["AQ"]);

// --- Projection + simplification tuning ---------------------------------------
const VIEW_WIDTH = 1000; // shared viewBox width (svg units)
const PADDING = 4; // inset so the framed world is not flush against the edge
// Douglas-Peucker tolerance in projected svg units. At the full-world scale (~2.7 units/°)
// this ≈ 0.055°, small enough that even micro-states (Singapore, Malta, the two Cyprus
// halves, Palestine, Kosovo) survive as clickable quads rather than collapsing below the
// 3-point minimum, while still cutting the artifact from a raw ~100k vertices to a
// shippable size. Raise it and small seeded countries start vanishing — verify the seeded
// set still renders before tightening for size.
const SIMPLIFY_EPSILON = 0.15;
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

/** Total vertex count of a geometry — used to pick the label of the largest member when
 *  several source features merge under one ISO (e.g. Australia + its external territories). */
function vertexCount(geometry) {
  let n = 0;
  eachCoord(geometry, () => n++);
  return n;
}

// --- Load + first pass: bounding box of the DRAWN features (Antarctica excluded) ---
const geojson = JSON.parse(readFileSync(SRC, "utf8"));
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error(`Unexpected GeoJSON: ${SRC}`);
}

const drawn = geojson.features.filter((f) => !DRAW_EXCLUDE.has(f.properties?.iso));

let minLon = Infinity;
let maxLon = -Infinity;
let minLat = Infinity;
let maxLat = -Infinity;
for (const feature of drawn) {
  eachCoord(feature.geometry, ([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
}
if (!Number.isFinite(minLon)) {
  throw new Error("No drawable features found — check the snapshot / DRAW_EXCLUDE.");
}

// Plate carrée: uniform units-per-degree in both axes so the outline reads as the familiar
// unprojected world map. Scale so the full longitude span fills the viewBox width.
const scale = (VIEW_WIDTH - 2 * PADDING) / (maxLon - minLon);
const viewHeight = Math.round((maxLat - minLat) * scale + 2 * PADDING);

/** [lon, lat] → [x, y] in the shared viewBox (north up). */
function project([lon, lat]) {
  const x = PADDING + (lon - minLon) * scale;
  const y = PADDING + (maxLat - lat) * scale;
  return [x, y];
}

// --- Second pass: build one merged, simplified path per ISO join key ------------
/** @type {Map<string, { geoName: string, labelVerts: number, subpaths: string[] }>} */
const byIso = new Map();
for (const feature of drawn) {
  // Normalize the join key to UPPERCASE for 2-letter ISO codes (the api's Country.isoCode
  // is uppercase alpha-2, joined by raw equality). Synthetic backdrop keys (lowercase
  // `x-…`, assigned at snapshot build to codeless de-facto entities like Somaliland) are
  // left as-is: they are intentionally non-joinable and always render inert.
  const rawIso = feature.properties?.iso;
  const iso =
    typeof rawIso === "string" && /^[a-z]{2}$/i.test(rawIso) ? rawIso.toUpperCase() : rawIso;
  const geoName = feature.properties?.name;
  if (typeof iso !== "string" || iso.length < 2) {
    throw new Error(`Feature has no valid join key: ${JSON.stringify(feature.properties)}`);
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

  // Merge features that share a join key (e.g. Australia + its external territories) into a
  // single shape → one <a>, one internal link per country, all its polygons highlighting
  // together. The label follows the largest member (provenance only; the UI shows nameTr).
  const verts = vertexCount(feature.geometry);
  const existing = byIso.get(iso);
  if (existing) {
    existing.subpaths.push(...subpaths);
    if (verts > existing.labelVerts) {
      existing.geoName = geoName;
      existing.labelVerts = verts;
    }
  } else {
    byIso.set(iso, { geoName, labelVerts: verts, subpaths });
  }
}

const shapes = [...byIso.entries()]
  .map(([iso, v]) => ({ iso, geoName: v.geoName, d: v.subpaths.join("") }))
  .sort((a, b) => a.iso.localeCompare(b.iso));

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
// Source: data/world-countries.geojson (Natural Earth Admin-0 1:50m, Public Domain).
// Regenerate with: pnpm generate:world-map
//
// Inline SVG path data for the full-world country map, plate-carrée-projected + simplified
// at build time. The raw GeoJSON never ships to the client (same discipline as the Türkiye
// map, → SPEC §5.2 / DEC 2026-07-10) — only these produced paths do. Keyed by ISO 3166-1
// alpha-2 (uppercase); join to live api country data by ISO code (\`geoName\` is a
// build-time label only, never shown — the api's nameTr is the display name). A country is
// interactive/linked ONLY when the api's map-summary carries its ISO code; the rest render
// as inert backdrop, same as unseeded provinces on the Türkiye map. Contested borders
// follow Natural Earth's de-facto default (Option A, → DEC 2026-07-13); Cyprus is split
// into CY (south) and QN (KKTC, north) as independently clickable regions.

/** One country outline in the shared \`WORLD_MAP_VIEWBOX\` coordinate space. */
export interface CountryShape {
  /**
   * Join key to api country data. Uppercase ISO 3166-1 alpha-2 for recognised entities;
   * the api's private-use \`QN\` for KKTC (no real ISO exists, → DEC 2026-07-13); or a
   * synthetic non-joinable \`x-…\` key for de-facto backdrop entities Natural Earth carries
   * without any ISO (Somaliland, Siachen Glacier) — those never match a seeded country and
   * always render inert.
   */
  readonly iso: string;
  /** Source Natural Earth label (build-time provenance only; UI shows the api nameTr). */
  readonly geoName: string;
  /** SVG path \`d\` (one or more closed subpaths for countries with islands). */
  readonly d: string;
}

/** Shared SVG viewBox all ${shapes.length} paths are projected into (full world, Antarctica excluded). */
export const WORLD_MAP_VIEWBOX = "0 0 ${VIEW_WIDTH} ${viewHeight}" as const;

export const COUNTRY_SHAPES: readonly CountryShape[] = [
${body}
];
`;

writeFileSync(OUT, out, "utf8");
const bytes = Buffer.byteLength(out, "utf8");
console.log(
  `generate:world-map → ${OUT}\n  ${shapes.length} shapes · viewBox 0 0 ${VIEW_WIDTH} ${viewHeight} · ${(
    bytes / 1024
  ).toFixed(1)} kB`,
);
