import { describe, expect, it } from "vitest";
import type { MeasurementType } from "@/lib/api/types";
import { MEASUREMENT_MIN_POINTS, canSaveMeasurement } from "./shape";

/**
 * Mirrors the api's `validateMeasurementShape` (`cografya_api`'s
 * `src/measurements/measurement-shape.validator.ts`): a payload this helper accepts must never
 * come back as `errors.measurements.invalidShape`, and one it rejects always would.
 */
describe("MEASUREMENT_MIN_POINTS", () => {
  it("carries the api's per-type minimum for every measurement type", () => {
    expect(MEASUREMENT_MIN_POINTS).toEqual({ coordinate: 1, distance: 2, area: 3 });
  });
});

describe("canSaveMeasurement", () => {
  const cases: readonly [MeasurementType, number, boolean][] = [
    ["coordinate", 0, false],
    ["coordinate", 1, true],
    // A coordinate is single-point by definition; the api rejects a second point too.
    ["coordinate", 2, false],
    ["distance", 0, false],
    ["distance", 1, false],
    ["distance", 2, true],
    ["distance", 5, true],
    ["area", 0, false],
    ["area", 1, false],
    ["area", 2, false],
    ["area", 3, true],
    ["area", 7, true],
  ];

  it.each(cases)("%s with %i point(s) -> %s", (type, count, expected) => {
    expect(canSaveMeasurement(type, count)).toBe(expected);
  });
});
