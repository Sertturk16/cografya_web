import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MeasurementType } from "@/lib/api/types";
import {
  MEASUREMENT_MAX_POINTS,
  MEASUREMENT_MIN_POINTS,
  MEASUREMENT_POINTS_MAX,
  MEASUREMENT_TITLE_MAX_LENGTH,
  canSaveMeasurement,
  measurementPointCountIssue,
} from "./shape";

/**
 * Mirrors the api's `validateMeasurementShape` (`cografya_api`'s
 * `src/measurements/measurement-shape.validator.ts`) and `CreateMeasurementRequestDto`'s flat
 * `@ArrayMaxSize(MEASUREMENT_POINTS_MAX)`: a payload this helper accepts must never come back as
 * `errors.measurements.invalidShape` (or be refused by the BFF's own schema), and one it rejects
 * always would.
 */
describe("MEASUREMENT_MIN_POINTS", () => {
  it("carries the api's per-type minimum for every measurement type", () => {
    expect(MEASUREMENT_MIN_POINTS).toEqual({ coordinate: 1, distance: 2, area: 3 });
  });
});

describe("MEASUREMENT_POINTS_MAX", () => {
  it("carries the api DTO's flat points bound (MEASUREMENT_POINTS_MAX = 20)", () => {
    expect(MEASUREMENT_POINTS_MAX).toBe(20);
  });
});

describe("the contract bounds (committed OpenAPI spec)", () => {
  const spec = JSON.parse(
    readFileSync(new URL("../../openapi/openapi.json", import.meta.url), "utf8"),
  ) as {
    components: {
      schemas: {
        CreateMeasurementRequestDto: {
          properties: { title: { maxLength: number }; points: { maxItems: number } };
        };
      };
    };
  };
  const create = spec.components.schemas.CreateMeasurementRequestDto.properties;

  it("MEASUREMENT_TITLE_MAX_LENGTH is the spec's title maxLength", () => {
    expect(MEASUREMENT_TITLE_MAX_LENGTH).toBe(create.title.maxLength);
  });

  it("MEASUREMENT_POINTS_MAX is the spec's points maxItems", () => {
    expect(MEASUREMENT_POINTS_MAX).toBe(create.points.maxItems);
  });
});

describe("MEASUREMENT_MAX_POINTS", () => {
  it("is one point for a coordinate and the flat bound for every other type", () => {
    expect(MEASUREMENT_MAX_POINTS).toEqual({
      coordinate: 1,
      distance: MEASUREMENT_POINTS_MAX,
      area: MEASUREMENT_POINTS_MAX,
    });
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
    ["distance", 20, true],
    ["distance", 21, false],
    ["area", 0, false],
    ["area", 1, false],
    ["area", 2, false],
    ["area", 3, true],
    ["area", 7, true],
    ["area", 20, true],
    ["area", 21, false],
  ];

  it.each(cases)("%s with %i point(s) -> %s", (type, count, expected) => {
    expect(canSaveMeasurement(type, count)).toBe(expected);
  });
});

describe("measurementPointCountIssue", () => {
  const cases: readonly [MeasurementType, number, "tooFew" | "tooMany" | null][] = [
    ["coordinate", 0, "tooFew"],
    ["coordinate", 1, null],
    ["coordinate", 2, "tooMany"],
    ["distance", 1, "tooFew"],
    ["distance", 2, null],
    ["distance", 20, null],
    ["distance", 21, "tooMany"],
    ["area", 2, "tooFew"],
    ["area", 3, null],
    ["area", 20, null],
    ["area", 21, "tooMany"],
  ];

  it.each(cases)("%s with %i point(s) -> %s", (type, count, expected) => {
    expect(measurementPointCountIssue(type, count)).toBe(expected);
  });

  it("agrees with canSaveMeasurement on every count from 0 to 25", () => {
    for (const type of ["coordinate", "distance", "area"] as const) {
      for (let count = 0; count <= 25; count++) {
        expect(canSaveMeasurement(type, count)).toBe(
          measurementPointCountIssue(type, count) === null,
        );
      }
    }
  });
});
