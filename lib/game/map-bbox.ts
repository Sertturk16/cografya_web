/**
 * The viewBox that frames a SUBSET of the map (→ DEC 2026-07-30p).
 *
 * In the region mode the map draws only the chosen region's provinces — the other 70-odd
 * shapes are not dimmed, they are not rendered at all. Keeping `MAP_VIEWBOX` would then
 * leave one small cluster floating in an otherwise empty 1000 × 429 box, so the frame is
 * recomputed from the shapes that ARE drawn. The side effect is the reason the owner asked
 * for it: at the same on-screen width, Yalova inside a Marmara-sized frame is several times
 * the size it is inside a Türkiye-sized one, which is exactly the small-province touch
 * target problem (SPEC §7.1) solved by geometry rather than by asking for a pinch.
 *
 * This is pure arithmetic over the BUILD-TIME artifact: no GeoJSON, no projection, no api.
 * It runs on the server, and only its result — a viewBox string — reaches the client.
 */

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Every coordinate pair in a generated province path.
 *
 * The generator emits ONLY absolute `M`/`L`/`Z` commands with plain decimal pairs
 * (`scripts/generate-map-paths.mjs`; verified against the committed artifact), so reading
 * the numbers in order and taking them two at a time IS the point list — there is no
 * relative offset to accumulate and no curve whose control points would sit outside the
 * drawn shape. A malformed or curve-bearing path would therefore be a change to the
 * generator, which is why `parsePathPoints` is asserted directly in the tests rather than
 * trusted.
 */
export function parsePathPoints(d: string): number[][] {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers) return [];
  const points: number[][] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = Number(numbers[i]);
    const y = Number(numbers[i + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
  }
  return points;
}

/**
 * The RINGS of a generated path — one per `M` subpath.
 *
 * `parsePathPoints` deliberately flattens everything into one point list, which is all a
 * bounding box needs. A point-in-polygon test needs the opposite: a province drawn as several
 * disjoint pieces (a coastline plus its islands) is several closed rings, and running one
 * crossing count over their concatenation would join the last point of one piece to the first
 * point of the next with a segment that exists nowhere on the map.
 *
 * The generator emits only absolute `M`/`L`/`Z` (see `parsePathPoints`), so splitting on `M`
 * IS the subpath split.
 */
export function parsePathRings(d: string): number[][][] {
  const rings: number[][][] = [];
  for (const chunk of d.split("M")) {
    if (!chunk.trim()) continue;
    const ring = parsePathPoints(chunk);
    // Two points cannot enclose anything, so such a ring can only add noise to a crossing
    // count and to a distance search.
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/** The tight bounding box of a set of paths, or `null` when there is nothing to bound. */
export function boundsOfPaths(paths: readonly string[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const d of paths) {
    for (const point of parsePathPoints(d)) {
      const x = point[0];
      const y = point[1];
      if (x === undefined || y === undefined) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY };
}

/** Breathing room around the subset, as a fraction of its longer side. */
const PADDING_RATIO = 0.04;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Is `p` inside the ring set, under the even-odd rule? */
function isInside(rings: readonly number[][][], px: number, py: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      if (!a || !b) continue;
      const ax = a[0];
      const ay = a[1];
      const bx = b[0];
      const by = b[1];
      if (ax === undefined || ay === undefined || bx === undefined || by === undefined) continue;
      if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** Shortest distance from `p` to any edge of the ring set. */
function distanceToEdge(rings: readonly number[][][], px: number, py: number): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      if (!a || !b) continue;
      const ax = a[0];
      const ay = a[1];
      const bx = b[0];
      const by = b[1];
      if (ax === undefined || ay === undefined || bx === undefined || by === undefined) continue;
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSq = dx * dx + dy * dy;
      const t =
        lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
      const qx = ax + t * dx - px;
      const qy = ay + t * dy - py;
      const distance = Math.sqrt(qx * qx + qy * qy);
      if (distance < best) best = distance;
    }
  }
  return best;
}

/** Candidates per axis in the coarse sweep, and again inside the winning cell. */
const INTERIOR_GRID = 22;
const INTERIOR_REFINE = 9;

/**
 * A point comfortably INSIDE the union of some paths — where a per-target glyph can be drawn.
 *
 * THE BOUNDING-BOX CENTRE IS NOT AN ANSWER, and this function exists because that was
 * measured rather than assumed: a province is an irregular, frequently concave polygon, and
 * İzmir's bbox centre lands in the gulf — outside İzmir. That is the same trap PR #48's
 * Playwright harness documented when a bbox-centre click kept answering for a NEIGHBOUR.
 *
 * So the point is searched for, not computed: sweep a grid over the bounds, keep only
 * candidates that are genuinely inside (even-odd over the real rings), and among those take
 * the one FURTHEST FROM ANY EDGE — the "most interior" point, which is what stops a glyph
 * from straddling a border. One refinement pass inside the winning cell buys a visibly better
 * placement for a fixed, small cost.
 *
 * Pure arithmetic over the build-time artifact: no projection, no api, no geography facts. It
 * runs on the server and only its result reaches the client.
 *
 * `null` when the paths enclose nothing the grid can find — the caller then draws no mark
 * rather than one in the sea.
 */
export function interiorPointForPaths(paths: readonly string[]): Point | null {
  const bounds = boundsOfPaths(paths);
  if (!bounds) return null;

  const rings = paths.flatMap((d) => parsePathRings(d));
  if (rings.length === 0) return null;

  const search = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    steps: number,
  ): { point: Point; clearance: number; cellX: number; cellY: number } | null => {
    const cellX = (maxX - minX) / steps;
    const cellY = (maxY - minY) / steps;
    if (!(cellX > 0) || !(cellY > 0)) return null;
    let best: { point: Point; clearance: number; cellX: number; cellY: number } | null = null;
    for (let i = 0; i < steps; i += 1) {
      const x = minX + (i + 0.5) * cellX;
      for (let j = 0; j < steps; j += 1) {
        const y = minY + (j + 0.5) * cellY;
        if (!isInside(rings, x, y)) continue;
        const clearance = distanceToEdge(rings, x, y);
        if (!best || clearance > best.clearance) {
          best = { point: { x, y }, clearance, cellX, cellY };
        }
      }
    }
    return best;
  };

  const coarse = search(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, INTERIOR_GRID);
  if (!coarse) return null;

  const fine = search(
    coarse.point.x - coarse.cellX,
    coarse.point.y - coarse.cellY,
    coarse.point.x + coarse.cellX,
    coarse.point.y + coarse.cellY,
    INTERIOR_REFINE,
  );
  const winner = fine && fine.clearance > coarse.clearance ? fine : coarse;

  // Rounded to the artifact's own two decimals, to keep the string short in the HTML — but
  // only if rounding did not move the point out of the shape it was chosen for. On a sliver
  // that is a real possibility, and "inside" is the guarantee this function makes.
  const round = (value: number) => Math.round(value * 100) / 100;
  const rounded = { x: round(winner.point.x), y: round(winner.point.y) };
  return isInside(rings, rounded.x, rounded.y) ? rounded : winner.point;
}

