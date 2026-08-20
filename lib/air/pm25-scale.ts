/**
 * Pure geometry for the province PM2.5 chart (HAVA-KIRLILIGI).
 *
 * NO React, NO i18n, NO DTO imports — raw years and numbers in, pixel coordinates out, so
 * the whole scaling layer is unit-testable in isolation. The server component
 * (`components/air/pm25-chart.tsx`) feeds the payload's numbers in and renders the returned
 * coordinates as inline SVG; number FORMATTING (locale digits, the unit) stays the
 * component's job via `next-intl`. The component performs no arithmetic of its own.
 *
 * This is deliberately NOT the climate chart's `lib/climate/scale.ts`, and neither is
 * refactored into a shared "scales" module (plan §1.2, `CONVENTIONS.md` §1 YAGNI). The two
 * charts share no axis: that one carries two independent axes, negative temperatures and
 * bar geometry; this one carries a single non-negative concentration series. An abstraction
 * over them would buy nothing today and would make the climate module the owner of this
 * chart's geometry.
 */

/** One year of the published series — structurally a subset of `Pm25AnnualValueDto`, so the
 *  contract's `years` array is assignable directly without a mapping step. */
export interface Pm25SeriesPoint {
  year: number;
  valueUgM3: number;
}

/** One rendered year: its data, its pixel position, and the two presentation decisions
 *  (does it carry a dot, does it carry an axis label) that the component must not re-derive. */
export interface Pm25Point {
  year: number;
  value: number;
  x: number;
  y: number;
  /** Point marker drawn — first, last, lowest and highest years only (27 dots is noise). */
  marker: boolean;
  /** Year printed under the axis — see `LABEL_END_GAP`. */
  labelled: boolean;
}

/** One y-axis tick projected to a pixel Y. */
export interface Pm25Tick {
  value: number;
  y: number;
}

/** A named year/value pair from the series (first, last, lowest, highest). */
export interface Pm25Extreme {
  year: number;
  value: number;
}

/** The finished y-axis domain: always anchored at zero, with a rounded ceiling. */
export interface Pm25Domain {
  min: number;
  max: number;
  step: number;
}

/** The full, render-ready geometry for one province's chart. */
export interface Pm25ChartGeometry {
  width: number;
  height: number;
  /** Plot rectangle inside the axis gutters: x0/x1 left/right, y0 top, y1 bottom. */
  plot: { x0: number; y0: number; x1: number; y1: number };
  domain: Pm25Domain;
  ticks: Pm25Tick[];
  points: Pm25Point[];
  /** `<polyline points>` — one unbroken run across every year the payload carries. */
  line: string;
  first: Pm25Extreme;
  last: Pm25Extreme;
  lowest: Pm25Extreme;
  highest: Pm25Extreme;
}

/** Chart canvas — a fixed `viewBox`, so a CSS `aspect-ratio` frame reserves the space
 *  before the SVG paints (zero CLS, `ENGINEERING.md` §4 #9). */
export const PM25_CHART_WIDTH = 720;
export const PM25_CHART_HEIGHT = 300;

/** Axis gutters. `left` holds two tick digits, `top` holds the unit caption above the
 *  highest tick number, `bottom` holds the year labels. */
const MARGIN = { top: 26, right: 16, bottom: 34, left: 44 } as const;

/** Baseline offset of the unit caption above the plot's top edge (see `MARGIN.top`). */
export const PM25_AXIS_UNIT_DY = 10;

/**
 * ⚠ THE ONE AXIS DECISION IN THIS FILE, and the only line a ruling would move.
 *
 * The y axis is anchored at ZERO for every province, per plan §4.2 — on a CONCENTRATION
 * chart a clipped baseline makes a small change look like a large one, and the reader who
 * compares two province pages is comparing shapes. This is also the premise the owner was
 * given, in writing, when ruling O-2 ("her iki durumda da çizgi sıfırdan başlar … bu
 * tartışmaya açık değil", → DEC 2026-08-20c md.2).
 *
 * It is stated as a constant rather than an inlined `0` because there is a live,
 * surfaced question about it: DEC 2026-08-20d md.3 says the within-province trend "uses
 * the whole chart height", and under a zero floor it measurably does not (median 32% of
 * the height across the 81 provinces; 21% for Samsun, 15,1-19,3 µg/m³). The conflict is on
 * the record for Atlas; until it is ruled, the written plan governs.
 */
const AXIS_FLOOR = 0;

/**
 * Candidate y-axis tick steps, ascending. The chosen step is the smallest one that puts the
 * ceiling within `TARGET_INTERVALS` of zero — so the axis carries four to six labelled
 * gridlines whatever the province's range is, instead of three on a clean province and
 * twelve on a dirty one.
 */
const AXIS_STEPS = [1, 2, 5, 10, 20, 50, 100] as const;
const TARGET_INTERVALS = 5;

