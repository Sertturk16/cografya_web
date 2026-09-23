import type { ShapePoint } from "@/lib/map/shape-geometry";

/**
 * Neighbour-country labels on `/turkiye`'s map (T-082).
 *
 * The labels are SVG text, so their size is in viewBox units and the drawing scales them with
 * the box: 12 units measured 10.85px in the 1440px desktop box and 2.2–2.8px in a phone's
 * 231–301px square. This module counter-scales them to a constant on-screen size and decides
 * which ones fit their country at that size, so a phone shows fewer labels, all legible.
 *
 * WHY THE FIT READS THE OUTLINE, NOT `labelRadius` ALONE. The artifact's `labelRadius` (the
 * largest circle inside the country) was the first rule tried, and no single factor on it works:
 * at 1440px "Yunanistan" is 1.08× Greece's circle and sits inside Greece, while at 360–390px
 * "Libya" at 1.04× and "Ürdün" at 1.12× their circles measured over the border. A circle
 * under-reads a long country and over-reads a narrow one. So the rule measures the horizontal
 * room around the label point on the country's own outline, at the text's top, middle and
 * bottom, against the text's width from measured glyph advances.
 */

/** The label size before any measurement, and the one the desktop box renders at 1440px. */
const DEFAULT_FONT_UNITS = 12;

/**
 * CSS px per viewBox unit in the 1440px desktop box: its 1148px content width (1150px less the
 * 1px borders) over the tall frame's 1270 units.
 */
export const DESKTOP_SCALE = 1148 / 1270;

/** On-screen label size in CSS px: what 12 units measure at 1440px (10.85px). */
export const CONTEXT_LABEL_PX = DEFAULT_FONT_UNITS * DESKTOP_SCALE;

/**
 * Advance widths in em of Nunito Sans Bold with `tracking-tight` (-0.025em), measured in the
 * browser as `width("HxH") - width("HH")` at 100px. The Turkish alphabet and a space; any other
 * character falls back to {@link FALLBACK_ADVANCE}, wider than every lowercase entry.
 */
const ADVANCE_EM: Readonly<Record<string, number>> = {
  " ": 0.245,
  A: 0.719,
  B: 0.663,
  C: 0.654,
  Ç: 0.654,
  D: 0.737,
  E: 0.572,
  F: 0.537,
  G: 0.711,
  Ğ: 0.711,
  H: 0.748,
  I: 0.256,
  İ: 0.256,
  J: 0.33,
  K: 0.639,
  L: 0.537,
  M: 0.843,
  N: 0.723,
  O: 0.76,
  Ö: 0.76,
  P: 0.627,
  R: 0.661,
  S: 0.606,
  Ş: 0.606,
  T: 0.596,
  U: 0.713,
  Ü: 0.713,
  V: 0.688,
  Y: 0.628,
  Z: 0.58,
  a: 0.522,
  b: 0.575,
  c: 0.447,
  ç: 0.447,
  d: 0.575,
  e: 0.517,
  f: 0.339,
  g: 0.579,
  ğ: 0.579,
  h: 0.56,
  ı: 0.23,
  i: 0.23,
  j: 0.234,
  k: 0.511,
  l: 0.294,
  m: 0.852,
  n: 0.56,
  o: 0.551,
  ö: 0.551,
  p: 0.575,
  r: 0.367,
  s: 0.463,
  ş: 0.463,
  t: 0.359,
  u: 0.554,
  ü: 0.554,
  v: 0.502,
  y: 0.501,
  z: 0.449,
};
const FALLBACK_ADVANCE = 0.75;

/**
 * Half the ink height in em around the `dominant-baseline="central"` line: cap height plus the
 * dots of İ and Ü above it, and the descenders of y and g below.
 */
const INK_HALF_EM = 0.4;

/** Clearance in CSS px between the text's ends and the border. */
const MARGIN_PX = 1;

/** A label's width in em, from {@link ADVANCE_EM}. */
export function labelWidthEm(name: string): number {
  let em = 0;
  for (const ch of name) em += ADVANCE_EM[ch] ?? FALLBACK_ADVANCE;
  return em;
}

/** Width and height of an SVG `viewBox` string. */
export function viewBoxSize(viewBox: string): { width: number; height: number } {
  const [, , width = 0, height = 0] = viewBox.trim().split(/\s+/).map(Number);
  return { width, height };
}

