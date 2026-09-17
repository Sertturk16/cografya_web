import * as React from "react";
import { cn } from "@/lib/utils";
import { MetricValue, type MetricValueProps } from "./metric-value";

export interface StatTileProps extends Omit<MetricValueProps, "className"> {
  readonly label: string;
  /** A short qualifier under the number — a source, a period, a caveat. */
  readonly hint?: string;
  readonly icon?: React.ReactNode;
  readonly className?: string;
}

/**
 * Label, number, optional hint — the shape 48 V2 files were writing by hand as
 * `text-3xl font-bold` plus a caption.
 *
 * The label comes FIRST in the DOM and is read first, even though the number is the larger
 * element visually. A screen-reader user hearing "18,2 °C" with no idea what it measures is
 * told nothing; the visual hierarchy is carried by type size, not by source order.
 *
 * It composes `MetricValue` rather than formatting numbers itself, which is what makes the
 * required `absent` prop reach every stat on the site: a tile cannot render a value it does
 * not have without first saying what "no value" looks like.
 */
export function StatTile({ label, hint, icon, className, ...metric }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon !== undefined ? (
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <MetricValue {...metric} />
      {hint !== undefined ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
