import type { MapPoint, MapRect } from "@/lib/map/projection";

/**
 * The frame that contains the base Türkiye map plus every earthquake marker.
 *
 * Deliberately simpler than `lib/map/point-labels.ts`'s `frameForLabelledPoints`: that module
 * exists to fit LABEL TEXT boxes around 30 fixed marine points. This map draws no per-marker
 * label at all (§5.13 — up to 200 events on one page would recreate the exact "word cloud"
 * `MarineMap`'s own docblock rejects), so the only thing the frame has to contain is each
 * marker's own circle. Pure, so it is usable identically from the server-rendered default view
 * and the client filter island's re-render (§5.5) — neither this module nor its caller needs
 * `server-only`.
 */
export function frameForMarkers(
  base: MapRect,
  points: readonly MapPoint[],
  maxMarkerRadius: number,
  margin: number,
): MapRect {
  let { minX, minY, maxX, maxY } = base;
  for (const point of points) {
    minX = Math.min(minX, point.x - maxMarkerRadius);
    minY = Math.min(minY, point.y - maxMarkerRadius);
    maxX = Math.max(maxX, point.x + maxMarkerRadius);
    maxY = Math.max(maxY, point.y + maxMarkerRadius);
  }
  return {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin,
  };
}
