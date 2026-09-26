"use client";

import * as React from "react";
import { wheelZoomFactor } from "./wheel-zoom";

/** How long the "Ctrl + tekerlek" hint stays after the last plain wheel over the map. */
const HINT_MS = 1500;
/** How long after the last zoom event the surface keeps its transform transition off. */
const ZOOMING_MS = 150;

/** WebKit's trackpad pinch event (`gesturestart`/`gesturechange`/`gestureend`), not in lib.dom. */
interface GestureEventLike extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

interface UseWheelZoomOptions {
  /** The map box: the listeners go on it and the hint is drawn inside it. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Zoom by `factor` (> 1 zooms in) around the client point; the surface clamps. */
  zoomBy: (factor: number, clientX: number, clientY: number) => void;
  /** Fullscreen: no page to scroll, so a plain wheel zooms too and no hint is shown. */
  plainWheelZooms: boolean;
}

/**
 * Trackpad pinch and Ctrl/⌘ + wheel zoom for every map (T-116).
 *
 * A pinch on a trackpad reaches Chrome, Edge and Firefox as a `ctrlKey` wheel event and Safari as
 * `gesture*` events; both zoom at the cursor. A plain wheel is left to scroll the page and only
 * raises `hintVisible`. React's `onWheel` is passive, so `preventDefault` there could not stop the
 * browser zooming the page; the listeners are added here with `{ passive: false }`.
 */
export function useWheelZoom({ targetRef, zoomBy, plainWheelZooms }: UseWheelZoomOptions) {
  const [hintVisible, setHintVisible] = React.useState(false);
  const [isZooming, setIsZooming] = React.useState(false);

  const applyZoom = React.useEffectEvent((factor: number, clientX: number, clientY: number) =>
    zoomBy(factor, clientX, clientY),
  );
  const plainZooms = React.useEffectEvent(() => plainWheelZooms);

  React.useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    // Factors are multiplied and applied once per frame at the latest cursor point: a trackpad
    // sends several events per frame, and each would otherwise zoom from a stale render.
    let pending = 1;
    let pointX = 0;
    let pointY = 0;
    let frame = 0;
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    let zoomingTimer: ReturnType<typeof setTimeout> | undefined;
    let gestureActive = false;
    let lastGestureScale = 1;
    const touches = new Set<number>();

    const flush = () => {
      frame = 0;
      const factor = pending;
      pending = 1;
      if (factor !== 1) applyZoom(factor, pointX, pointY);
    };

    const queue = (factor: number, clientX: number, clientY: number) => {
      pending *= factor;
      pointX = clientX;
      pointY = clientY;
      setIsZooming(true);
      clearTimeout(zoomingTimer);
      zoomingTimer = setTimeout(() => setIsZooming(false), ZOOMING_MS);
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || plainZooms()) {
        e.preventDefault();
        // Safari's own pinch is handled by the gesture events below.
        if (!gestureActive) queue(wheelZoomFactor(e.deltaY, e.deltaMode), e.clientX, e.clientY);
        return;
      }
      if (e.deltaX === 0 && e.deltaY === 0) return;
      setHintVisible(true);
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => setHintVisible(false), HINT_MS);
    };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureActive = true;
      lastGestureScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const { scale, clientX, clientY } = e as GestureEventLike;
      // iOS sends gesture events for a touch pinch as well; the surface's own pinch owns that.
      if (touches.size === 0 && lastGestureScale > 0) {
        queue(scale / lastGestureScale, clientX, clientY);
      }
      lastGestureScale = scale;
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      gestureActive = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") touches.add(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    el.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
      el.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(hintTimer);
      clearTimeout(zoomingTimer);
    };
  }, [targetRef]);

  // Entering fullscreen mid-hint drops it: a plain wheel zooms there.
  return { hintVisible: hintVisible && !plainWheelZooms, isZooming };
}
