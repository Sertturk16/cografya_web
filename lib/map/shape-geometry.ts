/**
 * Pure geometry over the committed map artifacts' `d` strings — no DOM, no React, no api.
 *
 * WHY THIS EXISTS RATHER THAN `lib/game/map-bbox.ts`. That module's `parsePathPoints`
 * documents its own limit in its docblock: the generator "only ever writes absolute
 * `M`/`L`/`Z`". That is true of `tr-provinces.generated.ts` and FALSE of
 * `world-countries.generated.ts`, which is encoded relatively (`M` once, then an `l` run —
 * ~26 % fewer bytes, see the artifact header). Feeding a world `d` to that parser silently
 * returns garbage coordinates rather than throwing, so the locator map needs a parser that
 * covers BOTH encodings. Merging the two modules is a tracked follow-up, not this package's
 * job.
 *
 * The supported subset is exactly what the two generators emit (verified against both
 * artifacts: TR uses `M`/`L`/`Z`, world uses `M`/`m`/`l`/`Z`). Anything else throws — a
 * silent wrong answer on a map is worse than a build failure.
 */

/** One point in the artifact's own viewBox unit space. */
export interface ShapePoint {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned bounding box in viewBox units. */
export interface ShapeBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Ring threshold, in viewBox units of the WORLD artifact (`0 0 1000 521`).
 *
 * A shape whose longest side is under this many units is drawn with a locator ring, because
 * the highlight alone is not findable at the size the figure actually renders: the country
 * figure is `min(100%, 560px)` wide (plan §5.2), i.e. a scale of 0.56 CSS px per unit, so
 * 18 units ≈ 10 CSS px. Measured consequence on the real corpus (re-measured 2026-08-08
 * against the live seed): 92 of the 199 seeded countries — 46 % — take a ring. That is not a
 * defect of the threshold; it is the size distribution of the world's countries.
 *
 * Deliberately expressed in UNITS, not pixels: the artifact's units are the only
 * render-width-independent quantity available at build time.
 */
export const RING_MAX_EXTENT_UNITS = 18;

/** SVG path tokens: single letters, or numbers (incl. `-1`, `.5`, `-.5`). */
const TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g;

/**
 * Split a `d` string into its closed subpaths, resolving relative commands to absolute
 * coordinates. One subpath per landmass (and one per enclave hole on the world artifact).
 *
 * Supports `M`/`m` (moveto, implicit lineto for the rest of the run), `L`/`l` (lineto) and
 * `Z` (closepath). Throws on anything else.
 */
export function parseSubpaths(d: string): ShapePoint[][] {
  const tokens = d.match(TOKEN) ?? [];
  const subpaths: ShapePoint[][] = [];
  let current: ShapePoint[] | null = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command: string | null = null;
  let i = 0;

  const next = (): number => {
    const raw = tokens[i++];
    const value = raw === undefined ? Number.NaN : Number.parseFloat(raw);
    if (Number.isNaN(value)) throw new Error(`shape-geometry: expected a number at token ${i - 1}`);
    return value;
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (token !== undefined && /[A-Za-z]/.test(token)) {
      command = token;
      i++;
    }
    if (command === "Z" || command === "z") {
      // Closepath returns the cursor to the subpath's start; the artifacts never emit a
      // vertex after Z without a new M, but resetting keeps the cursor honest either way.
      x = startX;
      y = startY;
      command = null;
      continue;
    }
    if (command === "M" || command === "m") {
      const a = next();
      const b = next();
      x = command === "M" ? a : x + a;
      y = command === "M" ? b : y + b;
      startX = x;
      startY = y;
      current = [{ x, y }];
      subpaths.push(current);
      // SVG: the coordinate pairs following a moveto are implicit LINETO of the same case.
      command = command === "M" ? "L" : "l";
      continue;
    }
    if (command === "L" || command === "l") {
      const a = next();
      const b = next();
      x = command === "L" ? a : x + a;
      y = command === "L" ? b : y + b;
      current?.push({ x, y });
      continue;
    }
    throw new Error(`shape-geometry: unsupported path command "${String(command)}"`);
  }

  return subpaths;
}

/** Bounding box of a point list. Returns `null` for an empty list. */
export function boundsOfPoints(points: readonly ShapePoint[]): ShapeBounds | null {
  const first = points[0];
  if (first === undefined) return null;
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Bounding box of a whole `d` string (every subpath). `null` if it has no vertices. */
export function shapeBounds(d: string): ShapeBounds | null {
  return boundsOfPoints(parseSubpaths(d).flat());
}

/**
 * Centre of the LARGEST subpath, not of the whole shape's bounding box — and the difference
 * is the whole point of this function.
 *
 * France's artifact shape includes its overseas departments, so its full bbox is 322.0 units
 * wide (re-measured 2026-08-08) and its centre falls in the Atlantic. The Netherlands (206.2),
 * the United States (870.0) and Russia (794.9) have the same shape. A locator ring drawn at a
 * full-bbox centre would point at open ocean on exactly the countries a reader is most likely
 * to look up.
 *
 * "Largest" is by bounding-box AREA, with vertex count as the tie-break: area is what makes
 * the mainland win over a scattered island set, and the tie-break keeps the result
 * deterministic for the degenerate shapes the artifact really contains (Singapore's bbox is
 * 1 × 0 units, so its area is 0).
 */
export function largestSubpathCenter(d: string): ShapePoint | null {
  let best: { bounds: ShapeBounds; count: number } | null = null;
  for (const points of parseSubpaths(d)) {
    const bounds = boundsOfPoints(points);
    if (bounds === null) continue;
    const area = bounds.width * bounds.height;
    if (best === null) {
      best = { bounds, count: points.length };
      continue;
    }
    const bestArea = best.bounds.width * best.bounds.height;
    if (area > bestArea || (area === bestArea && points.length > best.count)) {
      best = { bounds, count: points.length };
    }
  }
  if (best === null) return null;
  return {
    x: (best.bounds.minX + best.bounds.maxX) / 2,
    y: (best.bounds.minY + best.bounds.maxY) / 2,
  };
}

/**
 * Does this shape need a locator ring? `true` when its longest side is under
 * `RING_MAX_EXTENT_UNITS`. A shape with no vertices at all also returns `true`: nothing is
 * drawn, so the ring is the only thing that could still answer "where".
 */
export function needsRing(bounds: ShapeBounds | null): boolean {
  if (bounds === null) return true;
  return Math.max(bounds.width, bounds.height) < RING_MAX_EXTENT_UNITS;
}
