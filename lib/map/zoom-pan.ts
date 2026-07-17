/**
 * Pure zoom/pan geometry for the SVG-native world map (`/dunya`, SPEC
 * `dunya-haritasi-zoom-pan-spec`). NO DOM, NO React — every function here is a
 * deterministic transform on plain `viewBox` rectangles, so the click-vs-drag
 * threshold (SPEC §4) and the pan-clamp / cursor-anchored-zoom math (SPEC §1/§2) are
 * unit-testable in isolation (SPEC §8 test plan). The client island
 * (`components/map/map-zoom-pan.tsx`) owns all the imperative DOM/rAF wiring and calls
 * into these; keeping the math side-effect-free is what makes both testable AND the
 * per-frame update cheap (INP, SPEC §8).
 */

/** A `viewBox` rectangle in SVG user units: origin (x, y) + size (w, h). */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Owner-ruled zoom bounds (SPEC §1): 1× = full-world fit, 12× = Cyprus ~85px. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;

/**
 * Click-vs-drag disambiguation threshold (SPEC §4, amended owner-ruled 2026-07-18). A
 * pointer gesture is a real click (→ let the country `<a>` navigate) purely on MOVEMENT:
 * if it barely moved it navigates, no matter how long it was held. Anything past the
 * movement threshold is a pan → the click is swallowed. The former 250 ms duration gate
 * was removed because it silently ate deliberate slow stationary press-and-hold aiming on
 * small targets — the exact "small countries are hard to click" complaint this feature
 * exists to fix. Movement alone is the reliable pan/tap discriminator.
 */
export const CLICK_MOVE_THRESHOLD_PX = 6;

/** Parse an SVG `viewBox` attribute string ("minX minY width height") into a ViewBox. */
export function parseViewBox(value: string): ViewBox {
  const nums = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (nums.length !== 4) {
    throw new Error(`Invalid viewBox (expected 4 numbers): "${value}"`);
  }
  const [x, y, w, h] = nums as [number, number, number, number];
  if (![x, y, w, h].every((n) => Number.isFinite(n)) || w <= 0 || h <= 0) {
    throw new Error(`Invalid viewBox (non-finite or non-positive size): "${value}"`);
  }
  return { x, y, w, h };
}

/** Serialize a ViewBox back to an attribute string, rounded to keep it compact. */
export function formatViewBox(v: ViewBox): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(v.x)} ${r(v.y)} ${r(v.w)} ${r(v.h)}`;
}

/** Clamp a zoom factor into the owner-ruled [MIN_ZOOM, MAX_ZOOM] range. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Current zoom of a view relative to the world-fit rectangle (world.w / view.w). */
export function zoomOf(world: ViewBox, view: ViewBox): number {
  return world.w / view.w;
}

/**
 * Clamp a view's origin so the rectangle stays fully inside the world bbox (SPEC §1 —
 * "no pan into empty space beyond the world"). Width/height are assumed already ≤ world
 * (guaranteed by `clampZoom`, zoom ≥ 1), so `maxX/maxY ≥ world origin` and the range is
 * non-empty; at 1× the view is forced back onto the world origin.
 */
export function clampPan(view: ViewBox, world: ViewBox): ViewBox {
  const maxX = world.x + world.w - view.w;
  const maxY = world.y + world.h - view.h;
  return {
    ...view,
    x: Math.min(maxX, Math.max(world.x, view.x)),
    y: Math.min(maxY, Math.max(world.y, view.y)),
  };
}

/**
 * Zoom to `targetZoom` while keeping the world point currently under the fractional
 * viewport position (fracX, fracY) stationary — this is what makes wheel/double-click
 * zoom "anchor to the cursor" (SPEC §2). fracX/fracY ∈ [0, 1] measured from the view's
 * top-left. Result is clamped to the zoom range AND panned back inside the world bbox.
 */
export function zoomAtPoint(
  view: ViewBox,
  world: ViewBox,
  targetZoom: number,
  fracX: number,
  fracY: number,
): ViewBox {
  const z = clampZoom(targetZoom);
  const w = world.w / z;
  const h = world.h / z;
  // World-space point currently sitting under (fracX, fracY) of the viewport.
  const px = view.x + fracX * view.w;
  const py = view.y + fracY * view.h;
  return clampPan({ x: px - fracX * w, y: py - fracY * h, w, h }, world);
}

/** Pan by a delta expressed in world (SVG) units, clamped back inside the world bbox. */
export function panBy(view: ViewBox, world: ViewBox, dx: number, dy: number): ViewBox {
  return clampPan({ ...view, x: view.x + dx, y: view.y + dy }, world);
}

/**
 * Zoom factor implied by a pinch gesture (SPEC §3): the live finger separation relative
 * to the separation at pinch-start scales the zoom that was in effect when the pinch
 * began (fingers apart → zoom in, together → zoom out). Result is clamped to the
 * owner-ruled [MIN_ZOOM, MAX_ZOOM] range, exactly like `zoomAtPoint`, so a runaway pinch
 * can never escape the world-fit / 12× bounds. A non-positive start distance (a degenerate
 * two-finger-down on the same point) cannot define a ratio → the start zoom is held.
 */
export function zoomFromPinch(startZoom: number, startDist: number, currentDist: number): number {
  if (startDist <= 0) return clampZoom(startZoom);
  return clampZoom((startZoom * currentDist) / startDist);
}

/**
 * Smallest pan (never a zoom-in) that brings `shape` fully into the current view, so a
 * keyboard focus landing on a country clipped out of a zoomed/panned view scrolls it back
 * on-screen (WCAG 2.4.7 "focus visible"; SPEC §5). An already-fully-visible shape returns
 * the SAME view reference (the caller uses identity to skip a no-op animation). A shape
 * LARGER than the current viewport (e.g. a big country at high zoom) is centred so its
 * middle shows — the zoom level and aspect ratio are preserved; we never zoom IN to chase
 * a focus. Result stays clamped inside the world bbox. `shape` is an SVG-user-unit bbox
 * (same coordinate space as `view`), i.e. an element's `getBBox()`.
 */
export function viewToIncludeShape(view: ViewBox, world: ViewBox, shape: ViewBox): ViewBox {
  const fullyVisible =
    shape.x >= view.x &&
    shape.y >= view.y &&
    shape.x + shape.w <= view.x + view.w &&
    shape.y + shape.h <= view.y + view.h;
  if (fullyVisible) return view;

  // Per-axis: centre an oversized shape, else nudge the view just enough to contain it.
  const axis = (vStart: number, vSize: number, sStart: number, sSize: number): number => {
    if (sSize >= vSize) return sStart + sSize / 2 - vSize / 2;
    if (sStart < vStart) return sStart;
    if (sStart + sSize > vStart + vSize) return sStart + sSize - vSize;
    return vStart;
  };

  return clampPan(
    {
      ...view,
      x: axis(view.x, view.w, shape.x, shape.w),
      y: axis(view.y, view.h, shape.y, shape.h),
    },
    world,
  );
}

/** Euclidean pointer travel (px) between pointerdown and pointerup. */
export function moveDistance(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

/**
 * True when a pointer gesture should be treated as a real click that navigates, rather
 * than a pan whose click must be swallowed (SPEC §4, amended owner-ruled 2026-07-18):
 * it is a click purely when it moved LESS than the movement threshold — hold duration is
 * irrelevant, so a deliberate slow stationary press-and-hold still navigates.
 */
export function isRealClick(moveDistancePx: number): boolean {
  return moveDistancePx < CLICK_MOVE_THRESHOLD_PX;
}
