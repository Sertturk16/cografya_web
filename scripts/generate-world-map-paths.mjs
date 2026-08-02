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
 * EVERY snapshot feature is drawn — there is no exclusion list. Antarctica (AQ) used to be
 * the one deliberate omission (a ~5k-vertex full-width polar cap, the standard web-world-map
 * cut); that call was REVERSED on owner instruction ("the world map must not have holes",
 * 2026-07-26) after the `/dunya` completeness audit. It is drawn with a deliberately coarser
 * simplification tolerance (`SIMPLIFY_EPSILON_BY_ISO`) because it is a non-navigable backdrop
 * mass whose coastline detail carries no navigation value, plus a sub-pixel ring filter
 * (`MIN_RING_AREA_BY_ISO`) that drops only rings smaller than ~1 px at world scale:
 * 6.0 kB raw / 2.2 kB gzipped instead of ~19.8 kB raw.
 * Including it extends the framing to the south pole, so the shared viewBox grows taller —
 * the projected X extent and the northern edge are unchanged, so every already-emitted
 * country path stays byte-identical (verified at generation time, see `pnpm generate:world-map`).
 *
 * Run once and COMMIT the output (`pnpm generate:world-map`). CI/runtime never invoke this —
 * the app imports the committed artifact. The raw GeoJSON never reaches the client (same
 * discipline as the Türkiye map, → SPEC §5.2 / DEC 2026-07-10): only the produced SVG
 * paths ship.
 *
 * Projection: **Natural Earth 1** (Tom Patterson), a general-purpose pseudo-cylindrical
 * projection built exactly for "a nice-looking whole-world map". Applied point-wise via the
 * published polynomial — the identical closed-form d3-geo's `geoNaturalEarth1()` uses (same
 * constants), inlined here rather than pulling a dependency, matching this file's existing
 * hand-rolled-geometry style (see `simplify` below). It converges the meridians toward the
 * poles, so high latitudes (Greenland, Russia, Canada, Scandinavia) no longer read as the
 * horizontally-stretched "flat top" the plain equirectangular outline produced. Framed on the
 * bounding box of ALL features in PROJECTED space (pole to pole). This map is
 * navigation CHROME, not a data encoding, so the projection is chosen for legibility, not
 * measurement fidelity (same doctrine as the Türkiye map).
 *
 * Purely a build-time coordinate transform: the pipeline is still point-wise, the raw GeoJSON
 * still never reaches the client, and the React component / its SEO+CWV surface are untouched
 * — only the emitted path `d` values and the derived viewBox height change.
 *
 * Simplification is TOPOLOGICAL (`lib/map-topology.mjs`): a border shared by two countries is
 * cut out as an arc, simplified ONCE, and handed to both neighbours, so they cannot disagree
 * about which vertices survive and leave a sliver of sea along their common border. Emission
 * is RELATIVE (`lib/path-encode.mjs`) with a quantised cursor. Both modules are shared with
 * the Türkiye generator; read their headers before touching either.
 *
 * Interior rings are DRAWN AS HOLES. Every interior ring in this snapshot is an enclave — the
 * hole in South Africa is Lesotho, the holes in Kyrgyzstan are Uzbek and Tajik exclaves — and
 * dropping them made the surrounding country paint straight over a sovereign state that draws
 * earlier in ISO order (Lesotho was invisible and unclickable on the live map; its `<a>` was
 * in the HTML, so this was a rendering defect, not an SEO one). They are emitted as extra
 * subpaths and the component paints with `fill-rule="evenodd"`, which makes the hole a hole
 * without relying on the source's ring winding order. DEC 2026-07-26's "the world map must
 * not have holes" is about MISSING LANDMASS; an enclave hole is the opposite — the enclave
 * draws its own shape into it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildTopology, simplify } from "./lib/map-topology.mjs";
import { encodePath } from "./lib/path-encode.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "data", "world-countries.geojson");
const OUT = join(ROOT, "lib", "map", "world-countries.generated.ts");

