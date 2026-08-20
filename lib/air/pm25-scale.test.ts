import { describe, expect, it } from "vitest";
import {
  buildPm25ChartGeometry,
  PM25_CHART_HEIGHT,
  PM25_CHART_WIDTH,
  pm25AxisDomain,
  type Pm25SeriesPoint,
} from "./pm25-scale";

/**
 * Structure and invariants only (`CONVENTIONS.md` §2) — no test here asserts what a province
 * actually measured. The series below are constructed inputs, chosen to exercise a rule, and
 * none of them is a claim about the world.
 */

const series = (values: readonly number[], startYear = 1998): Pm25SeriesPoint[] =>
  values.map((valueUgM3, index) => ({ year: startYear + index, valueUgM3 }));

/** 27 years, the shape the contract publishes today. Values are a synthetic ramp. */
const twentySeven = series(Array.from({ length: 27 }, (_, i) => 12 + i * 0.5));

describe("pm25AxisDomain", () => {
  it("anchors the floor at zero for every input", () => {
    for (const max of [0.4, 9, 15.8, 22.7, 41.6, 48.1, 120]) {
      expect(pm25AxisDomain(max).min).toBe(0);
    }
  });

  it("puts the ceiling AT OR ABOVE the series maximum, never below it", () => {
    // The one property that, if broken, clips a real reading out of the plot.
    for (const max of [0.4, 9, 15.8, 20, 22.7, 25, 41.6, 48.1, 50, 120]) {
      expect(pm25AxisDomain(max).max).toBeGreaterThanOrEqual(max);
    }
  });

  it("keeps the ceiling a whole multiple of the chosen step", () => {
    for (const max of [0.4, 9, 15.8, 22.7, 41.6, 48.1, 120]) {
      const domain = pm25AxisDomain(max);
      expect(domain.max % domain.step).toBe(0);
    }
  });

  it("never lets the axis grow past six intervals, whatever the range", () => {
    // The reason the step is CHOSEN rather than fixed: a fixed step of 10 would give a
    // 48 µg/m³ province five gridlines and a 480 µg/m³ one forty-eight.
    for (const max of [0.4, 9, 15.8, 22.7, 41.6, 48.1, 120, 480]) {
      const domain = pm25AxisDomain(max);
      expect(domain.max / domain.step).toBeLessThanOrEqual(6);
    }
  });

  it("gives at least three intervals across the range the contract actually publishes", () => {
    // Three, not four: the step jumps at 25 and at 50, so a maximum just past a jump lands
    // on three gridlines (10,1 → step 5, ceiling 15). That is the rule working, not a thin
    // axis, and pinning four here asserted a guarantee the rule never made. The bound is a
    // property of the RULE, not a claim about any province's numbers.
    for (const max of [10.1, 15.8, 22.7, 25.1, 30, 41.6, 48.1]) {
      const domain = pm25AxisDomain(max);
      expect(domain.max / domain.step).toBeGreaterThanOrEqual(3);
    }
  });

  it("never returns a zero-width domain, even for an all-zero series", () => {
    // Degenerate input must not reach a caller as a divide-by-zero.
    const domain = pm25AxisDomain(0);
    expect(domain.max).toBeGreaterThan(domain.min);
  });
});

