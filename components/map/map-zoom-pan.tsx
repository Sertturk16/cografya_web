"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CLICK_MOVE_THRESHOLD_PX,
  type ViewBox,
  clampPan,
  formatViewBox,
  isRealClick,
  moveDistance,
  panBy,
  parseViewBox,
  viewToIncludeShape,
  zoomAtPoint,
  zoomFromPinch,
  zoomOf,
} from "@/lib/map/zoom-pan";
import styles from "./map.module.css";

/** Localized, server-formatted strings (this island ships no message bundle). */
export interface MapZoomPanLabels {
  zoomIn: string;
  zoomOut: string;
  reset: string;
  /** Full keyboard-controls sentence, referenced by the SVG via aria-describedby. */
  instructions: string;
  /** Short accessible name for the zoom-button group (NOT the full instructions). */
  controls: string;
  /** One-time discoverability hint (SPEC §9). */
  hint: string;
  /** Accessible label for the hint's dismiss (×) button. */
  dismissHint: string;
}

interface MapZoomPanProps {
  /**
   * The world-fit viewBox string as server-rendered on the `<svg>` — the single source
   * of truth for the reset/home view (SPEC §7) and the pan-clamp bounds (SPEC §1).
   * Passed in (rather than read from the DOM) so a bfcache-restored zoomed attribute
   * never poisons the "world" baseline, and so the layer is projection-agnostic.
   */
  viewBox: string;
  /** id of the visually-hidden instructions element the `<svg>` describes itself with. */
  instructionsId: string;
  labels: MapZoomPanLabels;
}

const HINT_STORAGE_KEY = "cografya:dunya-zoom-hint";

/**
 * Read the one-time-hint dismissed flag from localStorage as an external store (SPEC §9).
 * `useSyncExternalStore` is the SSR-safe way to read a browser-only source: the server
 * snapshot is always "not dismissed" (hint present in the first HTML), and the client
 * reconciles from storage on hydration — no setState-in-effect, no hydration error. The
 * subscribe is a no-op: the flag only changes via this component's own dismiss handler,
 * which tracks it in local state for the immediate hide.
 */
const subscribeHint = () => () => {};
const hintDismissedClient = () => {
  try {
    return window.localStorage.getItem(HINT_STORAGE_KEY) === "dismissed";
  } catch {
    return false;
  }
};
const hintDismissedServer = () => false;

/** Per press / keypress / double-click zoom multiplier (SPEC §2). */
const ZOOM_STEP = 1.8;
/** Arrow-key pan distance as a fraction of the current view width/height (SPEC §5). */
const KEY_PAN_FRACTION = 0.2;
/** Tween duration for button/keyboard/double-click zoom (SPEC §6). */
const TWEEN_MS = 200;
/**
 * Movement (px) past which a pointer drag starts panning (and stops being a tap). Pinned
 * to the SPEC §4 click-move threshold so there is ONE movement boundary: a gesture that
 * stays under it is a candidate tap that still navigates (crucial for tapping small
 * countries — the very complaint this feature fixes), and anything past it pans and
 * swallows the click. A lower pan-start would let a 3–6px finger wobble silently begin a
 * pan and eat the navigation, re-creating that complaint.
 */
const PAN_START_PX = CLICK_MOVE_THRESHOLD_PX;

/**
 * The `/dunya` world-map zoom/pan client island (SPEC `dunya-haritasi-zoom-pan-spec`).
 *
 * It is a thin sibling of the server-rendered `<svg>` inside `[data-map-root]` — exactly
 * the same "reach the shared container, enhance it imperatively" pattern as
 * `MapHoverCard`. It NEVER re-renders the map per frame: the viewBox is mutated directly
 * on the element and batched through `requestAnimationFrame`, so pan/zoom scrubbing stays
 * INP-safe (SPEC §8). All the SEO surface (the crawlable country `<a>` links, JSON-LD,
 * metadata, hreflang) is untouched server HTML — this only adds interaction on top.
 *
 * Controls (SPEC §2): cursor-anchored wheel zoom · click-drag pan · always-visible +/−
 * buttons · reset/fit button · double-click zoom · pinch + one-finger pan on touch
 * (coexisting with tap-to-navigate via the SPEC §4 movement+duration threshold) ·
 * keyboard (+/−/arrows/0/Home when the map is focused, SPEC §5) · reduced-motion skips
 * the zoom tween (SPEC §6).
 */
