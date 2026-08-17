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
 * How far a rendered box's aspect may drift from the world's before this module treats the
 * two as DIFFERENT shapes (→ DEC 2026-08-17g md. 1).
 *
 * A layout box is measured in device pixels and rounded; `/dunya` renders its `<svg>` with
 * `height: auto`, so its box carries the viewBox's own ratio to within a rounding error, and
 * the game's region rounds size their stage from the very frame they draw. Without a
 * tolerance those surfaces would "crop" themselves by a hundredth of a percent — a real
 * viewBox string change on a page this work is not allowed to touch. Half a percent is far
 * below any deliberate reframing (the phone stage asks for 1.2 against the country's 2.331,
 * a 94% difference) and far above sub-pixel noise.
 */
export const ASPECT_EPSILON = 0.005;

/** Aspect ratio (width ÷ height) of a viewBox rectangle. Module-local: `lib/game/map-bbox.ts`
 *  already exports `aspectOfViewBox` for callers outside this file (review CODE69-M3). */
function aspectOf(box: ViewBox): number {
  return box.w / box.h;
}

/**
 * The 1× reference rectangle for a stage whose aspect differs from the world's
 * (→ DEC 2026-08-17g md. 1/md. 2).
 *
 * Two rectangles are needed once the stage stops carrying the map's own shape, and they are
 * NOT interchangeable:
 *
 * - `"cover"` — the largest rectangle of `aspect` that fits INSIDE the world. This is what
 *   the phone opens with: the country is cropped east–west, every latitude stays on screen,
 *   and the scale is the whole point of the taller stage (360 × 300 ⇒ 514.8 × 429 user
 *   units ⇒ 0.699 px/uu against today's 0.36). It is exactly the rectangle
 *   `preserveAspectRatio="xMidYMid slice"` paints before any script runs, which is why
 *   hydration moves nothing.
 * - `"contain"` — the smallest rectangle of `aspect` that CONTAINS the world. This is what
 *   the reset button returns to: the whole country visible, with backdrop above and below
 *   rather than a cropped edge (owner ruling: "sıfırla = tüm ülke").
 *
 * Both are centred on the world's centre. When the stage already carries the world's shape —
 * `/dunya` and every region round — the two collapse onto the world itself and this whole
 * layer is inert (see `ASPECT_EPSILON`).
 */
export function fitViewToAspect(
  world: ViewBox,
  aspect: number,
  mode: "cover" | "contain",
): ViewBox {
  if (!Number.isFinite(aspect) || aspect <= 0) return { ...world };
  const worldAspect = aspectOf(world);
  if (Math.abs(aspect - worldAspect) / worldAspect < ASPECT_EPSILON) return { ...world };

  // One branch per mode, both expressed as "which side is the binding one".
  const h =
    mode === "cover" ? Math.min(world.h, world.w / aspect) : Math.max(world.h, world.w / aspect);
  const w = h * aspect;
  return {
    x: world.x + world.w / 2 - w / 2,
    y: world.y + world.h / 2 - h / 2,
    w,
    h,
  };
}

/**
 * The smallest rectangle containing every box given, or `null` for an empty list — the
 * camera's target when a shown answer covers several shapes (a bölge is seven to fourteen
 * provinces, → DEC 2026-08-17g md. 4).
 */
export function unionBox(boxes: readonly ViewBox[]): ViewBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (box.x + box.w > maxX) maxX = box.x + box.w;
    if (box.y + box.h > maxY) maxY = box.y + box.h;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

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

/**
 * Current zoom of a view relative to a REFERENCE rectangle (reference.w / view.w).
 *
 * The reference is the world on every surface whose stage carries the map's own shape, and
 * the `"contain"` fit of the stage's aspect where it does not (`fitViewToAspect`). The
 * signature is unchanged because the reference was always the first argument — callers pass
 * a different rectangle, not a different function.
 */
export function zoomOf(reference: ViewBox, view: ViewBox): number {
  return reference.w / view.w;
}

/**
 * Clamp a view's origin so the rectangle stays inside the world bbox (SPEC §1 — "no pan into
 * empty space beyond the world"), per axis.
 *
 * THE OVERSIZED CASE IS NEW and it is what makes the reset view legal (→ DEC 2026-08-17g
 * md. 4). Until the stage was allowed a shape of its own, a view could never be larger than
 * the world on either axis: `clampZoom` floors the zoom at 1× and 1× WAS the world. The
 * "whole country in a 1.2 stage" rectangle is taller than the world, and the old arithmetic
 * answered that by pinning it to the world's bottom edge — the country would have sat glued
 * to the top of the box with all the empty space below it. An axis whose view is at least as
 * large as the world is CENTRED instead, exactly as `viewToIncludeShape` already centres a
 * shape bigger than the viewport.
 *
 * The equal case (view size === world size) resolves to the world's own origin in BOTH the
 * old and the new arithmetic, which is why every surface whose stage carries the map's own
 * shape is untouched by this change.
 */
export function clampPan(view: ViewBox, world: ViewBox): ViewBox {
  const axis = (start: number, size: number, worldStart: number, worldSize: number): number =>
    size >= worldSize
      ? worldStart + worldSize / 2 - size / 2
      : Math.min(worldStart + worldSize - size, Math.max(worldStart, start));

  return {
    ...view,
    x: axis(view.x, view.w, world.x, world.w),
    y: axis(view.y, view.h, world.y, world.h),
  };
}

/**
 * Zoom to `targetZoom` while keeping the world point currently under the fractional
 * viewport position (fracX, fracY) stationary — this is what makes wheel/double-click
 * zoom "anchor to the cursor" (SPEC §2). fracX/fracY ∈ [0, 1] measured from the view's
 * top-left. Result is clamped to the zoom range AND panned back inside the world bbox.
 *
 * `base` is the 1× REFERENCE rectangle and defaults to the world, which is what every caller
 * passed before the stage was allowed a shape of its own — so the default path is the
 * arithmetic this function has always run, character for character. On a surface whose stage
 * has a different aspect the reference is `fitViewToAspect(world, aspect, "contain")`, and
 * splitting the two arguments is the whole of the aspect-awareness: the SIZE of a view comes
 * from the reference, the BOUNDS it may not leave come from the world. Rebuilding the size
 * from the world (as this did) is what would letterbox a 1.2 stage — the view would keep the
 * country's 2.331 shape inside a box that no longer has it.
 */
export function zoomAtPoint(
  view: ViewBox,
  world: ViewBox,
  targetZoom: number,
  fracX: number,
  fracY: number,
  base: ViewBox = world,
): ViewBox {
  const z = clampZoom(targetZoom);
  const w = base.w / z;
  const h = base.h / z;
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
