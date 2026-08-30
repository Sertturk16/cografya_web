// @ts-check
/**
 * Build-time generator: full-world country boundary GeoJSON → the `/turkiye` map's
 * geographic CONTEXT backdrop, in the pinned TR context frame (`turkiye-yenileme` PR-B,
 * plan §5.0-2 / §5.3).
 *
 * Reads the SAME committed snapshot the world map already reads —
 * `data/world-countries.geojson` (Natural Earth Admin-0 1:50m, Public Domain,
 * `data/README.md`) — and re-projects it into `TR_CONTEXT_FRAME`
 * (`scripts/lib/tr-frame.mjs`), the same equirectangular coordinate space the province
 * artifact already lives in. This is deliberately a SEPARATE artifact from
 * `world-countries.generated.ts`, never a slice of it: that artifact is Natural-Earth-1
 * projected (curved meridians, framed on the whole globe), and no scale-and-translate of a
 * pseudocylindrical projection reproduces an equirectangular one over a 20°-wide, 8°-tall
 * region — the two disagree nonlinearly, so borders drawn from it would not meet the
 * province outlines (plan §5.0-2). Re-projecting the same source bytes through
 * `projectToFrame()` is what puts a new context shape and an existing province shape in the
 * same coordinate space STRUCTURALLY, with no second registration step to keep in sync.
 *
 * Emits `lib/map/tr-context.generated.ts`: one shape per ISO join key that survives clipping
 * to `TR_CONTEXT_FRAME`, carrying its path `d` plus two generator-computed label placement
 * fields (`labelPoint`, `labelRadius` — see below). No exclusion list: every Natural Earth
 * feature is projected and clipped, and whichever ones have any visible area inside the frame
 * are drawn — a threshold on visible area is a geographic rule, a hand-kept "immediate
 * neighbours" list is a judgement that would need re-litigating every time the frame moves
 * (plan §5.3). Measured on the frame this generator ships with: exactly 15 features survive
 * (Türkiye itself plus 14 neighbours/near-neighbours), matching the plan's own table.
 *
 * ## Pipeline (plan §5.3)
 *
 * 1. Project every ring of every feature with `projectToFrame()` — the SAME projection
 *    function `generate-map-paths.mjs` and `generate-tr-inland-water.mjs` already use, so
 *    every TR-frame artifact is projected identically.
 * 2. CLIP each ring to `TR_CONTEXT_FRAME` with Sutherland–Hodgman rectangle clipping. This is
 *    the one helper the existing script libraries (`map-topology.mjs`, `path-encode.mjs`) do
 *    not already have — everything else below is reused from them unchanged.
 * 3. Drop a ring whose TRUE clipped area (before any simplification) falls under
 *    `MIN_VISIBLE_RING_AREA` — the same "decide on the object itself, not on what our own
 *    simplification left of it" ordering `generate-world-map-paths.mjs` uses for the AQ
 *    islet filter, and for the identical reason: testing the SIMPLIFIED ring conflates
 *    "genuinely sub-pixel" with "flattened by our own tolerance" and silently deletes real
 *    islands. `MIN_RING_AREA_BY_ISO` is the per-ISO companion knob (a coarser bar for a
 *    shape that is backdrop mass only) — empty today: nothing drawn here is Antarctica-scale
 *    backdrop, every one of the 15 survivors is either the country the map is about or a real
 *    neighbour whose coastline detail is part of what a reader is looking at.
 * 4. ONE topological simplification pass (`scripts/lib/map-topology.mjs`) over every ring that
 *    survived step 3, TR included — a border two of these countries share inside the frame
 *    (Iraq/Iran, Georgia/Armenia/Azerbaijan, …) is decided once and handed to both, so two
 *    neighbours cannot disagree about their common line the way `map-topology.mjs`'s own
 *    header measures the pre-topology world artifact once did (6.2% of shared vertices).
 *    Epsilon is FINER than the world generator's on purpose: `SIMPLIFY_EPSILON = 0.4` TR-frame
 *    units (≈ 670 m) against the world generator's effective ≈ 3.6 TR-unit-equivalent — this
 *    map sits at a much larger effective scale than the whole-world map, so the seam this
 *    generator has to keep honest (plan §5.0-3, measured max 4.60 u) needs a finer tolerance
 *    to stay closed.
 * 5. `assertInsideContextFrame()` — the same inverted safety net `tr-frame.mjs` already gives
 *    `TR_FRAME`, run on every final simplified vertex: nothing may sit outside the pinned
 *    frame after clipping (a clip bug would show up here as a thrown build, not a silent
 *    off-frame shape).
 * 6. Emit, keyed by the same ISO join key `world-countries.generated.ts` uses (uppercase
 *    alpha-2 for recognised entities, the api's private-use `QN` for Northern Cyprus — the
 *    identical join convention, so `QN`/`CY` resolve against the live api exactly as they do
 *    on `/dunya`).
 *
 * ## Label placement fields — deterministic, not hand-set
 *
 * `labelPoint` is the POLE OF INACCESSIBILITY of the shape's largest surviving subpath — the
 * interior point furthest from any edge — computed with the standard grid-refinement
 * algorithm (a bounded quadtree search: start from a coarse cell covering the ring's bbox,
 * always subdivide the most promising cell next, stop once no remaining cell could beat the
 * current best by more than the requested precision). `labelRadius` is that point's distance
 * to the nearest edge, i.e. the largest circle the shape can hold. Both are recomputed from
 * the shape itself every run, so a frame move or a snapshot refresh cannot leave a stale
 * hand-set offset behind — the same self-correcting property the api-sourced country names
 * have (plan §5.6).
 *
 * Run once and COMMIT the output (`pnpm generate:tr-context`). CI/runtime never invoke this —
 * the app imports the committed artifact, exactly like its three siblings.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildTopology } from "./lib/map-topology.mjs";
import { encodePath } from "./lib/path-encode.mjs";
import {
  assertInsideContextFrame,
  projectToFrame,
  TR_CONTEXT_FRAME,
  TR_CONTEXT_VIEWBOX,
} from "./lib/tr-frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "data", "world-countries.geojson");
const OUT = join(ROOT, "lib", "map", "tr-context.generated.ts");

// --- Tuning -------------------------------------------------------------------
/** Douglas-Peucker tolerance, in TR-frame svg units — see the module docblock, pipeline
 *  step 4, for why this is finer than the world generator's. */
