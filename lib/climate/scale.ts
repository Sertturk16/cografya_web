/**
 * Pure geometry for the province climate chart (İklim grafiği — W1).
 *
 * NO React, NO i18n, NO DTO imports — just numbers in, pixel coordinates out, so the
 * whole scaling layer is unit-testable in isolation (the same discipline as the api's
 * `climate-derivations.ts`). The server component (`components/climate/climate-chart.tsx`)
 * feeds raw MGM numbers in and renders the returned coordinates as inline SVG; number
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

/** One month column: the precipitation bar + the mean-temp marker (either may be null). */
export interface ChartColumn {
  month: number;
  /** Column center X (used for the month label and the temp marker). */
  cx: number;
  /** Precipitation `<rect>` box, or null when the month has no precipitation value. */
  bar: { x: number; y: number; w: number; h: number } | null;
  /** Mean-temp point, or null when the month has no mean value. */
  meanPoint: { x: number; y: number } | null;
}

/** The full, render-ready geometry for one province's chart. */
export interface ClimateChartGeometry {
  width: number;
  height: number;
  /** Plot rectangle (inside the axis gutters): x0/x1 left/right, y0 top, y1 bottom. */
  plot: { x0: number; y0: number; x1: number; y1: number };
  columns: ChartColumn[];
  /**
   * Mean-temp polyline point runs ("x,y x,y …"). One string per contiguous run of
   * non-null months, so a data gap breaks the line instead of drawing a false segment
   * across it (all published provinces are gap-free today; this is defence-in-depth).
   */
  meanRuns: string[];
  /** Min–max band area `<path>` `d` (max edge forward, min edge back), or null. */
  bandPath: string | null;
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
 *  so the DTO's `months` array is assignable directly. */
export interface MonthPoint {
  month: number;
  tempMeanC: number | null;
  tempMaxMeanC: number | null;
  tempMinMeanC: number | null;
  precipitationMm: number | null;
}

/** Chart canvas — fixed `viewBox` (owner spec): zero CLS via a constant aspect ratio. */
export const CHART_WIDTH = 720;
export const CHART_HEIGHT = 340;
const MARGIN = { top: 16, right: 46, bottom: 44, left: 42 } as const;
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

function isNum(v: number | null): v is number {
  return v !== null && Number.isFinite(v);
}

/**
 * Project one province's monthly normals into render-ready chart geometry.
 *
 * Temperature uses a left axis whose domain spans the coldest mean-min to the warmest
 * mean-max (so the whole min–max band fits) and always includes 0. Precipitation uses an
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

  // Temperature domain: cover the band's full extent (min of mins → max of maxes),
  // falling back to the mean series where max/min are absent.
  const tempValues: number[] = [];
  for (const m of months) {
    if (isNum(m.tempMinMeanC)) tempValues.push(m.tempMinMeanC);
    if (isNum(m.tempMaxMeanC)) tempValues.push(m.tempMaxMeanC);
    if (isNum(m.tempMeanC)) tempValues.push(m.tempMeanC);
  }
  const precipValues = months.map((m) => m.precipitationMm).filter(isNum);

  const tempDomain = niceDomain(
    tempValues.length ? Math.min(...tempValues) : 0,
    tempValues.length ? Math.max(...tempValues) : 0,
  );
  const precipDomain = niceDomain(0, precipValues.length ? Math.max(...precipValues) : 0);

  const yTemp = scaleLinear(tempDomain, y1, y0);
  const yPrecip = scaleLinear(precipDomain, y1, y0);

  const columns: ChartColumn[] = months.map((m, i) => {
    const cx = roundTo(x0 + (i + 0.5) * slot);
    const bar =
      isNum(m.precipitationMm) && m.precipitationMm >= 0
        ? (() => {
            const top = yPrecip(m.precipitationMm);
            return { x: roundTo(cx - barW / 2), y: top, w: barW, h: roundTo(y1 - top) };
          })()
        : null;
    const meanPoint = isNum(m.tempMeanC) ? { x: cx, y: yTemp(m.tempMeanC) } : null;
    return { month: m.month, cx, bar, meanPoint };
  });

  // Mean-temp polyline: contiguous non-null runs (a gap breaks the line).
  const meanRuns: string[] = [];
  let run: string[] = [];
  for (const col of columns) {
    if (col.meanPoint) {
      run.push(`${col.meanPoint.x},${col.meanPoint.y}`);
    } else if (run.length) {
      meanRuns.push(run.join(" "));
      run = [];
    }
  }
  if (run.length) meanRuns.push(run.join(" "));

  // Min–max band: forward along the max edge, back along the min edge, per contiguous
  // run where BOTH bounds exist. Multiple runs are concatenated into one `d`.
  const bandSegments: string[] = [];
  let segTop: string[] = [];
  let segBottom: Array<{ x: number; y: number }> = [];
  const flushBand = () => {
    if (segTop.length >= 2) {
      const back = [...segBottom].reverse().map((p) => `L ${p.x} ${p.y}`);
      bandSegments.push(`M ${segTop.join(" L ")} ${back.join(" ")} Z`);
    }
    segTop = [];
    segBottom = [];
  };
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const col = columns[i];
    if (m && col && isNum(m.tempMaxMeanC) && isNum(m.tempMinMeanC)) {
      segTop.push(`${col.cx} ${yTemp(m.tempMaxMeanC)}`);
      segBottom.push({ x: col.cx, y: yTemp(m.tempMinMeanC) });
    } else {
      flushBand();
    }
  }
  flushBand();
  const bandPath = bandSegments.length ? bandSegments.join(" ") : null;

  const tempTicks: Tick[] = tempDomain.ticks.map((value) => ({ value, y: yTemp(value) }));
  const precipTicks: Tick[] = precipDomain.ticks.map((value) => ({ value, y: yPrecip(value) }));
  const tempZeroY = tempDomain.min <= 0 && tempDomain.max >= 0 ? yTemp(0) : null;

  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    plot: { x0, y0, x1, y1 },
    columns,
    meanRuns,
    bandPath,
    tempTicks,
    precipTicks,
    tempDomain,
    precipDomain,
    tempZeroY,
  };
}
