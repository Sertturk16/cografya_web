/**
 * Values drawn on map markers (`/deniz` station temperatures, `/deprem` magnitudes) and the size
 * of the markers' touch targets (T-087).
 *
 * Both maps draw in viewBox units over a box as narrow as 284px, so a marker's 8.5-unit label
 * measured 2-3px on a phone and 4-6px on a tablet, and its hit area 4-6px across. A place name can
 * be dropped when it does not fit (`context-label-fit.ts`); a value cannot, because it is data. So
 * below the legible size the value leaves the marker and is read from the selection card, and the
 * marker keeps a touch target of design.md's 24x24 CSS px floor at every scale.
 */

/** The smallest on-screen size, in CSS px, a value on a marker is drawn at. */
export const MARKER_TEXT_MIN_PX = 7;

/** Half of design.md's 24x24 CSS px touch-target floor. */
export const MARKER_HIT_RADIUS_PX = 12;

/**
 * Whether text of `fontUnits` viewBox units is legible at `scale` CSS px per unit. `null` scale is
 * the unmeasured first render, which draws the desktop map.
 */
export function markerTextLegible(fontUnits: number, scale: number | null): boolean {
  return scale === null || fontUnits * scale >= MARKER_TEXT_MIN_PX;
}

/** A hit radius in viewBox units: `baseUnits`, or the touch-target floor if that is larger. */
export function markerHitRadius(baseUnits: number, scale: number | null): number {
  if (scale === null || !(scale > 0)) return baseUnits;
  return Math.max(baseUnits, MARKER_HIT_RADIUS_PX / scale);
}