// --- Projection + simplification tuning ---------------------------------------
const VIEW_WIDTH = 1000; // shared viewBox width (svg units)
const PADDING = 4; // inset so the framed world is not flush against the edge
// Douglas-Peucker tolerance in projected svg units. At the full-world equatorial scale
// (~2.7 units/° — Natural Earth's units/° shrink toward the poles, so this is the loosest,
// low-latitude case) this ≈ 0.055°, small enough that mid-small countries (Singapore, Malta, Bahrain, the two
// Cyprus halves, Palestine, Kosovo) survive as clickable polygons, while still cutting the
// artifact from a raw ~100k vertices to a shippable size. Micro-states below MARKER_MIN_SPAN
// (Vatican, Nauru, Monaco, Tuvalu, …) are handled by the marker fallback below — NOT dropped
// — so tuning this for size can never again silently delete a country from the link surface.
const SIMPLIFY_EPSILON = 0.15;
/**
 * Per-join-key tolerance overrides. Only for shapes that are pure backdrop mass — never for
 * anything the api can seed into a clickable country, where coastline fidelity is part of the
 * click target. Antarctica: a ~5k-vertex polar cap that is not navigable and never gets a
 * `/dunya/{slug}` page, so its coastline detail buys nothing; 0.8 (vs the global 0.15) keeps
 * the recognisable outline at world scale for a fraction of the bytes (see below).
 * @type {Map<string, number>}
 */
const SIMPLIFY_EPSILON_BY_ISO = new Map([["AQ", 0.8]]);
/**
 * Companion to the tolerance override: the minimum area (svg units²) a ring of such a shape
 * must ACTUALLY enclose to be drawn at all. Measured on the TRUE projected ring, before any
 * simplification — see the ordering note in the emit loop below, this is the whole point.
 *
 * Why the filter exists: Douglas-Peucker at a coarse tolerance does not delete an
 * archipelago's islets, it FLATTENS each of them into a near-zero-area zigzag sliver, which
 * reads as "hair" along the coast the moment the user zooms in (and this map zooms).
 * Antarctica's snapshot geometry carries 108 outer rings; 72 of them are genuinely sub-pixel
 * at world scale (1 unit² ≈ 1 px), and those are the ones this bar removes.
 *
 * What it guarantees, precisely: a ring is dropped ONLY if the place itself is smaller than
 * ~1 px on the rendered world map. Every ring at or above the bar is drawn — and drawn at
 * whatever tolerance preserves its shape (the coarse pass flattens 18 of the 36 survivors to
 * near-zero area, so those are re-simplified at the global tolerance rather than shipped as
 * hairlines). Cost of that honesty: 6.0 kB raw / 2.2 kB gzip for AQ, vs 6.8 kB raw with no
 * filter at all and ~19.8 kB unsimplified.
 *
 * Defaults to 0 for every other key, so no already-emitted country path is affected — the
 * 239 pre-existing shapes stay byte-identical, which is the standing gate on this artifact.
 * @type {Map<string, number>}
 */
const MIN_RING_AREA_BY_ISO = new Map([["AQ", 1]]);
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

/** Absolute shoelace area of a projected ring, in svg units². */
function ringArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

/** Visit every [lon, lat] pair in a Polygon / MultiPolygon geometry. */
function eachCoord(geometry, fn) {
  const polys = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  for (const poly of polys) for (const ring of poly) for (const pt of ring) fn(pt);
}

/**
 * Every polygon of a geometry as `{ outer, holes }` (each MultiPolygon member is a separate
 * island/landmass; ring 0 is its outline, rings 1+ are its enclave holes).
 */
function polygonRings(geometry) {
  const polys = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  return polys.map((poly) => ({ outer: poly[0], holes: poly.slice(1) }));
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
 *  for a country too small to survive simplification. Synthetic geometry, so it is built
 *  after the topology pass and never offered to it as a ring. */
function markerDiamond(cx, cy) {
  const r = MARKER_RADIUS;
  return [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy],
  ];
}

// --- Load + first pass: bounding box of ALL features (nothing is excluded) ---
const geojson = JSON.parse(readFileSync(SRC, "utf8"));
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error(`Unexpected GeoJSON: ${SRC}`);
}

const drawn = geojson.features;

