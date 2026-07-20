import type { getFormatter } from "next-intl/server";

/** The next-intl formatter instance (`await getFormatter()`). */
type Formatter = Awaited<ReturnType<typeof getFormatter>>;

/**
 * Localized short/long month name via the next-intl formatter — no hardcoded month
 * strings, so TR ("Ağustos") and EN ("August") both come from the locale data.
 * `month` is 1-based (1 = Ocak … 12 = Aralık, matching `ClimateMonthlyNormalDto.month`).
 * Day 15 (mid-month) avoids any timezone edge shifting the rendered month.
 *
 * Shared by the climograph `<desc>`/axis (components/climate/climate-chart.tsx) and the
 * climate JSON-LD `PropertyValue` nodes (the province page), so the two never diverge.
 */
export function monthName(format: Formatter, month: number, style: "short" | "long"): string {
  return format.dateTime(new Date(Date.UTC(2020, month - 1, 15)), { month: style });
}