/**
 * A year gets an axis label if it is the first, the last, or a multiple of
 * `LABEL_YEAR_MULTIPLE` far enough from both ends not to crowd them.
 *
 * The gap is expressed in YEARS OF THE SERIES, never as a hardcoded year list: the contract
 * guarantees "at least one entry", not 27 (plan §16 V-2), so the labels are derived from
 * whatever arrived. On today's 1998-2024 series the rule yields exactly 1998 · 2005 · 2010 ·
 * 2015 · 2020 · 2024 — 2000 is suppressed because it sits two slots from the start and would
 * collide with the 1998 label at a 320 px viewport.
 */
const LABEL_YEAR_MULTIPLE = 5;
const LABEL_END_GAP = 3;

/** Round to `decimals` places, killing binary-float dust in emitted SVG coordinates. */
export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * The y-axis domain for one province: zero to a rounded ceiling at or above the series
 * maximum. Per-province by ruling (→ DEC 2026-08-20c md.2) — the printed tick numbers are
 * what make two province charts comparable, not their shapes.
 *
 * A non-positive maximum (every value zero, or a contract violation) still yields a
 * one-step domain rather than a zero-width one, so no caller can divide by zero.
 */
export function pm25AxisDomain(maxValue: number): Pm25Domain {
  const step = AXIS_STEPS.find((s) => maxValue <= s * TARGET_INTERVALS) ?? AXIS_STEPS.at(-1) ?? 1;
  const ceiling = Math.ceil(maxValue / step) * step;
  return { min: AXIS_FLOOR, max: ceiling > AXIS_FLOOR ? ceiling : AXIS_FLOOR + step, step };
}

/**
 * Project one province's annual series into render-ready chart geometry.
 *
 * Returns `null` for an empty series. The contract types `years` as "at least one entry",
 * so this is not an expected state — but it is a REACHABLE one under a contract violation,
 * and returning null lets the section drop only the chart while the value line, the table
 * and the licence block (which do not depend on it) still publish.
 */
export function buildPm25ChartGeometry(
  years: readonly Pm25SeriesPoint[],
): Pm25ChartGeometry | null {
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined) return null;

  const x0 = MARGIN.left;
  const x1 = PM25_CHART_WIDTH - MARGIN.right;
  const y0 = MARGIN.top;
  const y1 = PM25_CHART_HEIGHT - MARGIN.bottom;
  const plotW = x1 - x0;

  // Extremes come from ONE pass over the real data and are handed to the component for the
  // SVG <desc>, so the sentence a screen reader hears and the dots the chart draws can
  // never describe different years.
  let lowest: Pm25SeriesPoint = first;
  let highest: Pm25SeriesPoint = first;
  let maxValue = first.valueUgM3;
  for (const point of years) {
    if (point.valueUgM3 < lowest.valueUgM3) lowest = point;
    if (point.valueUgM3 > highest.valueUgM3) highest = point;
    if (point.valueUgM3 > maxValue) maxValue = point.valueUgM3;
  }

  const domain = pm25AxisDomain(maxValue);
  const span = domain.max - domain.min;
  const yFor = (value: number) => roundTo(y1 - ((value - domain.min) / span) * (y1 - y0));

  const count = years.length;
  const lastIndex = count - 1;
  const points: Pm25Point[] = years.map((point, index) => ({
    year: point.year,
    value: point.valueUgM3,
    // A single-year series has no interval to spread across, so it sits in the middle of
    // the plot rather than on its left edge.
    x: roundTo(count === 1 ? (x0 + x1) / 2 : x0 + (index * plotW) / lastIndex),
    y: yFor(point.valueUgM3),
    marker:
      index === 0 ||
      index === lastIndex ||
      point.year === lowest.year ||
      point.year === highest.year,
    labelled:
      index === 0 ||
      index === lastIndex ||
      (point.year % LABEL_YEAR_MULTIPLE === 0 &&
        index >= LABEL_END_GAP &&
        index <= lastIndex - LABEL_END_GAP),
  }));

  const ticks: Pm25Tick[] = [];
  for (let value = domain.min; value <= domain.max + domain.step / 2; value += domain.step) {
    const rounded = roundTo(value, 6);
    ticks.push({ value: rounded, y: yFor(rounded) });
  }

  return {
    width: PM25_CHART_WIDTH,
    height: PM25_CHART_HEIGHT,
    plot: { x0, y0, x1, y1 },
    domain,
    ticks,
    points,
    line: points.map((point) => `${point.x},${point.y}`).join(" "),
    first: { year: first.year, value: first.valueUgM3 },
    last: { year: last.year, value: last.valueUgM3 },
    lowest: { year: lowest.year, value: lowest.valueUgM3 },
    highest: { year: highest.year, value: highest.valueUgM3 },
  };
}