const SIMPLIFY_EPSILON = 0.4;
/** Per-ISO override of {@link SIMPLIFY_EPSILON} for backdrop-only mass (the AQ pattern on
 *  the world generator). Empty: nothing drawn here is backdrop-only the way Antarctica is
 *  on the world map — every survivor is either the map's own subject or a real, nameable
 *  neighbour.
 *  @type {Map<string, number>} */
const SIMPLIFY_EPSILON_BY_ISO = new Map();
/** Minimum TRUE clipped ring area (svg units², measured BEFORE simplification — see the
 *  module docblock) a ring must clear to be drawn at all. Small enough that it only removes
 *  a genuine sliver (a frame-edge clip artifact), never a real, visible islet: the smallest
 *  ring that actually survives clipping on this frame (a Greek Aegean islet) measures
 *  15.75 u², two orders of magnitude above this bar. */
const MIN_VISIBLE_RING_AREA = 0.1;
/** Per-ISO companion to {@link MIN_VISIBLE_RING_AREA} (the AQ-pattern knob) — empty for the
 *  same reason {@link SIMPLIFY_EPSILON_BY_ISO} is.
 *  @type {Map<string, number>} */
const MIN_RING_AREA_BY_ISO = new Map();
/** Minimum TOTAL true clipped area (svg units², summed across every surviving ring) a
 *  feature must clear to be drawn as a shape at all — the "drop features whose total clipped
 *  outer-ring area is below a stated threshold" step (plan §5.3 step 3). Measured on this
 *  frame: every feature that clips to any meaningful geography at all clears 135 u² (Serbia,
 *  the smallest of the 15); nothing else exceeds a few hundredths of a unit (a frame-corner
 *  graze). Set two orders of magnitude below the smallest real survivor so a future frame
 *  move cannot silently start dropping a genuine neighbour. */
