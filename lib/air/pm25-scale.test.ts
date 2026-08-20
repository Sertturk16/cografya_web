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

/**
 * Constructed (min, max) pairs spanning the shapes the rule has to survive: a hair-thin
 * range, a narrow one, several ordinary ones, a very wide one, and one sitting near zero.
 * None is a claim about a province.
 */
const ranges: readonly (readonly [number, number])[] = [
  [0.1, 0.4],
  [15.1, 19.3],
  [12.4, 18.2],
  [14, 23.8],
  [20.2, 48],
  [32.7, 47.3],
  [9, 120],
  [40, 480],
];

describe("pm25AxisDomain", () => {
  it("puts the floor AT OR BELOW the series minimum — the axis never clips a low reading", () => {
    for (const [min, max] of ranges) {
      expect(pm25AxisDomain(min, max).min).toBeLessThanOrEqual(min);
    }
  });

  it("does NOT anchor the floor at zero when the province sits well above it", () => {
    // The ruled behaviour itself (→ DEC 2026-08-20c md.2 as applied 2026-08-20): the axis
    // spans the province's own range, so a series that never goes near zero gets a floor
    // that never goes near zero either.
    expect(pm25AxisDomain(15.1, 19.3).min).toBe(15);
    expect(pm25AxisDomain(32.7, 47.3).min).toBe(30);
  });

  it("moves the floor WITH the data instead of returning a fixed number", () => {
    // Positive control on the mechanism: shift the same-width range down and the floor
    // follows it down. A rule that had quietly frozen at one value would fail here.
    const high = pm25AxisDomain(35.2, 39.4).min;
    const low = pm25AxisDomain(15.2, 19.4).min;
    expect(high).toBeGreaterThan(low);
  });

  it("still floors at zero when the series itself reaches down to it", () => {
    // Not an exception to the rule — the same rule, on data that happens to sit there. A
    // concentration cannot be negative, so the floor can never go below zero.
    expect(pm25AxisDomain(0.1, 0.4).min).toBe(0);
    for (const [min, max] of ranges) {
      expect(pm25AxisDomain(min, max).min).toBeGreaterThanOrEqual(0);
    }
  });

  it("puts the ceiling AT OR ABOVE the series maximum, never below it", () => {
    // The one property that, if broken, clips a real reading out of the plot.
    for (const [min, max] of ranges) {
      expect(pm25AxisDomain(min, max).max).toBeGreaterThanOrEqual(max);
    }
  });

  it("keeps BOTH ends a whole multiple of the chosen step", () => {
    // Both, not just the ceiling: the floor is printed as a tick label now, and a floor off
    // the step grid would print a number the other ticks do not agree with.
    for (const [min, max] of ranges) {
      const domain = pm25AxisDomain(min, max);
      expect(domain.max % domain.step).toBe(0);
      expect(domain.min % domain.step).toBe(0);
    }
  });

  it("never lets the axis grow past six intervals, whatever the range", () => {
    // The reason the step is CHOSEN rather than fixed: a fixed step of 10 would give a
    // 48 µg/m³ province five gridlines and a 480 µg/m³ one forty-eight.
    for (const [min, max] of ranges) {
      const domain = pm25AxisDomain(min, max);
      expect((domain.max - domain.min) / domain.step).toBeLessThanOrEqual(6);
    }
  });

  it("gives at least three intervals once the span is three µg/m³ or wider", () => {
    // A property of the rule, provable rather than measured: the step is the smallest
    // candidate with span ≤ 5·step, and consecutive candidates are at most 2,5× apart, so a
    // span of three or more can never collapse onto a two-tick axis.
    for (const [min, max] of ranges.filter(([lo, hi]) => hi - lo >= 3)) {
      const domain = pm25AxisDomain(min, max);
      expect((domain.max - domain.min) / domain.step).toBeGreaterThanOrEqual(3);
    }
  });

  it("pads the domain by less than two steps beyond the data's own span", () => {
    // This is what the ruling actually bought, stated as an invariant: the axis is the
    // province's range plus rounding, never a range chosen for some other province.
    for (const [min, max] of ranges) {
      const domain = pm25AxisDomain(min, max);
      expect(domain.max - domain.min).toBeLessThan(max - min + 2 * domain.step);
    }
  });

  it("never returns a zero-width domain, for an all-zero or a perfectly flat series", () => {
    // Degenerate input must not reach a caller as a divide-by-zero. Both cases land on a
    // step boundary at both ends, which is the only way the floor can meet the ceiling.
    for (const [min, max] of [
      [0, 0],
      [20, 20],
    ] as const) {
      const domain = pm25AxisDomain(min, max);
      expect(domain.max).toBeGreaterThan(domain.min);
    }
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

  it("starts the tick list AT THE DOMAIN FLOOR and ends it at the ceiling", () => {
    // The floor is a printed tick, not an implied zero — this is the half of the ruling
    // that keeps a truncated axis from reading as a zero-based one. `twentySeven` ramps
    // 12 → 25, so its floor is 10 and the list must open on a number, not on zero.
    const geometry = buildPm25ChartGeometry(twentySeven);
    const ticks = geometry?.ticks ?? [];
    expect(ticks[0]?.value).toBe(geometry?.domain.min);
    expect(ticks[0]?.value).not.toBe(0);
    expect(ticks.at(-1)?.value).toBe(geometry?.domain.max);
  });

  it("puts the floor tick on the plot's bottom edge, where a reader looks for the baseline", () => {
    const geometry = buildPm25ChartGeometry(twentySeven);
    expect(geometry?.ticks[0]?.y).toBe(geometry?.plot.y1);
  });

  it("lets the trend fill most of the plot height for a narrow, high series", () => {
    // What the ruling bought, as a rule property on a constructed input: this 4,2-wide
    // range sitting between 15 and 20 occupied 21% of the plot height under a zero floor
    // (0-20 in steps of 5) and fills 84% of it under its own. The bound asserted is loose
    // on purpose — the claim is "most of the height", not a pinned number.
    const narrow = buildPm25ChartGeometry(series([15.1, 17.2, 16.4, 19.3, 18.1]));
    const ys = (narrow?.points ?? []).map((p) => p.y);
    const plotHeight = (narrow?.plot.y1 ?? 0) - (narrow?.plot.y0 ?? 0);
    const used = Math.max(...ys) - Math.min(...ys);
    expect(used / plotHeight).toBeGreaterThan(0.6);
  });
});