/** The width ÷ height of a `"minX minY width height"` string, or `null` if unreadable. */
export function aspectOfViewBox(viewBox: string): number | null {
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = parts[2];
  const height = parts[3];
  if (width === undefined || height === undefined) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0 || width <= 0) {
    return null;
  }
  return width / height;
}

/**
 * The narrowest frame we will draw: never taller than it is wide.
 *
 * A guard, not a shape preference. The stage takes its aspect FROM the frame, so a box
 * taller than it is wide would produce a map taller than the screen is wide — the player
 * would have to scroll the question off the top to see the bottom of it. No region of
 * Türkiye is anywhere near this (the narrowest measured is 1.18), which is exactly why it
 * is a floor rather than a fixed target.
 */
const MIN_ASPECT = 1;

/**
 * The viewBox string for a subset of shapes, or `null` when the subset is empty or has no
 * extent (the caller then keeps the full-map viewBox rather than rendering a degenerate
 * frame).
 *
 * The frame follows the SUBSET's own shape rather than the whole map's, and the stage
 * follows the frame (`components/game/game-map.tsx` reads the aspect back off this
 * string). That is where the magnification comes from: forcing every region into the
 * country's 2.33 letterbox would give Ege and Marmara — the two regions with the smallest
 * provinces, and therefore the ones that need it most — about half the enlargement their
 * own bounds allow.
 *
 * Because the stage matches the frame exactly, the `<svg>` never letterboxes and
 * `MapZoomPan` (which clamps panning to the base viewBox) keeps reasoning about the box
 * that is actually on screen, exactly as on `/dunya`.
 *
 * Numbers are rounded to two decimals: the artifact's own precision, and enough to keep
 * the string short in the HTML.
 */
export function viewBoxForPaths(paths: readonly string[]): string | null {
  const bounds = boundsOfPaths(paths);
  if (!bounds) return null;

  const pad = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * PADDING_RATIO;
  let minX = bounds.minX - pad;
  const minY = bounds.minY - pad;
  let width = bounds.maxX - bounds.minX + pad * 2;
  const height = bounds.maxY - bounds.minY + pad * 2;

  // A subset with no extent at all — one point, or several paths sharing one point — has no
  // frame to draw: `pad` is 0 too, so the string would be `"x y 0 0"`, an SVG that paints
  // nothing and an aspect the stage cannot read. It is answered exactly like an empty
  // subset, which sends the caller to the full-map viewBox. Unreachable from the committed
  // artifact today; this function is exported as a general utility, so it answers rather
  // than emitting a degenerate box for the next caller to discover on screen.
  if (width <= 0 || height <= 0) return null;

  if (width / height < MIN_ASPECT) {
    const grown = height * MIN_ASPECT;
    minX -= (grown - width) / 2;
    width = grown;
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return [round(minX), round(minY), round(width), round(height)].join(" ");
}