/** Origin and size of an SVG `viewBox` string. */
export function viewBoxRect(viewBox: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const [x = 0, y = 0, width = 0, height = 0] = viewBox.trim().split(/\s+/).map(Number);
  return { x, y, width, height };
}

/** An axis-aligned rectangle, in whatever space the caller names. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * The viewBox-unit rectangle under `rect`, given in the map box's own CSS px — an overlay such
 * as the zoom toolbar (T-086) — for an SVG drawn `xMidYMid slice` inside a wrapper transformed
 * `scale(zoom) translate(pan / zoom)` about its centre, which is the explorer's zoom and pan.
 * A screen point p maps back to the unzoomed box as (p - centre - pan) / zoom + centre.
 */
export function boxRectToViewBox(
  rect: Rect,
  box: { width: number; height: number },
  viewBox: { x: number; y: number; width: number; height: number },
  zoom: number,
  pan: { x: number; y: number },
): Rect {
  const s = sliceScale(box.width, box.height, viewBox.width, viewBox.height);
  const toUnitX = (px: number) =>
    ((px - box.width / 2 - pan.x) / zoom + box.width / 2 - (box.width - viewBox.width * s) / 2) /
      s +
    viewBox.x;
  const toUnitY = (px: number) =>
    ((px - box.height / 2 - pan.y) / zoom +
      box.height / 2 -
      (box.height - viewBox.height * s) / 2) /
      s +
    viewBox.y;
  return {
    left: toUnitX(rect.left),
    top: toUnitY(rect.top),
    right: toUnitX(rect.right),
    bottom: toUnitY(rect.bottom),
  };
}

/** CSS px per viewBox unit under `preserveAspectRatio="… slice"`: the larger axis wins. */
export function sliceScale(boxWidth: number, boxHeight: number, vbWidth: number, vbHeight: number) {
  return Math.max(boxWidth / vbWidth, boxHeight / vbHeight);
}

/**
 * The horizontal room at height `y` on either side of `x` inside `rings` (even-odd), as the
 * smaller of the two distances to the nearest crossing. 0 when `x` is outside at that height.
 */
export function horizontalRoom(rings: readonly (readonly ShapePoint[])[], x: number, y: number) {
  let left = -Infinity;
  let right = Infinity;
  let crossingsLeft = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (!a || !b || a.y > y === b.y > y) continue;
      const cx = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (cx <= x) {
        crossingsLeft += 1;
        if (cx > left) left = cx;
      } else if (cx < right) {
        right = cx;
      }
    }
  }
  if (crossingsLeft % 2 === 0) return 0;
  return Math.min(x - left, right - x);
}

/** The ink box of a neighbour label centred on (x, y) at `fontSize` viewBox units. */
export function contextLabelRect(name: string, x: number, y: number, fontSize: number): Rect {
  const halfWidth = (labelWidthEm(name) * fontSize) / 2;
  const halfInk = INK_HALF_EM * fontSize;
  return { left: x - halfWidth, top: y - halfInk, right: x + halfWidth, bottom: y + halfInk };
}

/** A country that may carry a label: its outline and the point the label is centred on. */
export interface LabelTarget {
  readonly rings: readonly (readonly ShapePoint[])[];
  readonly x: number;
  readonly y: number;
}

export interface ContextLabelLayout {
  /** Font size in viewBox units. */
  readonly fontSize: number;
  /** Whether `name`, centred on the target's point, stays inside its outline. */
  readonly fits: (name: string, target: LabelTarget) => boolean;
}

/**
 * `scale` is CSS px per viewBox unit as rendered, zoom included; `null` before the box has been
 * measured (server render and first paint), which renders today's desktop labels unchanged.
 */
export function contextLabelLayout(scale: number | null): ContextLabelLayout {
  if (scale === null || !(scale > 0)) {
    return { fontSize: DEFAULT_FONT_UNITS, fits: () => true };
  }
  const fontSize = Math.round((CONTEXT_LABEL_PX / scale) * 100) / 100;
  const halfInk = INK_HALF_EM * fontSize;
  const margin = MARGIN_PX / scale;
  return {
    fontSize,
    fits: (name, { rings, x, y }) => {
      const need = (labelWidthEm(name) * fontSize) / 2 + margin;
      return [y - halfInk, y, y + halfInk].every(
        (level) => horizontalRoom(rings, x, level) >= need,
      );
    },
  };
}
