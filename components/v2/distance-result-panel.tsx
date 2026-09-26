"use client";

import * as React from "react";
import { Car, Plane, Trash2, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { distanceTravelEstimates } from "@/lib/map/measure";
import { formatNumber } from "@/lib/text/format-number";
import { MapResultAction, MapResultPanel } from "@/components/v2/map-result-panel";

/**
 * The distance tool's result on its map (T-120): the straight-line total, flight time and road
 * estimate, from the same calculation and message keys as the result card below the map, with
 * Undo and Clear beside them.
 */
export function DistanceResultPanel({
  pointCount,
  distanceKm,
  onUndo,
  onClear,
  className,
  style,
  ref,
}: {
  pointCount: number;
  distanceKm: number;
  onUndo: () => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("ToolWorkbench");
  const locale = useLocale() as Locale;
  const { flightMinutes, roadKm } = distanceTravelEstimates(distanceKm);
  // No "0 km" for one point: a route with one point has no length yet.
  const hint =
    pointCount === 0
      ? t("resultPanelEmptyDistance")
      : pointCount === 1
        ? t("resultPanelOnePointDistance")
        : undefined;

  return (
    <MapResultPanel
      ref={ref}
      label={t("resultPanelLabel")}
      hint={hint}
      className={className}
      style={style}
      summary={
        <p className="m-0 flex items-baseline gap-1 leading-7">
          <span className="sr-only">{t("distanceTotal")}: </span>
          <span className="font-heading font-mono text-lg font-extrabold text-primary">
            {formatNumber(distanceKm, locale, 1)}
          </span>
          <span className="text-sm font-bold text-foreground">km</span>
        </p>
      }
      details={
        <p className="m-0 flex flex-wrap gap-x-3 font-mono text-[11px] leading-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Plane className="size-3 text-primary" aria-hidden="true" />
            <span className="sr-only">{t("flightTime")}: </span>
            {t("flightMinutes", { minutes: String(flightMinutes) })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Car className="size-3 text-secondary" aria-hidden="true" />
            <span className="sr-only">{t("roadEstimate")}: </span>
            {`~${formatNumber(roadKm, locale, 0)} km`}
          </span>
        </p>
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
