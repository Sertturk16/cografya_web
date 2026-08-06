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