const MIN_FEATURE_AREA = 1;
const DECIMALS = 1;
/** Precision (svg units) the pole-of-inaccessibility search stops refining at — see
 *  `poleOfInaccessibility()`. Comfortably below anything a label placement decision would
 *  notice. */
const LABEL_PRECISION = 0.5;

// --- Geometry primitives --------------------------------------------------------
/** Absolute shoelace area of an OPEN ring. */
function ringArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

/**
 * Sutherland–Hodgman clip of one OPEN ring against one convex half-plane.
 * @param {[number, number][]} points
 * @param {(p: [number, number]) => boolean} inside
 * @param {(a: [number, number], b: [number, number]) => [number, number]} intersect
 */
function clipEdge(points, inside, intersect) {
  if (points.length === 0) return points;
  /** @type {[number, number][]} */
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + points.length) % points.length];
    const currIn = inside(curr);
    const prevIn = inside(prev);
    if (currIn) {
      if (!prevIn) output.push(intersect(prev, curr));
      output.push(curr);
    } else if (prevIn) {
      output.push(intersect(prev, curr));
    }
  }
  return output;
}

/**
 * Clip one OPEN ring to the rectangle `[minX,maxX] × [minY,maxY]`, one half-plane at a time.
 * Sutherland–Hodgman is exact for an arbitrary (possibly non-convex) subject ring clipped
 * against a convex clip region — a rectangle — which is the only case this generator needs.
 * @param {[number, number][]} ring
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} rect
 * @returns {[number, number][]}
 */
function clipRingToRect(ring, rect) {
  let poly = ring;
  poly = clipEdge(
    poly,
    (p) => p[0] >= rect.minX,
    (a, b) => {
      const t = (rect.minX - a[0]) / (b[0] - a[0]);
      return [rect.minX, a[1] + t * (b[1] - a[1])];
    },
  );
  poly = clipEdge(
    poly,
    (p) => p[0] <= rect.maxX,
    (a, b) => {
      const t = (rect.maxX - a[0]) / (b[0] - a[0]);
      return [rect.maxX, a[1] + t * (b[1] - a[1])];
    },
  );
  poly = clipEdge(
    poly,
    (p) => p[1] >= rect.minY,
    (a, b) => {
      const t = (rect.minY - a[1]) / (b[1] - a[1]);
      return [a[0] + t * (b[0] - a[0]), rect.minY];
    },
  );
  poly = clipEdge(
    poly,
    (p) => p[1] <= rect.maxY,
    (a, b) => {
      const t = (rect.maxY - a[1]) / (b[1] - a[1]);
      return [a[0] + t * (b[0] - a[0]), rect.maxY];
    },
  );
  return poly;
}

const CONTEXT_RECT = {
  minX: TR_CONTEXT_FRAME.minX,
  minY: TR_CONTEXT_FRAME.minY,
  maxX: TR_CONTEXT_FRAME.minX + TR_CONTEXT_FRAME.width,
  maxY: TR_CONTEXT_FRAME.minY + TR_CONTEXT_FRAME.height,
};

/** Every polygon of a geometry as `{ outer, holes }` — mirrors the world generator's helper
 *  of the same shape (each MultiPolygon member is a separate island/landmass). */
function polygonRings(geometry) {
  const polys = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  return polys.map((poly) => ({ outer: poly[0], holes: poly.slice(1) }));
}

// --- Pole of inaccessibility (deterministic label placement, plan §5.3) --------------------
/** Perpendicular... distance from `p` to segment `a`→`b`. */
function pointToSegmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Even-odd point-in-ring test on an OPEN ring. */
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Signed distance from `(x,y)` to a ring's boundary — positive inside, negative outside. */
function signedDistanceToRing(x, y, ring) {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = pointToSegmentDistance([x, y], ring[j], ring[i]);
    if (d < min) min = d;
  }
  return pointInRing(x, y, ring) ? min : -min;
}