const DEG2RAD = Math.PI / 180;

/**
 * Natural Earth 1 raw projection (Tom Patterson) — the exact polynomial d3-geo's
 * `geoNaturalEarth1()` evaluates, with the same published constants. Point-wise and
 * closed-form: input `[lon, lat]` in DEGREES, output `[x, y]` in dimensionless projection
 * units (equator centred at 0). Meridians converge toward the poles, so high-latitude land
 * is no longer horizontally stretched the way plain equirectangular stretched it. The raw
 * output is framed to the viewBox by the scale/translate derived in the first pass below.
 */
function naturalEarthRaw([lon, lat]) {
  const lambda = lon * DEG2RAD;
  const phi = lat * DEG2RAD;
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;
  return [
    lambda *
      (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))),
    phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))),
  ];
}

// First pass: bounding box of the DRAWN features in PROJECTED (Natural Earth) space — the
// projection is non-linear, so framing must be computed on projected coordinates, not on the
// raw lon/lat extent.
let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;
for (const feature of drawn) {
  eachCoord(feature.geometry, (pt) => {
    const [x, y] = naturalEarthRaw(pt);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
}
if (!Number.isFinite(minX)) {
  throw new Error("No drawable features found — check the snapshot.");
}

// Scale so the full projected width fills the viewBox; height follows the projected span so
// the map keeps Natural Earth's intrinsic aspect ratio.
const scale = (VIEW_WIDTH - 2 * PADDING) / (maxX - minX);
const viewHeight = Math.round((maxY - minY) * scale + 2 * PADDING);

/** [lon, lat] → [x, y] in the shared viewBox (north up). */
function project(coord) {
  const [x, y] = naturalEarthRaw(coord);
  return [PADDING + (x - minX) * scale, PADDING + (maxY - y) * scale];
}

// --- Second pass (a): COLLECT every ring that will be drawn --------------------
// Nothing is simplified here. Douglas-Peucker now runs per shared ARC, not per ring, so the
// whole ring set has to be on the table before any tolerance is applied — that is the entire
// point of the topology module.
/**
 * One feature's drawing plan. `marker` short-circuits everything else; otherwise each entry
 * of `polygons` names the ring indices this feature contributed to `topologyRings`.
 * @type {{ iso: string, geoName: string, verts: number, bbox: { cx: number, cy: number, w: number, h: number },
 *          marker: [number, number][] | null,
 *          polygons: { outer: number, holes: number[] }[] }[]}
 */
const plans = [];
/** @type {{ points: [number, number][], epsilon: number }[]} */
const topologyRings = [];
/** Every join key we attempted to draw — checked against the emitted keys below so a
 *  future silent drop (the Nauru/Vatican bug) fails the build instead of shipping. */
const expectedKeys = new Set();
let holeRingCount = 0;
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

  const epsilon = SIMPLIFY_EPSILON_BY_ISO.get(iso) ?? SIMPLIFY_EPSILON;
  const minRingArea = MIN_RING_AREA_BY_ISO.get(iso) ?? 0;
  const bbox = projectedBBox(feature.geometry, project);
  const verts = vertexCount(feature.geometry);

  if (bbox.w < MARKER_MIN_SPAN && bbox.h < MARKER_MIN_SPAN) {
    // Micro-state: its whole outline is smaller than the simplify tolerance and would
    // collapse to nothing. Emit a fixed-size marker so the country still gets a shape (and
    // thus a crawlable link) instead of being silently dropped.
    plans.push({
      iso,
      geoName,
      verts,
      bbox,
      marker: markerDiamond(bbox.cx, bbox.cy),
      polygons: [],
    });
    continue;
  }

  /** @type {{ outer: number, holes: number[] }[]} */
  const polygons = [];
  for (const { outer, holes } of polygonRings(feature.geometry)) {
    const projected = outer.map(project);
    // ORDER MATTERS. The size decision is made on the TRUE ring, before any tolerance has
    // touched it: testing the SIMPLIFIED ring conflates "genuinely sub-pixel" with
    // "flattened by our own coarse tolerance" and silently deletes real islands (this is
    // exactly what it did — 18 real Antarctic rings, the largest a true 4.6 u² / 5.8 × 1.6 u
    // island, a visible hole at MAX_ZOOM; PR #23 review I1). Both figures are measured on
    // the TRUE projected ring, which is the object the test is deciding about.
    // Backdrop-only: minRingArea is 0 for every normal country, so their rings skip this
    // test entirely.
    if (minRingArea > 0 && ringArea(projected) < minRingArea) continue;
    // A ring that cleared the size bar IS a place, so it has to be drawn as one. If the
    // coarse backdrop tolerance would collapse it into a sliver, ask for the global
    // tolerance instead of shipping a hairline — a hairline is the very artifact the size
    // bar exists to remove, so emitting one would defeat the filter from the other side.
    // Decided on the ring ALONE, before topology, which is exact here precisely because the
    // only shape with a coarse override (Antarctica) borders nothing and therefore shares no
    // arc. Should that ever stop being true, the topology module simplifies a shared arc at
    // the FINEST epsilon of its owners, so a coarse backdrop can still never degrade a
    // neighbour — the trial below would merely become conservative.
    let ringEpsilon = epsilon;
    if (minRingArea > 0) {
      const trial = simplify(projected, epsilon);
      if (trial.length < 3 || ringArea(trial) < minRingArea) ringEpsilon = SIMPLIFY_EPSILON;
    }
    const outerIndex = topologyRings.length;
    topologyRings.push({ points: projected, epsilon: ringEpsilon });
    /** @type {number[]} */
    const holeIndices = [];
    for (const hole of holes) {
      holeIndices.push(topologyRings.length);
      topologyRings.push({ points: hole.map(project), epsilon: ringEpsilon });
      holeRingCount++;
    }
    polygons.push({ outer: outerIndex, holes: holeIndices });
  }
  plans.push({ iso, geoName, verts, bbox, marker: null, polygons });
}

// --- Second pass (b): ONE topology + simplification pass over every collected ring ---
const topology = buildTopology(topologyRings);
const simplifiedRings = topology.rings;
// The whole point of the topology pass: neighbours must agree, vertex for vertex, about the
// border they share. If they do not, the artifact ships visible slivers of sea along land
// borders — so fail the build BEFORE writing rather than let the regression through.
if (topology.stats.asymmetricSharedNodes !== 0) {
  throw new Error(
    `generate:world-map — ${topology.stats.asymmetricSharedNodes} shared source vertices were ` +
      `kept by one owner and dropped by another. Topology extraction is broken; the emitted ` +
      `borders would not coincide.`,
  );
}

// --- Second pass (c): assemble one merged path per ISO join key ------------------
/** @type {Map<string, { geoName: string, labelVerts: number, subpaths: [number, number][][] }>} */
const byIso = new Map();
let markerCount = 0;
let emittedHoles = 0;
for (const plan of plans) {
  const { iso, geoName, verts } = plan;
  /** @type {[number, number][][]} */
  const subpaths = [];
  if (plan.marker) {
    subpaths.push(plan.marker);
    markerCount++;
  } else {
    for (const polygon of plan.polygons) {
      const outer = simplifiedRings[polygon.outer];
      // A tiny islet of a larger country — safely dropped, and its holes go with it (a hole
      // without its landmass would punch through whatever is drawn underneath).
      if (outer.length < 3) continue;
      subpaths.push(outer);
      for (const holeIndex of polygon.holes) {
        const hole = simplifiedRings[holeIndex];
        if (hole.length < 3) continue; // sub-tolerance enclave: nothing left to cut out
        subpaths.push(hole);
        emittedHoles++;
      }
    }
    // Safety net: a feature whose bounding box cleared MARKER_MIN_SPAN must still have
    // produced at least one ring. If every ring collapsed, fall back to a marker rather than
    // dropping the country — the completeness assertion below is the hard guarantee, this
    // keeps it satisfiable. The completeness assertion would NOT catch this on its own: it
    // checks presence, not plausibility. So say it out loud, WITH the two numbers that tell
    // the two possible causes apart:
    //
    //   • total ring area ≈ 0 → a DISPERSED MICRO-ARCHIPELAGO. Every island is genuinely
    //     sub-pixel; only the chain between them spans more than MARKER_MIN_SPAN, which is a
    //     per-axis bbox test and cannot see that. The marker is the correct rendering, and
    //     the honest one — Maldives and the British Virgin Islands used to emit zero-area
    //     degenerate subpaths here instead: in the artifact, invisible on screen.
    //   • total ring area meaningfully > 0 → a real landmass reduced to a 2 u diamond, i.e.
    //     a tuning bug (too coarse an epsilon, too high a ring-area bar).
    if (subpaths.length === 0) {
      const area = plan.polygons.reduce(
        (sum, polygon) => sum + ringArea(topologyRings[polygon.outer].points),
        0,
      );
      console.warn(
        `generate:world-map — NOTE: "${geoName}" (${iso}) spans ` +
          `${plan.bbox.w.toFixed(2)} × ${plan.bbox.h.toFixed(2)} u but every ring collapsed, ` +
          `so it is drawn as a marker diamond. Total true ring area ${area.toFixed(2)} u² — ` +
          `≈0 means a dispersed micro-archipelago (expected); anything larger means ` +
          `SIMPLIFY_EPSILON_BY_ISO / MIN_RING_AREA_BY_ISO need retuning.`,
      );
      subpaths.push(markerDiamond(plan.bbox.cx, plan.bbox.cy));
      markerCount++;
    }
  }

  // Merge features that share a join key (e.g. Australia + its external territories) into a
  // single shape → one <a>, one internal link per country, all its polygons highlighting
  // together. The label follows the largest member (provenance only; the UI shows nameTr).
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
  .map(([iso, v]) => ({
    iso,
    geoName: v.geoName,
    d: encodePath(v.subpaths, { decimals: DECIMALS }),
  }))
  // Locale PINNED: the artifact mixes uppercase ISO keys with lowercase synthetic `x-…`
  // backdrop keys, whose relative order differs between ICU locales. The standing
  // `generate:world-map:check` drift gate would otherwise rest on every machine happening
  // to run the same default locale.
  .sort((a, b) => a.iso.localeCompare(b.iso, "en"));

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
// Inline SVG path data for the full-world country map, Natural-Earth-1-projected + simplified
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
  /**
   * SVG path \`d\` — one closed subpath per landmass, plus one per ENCLAVE HOLE (Lesotho
   * inside South Africa, the Uzbek/Tajik exclaves inside Kyrgyzstan, …). Holes rely on
   * \`fill-rule="evenodd"\`, so any element painting this string MUST set it; with the
   * default \`nonzero\` an enclave would be filled over by its surrounding country.
   *
   * Encoded relatively (\`M\` once, then an \`l\` run) — the outline is identical to the
   * absolute form, it is just ~26% fewer bytes on the wire.
   */
  readonly d: string;
}

/** Shared SVG viewBox all ${shapes.length} paths are projected into (whole world, pole to pole). */
export const WORLD_MAP_VIEWBOX = "0 0 ${VIEW_WIDTH} ${viewHeight}" as const;

export const COUNTRY_SHAPES: readonly CountryShape[] = [
${body}
];
`;

writeFileSync(OUT, out, "utf8");
const bytes = Buffer.byteLength(out, "utf8");
const { stats } = topology;
console.log(
  `generate:world-map → ${OUT}\n  ${shapes.length} shapes (${markerCount} micro-state markers) · ` +
    `viewBox 0 0 ${VIEW_WIDTH} ${viewHeight} · ${(bytes / 1024).toFixed(1)} kB · ` +
    `${expectedKeys.size} source keys all present ✓\n  topology: ${stats.inputRings} rings ` +
    `(${holeRingCount} enclave holes, ${emittedHoles} survived) → ${stats.arcs} arcs ` +
    `(${stats.sharedArcs} shared) · ${stats.inputVertices} → ${stats.outputVertices} vertices\n` +
    `  shared source nodes: ${stats.sharedNodes} · ` +
    `ASYMMETRIC: ${stats.asymmetricSharedNodes} ✓`,
);
