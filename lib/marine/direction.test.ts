import { describe, expect, it } from "vitest";
import type { MarineLayer, MarineValue } from "@/lib/api/types";
import {
  COMPASS_POINTS,
  MARINE_COMPASS_KEY,
  arrowRotationDeg,
  compassPoint,
  marineDirectionView,
  normalizeBearing,
} from "./direction";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). No assertion here claims which way the wind blows
 * anywhere; the bearings are synthetic and the conventions are both exercised whether or not
 * the api currently publishes them.
 *
 * THIS FILE IS THE 180° GUARD. ECMWF derives wind bearings from vector components, and a
 * sign error yields an arrow exactly reversed — a defect invisible on screen and invisible
 * to every test that only checks "an arrow was drawn". The eight-cardinal table below is the
 * only thing that can catch it, which is why it enumerates rather than parameterises the
 * expected rotations.
 */

function value(overrides: Partial<MarineValue> = {}): MarineValue {
  return {
    value: 5,
    unit: "meter_per_second",
    status: "ok",
    freshness: "fresh",
    validAtUtc: "2026-08-02T12:00:00.000Z",
    fetchedAtUtc: "2026-08-02T12:04:00.000Z",
    modelRunAtUtc: "2026-08-02T06:00:00.000Z",
    staleSinceUtc: null,
    source: "ecmwf",
    datasetId: null,
    gridLatitude: null,
    gridLongitude: null,
    distanceKm: null,
    ...overrides,
  };
}

function layer(overrides: Partial<MarineLayer> = {}): MarineLayer {
  return {
    id: "wind_speed_10m",
    labelTr: "Fixture",
    labelEn: "Fixture",
    unit: "meter_per_second",
    directionConvention: null,
    calmThreshold: null,
    primarySource: "ecmwf",
    fallbackSource: null,
    stepHours: 3,
    horizonEndUtc: null,
    updateFrequency: null,
    catalogueUpdatedAtUtc: null,
    colorStops: [],
    attributionId: "ecmwf",
    ...overrides,
  };
}

describe("normalizeBearing", () => {
  it.each([
    [0, 0],
    [359.9, 359.9],
    [360, 0],
    [720, 0],
    [-1, 359],
    [-90, 270],
    [450, 90],
  ])("wraps %p into [0,360) as %p", (input, expected) => {
    expect(normalizeBearing(input)).toBeCloseTo(expected, 6);
  });
});

describe("arrowRotationDeg — the eight cardinals, both conventions", () => {
  // `from` = "the flow COMES FROM this bearing", so the arrow (which shows where the flow
  // GOES) points the opposite way. Written out one by one on purpose: a formula in the test
  // would reproduce a sign error in the implementation.
  it.each([
    [0, 180],
    [45, 225],
    [90, 270],
    [135, 315],
    [180, 0],
    [225, 45],
    [270, 90],
    [315, 135],
  ])("from %p° rotates the arrow to %p°", (bearing, expected) => {
    expect(arrowRotationDeg(bearing, "from")).toBe(expected);
  });

  it.each([
    [0, 0],
    [45, 45],
    [90, 90],
    [135, 135],
    [180, 180],
    [225, 225],
    [270, 270],
    [315, 315],
  ])("towards %p° rotates the arrow to %p°", (bearing, expected) => {
    expect(arrowRotationDeg(bearing, "towards")).toBe(expected);
  });

  it("the two conventions are always exactly 180° apart", () => {
    for (let bearing = 0; bearing < 360; bearing += 7) {
      const from = arrowRotationDeg(bearing, "from");
      const towards = arrowRotationDeg(bearing, "towards");
      expect(normalizeBearing(from - towards)).toBe(180);
    }
  });

  it("keeps the result inside [0,360) for out-of-range bearings", () => {
    expect(arrowRotationDeg(-45, "from")).toBe(135);
    expect(arrowRotationDeg(400, "towards")).toBe(40);
  });

  it("yields 0 rather than NaN for a non-finite bearing", () => {
    expect(arrowRotationDeg(Number.NaN, "from")).toBe(0);
  });
});

describe("compassPoint — eight sectors, offset by half a sector", () => {
  it.each([
    [0, "n"],
    [45, "ne"],
    [90, "e"],
    [135, "se"],
    [180, "s"],
    [225, "sw"],
    [270, "w"],
    [315, "nw"],
  ] as const)("%p° is %s", (bearing, expected) => {
    expect(compassPoint(bearing)).toBe(expected);
  });

  it.each([
    [22.4, "n"],
    [22.5, "ne"],
    [337.4, "nw"],
    [337.5, "n"],
    [359.9, "n"],
  ] as const)("bucket boundary %p° falls in %s", (bearing, expected) => {
    // 359.9 → "kuzey" is the boundary that a naive `floor(bearing / 45)` gets wrong.
    expect(compassPoint(bearing)).toBe(expected);
  });

  it("never emits a sector outside the declared eight", () => {
    for (let bearing = -720; bearing <= 720; bearing += 3) {
      expect(COMPASS_POINTS).toContain(compassPoint(bearing));
    }
  });

  it("has a message key for every sector", () => {
    expect(Object.keys(MARINE_COMPASS_KEY).sort()).toEqual([...COMPASS_POINTS].sort());
  });
});

