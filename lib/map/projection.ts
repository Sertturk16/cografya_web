import { MAP_PROJECTION } from "@/lib/map/tr-provinces.generated";

/**
 * Placing a geographic coordinate into the Türkiye map's SVG coordinate space.
 *
 * The 81 province outlines in `tr-provinces.generated.ts` were projected at build time
 * with an equirectangular projection plus a cos(reference-latitude) x-correction
 * (`scripts/generate-map-paths.mjs`). Anything else drawn on that map — the 30 marine
 * reference points, a future city marker — has to use the SAME transform, or it lands in
 * the sea by tens of kilometres.
 *
 * The constants are EMITTED by the generator (`MAP_PROJECTION`), never restated here.
 * They derive from the source GeoJSON's own bounding box, so hand-copying them would
 * silently rot the moment the ODbL snapshot is refreshed; `pnpm generate:map:check`
 * catches a drift because the artifact itself changes.
 *
 * Scope note: this is deliberately a plain function over five numbers, not a projection
 * library. The Faz-1 map is navigation CHROME, not a data encoding (SPEC §2 doctrine),
 * and a conic-conformal upgrade would land in the generator — this module would follow it
 * automatically because it reads whatever the generator emitted.
 */

/** A point in the shared `MAP_VIEWBOX` coordinate space. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in the shared `MAP_VIEWBOX` coordinate space. */
export interface MapRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Reads an SVG `"minX minY width height"` string into a rectangle.
 *
 * Returns `null` for anything it cannot read, so a caller can fall back to the string it
 * already has rather than render a map framed on `NaN`.
 */
export function parseViewBox(viewBox: string): MapRect | null {
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [minX, minY, width, height] = parts;
  if (parts.length !== 4) return null;
  if (
    minX === undefined ||
    minY === undefined ||
    width === undefined ||
    height === undefined ||
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }
  return { minX, minY, maxX: minX + width, maxY: minY + height };
}

/** Formats a rectangle back into an SVG `viewBox` string. */
export function formatViewBox(rect: MapRect): string {
  const round = (n: number) => Number(n.toFixed(1));
  return `${round(rect.minX)} ${round(rect.minY)} ${round(rect.maxX - rect.minX)} ${round(
    rect.maxY - rect.minY,
  )}`;
}

/**
 * Projects a [longitude, latitude] pair (decimal degrees) into `MAP_VIEWBOX` units.
 *
 * North is up, so latitude is inverted: a HIGHER latitude yields a LOWER `y`.
 *
 * The result is NOT clamped to the viewBox. Türkiye's offshore points legitimately sit
 * outside the landmass bounding box the projection was framed on, and clamping would
 * silently move a marker to a place it is not — the caller decides how much sea margin to
 * show (see `components/marine/marine-map.tsx`).
 */
export function projectToMapPoint(longitude: number, latitude: number): MapPoint {
  const { minLon, maxLat, cosLat, scale, padding } = MAP_PROJECTION;
  return {
    x: padding + (longitude - minLon) * cosLat * scale,
    y: padding + (maxLat - latitude) * scale,
  };
}
