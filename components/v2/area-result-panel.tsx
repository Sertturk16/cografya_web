"use client";

import * as React from "react";
import { Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { MEASUREMENT_MIN_POINTS } from "@/lib/measurements/shape";
import { cn } from "@/lib/utils";
import { MapResultAction, MapResultPanel } from "@/components/v2/map-result-panel";

/**
 * The area tool's result on its map (T-121): the closed shape's area, its hectares, decares and
 * perimeter, with Undo and Clear beside them. The figures arrive formatted, from the same values
 * the result card below the map shows, so the two cannot disagree.
 *
 * A crossing outline has no area (T-094): the warning takes the hint line and the total reads
 * "—", never a figure beside a warning.
 */
export function AreaResultPanel({
  pointCount,
  isSelfIntersecting,
  area,
  hectares,
  decares,
  perimeter,
  onUndo,
  onClear,
  className,
  style,
  ref,
}: {
  pointCount: number;
  isSelfIntersecting: boolean;
  area: string;
  hectares: string;
  decares: string;
  perimeter: string;
  onUndo: () => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("ToolWorkbench");
  const missing = MEASUREMENT_MIN_POINTS.area - pointCount;
  const hint =
    pointCount === 0
      ? t("resultPanelEmptyArea")
      : missing > 0
        ? t("resultPanelFewPointsArea", { count: missing })
        : isSelfIntersecting
          ? t("resultPanelSelfIntersect")
          : undefined;

  return (
    <MapResultPanel
      ref={ref}
      label={t("resultPanelLabel")}
      hint={hint}
      hintTone={isSelfIntersecting && missing <= 0 ? "warning" : "muted"}
      status={
        hint ??
        `${t("areaTotal")}: ${area} km². ${t("hectares")}: ${hectares}. ${t("decares")}: ${decares}. ${t("perimeter")}: ${perimeter} km.`
      }
      className={className}
      style={style}
      summary={
        <p className="m-0 flex items-baseline gap-1 leading-7">
          <span
            className={cn(
              "font-heading font-mono text-lg font-extrabold",
              hint ? "text-muted-foreground" : "text-accent",
            )}
          >
            {hint ? "—" : area}
          </span>
          <span className="text-sm font-bold text-foreground">km²</span>
        </p>
      }
      // Sans with tabular figures, not mono: Türkiye's whole area in hectares and decares is one
      // pixel wider than a 320 px phone's panel in 11 px mono.
      details={
        <div className="text-[11px] leading-4 text-muted-foreground tabular-nums">
          <p className="m-0 whitespace-nowrap">{`${hectares} · ${decares}`}</p>
          <p className="m-0 whitespace-nowrap">{`${t("perimeter")} ${perimeter} km`}</p>
        </div>
      }
      actions={
        <>
          <MapResultAction
            icon={<Undo2 className="size-3.5" aria-hidden="true" />}
            label={t("undo")}
            onClick={onUndo}
            disabled={pointCount === 0}
          />
          <MapResultAction
            icon={<Trash2 className="size-3.5 text-destructive" aria-hidden="true" />}
            label={t("clear")}
            onClick={onClear}
            disabled={pointCount === 0}
          />
        </>
      }
    />
  );
}
