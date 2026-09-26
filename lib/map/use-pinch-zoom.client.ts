"use client";

import * as React from "react";
import { type PanOffset, type PinchStart, pinchZoomPan } from "./v2-zoom-pan";

/**
 * How long a country/province click stays swallowed after the last finger of a pinch lifts.
 * The browser may synthesize a `click` right after the final `pointerup`; it must not select
 * whatever sat under that finger.
 */
const CLICK_SUPPRESS_MS = 300;

interface UsePinchZoomOptions {
  /** The box the map is scaled inside; the transform origin is its centre. */
  containerRef: React.RefObject<HTMLElement | null>;
  zoom: number;
  pan: PanOffset;
  /** The surface's + button limit. */
  maxZoom: number;
  onChange: (next: { zoom: number; pan: PanOffset }) => void;
}

/**
 * Two-finger pinch zoom for the `scale()` + px-pan maps (`/dunya`, `/turkiye`), T-115.
 *
 * Only `pointerType === "touch"` is tracked, so mouse and pen keep the surface's own drag code.
 * The returned handlers are called first from the surface's pointer handlers: `true` means the
 * event belongs to a pinch and the surface must not treat it as a one-finger drag.
 */
export function usePinchZoom({ containerRef, zoom, pan, maxZoom, onChange }: UsePinchZoomOptions) {
  const pointsRef = React.useRef(new Map<number, { x: number; y: number }>());
  const startRef = React.useRef<PinchStart | null>(null);
  /** True from the second finger down until every finger is up. */
  const gestureRef = React.useRef(false);
  const suppressUntilRef = React.useRef(0);
  const [isPinching, setIsPinching] = React.useState(false);

  /** Finger distance and midpoint (relative to the box centre), or null without a box. */
  const measure = (): { dist: number; mid: PanOffset; width: number; height: number } | null => {
    const box = containerRef.current;
    const [a, b] = [...pointsRef.current.values()];
    if (!box || !a || !b) return null;
    const rect = box.getBoundingClientRect();
    const centreX = rect.left + box.clientLeft + box.clientWidth / 2;
    const centreY = rect.top + box.clientTop + box.clientHeight / 2;
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2 - centreX, y: (a.y + b.y) / 2 - centreY },
      width: box.clientWidth,
      height: box.clientHeight,
    };
  };

  const onPointerDown = (e: React.PointerEvent): boolean => {
    if (e.pointerType !== "touch") return false;
    pointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointsRef.current.size < 2) return gestureRef.current;
    const m = measure();
    if (m) startRef.current = { zoom, pan, dist: m.dist, mid: m.mid };
    gestureRef.current = true;
    setIsPinching(true);
    return true;
  };

  const onPointerMove = (e: React.PointerEvent): boolean => {
    if (e.pointerType !== "touch" || !pointsRef.current.has(e.pointerId)) return false;
    pointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const start = startRef.current;
    if (start && pointsRef.current.size >= 2) {
      const m = measure();
      if (m) onChange(pinchZoomPan(start, m.dist, m.mid, maxZoom, m.width, m.height));
    }
    return gestureRef.current;
  };

  const onPointerUp = (e: React.PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    pointsRef.current.delete(e.pointerId);
    // A third finger lifting leaves a pinch in progress; restart it from the two that remain.
    if (pointsRef.current.size >= 2) {
      const m = measure();
      if (m) startRef.current = { zoom, pan, dist: m.dist, mid: m.mid };
      return;
    }
    startRef.current = null;
    if (pointsRef.current.size === 0 && gestureRef.current) {
      gestureRef.current = false;
      suppressUntilRef.current = performance.now() + CLICK_SUPPRESS_MS;
      setIsPinching(false);
    }
  };

  /** True while a pinch is under way and briefly after it, so its lift never selects. */
  const suppressClick = (): boolean =>
    gestureRef.current || performance.now() < suppressUntilRef.current;

  return { onPointerDown, onPointerMove, onPointerUp, isPinching, suppressClick };
}
