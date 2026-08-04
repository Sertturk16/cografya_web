/**
 * Pure geometry for the province climate chart (İklim grafiği — W1).
 *
 * NO React, NO i18n, NO DTO imports — just numbers in, pixel coordinates out, so the
 * whole scaling layer is unit-testable in isolation (the same discipline as the api's
 * `climate-derivations.ts`). The server component (`components/climate/climate-chart.tsx`)
 * feeds the raw ERA5-Land numbers in and renders the returned coordinates as inline SVG; number
 * FORMATTING (locale digits, units) stays the component's job via `next-intl`.
 *
 * The load-bearing invariant (owner ruling 6 — the Y axis auto-scales PER province, so
 * the chart's *shape* is no longer comparable between provinces): `niceDomain()` ALWAYS
 * includes 0. Erzurum's mean of −9 °C in January must sit below a real, printed 0 °C
 * gridline, not float above a clipped baseline — otherwise a negative winter reads as a
 * mild one. Every axis tick carries a real number the reader can compare across provinces.
 */

/** A finished, human-friendly axis domain: rounded bounds + evenly-spaced tick values. */
export interface Domain {
  /** Lower bound (≤ 0 for any temperature series; always 0 for precipitation). */
  min: number;
  /** Upper bound. */
  max: number;
  /** Evenly-spaced "nice" tick values, ascending, spanning [min, max] inclusive. */
  ticks: number[];
}

/** One axis tick projected to a pixel Y. */
export interface Tick {
  value: number;
  y: number;
}

/** One month column: the precipitation bar + the mean-temp marker. Both always exist —
 *  the two source fields are required by the contract (api #87). */
export interface ChartColumn {
  month: number;
  /** Column center X (used for the month label and the temp marker). */
  cx: number;
  /** Precipitation `<rect>` box. */
  bar: { x: number; y: number; w: number; h: number };
  /** Mean-temp point. */
  meanPoint: { x: number; y: number };
}

/** The full, render-ready geometry for one province's chart. */
export interface ClimateChartGeometry {
  width: number;
  height: number;
  /** Plot rectangle (inside the axis gutters): x0/x1 left/right, y0 top, y1 bottom. */
  plot: { x0: number; y0: number; x1: number; y1: number };
  columns: ChartColumn[];
  /**
   * Mean-temp polyline points ("x,y x,y …") — ONE run across all 12 months.
   *
   * It used to be an array of contiguous non-null runs so a data gap could break the
   * line. `tempMeanC` is now a REQUIRED field (api #87), so a gap cannot occur and the
   * run-splitting was unreachable code.
   */
  meanLine: string;
  /** Temperature (left) axis ticks. */
  tempTicks: Tick[];
  /** Precipitation (right) axis ticks. */
  precipTicks: Tick[];
  tempDomain: Domain;
  precipDomain: Domain;
  /** Pixel Y of the 0 °C reference line (always within the temp domain → never null,
   *  but typed nullable so a future non-zero-including domain can opt out). */
  tempZeroY: number | null;
}

/** A minimal month row — structurally a subset of the api's `ClimateMonthlyNormalDto`,
 *  so the DTO's `months` array is assignable directly. The core pair is REQUIRED there
 *  (ERA5-Land, api #87), so neither field is nullable here either. */
export interface MonthPoint {
  month: number;
  tempMeanC: number;
  precipitationMm: number;
}

/** Chart canvas — fixed `viewBox` (owner spec): zero CLS via a constant aspect ratio. */
export const CHART_WIDTH = 720;
export const CHART_HEIGHT = 340;
/** Top margin carries the axis UNIT captions ("°C" / "mm") above the highest tick
 *  number. It must stay tall enough that the caption's glyph box clears the top tick's
 *  glyph box at every viewport — at 390px the viewBox scales ~0.49×, so a 5-unit
 *  nominal gap is the smallest that still reads (PR #18 review I3: at top=16 the
 *  captions overprinted the top ticks on mobile). */
const MARGIN = { top: 28, right: 46, bottom: 44, left: 42 } as const;
/** Baseline offset of the unit caption above the plot's top edge (see MARGIN.top). */
export const AXIS_UNIT_DY = 12;
/** Fraction of a month slot the precipitation bar occupies (centered, leaving gaps). */
const BAR_WIDTH_RATIO = 0.5;

/** Round to `decimals` places, killing binary-float dust (e.g. 0.30000000000000004 → 0.3). */
export function roundTo(value: number, decimals = 6): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * The classic "nice number" for an axis: the 1/2/5 × 10ⁿ closest to `range`.
 * `round=true` snaps to the nearest nice number (for a step size); `round=false`
 * rounds up (for an overall span).
 */
export function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * 10 ** exponent;
}

/**
 * Build a rounded axis domain over [dataMin, dataMax] that **always includes 0** and
 * carries evenly-spaced nice ticks. Zero is a multiple of the nice step, so it is always
 * one of the returned ticks — the load-bearing guarantee for a legible negative winter.
 *
 * @param targetTicks approximate number of tick intervals (real count may differ by ±1).
 */
