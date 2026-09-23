import * as React from "react";
import {
  contextLabelLayout,
  contextLabelRect,
  rectsOverlap,
  rectWithin,
  type LabelTarget,
  type Rect,
} from "@/lib/map/context-label-fit";
import { MAP_COUNTRY_NAMES_TR } from "@/lib/map/map-country-names";
import { SEA_LINE_HEIGHT_EM, seaLabelLayout } from "@/lib/map/sea-label-layout";
import { parseSubpaths } from "@/lib/map/shape-geometry";

/**
 * The neighbour-country and sea names over the Türkiye-centred maps: `/turkiye`, `/deniz` and
 * `/deprem` (T-085). All three draw the same context geometry in viewBox units, so all three had
 * the same defect: at a phone's ~290px box every name rendered at 2–6px. The sizing and fit rules
 * live in `lib/map/context-label-fit.ts` (neighbours, T-082) and `lib/map/sea-label-layout.ts`
 * (seas, T-084); this renders them, so a map only supplies its scale and what covers it.
 */

/** A neighbour that may carry a label: its name, and the outline the name must fit inside. */
export interface ContextLabelCandidate {
  readonly iso: string;
  readonly name: string;
  readonly target: LabelTarget;
}

interface ContextShapeLike {
  readonly iso: string;
  readonly geoName: string;
  readonly d: string;
  readonly labelPoint: { readonly x: number; readonly y: number };
}

export function contextLabelCandidates(
  shapes: readonly ContextShapeLike[],
): ContextLabelCandidate[] {
  return shapes.map((shape) => ({
    iso: shape.iso,
    name: MAP_COUNTRY_NAMES_TR[shape.iso] ?? shape.geoName,
    target: { rings: parseSubpaths(shape.d), x: shape.labelPoint.x, y: shape.labelPoint.y },
  }));
}

/** No overlay: one module-level array, so a map without one keeps the label memos stable. */
const NO_AREAS: readonly Rect[] = [];

/** Clearance in CSS px kept between a map label and an overlay, or the box's edge. */
const OVERLAY_CLEARANCE_PX = 4;

export interface MapBoxMetrics {
  /** The box's content size in CSS px (border excluded), which is what the SVG fills. */
  readonly width: number;
  readonly height: number;
  /** Visible overlays over the map, in the box's own CSS px, padded by the clearance. */
  readonly overlays: readonly Rect[];
}

/**
 * Measures the map box and the overlay floating on it (a toolbar, a status chip) whenever either
 * changes size, so a hidden-below-`sm` overlay is picked up when it appears. `null` until the first
 * measurement, so the server render and first paint agree and draw the desktop labels.
 */
