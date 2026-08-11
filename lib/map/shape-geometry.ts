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
 * 18 units ≈ 10 CSS px. The side measured is the LARGEST SUBPATH's, not the whole shape's
 * (→ `needsRing`, `DEC 2026-08-11h` md.1). Measured consequence on the real corpus
 * (re-measured 2026-08-11 against the live seed): 141 of the 240 artifact shapes and
 * 101 of the 199 seeded countries — 51 % — take a ring. That is not a defect of the
 * threshold; it is the size distribution of the world's countries.
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
 * Bounds of the LARGEST subpath, not of the whole shape — and the difference is the whole
 * point of this function.
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
 *
 * Exported because BOTH ring questions must be answered from this one box — see `needsRing`.
 */
export function largestSubpathBounds(d: string): ShapeBounds | null {
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
  return best?.bounds ?? null;
}

/** Centre of a box. Split out so the ring's decision and its position share one input. */
export function centerOfBounds(bounds: ShapeBounds): ShapePoint {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

/** Centre of the largest subpath, or `null` for a shape with no vertices. */
export function largestSubpathCenter(d: string): ShapePoint | null {
  const bounds = largestSubpathBounds(d);
  return bounds === null ? null : centerOfBounds(bounds);
}

/**
 * Does this shape need a locator ring? `true` when the longest side of the box it is given is
 * under `RING_MAX_EXTENT_UNITS`.
 *
 * ## Which box the caller must pass — the correction in `DEC 2026-08-11h` md.1
 *
 * The LARGEST SUBPATH's box, the same one the ring's centre comes from. Passing the full
 * shape bbox is what shipped first, and it applied the letter of `DEC 2026-08-08a` md.1 while
 * losing its purpose ("make an unfindable shape findable"): the two geometries disagree
 * wherever territory is scattered, and the disagreement always falls the wrong way. The
 * Netherlands renders ≈5 CSS px of mainland while its bbox spans 206.2 units because of the
 * Caribbean municipalities; Kiribati ≈0.6 px and Fiji ≈2.6 px because crossing the date line
 * stretches their bboxes across ~96 % of the map. All three were judged "large" and drawn with
 * no ring at all — a locator figure whose caption names a country the reader cannot find on it.
 *
 * The ruling updates the recorded consequence with the rule: **141 of the 240 artifact shapes**
 * take a ring under this reading, where the full-bbox reading gave 127. Fourteen shapes move
 * (NL, KI, FJ, PF, FM, BS, VU, SB, TF, GS, NC, PT, GR, SH); none loses a ring.
 *
 * Takes a non-null box on purpose. The empty-shape case used to be documented here as
 * "ringed, because the ring is the only thing left" — which was never true: the only call site
 * then asked for a centre, got `null` back, and drew nothing. A promise no code kept is worse
 * than no promise, so the caller now handles the empty shape explicitly.
 */
export function needsRing(bounds: ShapeBounds): boolean {
  return Math.max(bounds.width, bounds.height) < RING_MAX_EXTENT_UNITS;
}
