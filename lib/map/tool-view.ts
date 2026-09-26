import { TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { TR_CONTEXT_TALL_VIEWBOX } from "@/lib/map/tr-context-tall.generated";
import { clampPan, fitViewToAspect, parseViewBox, type ViewBox } from "@/lib/map/zoom-pan";

/**
 * The tool map's 1× frame, sized to its box (T-124).
 *
 * The tool pages used to draw the wide context frame (`TR_CONTEXT_VIEWBOX`, 1270 × 580) into every
 * box. On a portrait phone that is a 140 px-tall strip. A taller box needs geography above and below
 * Türkiye, which the tall context artifact (`tr-context-tall.generated.ts`, T-079) already has, and
 * it needs Türkiye to draw LARGER, which `/turkiye`'s `slice` over the full-width tall frame does
 * not give: that keeps the horizontal scale and only adds sea.
 *
 * So the frame is `TOOL_CORE_VIEW` expanded to the box's aspect (`fitViewToAspect`, "contain"):
 * the core is the wide frame's height and Türkiye's width plus a margin, centred where the wide
 * frame is. In the desktop box that expansion lands exactly on the wide frame, so the page view
 * there is unchanged. In a narrower box the sides are cropped to the core and the frame grows
 * north and south. It never reaches past the tall frame, where there is no geography to draw; past
 * that the svg's default `meet` fit letterboxes, as it always did.
 */
const TALL_FRAME = parseViewBox(TR_CONTEXT_TALL_VIEWBOX);
const WIDE_FRAME = parseViewBox(TR_CONTEXT_VIEWBOX);

/** Türkiye (`MAP_VIEWBOX`, x 0–1000) plus 25 units a side at the least, centred on the wide
 *  frame's centre (x 485, y 230), with the wide frame's height. */
export const TOOL_CORE_VIEW: ViewBox = { x: -55, y: -60, w: 1080, h: 580 };

export function toolBaseView(aspect: number): ViewBox {
  // Before the box is measured (server render, first paint) the desktop frame is the answer.
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : WIDE_FRAME.w / WIDE_FRAME.h;
  const fitted = fitViewToAspect(TOOL_CORE_VIEW, safeAspect, "contain");
  const w = Math.min(fitted.w, TALL_FRAME.w);
  const h = Math.min(fitted.h, TALL_FRAME.h);
  return {
    x: TOOL_CORE_VIEW.x + TOOL_CORE_VIEW.w / 2 - w / 2,
    y: TOOL_CORE_VIEW.y + TOOL_CORE_VIEW.h / 2 - h / 2,
    w,
    h,
  };
}

/** CSS px the map's own controls cover along each edge of the box. */
export interface BoxInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The view that frames `points` inside the part of the box the controls leave free (T-124).
 *
 * The tool's presets, dropdown picks and restored measurements move the map to their points. The
 * first version fitted them to the whole box, so on a phone the end labels of "Karadeniz Kıyısı",
 * "Edirne-Iğdır" and "Marmara" landed under the zoom and fullscreen buttons and the scale bar. Here
 * the points fit the box minus `insets`, and the view is shifted so their centre sits in the middle
 * of that free area rather than of the box.
 *
 * `pad` is headroom around the points' span for their labels. A single point (or a tight cluster)
 * has no span, so each span is floored at `minSpan` of the base view. The result is clamped to
 * `[1, maxZoom]` and panned back inside `base`, the same bounds manual pan keeps.
 */
export function fitPointsView(
  points: readonly { x: number; y: number }[],
  base: ViewBox,
  box: { w: number; h: number },
  insets: BoxInsets,
  {
    pad = 1.7,
    minSpan = 0.06,
    maxZoom = 8,
  }: { pad?: number; minSpan?: number; maxZoom?: number } = {},
): ViewBox {
  if (points.length === 0 || box.w <= 0 || box.h <= 0) return { ...base };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, base.w * minSpan) * pad;
  const spanY = Math.max(maxY - minY, base.h * minSpan) * pad;

  // px per map unit at 1×, as the svg's default `meet` fit draws `base` into the box.
  const scaleAt1 = Math.min(box.w / base.w, box.h / base.h);
  const freeW = Math.max(box.w - insets.left - insets.right, 1);
  const freeH = Math.max(box.h - insets.top - insets.bottom, 1);
  const zoom = Math.min(
    maxZoom,
    Math.max(1, Math.min(freeW / (spanX * scaleAt1), freeH / (spanY * scaleAt1))),
  );

  const scale = scaleAt1 * zoom;
  const w = base.w / zoom;
  const h = base.h / zoom;
  // Centre the points on the free area: move the view by the insets' imbalance, in map units.
  const cx = (minX + maxX) / 2 - (insets.left - insets.right) / 2 / scale;
  const cy = (minY + maxY) / 2 - (insets.top - insets.bottom) / 2 / scale;
  return clampPan({ x: cx - w / 2, y: cy - h / 2, w, h }, base);
}
