"use client";

import { useEffect, useRef } from "react";
import { MAP_CAMERA_EVENT, isMapCameraEvent } from "@/lib/map/map-camera";
import {
  CLICK_MOVE_THRESHOLD_PX,
  type ViewBox,
  clampPan,
  fitViewToAspect,
  formatViewBox,
  isRealClick,
  moveDistance,
  panBy,
  parseViewBox,
  unionBox,
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
  /**
   * WHERE the control cluster sits, expressed as the two classes that position it — the
   * caller's own, so a surface can place the buttons without this file learning about it
   * (→ DEC 2026-08-17g md. 3: on a phone the game's cluster leaves the map entirely).
   *
   * They REPLACE the shared overlay classes rather than being appended: the game's cluster
   * is a row in the frame's flow, which is not a variation on `position: absolute; inset: 0`
   * but its opposite, and a caller that has to out-specify six declarations from another
   * module is the override-soup this prop exists to avoid. The BUTTONS keep the shared
   * `.zoomButton` look either way — only placement is the caller's.
   *
   * Omitted (the `/dunya` case) they are exactly today's classes, so that surface renders the
   * same markup it always has.
   */
  layerClassName?: string;
  controlsClassName?: string;
}

/* REMOVED 2026-08-02 (owner ruling): the one-time "scroll to zoom" hint box (SPEC §9) and
   its localStorage dismissed-flag store. It sat in the map's bottom-left corner, on top of
   the map, with `pointer-events: auto` — so it also swallowed clicks on whatever shape was
   under it — and on a short stage it crowded the ODbL attribution. The always-visible
   +/−/reset buttons and the aria-describedby instructions carry the same affordance
   without covering the map. */

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
 * The shared map zoom/pan client island (SPEC `dunya-haritasi-zoom-pan-spec`), used by the
 * `/dunya` world map and, from Kâşif PR-2, by the `/oyun` game map — where zoom is not a
 * convenience but the only way to reach the smallest provinces on a phone (SPEC §7.2).
 *
 * It enhances the server-rendered `<svg>` found inside whichever element it is mounted in —
 * resolved as its own `parentElement` rather than by name, which is why one component serves
 * both surfaces. Exactly the same "reach the shared container, enhance it imperatively"
 * pattern as `MapHoverCard`. Since the game's cluster moved out of the map box the host and
 * the SVG's own parent are no longer always the same element, so the two roles are named
 * apart inside the effect: the HOST is where the buttons live, the CANVAS (`svg.parentElement`
 * — `.mapRoot` on `/dunya`, `.stage` on `/oyun`) is what carries `data-panning` and swallows
 * a drag's click. It NEVER re-renders the map per frame: the viewBox is mutated directly
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
export function MapZoomPan({
  viewBox,
  instructionsId,
  labels,
  layerClassName,
  controlsClassName,
}: MapZoomPanProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Imperative control handles wired up on mount; the rendered buttons call through
  // these so the JSX never needs the live viewBox in React state.
  const apiRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
  } | null>(null);

  useEffect(() => {
    // The island is a sibling of the `<svg>` on /dunya and a sibling of the STAGE that holds
    // it in the game (the game's cluster left the map box, → DEC 2026-08-17g md. 3), so the
    // search is a descendant one and the contract is "the element I am mounted in contains
    // exactly one <svg>".
    const host = rootRef.current?.parentElement;
    const svg = host?.querySelector("svg");
    if (!(host instanceof HTMLElement) || !(svg instanceof SVGSVGElement)) return;

    // The element that carries `data-panning` and swallows the click of a drag is the SVG's
    // OWN parent, not the island's host. Today those are the same element on both surfaces
    // (`.mapRoot` on /dunya, `.stage` in the game) — naming it this way is what keeps them
    // the same now that the island's host can be one level further out. Eight game CSS rules
    // are written against `.stage[data-panning]`, and they would have gone quiet.
    const canvas = svg.parentElement;
    if (!(canvas instanceof HTMLElement)) return;

    const world = parseViewBox(viewBox);
    // The 1× REFERENCE and the OPENING frame. They are the world itself wherever the stage
    // carries the map's own shape — /dunya, every region round, and the game's own desktop
    // layout — because `fitViewToAspect` answers a matching aspect with the world
    // (`ASPECT_EPSILON`). Where the stage has a shape of its own (the phone's 1.2 stage) the
    // reference grows to hold the whole country, and the opening frame is the crop that pays
    // for the scale (→ DEC 2026-08-17g md. 1/md. 2).
    let base: ViewBox = { ...world };
    let view: ViewBox = { ...world };
    // Until the player moves the map themselves, a re-measure re-derives the opening frame
    // rather than preserving the current one: rotating a phone should re-frame the country,
    // not keep a crop computed for the other orientation. After the first interaction the
    // player's view is theirs and only its shape is rebuilt.
    let userAdjusted = false;

    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- filter radii that must not grow with the zoom -------------------------------
    // A `<filter>` primitive's `radius` is in USER UNITS of the map's coordinate space, so
    // zooming in magnifies it along with the geometry. The game map's bölge silhouette is
    // drawn that way, and left uncompensated it reached a ~25px black band at 12× (measured;
    // `overlay-6a`). The fix is one attribute write per frame: scale the radius by exactly
    // the factor the view narrowed by, and the outline holds its on-screen thickness.
    //
    // Discovered by attribute, not by id, so this island stays surface-agnostic: /dunya has
    // no such primitive and this whole block costs it one empty query. `data-zoom-radius`
    // holds the BASE value and is never written to — only `radius` is — so repeated frames
    // cannot compound, and re-reading after a bfcache restore still starts from the truth.
    const zoomRadii = [...svg.querySelectorAll("[data-zoom-radius]")]
      .map((node) => ({ node, base: Number(node.getAttribute("data-zoom-radius")) }))
      .filter((entry) => Number.isFinite(entry.base) && entry.base > 0);
    const writeZoomRadii = (v: ViewBox) => {
      if (zoomRadii.length === 0 || world.w <= 0) return;
      const scale = v.w / world.w;
      for (const { node, base } of zoomRadii) {
        node.setAttribute("radius", (base * scale).toFixed(4));
      }
    };

    // --- imperative viewBox writes, batched to one per frame (SPEC §8, INP) ----------
    let applyRaf: number | null = null;
    // Both writes live here, so the radius can never lag a frame behind the view it
    // compensates for — every path that moves the view goes through this function.
    const writeNow = (v: ViewBox) => {
      svg.setAttribute("viewBox", formatViewBox(v));
      writeZoomRadii(v);
      // --- who owns the vertical finger ------------------------------------------------
      // A stage tall enough to matter (the phone's 1.2 box is half the screen) cannot also
      // hold `touch-action: none` unconditionally: the page under it would be unscrollable
      // wherever the map is. The rule falls out of the view itself — while every row of the
      // world is on screen a vertical drag moves the map by exactly nothing (`clampPan` pins
      // it), so the page may have it; the moment the view is vertically cropped the map needs
      // it back. One attribute, read only by the game's stylesheet: /dunya keeps its
      // unconditional `touch-action: none` because its own rules never mention this.
      //
      // The tolerance is RELATIVE, like `ASPECT_EPSILON` and unlike the absolute half-unit
      // this used to carry (review CODE69-M6): the module's contract is projection-agnostic,
      // and a map whose viewBox height is of order ten user units would read as "cropped" a
      // whole 5% early against a fixed 0.5.
      const cropsVertically = v.h < world.h * (1 - 1e-3);
      svg.toggleAttribute("data-vertical-pan", cropsVertically);
    };
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
      userAdjusted = true;
      animateTo(zoomAtPoint(view, world, zoomOf(base, view) * factor, 0.5, 0.5, base));
    };
    /**
     * "Show the whole map" (→ DEC 2026-08-17g md. 4). The target is the 1× REFERENCE, not the
     * frame the map opened with: on a phone those differ, and the owner ruled that the button
     * a player presses to see everything must actually show everything. On every surface
     * whose stage carries the map's own shape the two are the same rectangle and this is the
     * reset it has always been.
     */
    const reset = () => {
      userAdjusted = true;
      animateTo({ ...base });
    };

    apiRef.current = {
      zoomIn: () => zoomStep(ZOOM_STEP),
      zoomOut: () => zoomStep(1 / ZOOM_STEP),
      reset,
    };

    /** Same rectangle, to the bit — the "did the frame actually change" test below. */
    const sameFrame = (a: ViewBox, b: ViewBox) =>
      a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

    /**
     * Derive both rectangles from the box the stage actually rendered, and write the view.
     *
     * MEASURED, not passed in: the phone stage's height is `min(width / 1.2, viewport cap)`
     * with a floor at the map's own ratio, so its aspect is a LAYOUT outcome and no server
     * constant could state it. The box itself is settled by CSS before this runs — the
     * fixed-size-container rule is untouched (ENGINEERING §3, CLS budget §4 #9) — and what
     * this decides is only which part of the world is drawn inside it.
     *
     * There is no visible step at hydration: the server ships
     * `preserveAspectRatio="xMidYMid slice"`, whose painted rectangle IS the `"cover"` fit
     * computed here, so the explicit viewBox written on mount replaces an identical framing.
     *
     * A REFRAME THAT CHANGES NOTHING MUST DO NOTHING — least of all cancel an animation
     * (review CODE69-C1, adversarially validated with a live A/B). `/dunya` renders its
     * `<svg>` at `height: auto`, so the element's box height is derived from the very
     * `viewBox` this island writes on every tween frame; `formatViewBox` rounds w and h
     * independently, so each write moves that height by a LayoutUnit or two and the
     * ResizeObserver below fires MID-TWEEN. With the tail unconditional, the observer
     * cancelled the tween on its first or second frame and wrote the interpolated rectangle
     * as final: measured on the branch, one `+` press delivered 1.028× of its 1.800× step
     * and the reset button needed 13 presses to reach the world view.
     *
     * The guard is exact rather than tolerant on purpose: `fitViewToAspect` answers every
     * aspect within `ASPECT_EPSILON` with the world ITSELF, so on any surface whose stage
     * carries the map's own shape both sides are the same four numbers and the feedback path
     * is closed at the source. `force` belongs to the two callers that must rebuild whatever
     * the arithmetic says — mount, and a bfcache restore, where the attribute sitting on the
     * element is not one this island wrote.
     */
    const reframe = (force = false) => {
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const aspect = rect.width / rect.height;
      const nextBase = fitViewToAspect(world, aspect, "contain");
      if (!force && sameFrame(nextBase, base)) return;
      if (userAdjusted) {
        // Keep the player's zoom and the point they were looking at; rebuild the shape.
        const zoom = zoomOf(base, view);
        base = nextBase;
        view = zoomAtPoint(view, world, zoom, 0.5, 0.5, base);
      } else {
        base = nextBase;
        view = fitViewToAspect(world, aspect, "cover");
      }
      cancelTween();
      writeNow(view);
    };

    // --- wheel zoom, cursor-anchored, direct 1:1 (no tween) --------------------------
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // never scroll the page while zooming the map
      cancelTween();
      userAdjusted = true;
      const { fx, fy } = svgFraction(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * 0.0015); // smooth exponential
      setView(zoomAtPoint(view, world, zoomOf(base, view) * factor, fx, fy, base));
    };

    // --- pointer pan (single) + pinch (two), no capture so native click stays intact -
    const pointers = new Map<number, { x: number; y: number }>();
    let panOrigin: { vx: number; vy: number; cx: number; cy: number } | null = null;
    let pinchStart: { dist: number; zoom: number } | null = null;
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
          pinchStart = { dist: clientDistance(a, b), zoom: zoomOf(base, view) };
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
          userAdjusted = true;
          setView(zoomAtPoint(view, world, targetZoom, fx, fy, base));
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
        userAdjusted = true;
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
      canvas.dataset.panning = "true";
    };
    const endPanning = () => {
      panning = false;
      delete canvas.dataset.panning;
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
        // A drag/pan must NOT navigate: swallow the upcoming click. Duration is no longer
        // a gate (owner-ruled 2026-07-18) — a stationary press-and-hold still navigates;
        // only crossing the movement threshold (or a pinch) swallows the click.
        if (wasPanningGesture || !isRealClick(maxMove)) {
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
      userAdjusted = true;
      const { fx, fy } = svgFraction(e.clientX, e.clientY);
      animateTo(zoomAtPoint(view, world, zoomOf(base, view) * ZOOM_STEP, fx, fy, base));
    };

    // --- keyboard, only while the map surface itself is focused (SPEC §5) ------------
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== svg) return; // don't hijack keys while a country <a> is focused
      const panX = view.w * KEY_PAN_FRACTION;
      const panY = view.h * KEY_PAN_FRACTION;
      if (e.key.startsWith("Arrow")) userAdjusted = true;
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

    // Keyboard focus-follows-view (WCAG 2.4.7, SPEC §5): when a focusable shape takes
    // focus and is clipped out of a zoomed/panned view, pan it back on-screen so the
    // :focus-visible highlight is actually visible. Gated on `pointers.size === 0`, which
    // is false during a mouse press (focus fires while the pointer is down) — so ONLY true
    // keyboard focus pans; a mouse click that focuses-then-navigates never triggers it.
    //
    // "Focusable shape" is deliberately broader than `SVGAElement` (Kâşif PR-2): the game
    // map's provinces are shapes the game island gives `tabindex` and `role="button"`, not
    // links. `SVGAElement` still matches — a country link on /dunya is an
    // `SVGGraphicsElement` and has no `tabindex` — so /dunya's behaviour is unchanged by
    // construction. Since the maps went to layered `<use>` twins, the focused shape is an
    // `SVGUseElement`: it is an `SVGGraphicsElement` too, and `getBBox()` on it returns the
    // REFERENCED geometry's box, so this predicate and the fit below both keep working with
    // no change (verified in a browser). The `node !== svg` guard is load-bearing: the zoomable
    // `<svg>` is itself an `SVGGraphicsElement` with `tabindex="0"` (set below), and
    // without the guard focusing the map surface would try to fit the map's own bounding
    // box and silently reset the view.
    const isFocusableShape = (node: EventTarget | null): node is SVGGraphicsElement =>
      node instanceof SVGGraphicsElement &&
      node !== svg &&
      (node instanceof SVGAElement || node.hasAttribute("tabindex"));

    const onFocusIn = (e: FocusEvent) => {
      if (panning || pointers.size > 0) return;
      const target = e.target;
      if (!isFocusableShape(target) || !svg.contains(target)) return;
      const box = target.getBBox();
      if (box.width <= 0 || box.height <= 0) return;
      const next = viewToIncludeShape(view, world, {
        x: box.x,
        y: box.y,
        w: box.width,
        h: box.height,
      });
      if (next === view) return; // identity-unchanged when already fully visible
      // A pan the USER caused, so a later re-measure must keep it (review A11Y69-M1): without
      // this, rotating the phone re-derived the opening frame and threw the focused province
      // back off screen while DOM focus was still on it (WCAG 2.4.7).
      userAdjusted = true;
      animateTo(next);
    };

    // Reset to the opening view on a bfcache restore (SPEC §7 — no persistence). It goes
    // through `reframe` so a restore into a different orientation re-derives the frame from
    // the box that is actually on screen.
    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) {
        cancelTween();
        userAdjusted = false;
        // FORCED: the restored attribute is a zoomed view this island did not write, so the
        // frame arithmetic alone cannot tell that anything needs rewriting — on `/dunya` it
        // says the frame is the world both before and after.
        reframe(true);
      }
    };

    /**
     * "Cevabı göster" pans the map to the answer — and does nothing else (→ DEC 2026-08-17g
     * md. 4). `viewToIncludeShape` is the whole implementation: it never zooms IN, which is
     * what keeps Kâşif SPEC §7.2's ban intact (an automatic zoom would hand the player the
     * answer), and it centres a target larger than the view — the bölge case, where the
     * answer is a dozen provinces and their union may not fit at the current zoom.
     */
    const onCamera = (event: Event) => {
      if (!isMapCameraEvent(event)) return;
      const boxes: ViewBox[] = [];
      for (const shape of event.detail.shapes) {
        // The element check is HERE rather than in the predicate (review CODE69-M4): the
        // predicate is the module's node-testable half and may not name a DOM global, while
        // this listener only ever runs in a browser. A future dispatcher sending plate codes
        // instead of elements is then filtered out, not a `TypeError` inside `contains`.
        if (!(shape instanceof SVGGraphicsElement) || !svg.contains(shape)) continue;
        const box = shape.getBBox();
        if (box.width <= 0 || box.height <= 0) continue;
        boxes.push({ x: box.x, y: box.y, w: box.width, h: box.height });
      }
      const target = unionBox(boxes);
      if (!target) return;
      const next = viewToIncludeShape(view, world, target);
      if (next === view) return; // identity-unchanged when already fully visible
      // Same reason as `onFocusIn`: the player pressed "Cevabı göster" and this frame is the
      // answer to it, so a rotation must not discard it (review CODE69-M5).
      userAdjusted = true;
      animateTo(next);
    };

    // Re-derive the frames when the stage's box changes SHAPE — an orientation change, a
    // desktop resize, or the phone height cap starting to bind. Never forced: a box that
    // resizes without changing shape (every `/dunya` frame, see `reframe`) must leave the
    // view, and any tween running over it, alone.
    const resizeObserver = new ResizeObserver(() => reframe());

    // Make the SVG a keyboard-focusable pan/zoom surface without disturbing the crawlable
    // country <a> tab order (SPEC §5) or its existing <title> labelling.
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("data-zoomable", "true");
    svg.setAttribute("aria-describedby", instructionsId);
    // Derive the opening frame and write it. Also defends against a bfcache-restored zoomed
    // attribute (the effect doesn't re-run on restore) — hence forced: `base` starts as the
    // world, so on `/dunya` the arithmetic would otherwise find nothing to do and leave a
    // restored attribute in place.
    reframe(true);

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("dblclick", onDblClick);
    svg.addEventListener("keydown", onKeyDown);
    svg.addEventListener("focusin", onFocusIn);
    svg.addEventListener(MAP_CAMERA_EVENT, onCamera);
    canvas.addEventListener("click", onClickCapture, true);
    window.addEventListener("pageshow", onPageShow);
    resizeObserver.observe(svg);

    return () => {
      if (applyRaf !== null) cancelAnimationFrame(applyRaf);
      cancelTween();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("dblclick", onDblClick);
      svg.removeEventListener("keydown", onKeyDown);
      svg.removeEventListener("focusin", onFocusIn);
      svg.removeEventListener(MAP_CAMERA_EVENT, onCamera);
      canvas.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pageshow", onPageShow);
      endPanning();
      apiRef.current = null;
    };
  }, [viewBox, instructionsId]);

  return (
    <div ref={rootRef} className={layerClassName ?? styles.zoomLayer}>
      <div
        className={controlsClassName ?? styles.zoomControls}
        role="group"
        aria-label={labels.controls}
      >
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
          {/*
            DRAWN, NOT TYPED — this is the fix (→ DEC 2026-08-19a md. 8). This button used
            to carry the character ⤢ (U+2922), which readers took for "fullscreen". The
            cause is mechanical, not aesthetic: `lib/fonts.ts` loads Nunito Sans with the
            `latin` + `latin-ext` subsets, which cover `+` (U+002B) and `−` (U+2212) — the
            two siblings above — but NOT U+2922, so that one character alone was handed to
            whatever system font the reader had, and most of them draw U+2922 as the
            expand-to-fullscreen icon. Every rotate-back CHARACTER is outside those subsets
            too (U+21BA ↺, U+27F2 ⟲), so swapping one character for another would place the
            same bet again (`ENGINEERING.md` §5).

            AND IT IS A CSS MASK, NOT AN INLINE <svg>, WHICH IS LOAD BEARING. This island's
            controller finds the map with `host.querySelector("svg")` (see the mount effect
            above), a descendant search whose stated contract is "the element I am mounted
            in contains exactly one <svg>". On /dunya the island precedes the map in the
            DOM, so an <svg> in this button IS the first match: the controller then drives
            the 20px icon — measured, it took the map's `239.5 0 521 521` viewBox — and the
            240-path world map never moves again. A mask paints the same drawing with no
            element in the DOM, so the contract holds untouched on both surfaces.
          */}
          <span aria-hidden="true" className={styles.resetGlyph} />
        </button>
      </div>
    </div>
  );
}
