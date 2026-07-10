// @ts-check
/**
 * Build-time generator: Türkiye il boundary GeoJSON → inline SVG `<path>` data.
 *
 * Reads the committed snapshot `data/tr-il-boundaries.geojson` (ODbL, see
 * `data/README.md`) and emits `lib/map/tr-provinces.generated.ts`: one simplified
 * SVG path per province, keyed by plaka kodu, in a single shared viewBox.
 *
 * Run once and COMMIT the output (`pnpm generate:map`). CI/runtime never invoke
 * this — the app imports the committed artifact. The raw GeoJSON never reaches the
 * client (SPEC §5.2 / DEC 2026-07-10): only the produced SVG paths ship.
 *
 * Projection: equirectangular with a cos(reference-latitude) x-correction. For a
 * mid-latitude country of Türkiye's extent this yields a faithful, recognizable
 * outline, and — critically — this Faz-1 map is navigation CHROME, not a data
 * encoding (SPEC §2 doctrine note), so a precise cartographic projection is not
 * required. A conic-conformal upgrade (via d3-geo) is a possible Faz-2 refinement.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "data", "tr-il-boundaries.geojson");
const OUT = join(ROOT, "lib", "map", "tr-provinces.generated.ts");

/**
 * GeoJSON feature `name` → official plaka kodu (zero-padded 2-digit). Static
 * reference data (Türkiye's 81 provinces). Keys are the EXACT strings the source
 * file uses (note the informal `"Afyon"` → 03 Afyonkarahisar, `"Mersin"` → 33).
 * The generator throws if a feature name is missing here, so a source change can
 * never silently drop a province.
 */
const NAME_TO_PLATE = {
  Adana: "01",
  Adıyaman: "02",
  Afyon: "03",
  Ağrı: "04",
  Amasya: "05",
  Ankara: "06",
  Antalya: "07",
  Artvin: "08",
  Aydın: "09",
  Balıkesir: "10",
  Bilecik: "11",
  Bingöl: "12",
  Bitlis: "13",
  Bolu: "14",
  Burdur: "15",
  Bursa: "16",
  Çanakkale: "17",
  Çankırı: "18",
  Çorum: "19",
  Denizli: "20",
  Diyarbakır: "21",
  Edirne: "22",
  Elazığ: "23",
  Erzincan: "24",
  Erzurum: "25",
  Eskişehir: "26",
  Gaziantep: "27",
  Giresun: "28",
  Gümüşhane: "29",
  Hakkari: "30",
  Hatay: "31",
  Isparta: "32",
  Mersin: "33",
  İstanbul: "34",
  İzmir: "35",
  Kars: "36",
  Kastamonu: "37",
  Kayseri: "38",
  Kırklareli: "39",
  Kırşehir: "40",
  Kocaeli: "41",
  Konya: "42",
  Kütahya: "43",
  Malatya: "44",
  Manisa: "45",
  Kahramanmaraş: "46",
  Mardin: "47",
  Muğla: "48",
  Muş: "49",
  Nevşehir: "50",
  Niğde: "51",
  Ordu: "52",
  Rize: "53",
  Sakarya: "54",
  Samsun: "55",
  Siirt: "56",
  Sinop: "57",
  Sivas: "58",
  Tekirdağ: "59",
  Tokat: "60",
  Trabzon: "61",
  Tunceli: "62",
  Şanlıurfa: "63",
  Uşak: "64",
  Van: "65",
  Yozgat: "66",
  Zonguldak: "67",
  Aksaray: "68",
  Bayburt: "69",
  Karaman: "70",
  Kırıkkale: "71",
  Batman: "72",
  Şırnak: "73",
  Bartın: "74",
  Ardahan: "75",
  Iğdır: "76",
  Yalova: "77",
  Karabük: "78",
  Kilis: "79",
  Osmaniye: "80",
  Düzce: "81",
};

// --- Projection + simplification tuning ---------------------------------------
const VIEW_WIDTH = 1000; // shared viewBox width (svg units)
const PADDING = 6; // inset so strokes near the edge are not clipped
const SIMPLIFY_EPSILON = 0.45; // Douglas-Peucker tolerance, in projected svg units
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
      const d = perpDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
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

