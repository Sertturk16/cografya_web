/**
 * DOM-free helpers for wheel and trackpad zoom on every map (T-116). The listener wiring lives in
 * `use-wheel-zoom.client.ts`; this file stays pure so vitest's node environment can test it.
 */

import type { PanOffset } from "./v2-zoom-pan";

/** `WheelEvent.deltaMode` units in px: pixels, lines, pages. */
const DELTA_MODE_PX = [1, 16, 800] as const;

/**
 * Largest wheel movement one event may zoom by, in px. A mouse notch (~100 px) is cut to this, so
 * it zooms by `exp(0.5)` ≈ ×1.65, close to the + buttons; a trackpad pinch sends many small
 * deltas and stays smooth.
 */
const MAX_STEP_PX = 50;

/** The zoom factor for one wheel event: > 1 zooms in (wheel up / fingers apart). */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const px = deltaY * (DELTA_MODE_PX[deltaMode as 0 | 1 | 2] ?? 1);
  const step = Math.max(-MAX_STEP_PX, Math.min(MAX_STEP_PX, px));
  return Math.exp(-step / 100);
}

/** True on macOS and iOS, where the zoom modifier the hint names is ⌘ rather than Ctrl. */
export function isApplePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

interface MeasurableBox {
  getBoundingClientRect(): { left: number; top: number };
  clientLeft: number;
  clientTop: number;
  clientWidth: number;
  clientHeight: number;
}

/**
 * A client point as an offset from the centre of `box`'s padding box, which is where the maps'
 * `transform-origin: center center` sits.
 */
export function offsetFromCentre(box: MeasurableBox, clientX: number, clientY: number): PanOffset {
  const rect = box.getBoundingClientRect();
  return {
    x: clientX - (rect.left + box.clientLeft + box.clientWidth / 2),
    y: clientY - (rect.top + box.clientTop + box.clientHeight / 2),
  };
}