describe("marineDirectionView — the arrow-unlock gate", () => {
  const directionLayer = layer({ id: "wind_direction_10m", directionConvention: "from" });
  const magnitudeLayer = layer({ id: "wind_speed_10m", calmThreshold: 0.5 });

  it("draws the arrow when convention, direction and magnitude are all present", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 8.4 }),
      magnitudeLayer,
      direction: value({ value: 315, unit: "degree_true" }),
      directionLayer,
    });

    expect(view).toEqual({
      kind: "arrow",
      bearing: 315,
      rotationDeg: 135,
      compass: "nw",
      convention: "from",
    });
  });

  it("draws NO arrow when the layer publishes no direction convention", () => {
    // The binding unlock condition (SPEC §5.5): if the api withdraws the convention the arrow
    // must vanish with no redeploy, so there is no local flag that could keep it on.
    const view = marineDirectionView({
      magnitude: value({ value: 8.4 }),
      magnitudeLayer,
      direction: value({ value: 315, unit: "degree_true" }),
      directionLayer: layer({ id: "wind_direction_10m", directionConvention: null }),
    });

    expect(view).toEqual({ kind: "none" });
  });

  it("draws no arrow when the direction layer is missing from the catalogue entirely", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 8.4 }),
      magnitudeLayer,
      direction: value({ value: 315, unit: "degree_true" }),
      directionLayer: undefined,
    });

    expect(view).toEqual({ kind: "none" });
  });

  it.each(["no_data", "not_supported", "unavailable"] as const)(
    "draws no arrow when the direction value is %s",
    (status) => {
      const view = marineDirectionView({
        magnitude: value({ value: 8.4 }),
        magnitudeLayer,
        direction: value({ status, value: null, freshness: null, unit: "degree_true" }),
        directionLayer,
      });

      expect(view).toEqual({ kind: "none" });
    },
  );

  it("draws no arrow when the magnitude itself is absent (an angle with nothing on it)", () => {
    const view = marineDirectionView({
      magnitude: value({ status: "no_data", value: null, freshness: null }),
      magnitudeLayer,
      direction: value({ value: 315, unit: "degree_true" }),
      directionLayer,
    });

    expect(view).toEqual({ kind: "none" });
  });

  it("shows CALM instead of an arrow below the layer's threshold", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 0.3 }),
      magnitudeLayer,
      direction: value({ value: 315, unit: "degree_true" }),
      directionLayer,
    });

    expect(view).toEqual({ kind: "calm" });
  });

  it("treats the threshold as inclusive at the boundary (>= threshold draws)", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 0.5 }),
      magnitudeLayer,
      direction: value({ value: 90, unit: "degree_true" }),
      directionLayer,
    });

    expect(view).toMatchObject({ kind: "arrow" });
  });

  it("reports calm even when the direction value is broken (calm outranks the arrow gate)", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 0.01 }),
      magnitudeLayer,
      direction: value({ status: "no_data", value: null, freshness: null }),
      directionLayer,
    });

    expect(view).toEqual({ kind: "calm" });
  });

  it("never claims calm when the layer publishes no threshold", () => {
    // Temperature and the direction layers carry `calmThreshold: null`; "calm" there would be
    // an invented judgement, so a missing threshold can only produce an arrow or nothing.
    const view = marineDirectionView({
      magnitude: value({ value: 0.01 }),
      magnitudeLayer: layer({ calmThreshold: null }),
      direction: value({ value: 10, unit: "degree_true" }),
      directionLayer,
    });

    expect(view).toMatchObject({ kind: "arrow" });
  });

  it("never claims calm when the magnitude layer is missing from the catalogue", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 0.01 }),
      magnitudeLayer: undefined,
      direction: value({ value: 10, unit: "degree_true" }),
      directionLayer,
    });

    expect(view).toMatchObject({ kind: "arrow" });
  });

  it("normalizes an out-of-range bearing before deriving compass and rotation", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 8.4 }),
      magnitudeLayer,
      direction: value({ value: 405, unit: "degree_true" }),
      directionLayer,
    });

    expect(view).toEqual({
      kind: "arrow",
      bearing: 45,
      rotationDeg: 225,
      compass: "ne",
      convention: "from",
    });
  });

  it("honours a 'towards' convention without a second set of strings", () => {
    const view = marineDirectionView({
      magnitude: value({ value: 8.4 }),
      magnitudeLayer,
      direction: value({ value: 90, unit: "degree_true" }),
      directionLayer: layer({ id: "wind_direction_10m", directionConvention: "towards" }),
    });

    expect(view).toEqual({
      kind: "arrow",
      bearing: 90,
      rotationDeg: 90,
      compass: "e",
      convention: "towards",
    });
  });
});