// --- Load + first pass: project every point, track projected bounds -----------
const geojson = JSON.parse(readFileSync(SRC, "utf8"));
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error(`Unexpected GeoJSON: ${SRC}`);
}

let minLon = Infinity;
let maxLon = -Infinity;
let minLat = Infinity;
let maxLat = -Infinity;
for (const feature of geojson.features) {
  eachCoord(feature.geometry, ([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
}

const refLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
const cosLat = Math.cos(refLat);
// Raw (pre-scale) projected extent → scale so width fills VIEW_WIDTH - 2*PADDING.
const rawW = (maxLon - minLon) * cosLat;
const rawH = maxLat - minLat;
const scale = (VIEW_WIDTH - 2 * PADDING) / rawW;
const viewHeight = Math.round(rawH * scale + 2 * PADDING);

/** [lon, lat] → [x, y] in the shared viewBox (north up). */
function project([lon, lat]) {
  const x = PADDING + (lon - minLon) * cosLat * scale;
  const y = PADDING + (maxLat - lat) * scale;
  return [x, y];
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

// --- Second pass: build one simplified path per province ----------------------
/** @type {{ plateCode: string, geoName: string, d: string }[]} */
const shapes = [];
for (const feature of geojson.features) {
  const geoName = feature.properties?.name;
  const plateCode = NAME_TO_PLATE[geoName];
  if (!plateCode) {
    throw new Error(`No plate code mapped for GeoJSON province name "${geoName}"`);
  }
  const subpaths = [];
  for (const ring of outerRings(feature.geometry)) {
    const projected = ring.map(project);
    const simplified = simplify(projected, SIMPLIFY_EPSILON);
    if (simplified.length < 3) continue;
    const d = simplified
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`)
      .join("");
    subpaths.push(`${d}Z`);
  }
  shapes.push({ plateCode, geoName, d: subpaths.join("") });
}

shapes.sort((a, b) => a.plateCode.localeCompare(b.plateCode));

// --- Emit -------------------------------------------------------------------
const body = shapes
  .map(
    (s) =>
      `  { plateCode: ${JSON.stringify(s.plateCode)}, geoName: ${JSON.stringify(
        s.geoName,
      )}, d: ${JSON.stringify(s.d)} },`,
  )
  .join("\n");

const out = `// AUTO-GENERATED by scripts/generate-map-paths.mjs — DO NOT EDIT BY HAND.
// Source: data/tr-il-boundaries.geojson (© OpenStreetMap katkıcıları, ODbL).
// Regenerate with: pnpm generate:map
//
// Inline SVG path data for Türkiye's 81 il, projected + simplified at build time.
// The raw GeoJSON never ships to the client (SPEC §5.2 / DEC 2026-07-10) — only
// these produced paths do. Keyed by plaka kodu; join to live API province data by
// plate code (\`geoName\` is a build-time label only, never shown — the API's
// nameTr is the display name).

/** One province outline in the shared \`MAP_VIEWBOX\` coordinate space. */
export interface ProvinceShape {
  /** Plaka kodu (zero-padded 2-digit) — the stable join key to API province data. */
  readonly plateCode: string;
  /** Source GeoJSON label (build-time provenance only; UI shows the API nameTr). */
  readonly geoName: string;
  /** SVG path \`d\` (one or more closed subpaths for provinces with islands). */
  readonly d: string;
}

/** Shared SVG viewBox all ${shapes.length} paths are projected into. */
export const MAP_VIEWBOX = "0 0 ${VIEW_WIDTH} ${viewHeight}" as const;

export const PROVINCE_SHAPES: readonly ProvinceShape[] = [
${body}
];
`;

writeFileSync(OUT, out, "utf8");
const bytes = Buffer.byteLength(out, "utf8");
console.log(
  `generate:map → ${OUT}\n  ${shapes.length} provinces · viewBox 0 0 ${VIEW_WIDTH} ${viewHeight} · ${(
    bytes / 1024
  ).toFixed(1)} kB`,
);
