import { describe, expect, it } from "vitest";
import { kmhCompanion, metersPerSecondToKmh } from "./units";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Nothing here asserts a wind speed; it asserts that
 * the ONE conversion this surface performs is the definitional one and that it is gated on
 * the unit rather than on which column a number happens to sit in.
 */

describe("metersPerSecondToKmh", () => {
  it.each([
    [0, 0],
    [1, 3.6],
    [10, 36],
    [8.4, 30.24],
  ])("%p m/s is %p km/h", (input, expected) => {
    expect(metersPerSecondToKmh(input)).toBeCloseTo(expected, 6);
  });

  it("is linear — twice the speed is twice the km/h", () => {
    const single = metersPerSecondToKmh(6.25);
    const double = metersPerSecondToKmh(12.5);
    expect(single).not.toBeNull();
    expect(double).toBeCloseTo((single ?? 0) * 2, 6);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("returns null for %p", (bad) => {
    expect(metersPerSecondToKmh(bad)).toBeNull();
  });
});

describe("kmhCompanion — gated on the unit, not on the column", () => {
  it("converts a metre-per-second value", () => {
    expect(kmhCompanion(5, "meter_per_second")).toBeCloseTo(18, 6);
  });

  it.each(["m", "celsius", "degree_true"] as const)("returns null for %s", (unit) => {
    expect(kmhCompanion(5, unit)).toBeNull();
  });
});
