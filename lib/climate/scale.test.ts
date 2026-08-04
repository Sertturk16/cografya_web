import { describe, expect, it } from "vitest";
import {
  buildClimateChartGeometry,
  CHART_HEIGHT,
  CHART_WIDTH,
  type MonthPoint,
  niceDomain,
  niceNum,
  roundTo,
  scaleLinear,
} from "./scale";

// These tests assert STRUCTURE and INVARIANTS, not specific climate facts (the numbers
// live in the api's committed data, not here). The single load-bearing invariant is that
// an auto-scaled axis always includes 0 — the compensation the owner ruling requires.

describe("roundTo", () => {
  it("removes binary-float dust", () => {
    expect(roundTo(0.1 + 0.2)).toBe(0.3);
  });
  it("respects the requested precision", () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
  });
});

describe("niceNum", () => {
  it("returns a 1/2/5 × 10ⁿ magnitude", () => {
    for (const r of [0.7, 3, 8, 47, 230, 2291]) {
      const n = niceNum(r, false);
      const mantissa = n / 10 ** Math.floor(Math.log10(n));
      expect([1, 2, 5, 10]).toContain(roundTo(mantissa));
    }
  });
  it("never returns a non-positive step for degenerate input", () => {
    expect(niceNum(0, true)).toBeGreaterThan(0);
    expect(niceNum(-5, true)).toBeGreaterThan(0);
  });
});

describe("niceDomain — always includes 0 (owner ruling 6 compensation)", () => {
  const cases: Array<{ name: string; min: number; max: number }> = [
    { name: "Erzurum-like (negative winter)", min: -13.9, max: 27.4 },
    { name: "Konya-like (dips just below 0)", min: -4.1, max: 30.3 },
    { name: "Antalya-like (all-positive temp)", min: 6.1, max: 34.2 },
    { name: "Rize-like precipitation", min: 0, max: 293.8 },
    { name: "arid precipitation floor", min: 0, max: 43.4 },
  ];
  for (const c of cases) {
    it(`${c.name}: 0 is within [min,max] and is a tick`, () => {
      const d = niceDomain(c.min, c.max);
      expect(d.min).toBeLessThanOrEqual(0);
      expect(d.max).toBeGreaterThanOrEqual(0);
      expect(d.ticks).toContain(0);
    });
    it(`${c.name}: domain fully contains the data`, () => {
      const d = niceDomain(c.min, c.max);
      expect(d.min).toBeLessThanOrEqual(c.min);
      expect(d.max).toBeGreaterThanOrEqual(c.max);
    });
  }

  it("produces ascending ticks spanning [min, max]", () => {
    const d = niceDomain(-13.9, 27.4);
    expect(d.ticks[0]).toBe(d.min);
    expect(d.ticks[d.ticks.length - 1]).toBe(d.max);
    for (let i = 1; i < d.ticks.length; i++) {
      expect(d.ticks[i]!).toBeGreaterThan(d.ticks[i - 1]!);
    }
  });

  it("handles a flat POSITIVE series without a degenerate axis", () => {
    // NOTE: this does NOT reach the `lo === hi` guard — forcing 0 in makes the span 0..5.
    // The all-zero case below is the only input that does; see it.
    const d = niceDomain(5, 5);
    expect(d.min).toBeLessThanOrEqual(0);
    expect(d.max).toBeGreaterThanOrEqual(5);
    expect(d.ticks).toContain(0);
  });

  it("handles an all-zero series — the only input that reaches the lo===hi guard", () => {
    // What an all-null precipitation or temperature series collapses to. Without the
    // guard the domain is 0..0 → a zero-width axis with a single degenerate tick.
    const d = niceDomain(0, 0);
    expect(d.max).toBeGreaterThan(d.min);
    expect(d.ticks.length).toBeGreaterThan(1);
    expect(d.ticks).toContain(0);
  });
});

describe("scaleLinear", () => {
  it("maps domain endpoints to range endpoints", () => {
    const s = scaleLinear({ min: 0, max: 100 }, 280, 20); // SVG y: bottom→top
    expect(s(0)).toBe(280);
    expect(s(100)).toBe(20);
  });
  it("is monotonic and interpolates the midpoint", () => {
    const s = scaleLinear({ min: -10, max: 30 }, 280, 20);
    expect(s(10)).toBeCloseTo(150, 5);
    expect(s(-10)).toBeGreaterThan(s(30));
  });
  it("does not divide by zero on a degenerate domain", () => {
    const s = scaleLinear({ min: 7, max: 7 }, 0, 100);
    expect(Number.isFinite(s(7))).toBe(true);
  });
});

