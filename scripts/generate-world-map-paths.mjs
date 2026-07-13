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
// this ≈ 0.055°, small enough that mid-small countries (Singapore, Malta, Bahrain, the two
// Cyprus halves, Palestine, Kosovo) survive as clickable polygons, while still cutting the
// artifact from a raw ~100k vertices to a shippable size. Micro-states below MARKER_MIN_SPAN
// (Vatican, Nauru, Monaco, Tuvalu, …) are handled by the marker fallback below — NOT dropped
// — so tuning this for size can never again silently delete a country from the link surface.
const SIMPLIFY_EPSILON = 0.15;
const DECIMALS = 1; // coordinate rounding in the emitted path data

// --- Micro-state marker fallback (never silently drop a country) ---------------
// A country whose whole projected outline is smaller than the Douglas-Peucker tolerance
// collapses below 3 points and would vanish from COUNTRY_SHAPES entirely — no shape, so no
// crawlable `<a>`, so the country is undiscoverable from the map (the Nauru/Vatican bug,
// PR #13 review). Instead, any feature whose projected bounding box spans less than
// MARKER_MIN_SPAN units in BOTH axes is rendered as a fixed-size diamond marker centred on
// it — a guaranteed minimum clickable/crawlable target. The threshold sits in the clean gap
// between the largest genuine micro-state that must stay a marker (Saint Kitts, ~0.85u) and
// the smallest country the review verified must stay a real polygon (Singapore, ~0.95u), so
// this touches only shapes that are otherwise invisible/degenerate, never a real outline.
const MARKER_MIN_SPAN = 0.9; // projected svg units (per axis)
const MARKER_RADIUS = 1.0; // half-diagonal of the fallback diamond, svg units

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

/** Projected bounding box `{ cx, cy, w, h }` of a geometry (uses `project`, defined below at
 *  call time). Drives the micro-state marker fallback. */
function projectedBBox(geometry, projectFn) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  eachCoord(geometry, (pt) => {
    const [x, y] = projectFn(pt);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/** A fixed-size diamond subpath centred at (cx, cy) — the guaranteed-representable fallback
 *  for a country too small to survive simplification. */
function markerDiamond(cx, cy) {
  const r = MARKER_RADIUS;
  return (
    `M${round(cx)} ${round(cy - r)}L${round(cx + r)} ${round(cy)}` +
    `L${round(cx)} ${round(cy + r)}L${round(cx - r)} ${round(cy)}Z`
  );
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
/** Every join key we attempted to draw — checked against the emitted keys below so a
 *  future silent drop (the Nauru/Vatican bug) fails the build instead of shipping. */
const expectedKeys = new Set();
let markerCount = 0;
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
  expectedKeys.add(iso);

  const subpaths = [];
  const bbox = projectedBBox(feature.geometry, project);
  if (bbox.w < MARKER_MIN_SPAN && bbox.h < MARKER_MIN_SPAN) {
    // Micro-state: its whole outline is smaller than the simplify tolerance and would
    // collapse to nothing. Emit a fixed-size marker so the country still gets a shape (and
    // thus a crawlable link) instead of being silently dropped.
    subpaths.push(markerDiamond(bbox.cx, bbox.cy));
    markerCount++;
  } else {
    for (const ring of outerRings(feature.geometry)) {
      const projected = ring.map(project);
      const simplified = simplify(projected, SIMPLIFY_EPSILON);
      if (simplified.length < 3) continue; // a tiny islet of a larger country — safely dropped
      const d = simplified
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`)
        .join("");
      subpaths.push(`${d}Z`);
    }
    // Safety net: a feature big enough to skip the marker path must still have produced at
    // least one ring. If every ring somehow collapsed, fall back to a marker rather than
    // dropping the country — the completeness assertion below is the hard guarantee, this
    // keeps it satisfiable.
    if (subpaths.length === 0) {
      subpaths.push(markerDiamond(bbox.cx, bbox.cy));
      markerCount++;
    }
  }

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

// Completeness guarantee: every source join key MUST have produced a shape. This is the
// regression guard the PR #13 review asked for — if simplification, a geometry edge case, or
// a future tuning ever drops a country from the link surface again, the build fails loudly
// here instead of silently shipping an undiscoverable (but seeded + indexable) country.
const missing = [...expectedKeys].filter((k) => !byIso.has(k));
if (missing.length > 0) {
  throw new Error(
    `generate:world-map — ${missing.length} source feature(s) produced no shape and would be ` +
      `silently undiscoverable: ${missing.join(", ")}. Every drawn feature must emit a shape ` +
      `(lower SIMPLIFY_EPSILON, raise MARKER_MIN_SPAN, or fix the geometry).`,
  );
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
  `generate:world-map → ${OUT}\n  ${shapes.length} shapes (${markerCount} micro-state markers) · ` +
    `viewBox 0 0 ${VIEW_WIDTH} ${viewHeight} · ${(bytes / 1024).toFixed(1)} kB · ` +
    `${expectedKeys.size} source keys all present ✓`,
);