export function useMapBoxMetrics(
  boxRef: React.RefObject<HTMLElement | null>,
  overlayRef?: React.RefObject<HTMLElement | null>,
): MapBoxMetrics | null {
  const [metrics, setMetrics] = React.useState<MapBoxMetrics | null>(null);
  React.useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const overlay = overlayRef?.current ?? null;
    const measure = () => {
      const overlays: Rect[] =
        overlay && overlay.offsetWidth > 0
          ? [
              {
                left: overlay.offsetLeft - OVERLAY_CLEARANCE_PX,
                top: overlay.offsetTop - OVERLAY_CLEARANCE_PX,
                right: overlay.offsetLeft + overlay.offsetWidth + OVERLAY_CLEARANCE_PX,
                bottom: overlay.offsetTop + overlay.offsetHeight + OVERLAY_CLEARANCE_PX,
              },
            ]
          : [];
      const next = { width: box.clientWidth, height: box.clientHeight, overlays };
      if (!(next.width > 0 && next.height > 0)) return;
      // The observer fires once on `observe` and then only on a size change; an unchanged
      // measurement is not worth a render.
      setMetrics((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (overlay) observer.observe(overlay);
    return () => observer.disconnect();
  }, [boxRef, overlayRef]);
  return metrics;
}

interface MapContextLabelsProps {
  readonly candidates: readonly ContextLabelCandidate[];
  /** CSS px per viewBox unit as rendered, zoom included; `null` before the box is measured. */
  readonly scale: number | null;
  /** ViewBox areas an overlay covers: no label is drawn under one. */
  readonly blocked?: readonly Rect[];
  /** The viewBox area the box shows at rest: no label is drawn across its edge. */
  readonly frame?: Rect | null;
  /** Paint the neighbour names before the sea names (`/deprem`'s order) instead of after. */
  readonly neighboursFirst?: boolean;
}

export function MapContextLabels({
  candidates,
  scale,
  blocked = NO_AREAS,
  frame = null,
  neighboursFirst = false,
}: MapContextLabelsProps) {
  /**
   * The frame less the clearance, so no sea name is drawn touching the box's edge; a sea has
   * another placement to go to. A neighbour name has one spot, so it only has to stay inside the
   * frame: with the inset, "Yunanistan" (2px from the left edge at 1440) would be dropped.
   */
  const inner = React.useMemo(() => {
    if (!frame || scale === null) return frame;
    const inset = OVERLAY_CLEARANCE_PX / scale;
    return {
      left: frame.left + inset,
      top: frame.top + inset,
      right: frame.right - inset,
      bottom: frame.bottom - inset,
    };
  }, [frame, scale]);

  const neighbours = React.useMemo(() => {
    const layout = contextLabelLayout(scale);
    return {
      fontSize: layout.fontSize,
      items: candidates.filter(({ name, target }) => {
        if (!layout.fits(name, target)) return false;
        const rect = contextLabelRect(name, target.x, target.y, layout.fontSize);
        if (frame && !rectWithin(rect, frame)) return false;
        return !blocked.some((area) => rectsOverlap(rect, area));
      }),
    };
  }, [candidates, scale, blocked, frame]);

  const seas = React.useMemo(
    () =>
      seaLabelLayout(
        scale,
        (rect) =>
          (inner !== null && !rectWithin(rect, inner)) ||
          blocked.some((area) => rectsOverlap(rect, area)),
      ),
    [scale, blocked, inner],
  );

  const seaGroup = (
    /* FULL STRENGTH, no `opacity-*`: an opacity utility is part of the rendered colour and has to
       be measured with `blendOver`. The `opacity-80` these labels once shipped with put
       `fill-accent` at 3.35:1 light / 3.85:1 dark on `--map-sea`, under TEXT_MIN; at full strength
       it is 4.85/5.19. `tracking-wider` sits on each text, not the group, so its 0.05em resolves
       against the label's own size. */
    <g key="seas" className="fill-accent font-heading font-bold pointer-events-none select-none">
      {seas.map((sea) => (
        <text
          key={sea.name}
          x={sea.x}
          y={sea.y}
          textAnchor="middle"
          fontSize={sea.fontSize}
          transform={sea.rotate ? `rotate(${sea.rotate} ${sea.x} ${sea.y})` : undefined}
          className="tracking-wider"
        >
          {sea.lines.map((line, i) => (
            <tspan key={line} x={sea.x} dy={i === 0 ? undefined : `${SEA_LINE_HEIGHT_EM}em`}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </g>
  );

  const neighbourGroup = (
    /* FULL STRENGTH for the same reason: `opacity-80` put `--map-label` at 3.75:1 light / 4.08:1
       dark on `--map-context-land`, under TEXT_MIN, against the 5.75/5.54 the token records in
       `app/globals.css`. `fontSize` is in viewBox units and already divides out any zoom. */
    <g
      key="neighbours"
      fontSize={neighbours.fontSize}
      className="fill-[var(--map-label)] font-sans font-bold pointer-events-none select-none"
    >
      {neighbours.items.map(({ iso, name, target }) => (
        <text
          key={iso}
          x={target.x}
          y={target.y}
          textAnchor="middle"
          dominantBaseline="central"
          className="tracking-tight select-none"
        >
          {name}
        </text>
      ))}
    </g>
  );

  return neighboursFirst ? [neighbourGroup, seaGroup] : [seaGroup, neighbourGroup];
}