// A compact 12-month stress fixture: negative winter means and a tall precipitation month
// — enough to exercise every branch. Values are illustrative, not a real province.
// The core pair is REQUIRED by the contract (api #87), so there is no null case to model.
function fixture(overrides: Partial<Record<number, Partial<MonthPoint>>> = {}): MonthPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const base: MonthPoint = {
      month,
      tempMeanC: -9 + i * 2.5,
      precipitationMm: 20 + i * 5,
    };
    return { ...base, ...overrides[month] };
  });
}

describe("buildClimateChartGeometry", () => {
  it("emits the fixed canvas and 12 columns", () => {
    const g = buildClimateChartGeometry(fixture());
    expect(g.width).toBe(CHART_WIDTH);
    expect(g.height).toBe(CHART_HEIGHT);
    expect(g.columns).toHaveLength(12);
  });

  it("keeps every bar and mean point inside the plot rectangle", () => {
    const g = buildClimateChartGeometry(fixture());
    for (const col of g.columns) {
      expect(col.bar.x).toBeGreaterThanOrEqual(g.plot.x0);
      expect(col.bar.x + col.bar.w).toBeLessThanOrEqual(g.plot.x1 + 0.001);
      expect(col.bar.y).toBeGreaterThanOrEqual(g.plot.y0 - 0.001);
      expect(col.bar.h).toBeGreaterThanOrEqual(0);
      expect(col.meanPoint.y).toBeGreaterThanOrEqual(g.plot.y0 - 0.001);
      expect(col.meanPoint.y).toBeLessThanOrEqual(g.plot.y1 + 0.001);
    }
  });

  it("draws a 0 °C reference line inside the plot for a negative-winter province", () => {
    const g = buildClimateChartGeometry(fixture());
    expect(g.tempZeroY).not.toBeNull();
    expect(g.tempZeroY!).toBeGreaterThan(g.plot.y0);
    expect(g.tempZeroY!).toBeLessThan(g.plot.y1);
  });

  it("produces one unbroken mean polyline across all 12 months", () => {
    const g = buildClimateChartGeometry(fixture());
    // One run, not an array of runs: `tempMeanC` is required, so a gap cannot occur.
    expect(g.meanLine.split(" ")).toHaveLength(12);
  });

  it("gives every month a bar and a mean point", () => {
    // The old "null value ⇒ null bar / null meanPoint" branches are gone with the
    // nullable fields; this pins that every column is now fully populated.
    const g = buildClimateChartGeometry(fixture());
    expect(g.columns).toHaveLength(12);
    for (const col of g.columns) {
      expect(col.bar).not.toBeNull();
      expect(col.meanPoint).not.toBeNull();
    }
  });

  it("keeps ticks finite when every month carries the same value", () => {
    // The degenerate-domain guard (lo === hi) still has to hold — a flat series is
    // legitimate input, unlike the all-null series this replaced.
    const flat = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      tempMeanC: 12,
      precipitationMm: 0,
    }));
    const g = buildClimateChartGeometry(flat);
    for (const t of [...g.tempTicks, ...g.precipTicks]) {
      expect(Number.isFinite(t.y)).toBe(true);
    }
  });

  it("grows precipitation bars from the baseline and floors a negative value at zero", () => {
    const g = buildClimateChartGeometry(
      fixture({ 3: { precipitationMm: 0 }, 4: { precipitationMm: -1 } }),
    );
    for (const col of g.columns) {
      // Every bar's foot sits on (or, for the floored case, above) the precip 0 baseline.
      expect(col.bar.y + col.bar.h).toBeLessThanOrEqual(roundTo(g.plot.y1, 3) + 0.001);
    }
    expect(g.columns[2]!.bar.h).toBe(0); // 0 mm is a real value → a zero-height bar
    // A negative total is a contract violation; it is floored so the SVG stays valid
    // (never a negative `height`). The raw number still prints in the table.
    expect(g.columns[3]!.bar.h).toBe(0);
  });

  it("keeps months in calendar order with ascending column centers", () => {
    const g = buildClimateChartGeometry(fixture());
    g.columns.forEach((col, i) => expect(col.month).toBe(i + 1));
    for (let i = 1; i < g.columns.length; i++) {
      expect(g.columns[i]!.cx).toBeGreaterThan(g.columns[i - 1]!.cx);
    }
  });

  // Guards the axes against being swapped: the temp scale must map onto the TEMP domain
  // and the precip scale onto the PRECIP domain. The fixture's magnitudes differ enough
  // (temps ~-14..+26, precip 20..75) that a swap would push points outside the plot.
  it("colder-than / warmer-than months map to lower / higher pixels (SVG y grows down)", () => {
    const g = buildClimateChartGeometry(fixture());
    const jan = g.columns[0]!.meanPoint!;
    const jul = g.columns[6]!.meanPoint!;
    expect(jan.y).toBeGreaterThan(jul.y); // January colder → larger y (further down)
  });
});
