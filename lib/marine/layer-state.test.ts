import { describe, expect, it } from "vitest";
import type { MarineLayer } from "@/lib/api/types";
import { marineLayerState } from "./layer-state";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). This asserts the CLASSIFIER's matrix over null
 * combinations — never a fact about which provider is live today. "Sea surface temperature
 * is in the next phase" is a statement about the world, not about this function, and
 * pinning it here would make the test fail on the day the api starts serving it correctly.
 */

function layer(overrides: Partial<MarineLayer> = {}): MarineLayer {
  return {
    id: "wind_speed_10m",
    labelTr: "Fixture katmanı",
    labelEn: "Fixture layer",
    unit: "meter_per_second",
    directionConvention: null,
    calmThreshold: null,
    primarySource: "ecmwf",
    fallbackSource: null,
    stepHours: 3,
    horizonEndUtc: "2026-01-05T06:00:00.000Z",
    updateFrequency: "fixture-frequency",
    catalogueUpdatedAtUtc: "2026-01-01T06:00:00.000Z",
    colorStops: [],
    attributionId: "fixture",
    ...overrides,
  };
}

describe("marineLayerState", () => {
  it("is live only when all three künye fields are resolved", () => {
    expect(marineLayerState(layer())).toBe("live");
  });

  it("is nextPhase when every künye field is null (the all-null production default)", () => {
    expect(
      marineLayerState(
        layer({ horizonEndUtc: null, updateFrequency: null, catalogueUpdatedAtUtc: null }),
      ),
    ).toBe("nextPhase");
  });

  it.each([
    ["horizonEndUtc", { horizonEndUtc: null }],
    ["updateFrequency", { updateFrequency: null }],
    ["catalogueUpdatedAtUtc", { catalogueUpdatedAtUtc: null }],
  ])("is nextPhase when only %s is null (no half-live row)", (_name, overrides) => {
    expect(marineLayerState(layer(overrides))).toBe("nextPhase");
  });

  it("ignores primarySource entirely — the künye decides, not the provider", () => {
    const resolvedCmems = layer({ primarySource: "cmems" });
    const unresolvedEcmwf = layer({
      primarySource: "ecmwf",
      horizonEndUtc: null,
      updateFrequency: null,
      catalogueUpdatedAtUtc: null,
    });

    expect(marineLayerState(resolvedCmems)).toBe("live");
    expect(marineLayerState(unresolvedEcmwf)).toBe("nextPhase");
  });
});