describe("buildPm25ChartGeometry", () => {
  it("returns null for an empty series instead of throwing", () => {
    // Contract-illegal ("at least one entry") but reachable; the section drops only the
    // chart, never the page.
    expect(buildPm25ChartGeometry([])).toBeNull();
  });

  it("emits one point per payload year and one coordinate pair per point", () => {
    const geometry = buildPm25ChartGeometry(twentySeven);
    expect(geometry).not.toBeNull();
    expect(geometry?.points).toHaveLength(twentySeven.length);
    expect(geometry?.line.split(" ")).toHaveLength(twentySeven.length);
  });

  it("maps x monotonically increasing across the series", () => {
    const geometry = buildPm25ChartGeometry(twentySeven);
    const xs = geometry?.points.map((p) => p.x) ?? [];
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1] ?? Number.NEGATIVE_INFINITY);
    }
  });

  it("keeps every point inside the plot rectangle", () => {
    const geometry = buildPm25ChartGeometry(twentySeven);
    expect(geometry).not.toBeNull();
    for (const point of geometry?.points ?? []) {
      expect(point.x).toBeGreaterThanOrEqual(geometry?.plot.x0 ?? 0);
      expect(point.x).toBeLessThanOrEqual(geometry?.plot.x1 ?? 0);
      expect(point.y).toBeGreaterThanOrEqual(geometry?.plot.y0 ?? 0);
      expect(point.y).toBeLessThanOrEqual(geometry?.plot.y1 ?? 0);
    }
  });

  it("draws a higher value HIGHER on the canvas (y grows downwards in SVG)", () => {
    const geometry = buildPm25ChartGeometry(series([10, 30]));
    const [low, high] = geometry?.points ?? [];
    expect(low?.y).toBeGreaterThan(high?.y ?? Number.POSITIVE_INFINITY);
  });

  it("survives a fully flat series with no divide-by-zero", () => {
    const geometry = buildPm25ChartGeometry(series([20, 20, 20, 20]));
    for (const point of geometry?.points ?? []) {
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it("centres a single-year series instead of parking it on the left edge", () => {
    const geometry = buildPm25ChartGeometry(series([22]));
    const only = geometry?.points[0];
    expect(only?.x).toBe(((geometry?.plot.x0 ?? 0) + (geometry?.plot.x1 ?? 0)) / 2);
    expect(only?.marker).toBe(true);
    expect(only?.labelled).toBe(true);
  });

  it("names the extremes from the data, not from the ends of the series", () => {
    // 3rd entry is the lowest, 2nd the highest — neither is first or last.
    const geometry = buildPm25ChartGeometry(series([20, 40, 10, 25]));
    expect(geometry?.lowest.value).toBe(10);
    expect(geometry?.highest.value).toBe(40);
    expect(geometry?.first.value).toBe(20);
    expect(geometry?.last.value).toBe(25);
  });

  it("marks exactly the first, last, lowest and highest years", () => {
    // The dots and the <desc> sentence must describe the same four years — that is the
    // whole reason the scale module computes them instead of the component.
    const geometry = buildPm25ChartGeometry(series([20, 40, 10, 25]));
    const marked = (geometry?.points ?? []).filter((p) => p.marker).map((p) => p.year);
    expect(marked).toEqual([
      geometry?.first.year,
      geometry?.highest.year,
      geometry?.lowest.year,
      geometry?.last.year,
    ]);
  });

  it("labels the ends plus spaced multiples of five, derived from the payload's years", () => {
    // 27 is never hardcoded anywhere; the label set falls out of whatever years arrived.
    const geometry = buildPm25ChartGeometry(twentySeven);
    const labelled = (geometry?.points ?? []).filter((p) => p.labelled).map((p) => p.year);
    expect(labelled).toEqual([1998, 2005, 2010, 2015, 2020, 2024]);
  });

  it("re-derives the label set for a DIFFERENT year range rather than reusing that one", () => {
    // Positive control on the rule itself: shift the series and the labels move with it.
    const shifted = buildPm25ChartGeometry(series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 2001));
    const labelled = (shifted?.points ?? []).filter((p) => p.labelled).map((p) => p.year);
    expect(labelled).toEqual([2001, 2005, 2011]);
  });

  it("keeps the declared canvas, so the CSS aspect-ratio frame matches the viewBox", () => {
    const geometry = buildPm25ChartGeometry(twentySeven);
    expect(geometry?.width).toBe(PM25_CHART_WIDTH);
    expect(geometry?.height).toBe(PM25_CHART_HEIGHT);
  });

  it("starts the tick list at zero and ends it at the domain ceiling", () => {
    const geometry = buildPm25ChartGeometry(twentySeven);
    const ticks = geometry?.ticks ?? [];
    expect(ticks[0]?.value).toBe(0);
    expect(ticks.at(-1)?.value).toBe(geometry?.domain.max);
  });
});
