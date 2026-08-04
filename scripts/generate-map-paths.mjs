// @ts-check
/**
 * Build-time generator: Türkiye il boundary GeoJSON → inline SVG `<path>` data.
 *
 * Reads the committed snapshot `data/tr-il-boundaries.geojson` (ODbL, see
 * `data/README.md`) and emits TWO artifacts from the ONE source, in ONE run:
 *
 *   lib/map/tr-provinces.generated.ts       ε=0.45 · 1 decimal — the INTERACTIVE map
 *     (`/turkiye`, `/oyun`): 81 hit targets, hover cards, zoom/pan.
 *   lib/map/tr-provinces-mini.generated.ts  ε=2    · 0 decimals — the HOMEPAGE thumbnail
 *     (`components/home/mini-turkey-map.tsx`): one link, no hover, no zoom.
 *
 * ## Why the mini artifact is SEPARATE rather than the same paths scaled down (→ plan §2.4)
 *
 * The homepage is the site's most-visited page and its byte budget is the tightest. Reusing
 * `PROVINCE_SHAPES` there costs 23.3 kB gzip of markup — and roughly twice that once Next
 * serializes the same markup a second time into the RSC flight payload (the measured ×2 the
 * `/turkiye` map documents). Decimating to ε=2 · 0 decimals keeps 42 % of the vertices and
 * costs 8.2 kB, which at the thumbnail's render width (~520 px for a 1000-unit viewBox ⇒
 * 0.52 px/unit) is a worst-case ~1.04 px deviation: invisible.
 *
 * It matters MORE later, not less: the queued geoBoundaries re-source (P2) grows the
 * interactive artifact ~3.8×. A homepage sharing that artifact would degrade on a wave that
 * has nothing to do with it; a homepage on its own decimation stays flat and merely gets a
 * more faithful outline.
 *
 * ## Why BOTH live in this ONE generator
 *
 * Same source, same `TR_FRAME`, same `NAME_TO_PLATE`, same run. Two generators could drift
 * in their source or frame assumptions silently — the exact failure class `assertFrameFit`
 * and `scripts/lib/tr-frame.mjs` exist to prevent. `pnpm generate:map:check` covers both
 * files, so neither can go stale on its own.
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
 *
 * The projection CONSTANTS are no longer derived here: they are pinned in
 * `scripts/lib/tr-frame.mjs` and shared with every other generator that draws into the
 * same viewBox (inland water today, rivers later). This generator still measures the
 * source bbox — but only to ASSERT that it still agrees with the pinned frame, so a
 * snapshot refresh that would have silently shifted the provinces under a co-registered
 * layer now stops the build instead (→ DEC 2026-08-02k md. 1).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { perpDistance } from "./lib/map-topology.mjs";
import {
  TR_FRAME,
  assertFrameMatchesBounds,
  assertInsideFrame,
  projectToFrame,
} from "./lib/tr-frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "data", "tr-il-boundaries.geojson");
const OUT = join(ROOT, "lib", "map", "tr-provinces.generated.ts");
const OUT_MINI = join(ROOT, "lib", "map", "tr-provinces-mini.generated.ts");

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

// --- Simplification tuning ----------------------------------------------------
// The FRAME (viewBox size, projection constants, padding) is not tuned here — it is pinned
// in scripts/lib/tr-frame.mjs and shared with every other generator that draws into it.
const SIMPLIFY_EPSILON = 0.45; // Douglas-Peucker tolerance, in projected svg units
const DECIMALS = 1; // coordinate rounding in the emitted path data

// The MINI variant's tuning. ε is in the same projected svg units, so it converts straight
// into a render-size bound: the thumbnail draws the 1000-unit viewBox at ~520 px (0.52
// px/unit), so ε=2 caps the deviation at ~1.04 px and ε=3 at ~1.56 px. 2 was chosen from the
// measured ladder in plan §2.4 (5,098 → 2,121 vertices, 23.3 → 8.2 kB gzip) and confirmed on
// rendered samples. Zero decimals because a tenth of a unit is 0.05 px there — pure payload.
const MINI_SIMPLIFY_EPSILON = 2;
const MINI_DECIMALS = 0;

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

/** @param {number} n @param {number} decimals */
function round(n, decimals) {
  return Number(n.toFixed(decimals));
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

// The frame is PINNED, not derived. This snapshot is still the landmass the frame was
// fitted to, so its bbox must still reproduce the pinned constants exactly — and if it does
// not, the generator refuses to run rather than quietly moving every map on the site out
// from under the layers that share the frame (→ DEC 2026-08-02k md. 1).
assertFrameMatchesBounds({ minLon, maxLon, minLat, maxLat });

const {
  minLon: frameMinLon,
  maxLat: frameMaxLat,
  cosLat,
  scale,
  padding: PADDING,
  viewWidth: VIEW_WIDTH,
  viewHeight,
} = TR_FRAME;

/** [lon, lat] → [x, y] in the shared viewBox (north up). */
const project = projectToFrame;

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

// --- Second pass: project every province's outer rings ONCE -------------------
// Projection and the frame assertion are variant-INDEPENDENT, so they happen here rather
// than inside the per-variant build: two variants must never disagree about whether the
// source still fits the pinned frame, and running the check twice would only make a failure
// print twice.
/** @type {{ plateCode: string, geoName: string, rings: [number, number][][] }[]} */
const projected = [];
for (const feature of geojson.features) {
  const geoName = feature.properties?.name;
  const plateCode = NAME_TO_PLATE[geoName];
  if (!plateCode) {
    throw new Error(`No plate code mapped for GeoJSON province name "${geoName}"`);
  }
  const rings = [];
  for (const ring of outerRings(feature.geometry)) {
    const points = ring.map(project);
    // Inverted safety net: with the frame pinned, "the source grew" can no longer move the
    // frame, so it has to surface as "the source no longer fits".
    assertInsideFrame(points, { label: `${geoName} (${plateCode})` });
    rings.push(points);
  }
  projected.push({ plateCode, geoName, rings });
}

projected.sort((a, b) => a.plateCode.localeCompare(b.plateCode));

/**
 * One simplification variant: same projected rings, its own tolerance and rounding.
 *
 * Both artifacts come out of this one function, so a change to how a `d` string is built
 * (the command letters, the separator, the closing `Z`) can never apply to one artifact and
 * not the other.
 *
 * @param {number} epsilon @param {number} decimals
 * @returns {{ plateCode: string, geoName: string, d: string }[]}
 */
function buildShapes(epsilon, decimals) {
  return projected.map(({ plateCode, geoName, rings }) => {
    const subpaths = [];
    for (const points of rings) {
      const simplified = simplify(points, epsilon);
      if (simplified.length < 3) continue;
      const d = simplified
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x, decimals)} ${round(y, decimals)}`)
        .join("");
      subpaths.push(`${d}Z`);
    }
    return { plateCode, geoName, d: subpaths.join("") };
  });
}

const shapes = buildShapes(SIMPLIFY_EPSILON, DECIMALS);
const miniShapes = buildShapes(MINI_SIMPLIFY_EPSILON, MINI_DECIMALS);

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

/**
 * The exact equirectangular constants the paths above were projected with, so that a
 * [lon, lat] pair OUTSIDE this GeoJSON (an offshore marine reference point, a city
 * marker) can be placed in the SAME coordinate space at runtime.
 *
 * Emitted by the generator rather than restated by hand, so no consumer can hold a stale
 * copy. The values themselves are PINNED in \`scripts/lib/tr-frame.mjs\` and shared with
 * every other generator that draws into this viewBox (the inland-water layer, later the
 * rivers), which is what keeps those artifacts co-registered with these outlines. The
 * generator re-measures this snapshot's bounding box on every run and throws if it no
 * longer agrees with the pinned frame; \`pnpm generate:map:check\` fails on any drift.
 *
 * Apply them with \`projectToMapPoint()\` in \`lib/map/projection.ts\` — never inline.
 */
export interface MapProjection {
  /** Western edge of the source bounding box (decimal degrees). */
  readonly minLon: number;
  /** Northern edge of the source bounding box (decimal degrees). */
  readonly maxLat: number;
  /** cos(reference latitude) — the equirectangular x-correction factor. */
  readonly cosLat: number;
  /** Degrees → svg-unit scale factor. */
  readonly scale: number;
  /** Constant svg-unit offset added on every side; also reserved out of \`scale\`. */
  readonly padding: number;
}

export const MAP_PROJECTION: MapProjection = {
  minLon: ${frameMinLon},
  maxLat: ${frameMaxLat},
  cosLat: ${cosLat},
  scale: ${scale},
  padding: ${PADDING},
};

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

// --- Emit the MINI artifact ---------------------------------------------------
// Deliberately NOT a second copy of the interface above. It carries `plateCode` + `d` and
// nothing else — `geoName` is build-time provenance the thumbnail has no use for.
//
// It also does NOT re-export `MAP_VIEWBOX` from the primary artifact, tempting as that is:
// that import would tie the homepage's module graph to the 63 kB interactive artifact and
// leave the whole point of this file resting on a bundler's tree-shaking. The viewBox is
// emitted as its own literal from the SAME `TR_FRAME` constants in the same run, and
// `lib/map/tr-provinces-mini.test.ts` asserts the two strings are identical — single-sourced
// at the generator, verified at the test, with no runtime coupling.
// `MAP_PROJECTION` is not emitted at all: the thumbnail places no runtime coordinates.
const miniBody = miniShapes
  .map((s) => `  { plateCode: ${JSON.stringify(s.plateCode)}, d: ${JSON.stringify(s.d)} },`)
  .join("\n");

const miniOut = `// AUTO-GENERATED by scripts/generate-map-paths.mjs — DO NOT EDIT BY HAND.
// Source: data/tr-il-boundaries.geojson (© OpenStreetMap katkıcıları, ODbL).
// Regenerate with: pnpm generate:map  (this file and tr-provinces.generated.ts together)
//
// The DECIMATED Türkiye outline — ε=${MINI_SIMPLIFY_EPSILON} svg units, ${MINI_DECIMALS} decimals — for the homepage
// thumbnail ONLY (\`components/home/mini-turkey-map.tsx\`). Same source, same run, same
// pinned frame as the interactive artifact beside it; ${miniShapes.length} shapes, no hit targets.
//
// WHY A SECOND ARTIFACT EXISTS: the interactive paths cost ~23 kB gzip of markup, which the
// site's most-visited page cannot spend on a decorative thumbnail — and the queued
// geoBoundaries re-source grows them ~3.8× again. This one is drawn at ~520 px for a
// 1000-unit viewBox (0.52 px/unit), so ε=${MINI_SIMPLIFY_EPSILON} is a worst-case ~${(MINI_SIMPLIFY_EPSILON * 0.52).toFixed(2)} px deviation.
// Do NOT use it for anything clickable, hoverable or zoomable — at this tolerance the
// outline is a picture, not a hit target.

/** One decimated province outline, in the SAME \`MAP_VIEWBOX\` space as the primary artifact. */
export interface MiniProvinceShape {
  /** Plaka kodu (zero-padded 2-digit) — the join key to API province data (\`data-region\`). */
  readonly plateCode: string;
  /** SVG path \`d\` (one or more closed subpaths for provinces with islands). */
  readonly d: string;
}

/**
 * The SAME viewBox string as \`MAP_VIEWBOX\` — both are emitted from the pinned \`TR_FRAME\`
 * in one generator run, and \`tr-provinces-mini.test.ts\` asserts they are identical. It is a
 * literal rather than a re-export so importing the thumbnail cannot drag the 63 kB
 * interactive artifact into the homepage's module graph.
 */
export const MINI_MAP_VIEWBOX = "0 0 ${VIEW_WIDTH} ${viewHeight}" as const;

export const MINI_PROVINCE_SHAPES: readonly MiniProvinceShape[] = [
${miniBody}
];
`;

writeFileSync(OUT_MINI, miniOut, "utf8");
const miniBytes = Buffer.byteLength(miniOut, "utf8");
const vertexCount = (list) => list.reduce((sum, s) => sum + (s.d.match(/[ML]/g)?.length ?? 0), 0);
console.log(
  `generate:map → ${OUT_MINI}\n  ${miniShapes.length} provinces · ε=${MINI_SIMPLIFY_EPSILON} · ${MINI_DECIMALS} decimals · ` +
    `${vertexCount(miniShapes)} vertices (${(
      (vertexCount(miniShapes) / vertexCount(shapes)) *
      100
    ).toFixed(0)}% of ${vertexCount(shapes)}) · ${(miniBytes / 1024).toFixed(1)} kB`,
);