/**
 * Pole of inaccessibility of one simple (hole-free) polygon ring — the interior point
 * furthest from the boundary, found by the standard grid-refinement search: seed a coarse
 * grid of cells over the ring's bbox, repeatedly pop the most promising remaining cell
 * (highest possible distance any point inside it could reach) and subdivide it into four,
 * until no remaining cell could beat the current best by more than `precision`.
 *
 * @param {[number, number][]} ring
 * @param {number} precision
 * @returns {{ x: number, y: number, d: number }}
 */
function poleOfInaccessibility(ring, precision) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width === 0 || height === 0) return { x: minX, y: minY, d: 0 };

  const cellSize = Math.min(width, height);
  let h = cellSize / 2;

  const makeCell = (x, y, h) => {
    const d = signedDistanceToRing(x, y, ring);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  /** @type {ReturnType<typeof makeCell>[]} */
  const queue = [];
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      queue.push(makeCell(x + h, y + h, h));
    }
  }

  let best = makeCell(minX + width / 2, minY + height / 2, 0);
  const bbox = makeCell(minX + width / 2, minY + height / 2, 0);
  if (bbox.d > best.d) best = bbox;

  let guard = 0;
  const GUARD_MAX = 200000; // generous bound; real convergence is orders of magnitude faster
  while (queue.length > 0 && guard < GUARD_MAX) {
    guard++;
    queue.sort((a, b) => a.max - b.max);
    const cell = /** @type {ReturnType<typeof makeCell>} */ (queue.pop());
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue; // no descendant can beat best meaningfully
    const half = cell.h / 2;
    if (half < precision / 4) continue; // cells too small to matter further
    queue.push(makeCell(cell.x - half, cell.y - half, half));
    queue.push(makeCell(cell.x + half, cell.y - half, half));
    queue.push(makeCell(cell.x - half, cell.y + half, half));
    queue.push(makeCell(cell.x + half, cell.y + half, half));
  }
  return { x: best.x, y: best.y, d: Math.max(best.d, 0) };
}

// --- Load ------------------------------------------------------------------------
const geojson = JSON.parse(readFileSync(SRC, "utf8"));
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  throw new Error(`Unexpected GeoJSON: ${SRC}`);
}

// --- Pass 1: project + clip every ring of every feature, filter by ring/feature area ------
/**
 * @type {{ iso: string, geoName: string, polygons: { outer: number, holes: number[] }[] }[]}
 */
const plans = [];
/** @type {{ points: [number, number][], epsilon: number }[]} */
const topologyRings = [];
let rawRingCount = 0;
let survivingRingCount = 0;

for (const feature of geojson.features) {
  const rawIso = feature.properties?.iso;
  const iso =
    typeof rawIso === "string" && /^[a-z]{2}$/i.test(rawIso) ? rawIso.toUpperCase() : rawIso;
  const geoName = feature.properties?.name;
  if (typeof iso !== "string" || iso.length < 2) continue; // synthetic backdrop keys never join here either

  const epsilon = SIMPLIFY_EPSILON_BY_ISO.get(iso) ?? SIMPLIFY_EPSILON;
  const minRingArea = Math.max(MIN_VISIBLE_RING_AREA, MIN_RING_AREA_BY_ISO.get(iso) ?? 0);

  /** @type {{ outer: number, holes: number[] }[]} */
  const polygons = [];
  let featureTrueArea = 0;

  for (const { outer, holes } of polygonRings(feature.geometry)) {
    rawRingCount++;
    const projectedOuter = outer.map((pt) => projectToFrame(pt));
    const clippedOuter = clipRingToRect(projectedOuter, CONTEXT_RECT);
    if (clippedOuter.length < 3) continue;
    const trueArea = ringArea(clippedOuter);
    if (trueArea < minRingArea) continue;

    const outerIndex = topologyRings.length;
    topologyRings.push({ points: clippedOuter, epsilon });
    featureTrueArea += trueArea;
    survivingRingCount++;

    /** @type {number[]} */
    const holeIndices = [];
    for (const hole of holes) {
      const projectedHole = hole.map((pt) => projectToFrame(pt));
      const clippedHole = clipRingToRect(projectedHole, CONTEXT_RECT);
      if (clippedHole.length < 3) continue;
      if (ringArea(clippedHole) < minRingArea) continue;
      holeIndices.push(topologyRings.length);
      topologyRings.push({ points: clippedHole, epsilon, preserve: true });
      survivingRingCount++;
    }
    polygons.push({ outer: outerIndex, holes: holeIndices });
  }

  if (polygons.length === 0 || featureTrueArea < MIN_FEATURE_AREA) continue;
  plans.push({ iso, geoName, polygons });
}

