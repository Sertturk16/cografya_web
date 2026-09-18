import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricValueProps {
  readonly value: number | null | undefined;
  /** "°C", "m", "km²". Rendered smaller and dimmer than the number. */
  readonly unit?: string;
  /** Decimal places. Omit for an integer. */
  readonly precision?: number;
  /** BCP-47 tag. Turkish uses "," as the decimal separator and the site is bilingual. */
  readonly locale?: string;
  /**
   * What to render when there is no reading. REQUIRED — there is no default that is safe.
   *
   * T-024 shipped a page promising live hourly telemetry over data that was not there. The
   * fix was per-page copy conditioning, which works until the next page forgets. Making this
   * required moves the guarantee into the type: a caller cannot fail to decide what an
   * absent reading looks like.
   */
  readonly absent: { readonly label: string; readonly hint?: string };
  readonly className?: string;
}

/**
 * A measurement, or an honest statement that there is no measurement.
 *
 * WHAT IT NEVER RENDERS, and why each matters:
 *
 *   - `0` for an absent value. Zero is a reading. "No data" is not zero degrees.
 *   - A bare dash. A dash occupies the same slot a number would, in the same typographic
 *     rhythm, and reads as a measurement at a glance — which is the T-024 defect wearing a
 *     different costume.
 *
 * Instead the absent state renders words, in muted text, visibly not a number.
 *
 * Numbers format through `Intl.NumberFormat`, not string concatenation: `18.2` is "18,2" in
 * Turkish, and the site serves both locales.
 */
export function MetricValue({
  value,
  unit,
  precision,
  locale = "tr",
  absent,
  className,
}: MetricValueProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className={cn("inline-flex flex-col gap-0.5", className)}>
        <span className="text-sm font-medium text-muted-foreground">{absent.label}</span>
        {absent.hint !== undefined ? (
          <span className="text-xs text-muted-foreground/80">{absent.hint}</span>
        ) : null}
      </span>
    );
  }

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);

  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      {/*
        `tabular-nums` so a column of these lines up digit by digit.

        NO COLOUR CLASS, on purpose. The number INHERITS, which is what lets `StatTile`'s `tone`
        union reach it from the wrapper — a `text-foreground` here would win on the element
        itself and the five raw palette colours this migration replaced would have had nowhere
        to land. Standalone, the inherited colour is the page's `text-foreground` anyway.

        `sm:text-3xl` is the metric strips' own scale, which 13 files wrote by hand; matching it
        is what keeps the migration from shrinking every hero number by 6px at desktop.
      */}
      <span className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">{formatted}</span>
      {unit !== undefined ? (
        <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      ) : null}
    </span>
  );
}