export function niceDomain(dataMin: number, dataMax: number, targetTicks = 5): Domain {
  // Force 0 into the data span first (before nicing), so a bar/line baseline is real.
  const lo = Math.min(dataMin, 0);
  let hi = Math.max(dataMax, 0);
  if (lo === hi) hi = lo + 1; // fully-flat series → a unit span so the axis isn't degenerate

  const span = niceNum(hi - lo, false);
  const step = niceNum(span / Math.max(1, targetTicks - 1), true);
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  // +step/2 guards the loop's final tick against float drift at the top bound.
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(roundTo(v));
  }
  return { min: roundTo(niceMin), max: roundTo(niceMax), ticks };
}

/** A linear scale value→pixel over a domain projected onto [rangeStart, rangeEnd]. */
export function scaleLinear(
  domain: { min: number; max: number },
  rangeStart: number,
  rangeEnd: number,
): (value: number) => number {
  const { min, max } = domain;
  const span = max - min || 1; // guard a zero-width domain
  return (value: number) => roundTo(rangeStart + ((value - min) / span) * (rangeEnd - rangeStart));
}

/**
 * Project one province's monthly normals into render-ready chart geometry.
 *
 * Temperature uses a left axis whose domain spans the mean series and always includes 0.
 * (It used to span the mean-min→mean-max envelope so the light band fit inside it; ERA5-Land
 * publishes no such envelope, so the domain now follows the mean series alone — which makes
 * the curve fill more of the plot than it did in the MGM era.) Precipitation uses an
 * independent right axis anchored at 0 (bars grow from the baseline). Both auto-scale per
 * province, which is exactly why the returned ticks carry real numbers.
 */
export function buildClimateChartGeometry(months: MonthPoint[]): ClimateChartGeometry {
  const x0 = MARGIN.left;
  const x1 = CHART_WIDTH - MARGIN.right;
  const y0 = MARGIN.top;
  const y1 = CHART_HEIGHT - MARGIN.bottom;
  const plotW = x1 - x0;
  const slot = plotW / 12;
  const barW = roundTo(slot * BAR_WIDTH_RATIO);

  // Temperature domain: the mean series' own extent (always widened to include 0).
  const tempValues = months.map((m) => m.tempMeanC);
  const precipValues = months.map((m) => m.precipitationMm);

  const tempDomain = niceDomain(
    tempValues.length ? Math.min(...tempValues) : 0,
    tempValues.length ? Math.max(...tempValues) : 0,
  );
  const precipDomain = niceDomain(0, precipValues.length ? Math.max(...precipValues) : 0);

  const yTemp = scaleLinear(tempDomain, y1, y0);
  const yPrecip = scaleLinear(precipDomain, y1, y0);

  const columns: ChartColumn[] = months.map((m, i) => {
    const cx = roundTo(x0 + (i + 0.5) * slot);
    // A bar always exists now — `precipitationMm` is a required field, so the old
    // "no value ⇒ no bar" branch is gone. The bar's TOP is clamped to the baseline: a
    // NEGATIVE monthly total is physically impossible and would be a contract violation,
    // and letting it through would emit a negative `<rect height>` (invalid SVG,
    // renderer-defined behaviour) hanging below the plot. Clamping the top — rather than
    // just flooring the height — is what keeps the bar's foot ON the baseline instead of
    // parked outside the plot rectangle. The offending number is not hidden: it prints
    // unchanged in the always-visible table, which is the authoritative surface for the
    // values and the honest place for a bad one to show up.
    //
    // Scope, precisely: this handles every FINITE value. A non-finite one (NaN/Infinity —
    // an api serialization bug, not a null) still propagates into the coordinates. That is
    // deliberate rather than guarded: the api gates non-finite numbers at its own jsonb
    // boundary, the contract types this `number`, and adding an unreachable branch here is
    // the speculative defence the core-pair ruling (DEC 2026-08-01o) exists to refuse.
    const top = Math.min(yPrecip(m.precipitationMm), y1);
    return {
      month: m.month,
      cx,
      bar: { x: roundTo(cx - barW / 2), y: top, w: barW, h: roundTo(y1 - top) },
      meanPoint: { x: cx, y: yTemp(m.tempMeanC) },
    };
  });

  // Mean-temp polyline — one unbroken run, because every month carries a mean.
  const meanLine = columns.map((col) => `${col.meanPoint.x},${col.meanPoint.y}`).join(" ");

  const tempTicks: Tick[] = tempDomain.ticks.map((value) => ({ value, y: yTemp(value) }));
  const precipTicks: Tick[] = precipDomain.ticks.map((value) => ({ value, y: yPrecip(value) }));
  const tempZeroY = tempDomain.min <= 0 && tempDomain.max >= 0 ? yTemp(0) : null;

  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    plot: { x0, y0, x1, y1 },
    columns,
    meanLine,
    tempTicks,
    precipTicks,
    tempDomain,
    precipDomain,
    tempZeroY,
  };
}