// --- Pass 2: ONE topology + simplification pass over every surviving ring -----------------
const topology = buildTopology(topologyRings);
const simplifiedRings = topology.rings;
if (topology.stats.asymmetricSharedNodes !== 0) {
  throw new Error(
    `generate:tr-context — ${topology.stats.asymmetricSharedNodes} shared source vertices were ` +
      `kept by one owner and dropped by another. Topology extraction is broken; the emitted ` +
      `context borders would not coincide.`,
  );
}

// --- Pass 3: assemble one shape per ISO, compute the label placement fields ---------------
/** @type {{ iso: string, geoName: string, d: string, labelPoint: { x: number, y: number }, labelRadius: number }[]} */
const shapes = [];
let allProjectedPoints = /** @type {[number, number][]} */ ([]);

for (const plan of plans) {
  /** @type {[number, number][][]} */
  const subpaths = [];
  for (const polygon of plan.polygons) {
    const outer = simplifiedRings[polygon.outer];
    if (outer.length < 3 || ringArea(outer) < MIN_VISIBLE_RING_AREA) continue;
    subpaths.push(outer);
    for (const holeIndex of polygon.holes) {
      const hole = simplifiedRings[holeIndex];
      if (hole.length < 3 || ringArea(hole) < MIN_VISIBLE_RING_AREA) continue;
      subpaths.push(hole);
    }
  }
  if (subpaths.length === 0) continue;

  for (const sp of subpaths) allProjectedPoints = allProjectedPoints.concat(sp);

  // Label placement is derived from the LARGEST surviving subpath — a country's mainland,
  // never one of its islands (Greece's biggest Aegean island is nowhere near the size of its
  // clipped mainland fragment).
  let largest = subpaths[0];
  let largestArea = ringArea(largest);
  for (const sp of subpaths) {
    const a = ringArea(sp);
    if (a > largestArea) {
      largest = sp;
      largestArea = a;
    }
  }
  const pole = poleOfInaccessibility(largest, LABEL_PRECISION);

  const d = encodePath(subpaths, { decimals: DECIMALS });
  shapes.push({
    iso: plan.iso,
    geoName: plan.geoName,
    d,
    labelPoint: { x: Math.round(pole.x * 10) / 10, y: Math.round(pole.y * 10) / 10 },
    labelRadius: Math.round(pole.d * 10) / 10,
  });
}

// Safety net (pipeline step 5): every emitted vertex must lie inside the pinned context
// frame. A clip bug would otherwise ship a shape that quietly draws past the panel.
assertInsideContextFrame(allProjectedPoints, { label: "generate:tr-context", tolerance: 0.5 });

shapes.sort((a, b) => a.iso.localeCompare(b.iso, "en"));

// --- Emit -------------------------------------------------------------------
const body = shapes
  .map(
    (s) =>
      `  { iso: ${JSON.stringify(s.iso)}, geoName: ${JSON.stringify(s.geoName)}, d: ${JSON.stringify(
        s.d,
      )}, labelPoint: { x: ${s.labelPoint.x}, y: ${s.labelPoint.y} }, labelRadius: ${s.labelRadius} },`,
  )
  .join("\n");