export function MapZoomPan({ viewBox, instructionsId, labels }: MapZoomPanProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const storedDismissed = useSyncExternalStore(
    subscribeHint,
    hintDismissedClient,
    hintDismissedServer,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const hintVisible = !storedDismissed && !dismissedNow;
  // Imperative control handles wired up on mount; the rendered buttons call through
  // these so the JSX never needs the live viewBox in React state.
  const apiRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
  } | null>(null);

  useEffect(() => {
    const container = rootRef.current?.parentElement;
    const svg = container?.querySelector("svg");
    if (!(container instanceof HTMLElement) || !(svg instanceof SVGSVGElement)) return;

    const world = parseViewBox(viewBox);
    let view: ViewBox = { ...world };

    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- imperative viewBox writes, batched to one per frame (SPEC §8, INP) ----------
    let applyRaf: number | null = null;
    const writeNow = (v: ViewBox) => svg.setAttribute("viewBox", formatViewBox(v));
    const scheduleWrite = () => {
      if (applyRaf !== null) return;
      applyRaf = requestAnimationFrame(() => {
        applyRaf = null;
        writeNow(view);
      });
    };
    const setView = (next: ViewBox) => {
      view = next;
      scheduleWrite();
    };

    // --- smooth tween for discrete zoom (buttons / keyboard / double-click) ----------
    let tweenRaf: number | null = null;
    const cancelTween = () => {
      if (tweenRaf !== null) {
        cancelAnimationFrame(tweenRaf);
        tweenRaf = null;
      }
    };
    const animateTo = (rawTarget: ViewBox) => {
      cancelTween();
      const target = clampPan(rawTarget, world);
      if (reducedMotion()) {
        setView(target); // instant jump, no tween (SPEC §6)
        return;
      }
      const from = { ...view };
      const start = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / TWEEN_MS);
        const e = ease(t);
        view = {
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          w: from.w + (target.w - from.w) * e,
          h: from.h + (target.h - from.h) * e,
        };
        writeNow(view);
        tweenRaf = t < 1 ? requestAnimationFrame(step) : null;
      };
      tweenRaf = requestAnimationFrame(step);
    };

    const svgFraction = (clientX: number, clientY: number) => {
      const rect = svg.getBoundingClientRect();
      return {
        fx: (clientX - rect.left) / rect.width,
        fy: (clientY - rect.top) / rect.height,
      };
    };

    // Center-anchored discrete zoom used by the buttons and the +/- keys.
    const zoomStep = (factor: number) => {
      cancelTween();
      animateTo(zoomAtPoint(view, world, zoomOf(world, view) * factor, 0.5, 0.5));
    };
    const reset = () => animateTo({ ...world });

    apiRef.current = {
      zoomIn: () => zoomStep(ZOOM_STEP),
      zoomOut: () => zoomStep(1 / ZOOM_STEP),
      reset,
    };

    // --- wheel zoom, cursor-anchored, direct 1:1 (no tween) --------------------------
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // never scroll the page while zooming the map
      cancelTween();
      const { fx, fy } = svgFraction(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * 0.0015); // smooth exponential
      setView(zoomAtPoint(view, world, zoomOf(world, view) * factor, fx, fy));
    };

    // --- pointer pan (single) + pinch (two), no capture so native click stays intact -
    const pointers = new Map<number, { x: number; y: number }>();
    let panOrigin: { vx: number; vy: number; cx: number; cy: number } | null = null;
    let pinchStart: { dist: number; zoom: number } | null = null;
    let downTime = 0;
    let maxMove = 0;
    let justDragged = false;
    let panning = false;

    const clientDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const beginPanFromPrimary = () => {
      const first = pointers.values().next().value;
      if (!first) {
        panOrigin = null;
        return;
      }
      panOrigin = { vx: view.x, vy: view.y, cx: first.x, cy: first.y };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return; // primary button only
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      cancelTween();
      justDragged = false;
      downTime = e.timeStamp;
      maxMove = 0;
      // Global listeners so a fast drag that leaves the SVG still tracks (SPEC §2).
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      if (pointers.size === 1) {
        beginPanFromPrimary();
        pinchStart = null;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (a && b) {
          pinchStart = { dist: clientDistance(a, b), zoom: zoomOf(world, view) };
          panOrigin = null; // suspend single-finger pan during the pinch
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinchStart && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        if (!a || !b) return;
        const dist = clientDistance(a, b);
        if (pinchStart.dist > 0) {
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const { fx, fy } = svgFraction(midX, midY);
          const targetZoom = zoomFromPinch(pinchStart.zoom, pinchStart.dist, dist);
          setView(zoomAtPoint(view, world, targetZoom, fx, fy));
        }
        markPanning();
        return;
      }

      if (panOrigin) {
        const rect = svg.getBoundingClientRect();
        const p = pointers.get(e.pointerId);
        if (!p) return;
        const dxClient = p.x - panOrigin.cx;
        const dyClient = p.y - panOrigin.cy;
        maxMove = Math.max(maxMove, moveDistance(dxClient, dyClient));
        if (!panning && maxMove < PAN_START_PX) return; // still a candidate tap
        markPanning();
        // Convert client px delta into world units, then move opposite the drag.
        const worldPerPxX = view.w / rect.width;
        const worldPerPxY = view.h / rect.height;
        setView(
          clampPan(
            {
              ...view,
              x: panOrigin.vx - dxClient * worldPerPxX,
              y: panOrigin.vy - dyClient * worldPerPxY,
            },
            world,
          ),
        );
      }
    };

    const markPanning = () => {
      if (panning) return;
      panning = true;
      container.dataset.panning = "true";
    };
    const endPanning = () => {
      panning = false;
      delete container.dataset.panning;
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasPanningGesture = panning;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (pointers.size === 1) {
        // Lifting one finger of a pinch: continue panning with the one that remains.
        beginPanFromPrimary();
        return;
      }
      if (pointers.size === 0) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        const duration = e.timeStamp - downTime;
        // A drag/pan (or a slow press) must NOT navigate: swallow the upcoming click.
        if (wasPanningGesture || !isRealClick(maxMove, duration)) {
          justDragged = true;
        }
        panOrigin = null;
        endPanning();
      }
    };

    // Capture-phase click swallow: if the gesture was a pan, stop the country <a> from
    // navigating (SPEC §4). A real tap/click leaves justDragged false → link works.
    const onClickCapture = (e: MouseEvent) => {
      if (justDragged) {
        e.preventDefault();
        e.stopPropagation();
        justDragged = false;
      }
    };

    // Double-click zooms in one step, anchored at the cursor (SPEC §2). On a seeded
    // country the first click already navigates, so this effectively fires over ocean /
    // unseeded backdrop — the expected "zoom into empty sea" gesture.
    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      const { fx, fy } = svgFraction(e.clientX, e.clientY);
      animateTo(zoomAtPoint(view, world, zoomOf(world, view) * ZOOM_STEP, fx, fy));
    };

    // --- keyboard, only while the map surface itself is focused (SPEC §5) ------------
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== svg) return; // don't hijack keys while a country <a> is focused
      const panX = view.w * KEY_PAN_FRACTION;
      const panY = view.h * KEY_PAN_FRACTION;
      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomStep(ZOOM_STEP);
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomStep(1 / ZOOM_STEP);
          break;
        // Arrow pans cancel any in-flight zoom tween first: otherwise the tween's own rAF
        // loop keeps overwriting `view` and silently stomps the pan applied here — the
        // "first arrow after a zoom is a no-op" papercut (review L1).
        case "ArrowLeft":
          e.preventDefault();
          cancelTween();
          setView(panBy(view, world, -panX, 0));
          break;
        case "ArrowRight":
          e.preventDefault();
          cancelTween();
          setView(panBy(view, world, panX, 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          cancelTween();
          setView(panBy(view, world, 0, -panY));
          break;
        case "ArrowDown":
          e.preventDefault();
          cancelTween();
          setView(panBy(view, world, 0, panY));
          break;
        case "0":
        case "Home":
          e.preventDefault();
          reset();
          break;
        default:
          break;
      }
    };

    // Keyboard focus-follows-view (WCAG 2.4.7, SPEC §5): when a country <a> takes focus
    // and its shape is clipped out of a zoomed/panned view, pan it back on-screen so the
    // :focus-visible highlight is actually visible. Gated on `pointers.size === 0`, which
    // is false during a mouse press (focus fires while the pointer is down) — so ONLY true
    // keyboard focus pans; a mouse click that focuses-then-navigates never triggers it.
    const onFocusIn = (e: FocusEvent) => {
      if (panning || pointers.size > 0) return;
      const target = e.target;
      if (!(target instanceof SVGAElement) || !svg.contains(target)) return;
      const box = target.getBBox();
      if (box.width <= 0 || box.height <= 0) return;
      const next = viewToIncludeShape(view, world, {
        x: box.x,
        y: box.y,
        w: box.width,
        h: box.height,
      });
      if (next !== view) animateTo(next); // identity-unchanged when already fully visible
    };

    // Reset to the world view on a bfcache restore (SPEC §7 — no persistence).
    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) {
        cancelTween();
        view = { ...world };
        writeNow(view);
      }
    };

    // Make the SVG a keyboard-focusable pan/zoom surface without disturbing the crawlable
    // country <a> tab order (SPEC §5) or its existing <title> labelling.
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("data-zoomable", "true");
    svg.setAttribute("aria-describedby", instructionsId);
    // Defend against a bfcache-restored zoomed attribute (effect doesn't re-run on restore).
    writeNow(view);

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("dblclick", onDblClick);
    svg.addEventListener("keydown", onKeyDown);
    svg.addEventListener("focusin", onFocusIn);
    container.addEventListener("click", onClickCapture, true);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      if (applyRaf !== null) cancelAnimationFrame(applyRaf);
      cancelTween();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("dblclick", onDblClick);
      svg.removeEventListener("keydown", onKeyDown);
      svg.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pageshow", onPageShow);
      endPanning();
      apiRef.current = null;
    };
  }, [viewBox, instructionsId]);

  const dismissHint = () => {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, "dismissed");
    } catch {
      // storage blocked → the hint simply reappears next visit; acceptable.
    }
  };

  return (
    <div ref={rootRef} className={styles.zoomLayer}>
      <div className={styles.zoomControls} role="group" aria-label={labels.controls}>
        <button
          type="button"
          className={styles.zoomButton}
          aria-label={labels.zoomIn}
          onClick={() => apiRef.current?.zoomIn()}
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          className={styles.zoomButton}
          aria-label={labels.zoomOut}
          onClick={() => apiRef.current?.zoomOut()}
        >
          <span aria-hidden="true">&minus;</span>
        </button>
        <button
          type="button"
          className={styles.zoomButton}
          aria-label={labels.reset}
          onClick={() => apiRef.current?.reset()}
        >
          <span aria-hidden="true">⤢</span>
        </button>
      </div>

      {hintVisible && (
        <div className={styles.zoomHint} role="note">
          <span>{labels.hint}</span>
          <button
            type="button"
            className={styles.zoomHintDismiss}
            aria-label={labels.dismissHint}
            onClick={dismissHint}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </div>
  );
}
