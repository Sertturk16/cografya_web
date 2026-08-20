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

/** The finished y-axis domain — the province's own range, rounded outwards to whole steps. */
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
 * ⚠ THE ONE AXIS DECISION IN THIS FILE, and the only rule a ruling would move.
 *
 * The y axis spans THE PROVINCE'S OWN RANGE: floor and ceiling are the series minimum and
 * maximum rounded outwards to whole tick steps. **It does not start at zero.**
 *
 * That is DEC 2026-08-20c md.2 — "her ilde kendi ölçeğinde", bought explicitly for
 * IN-PROVINCE TREND READABILITY — as applied by Atlas on 2026-08-20. A per-province ceiling
 * over a zero floor is also "its own scale" on the face of the wording, and this file
 * shipped that reading first; the measurement is what settles it. Under a zero floor the
 * trend occupies a median 32% of the chart height across the 81 provinces and 21% in the
 * narrowest (Samsun, 15,1-19,3 µg/m³), with 34 of the 81 below the 29% that DEC 2026-08-20d
 * named as the unacceptable cost — i.e. the zero floor keeps the exact harm the removal of
 * the WHO reference line was for. Under the province's own range the same figures are a
 * median 77% and a worst case of 54%.
 *
 * A truncated axis exaggerates variation, and that real cost is paid down in two places
 * that are part of this decision rather than decoration:
 *
 * 1. **The floor is PRINTED**, as a tick label like every other tick, so the chart cannot
 *    read as if it started at zero (`pm25-chart.tsx` draws one `<text>` per `ticks` entry,
 *    and the first entry is the floor).
 * 2. **The magnitude is carried in words and figures**, not inferred from the picture: the
 *    always-visible value line, the `<desc>` sentence that names the min and the max with
 *    their years, and the full 27-row table one click away (→ DEC 2026-08-20c md.3).
 *
 * Reversal cost, if the owner overturns this at the frame gate: `floor` below becomes `0`,
 * the step reverts to being chosen on `maxValue`, and the four domain tests move with them.
 */

/**
 * Candidate y-axis tick steps, ascending. The chosen step is the smallest one that fits the
 * province's SPAN within `TARGET_INTERVALS` — so the axis carries three to six intervals
 * whatever the province's range is, instead of three on a flat province and twelve on a
 * volatile one.
 *
 * The step is chosen on the SPAN and not on the maximum, and with a floor off zero it has
 * to be: a step sized for the maximum would put the narrowest province on a two-tick axis
 * (Samsun's 15,13-19,33 would round to a single 15-20 interval).
 *
 * Measured against the 81 published series (`data/acag-pm25/acag-province-pm25.json`, read
 * from api `origin/dev` @ `7a6f285`): steps 1/2/5/10 on 3/41/36/1 provinces, giving 3/4/5/6
 * intervals on 21/22/27/11 of them — four to seven printed ticks each. No province lands on
 * a one- or two-tick axis.
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
 * The y-axis domain for one province: the series minimum rounded DOWN and the series
 * maximum rounded UP to whole tick steps (→ the axis decision above). Both ends are
 * per-province, so two provinces' chart SHAPES are not comparable — the printed tick
 * numbers are what carry the comparison, which is why every tick is labelled.
 *
 * The floor is never negative for a legal payload: a concentration is non-negative, and
 * `Math.floor(x / step) * step` of a non-negative `x` is non-negative. A province whose
 * minimum is below one step floors at zero and honestly shows a zero baseline.
 *
 * A flat series (minimum === maximum, both landing on a step boundary) still yields a
 * one-step domain rather than a zero-width one, so no caller can divide by zero.
 */
export function pm25AxisDomain(minValue: number, maxValue: number): Pm25Domain {
  const span = maxValue - minValue;
  const step = AXIS_STEPS.find((s) => span <= s * TARGET_INTERVALS) ?? AXIS_STEPS.at(-1) ?? 1;
  const floor = Math.floor(minValue / step) * step;
  const ceiling = Math.ceil(maxValue / step) * step;
  return { min: floor, max: ceiling > floor ? ceiling : floor + step, step };
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
  for (const point of years) {
    if (point.valueUgM3 < lowest.valueUgM3) lowest = point;
    if (point.valueUgM3 > highest.valueUgM3) highest = point;
  }

  // BOTH ends of the domain now come from the data, so the same single pass feeds the axis
  // and the <desc>: the sentence a screen reader hears names the very values the axis was
  // built from.
  const domain = pm25AxisDomain(lowest.valueUgM3, highest.valueUgM3);
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