const out = `// AUTO-GENERATED by scripts/generate-tr-context.mjs — DO NOT EDIT BY HAND.
// Source: data/world-countries.geojson (Natural Earth Admin-0 1:50m, Public Domain) — the
// SAME committed snapshot lib/map/world-countries.generated.ts is generated from, re-projected
// into the TR context frame (scripts/lib/tr-frame.mjs TR_CONTEXT_FRAME) by THIS generator. No
// new geographic dataset enters the repo (turkiye-yenileme plan §5.0-2).
// Regenerate with: pnpm generate:tr-context
//
// Türkiye's geographic backdrop for the widened /turkiye map (turkiye-yenileme PR-B): Türkiye
// itself (the "TR" entry — drawn as CASING only, never labelled, see turkey-map-section.tsx)
// plus every neighbouring/near-neighbouring country whose Natural Earth outline has any
// visible area inside TR_CONTEXT_FRAME. Raw GeoJSON never ships to the client — only these
// produced paths do (same discipline as every other map artifact in this repo). Keyed by ISO
// 3166-1 alpha-2 (uppercase), or the api's private-use "QN" for Northern Cyprus (KKTC) — the
// identical join convention world-countries.generated.ts uses, so a shape resolves against
// the live api's country-map-summary exactly as it does on /dunya.

/** One context shape in the shared \`TR_CONTEXT_VIEWBOX\` coordinate space. */
export interface ContextShape {
  /** Join key to live api country data (uppercase ISO alpha-2, or "QN" for KKTC). */
  readonly iso: string;
  /** Source Natural Earth label (build-time provenance only; never shown — the api's nameTr/
   *  nameEn is the display name, verified against GLOSSARY.md §7.3 for QN/CY). */
  readonly geoName: string;
  /** SVG path \`d\` — one closed subpath per landmass fragment this frame clips to. */
  readonly d: string;
  /**
   * Pole of inaccessibility of this shape's largest subpath, in TR-frame svg units — the
   * interior point furthest from any edge. Deterministic and self-correcting: recomputed
   * from the shape itself every generator run, never a hand-set offset.
   */
  readonly labelPoint: { readonly x: number; readonly y: number };
  /** Distance from \`labelPoint\` to the nearest edge — the largest circle the shape can hold,
   *  i.e. how much room a label centred there actually has before it must wrap or exceed the
   *  shape. */
  readonly labelRadius: number;
}

/** Shared SVG viewBox every context shape is projected into — the WIDER frame around
 *  \`MAP_VIEWBOX\`, in the same coordinate space (\`scripts/lib/tr-frame.mjs\` TR_CONTEXT_FRAME).
 *  \`MAP_VIEWBOX\` itself is untouched; this is a second, independent frame. Re-exported here
 *  (rather than imported straight from \`scripts/lib/tr-frame.mjs\` at runtime) for the same
 *  reason \`tr-provinces.generated.ts\` re-exports \`MAP_VIEWBOX\` instead of every consumer
 *  reaching into \`scripts/\`: the generated artifact is the app's one runtime-facing surface. */
export const TR_CONTEXT_VIEWBOX = "${TR_CONTEXT_VIEWBOX}" as const;

export const CONTEXT_SHAPES: readonly ContextShape[] = [
${body}
];
`;

writeFileSync(OUT, out, "utf8");
const bytes = Buffer.byteLength(out, "utf8");
const { stats } = topology;
console.log(
  `generate:tr-context → ${OUT}\n  ${shapes.length} shapes · viewBox ${TR_CONTEXT_VIEWBOX} · ` +
    `${(bytes / 1024).toFixed(1)} kB\n  raw rings: ${rawRingCount} seen, ${survivingRingCount} ` +
    `survived clip+area filter\n  topology: ${stats.inputRings} rings → ${stats.arcs} arcs ` +
    `(${stats.sharedArcs} shared) · ${stats.inputVertices} → ${stats.outputVertices} vertices\n` +
    `  shared source nodes: ${stats.sharedNodes} · ASYMMETRIC: ${stats.asymmetricSharedNodes} ✓`,
);
