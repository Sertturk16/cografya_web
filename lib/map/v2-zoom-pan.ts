/**
 * Pure geometry utilities for V2 interactive maps (`v2-turkey-map-explorer` and
 * `v2-world-map-explorer`).
 */

import { zoomFromPinch } from "./zoom-pan";

export interface PanOffset {
  x: number;
  y: number;
}

/**
 * Round to 2 decimal places to avoid IEEE-754 floating point artifacts
 * (e.g. 199.99999999999994 vs 200).
 */
function round2(val: number): number {
  const rounded = Math.round(val * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Clamps a 2D pan offset in pixels so that a scaled map container
 * (`scale(zoom)` with `transform-origin: center center`) cannot be
 * dragged past its outer bounds to reveal blank space/void.
 *
 * When zoom = 1, pan is strictly locked to (0, 0).
 * When zoom > 1, the maximum allowed pan along each axis is `(zoom - 1) * dimension / 2`.
 */
export function clampPanOffset(
  offset: PanOffset,
  zoom: number,
  containerWidth: number,
  containerHeight: number,
): PanOffset {
  if (zoom <= 1 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0 };
  }

  const maxPanX = round2(((zoom - 1) * containerWidth) / 2);
  const maxPanY = round2(((zoom - 1) * containerHeight) / 2);

  const clampedX = Math.max(-maxPanX, Math.min(maxPanX, offset.x));
  const clampedY = Math.max(-maxPanY, Math.min(maxPanY, offset.y));

  return {
    x: round2(clampedX),
    y: round2(clampedY),
  };
}

/** The state a pinch gesture started from; `mid` is relative to the box centre, in px. */
export interface PinchStart {
  zoom: number;
  pan: PanOffset;
  dist: number;
  mid: PanOffset;
}

/**
 * One step of a two-finger pinch on a map zoomed with `scale(zoom) translate(pan / zoom)`
 * around the box centre, where a map point `u` (px from the centre at 1x) is drawn at
 * `zoom * u + pan`.
 *
 * The map point under the fingers' midpoint at pinch start stays under their CURRENT
 * midpoint, so spreading zooms around the fingers and moving both fingers pans. The zoom
 * ratio comes from `zoomFromPinch`, capped at the surface's own `maxZoom` (its + button
 * limit); the pan is clamped exactly like a drag, which also zeroes it at 1x.
 */
export function pinchZoomPan(
  start: PinchStart,
  currentDist: number,
  currentMid: PanOffset,
  maxZoom: number,
  containerWidth: number,
  containerHeight: number,
): { zoom: number; pan: PanOffset } {
  const zoom = Math.min(maxZoom, zoomFromPinch(start.zoom, start.dist, currentDist));
  const ratio = zoom / start.zoom;
  const pan = clampPanOffset(
    {
      x: currentMid.x - ratio * (start.mid.x - start.pan.x),
      y: currentMid.y - ratio * (start.mid.y - start.pan.y),
    },
    zoom,
    containerWidth,
    containerHeight,
  );
  return { zoom, pan };
}
