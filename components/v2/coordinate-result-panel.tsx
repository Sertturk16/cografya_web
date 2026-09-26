"use client";

import * as React from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MapResultAction, MapResultPanel } from "@/components/v2/map-result-panel";

/** The coordinate tool's point, formatted by the workbench as its result card shows it. */
export interface CoordinateReading {
  latDecimal: string;
  lonDecimal: string;
  latDms: string;
  lonDms: string;
  province: string | null;
}

/**
 * Sizing copy for the details row before there is a point: the row stays mounted, invisible, so
 * the panel is as tall empty as with a point (the T-126 rule). Never visible or announced.
 */
const SIZING_READING: CoordinateReading = {
  latDecimal: "39,925533° K",
  lonDecimal: "32,866287° D",
  latDms: `39° 55' 31,9" K`,
  lonDms: `32° 51' 58,6" D`,
  province: null,
};

/**
 * The coordinate tool's result on its map (T-121): the province the point falls in as the
 * headline, latitude and longitude in two columns (decimal over degrees-minutes-seconds), Copy and
 * Clear. At 320 px the decimal pair does not fit beside the buttons on one line, which is why the
 * province, not the coordinate, is the summary. No Undo: with one point it would be Clear.
 */
export function CoordinateResultPanel({
  reading,
  copied,
  onCopy,
  onClear,
  className,
  style,
  ref,
}: {
  reading: CoordinateReading | null;
  copied: boolean;
  onCopy: () => void;
  onClear: () => void;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("ToolWorkbench");
  const hint = reading ? undefined : t("resultPanelEmptyCoordinates");
  const shown = reading ?? SIZING_READING;
  const place = shown.province ?? t("resultPanelOutside");

  return (
    <MapResultPanel
      ref={ref}
      label={t("resultPanelLabel")}
      hint={hint}
      status={
        hint ??
        `${t("decimalDegreesLabel")}: ${shown.latDecimal}, ${shown.lonDecimal}. ${t("dmsLabel")}: ${shown.latDms}, ${shown.lonDms}. ${t("provinceHitLabel")} ${place}.`
      }
      className={className}
      style={style}
      summary={
        <p
          className={cn(
            "m-0 whitespace-nowrap font-heading text-sm font-bold leading-7",
            hint ? "text-muted-foreground" : "text-secondary",
          )}
        >
          {hint ? "—" : place}
        </p>
      }
      details={
        <div className="grid grid-cols-2 gap-x-3 font-mono leading-4">
          {(
            [
              ["lat", shown.latDecimal, shown.latDms],
              ["lon", shown.lonDecimal, shown.lonDms],
            ] as const
          ).map(([axis, decimal, dms]) => (
            <div key={axis} className="min-w-0">
              <p className="m-0 whitespace-nowrap text-xs font-bold text-foreground">{decimal}</p>
              <p className="m-0 whitespace-nowrap text-[11px] text-muted-foreground">{dms}</p>
            </div>
          ))}
        </div>
      }
      actions={
        <>
          <MapResultAction
            icon={
              copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )
            }
            label={copied ? t("copied") : t("resultPanelCopy")}
            onClick={onCopy}
            disabled={!reading}
          />
          <MapResultAction
            icon={<Trash2 className="size-3.5 text-destructive" aria-hidden="true" />}
            label={t("clear")}
            onClick={onClear}
            disabled={!reading}
          />
        </>
      }
    />
  );
}
