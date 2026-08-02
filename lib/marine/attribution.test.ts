import { describe, expect, it } from "vitest";
import type { MarineLayer } from "@/lib/api/types";
import { ecmwfAttributionYear } from "./attribution";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Every layer here is synthetic. Nothing asserts
 * which provider serves which quantity today, or which year the live cycle carries —
 * those are facts about the world and the ingest, and pinning them would fail the day
 * either legitimately changes.
 *
 * What IS pinned is the rule the licence forces on us: the copyright year is the ingested
 * CYCLE's own UTC year, and when there is no cycle there is no year — never "now", never a
 * default.
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
    horizonEndUtc: "2030-01-05T06:00:00.000Z",
    updateFrequency: "fixture-frequency",
    catalogueUpdatedAtUtc: "2026-01-01T06:00:00.000Z",
    colorStops: [],
    attributionId: "fixture",
    ...overrides,
  };
}

describe("ecmwfAttributionYear", () => {
  it("reads the year from the ingested cycle, not from the clock", () => {
    expect(
      ecmwfAttributionYear([layer({ catalogueUpdatedAtUtc: "2019-04-02T00:00:00.000Z" })]),
    ).toBe(2019);
  });

  it("counts a layer that falls back to ECMWF, not only one sourced from it", () => {
    expect(
      ecmwfAttributionYear([
        layer({
          primarySource: "cmems",
          fallbackSource: "ecmwf",
          catalogueUpdatedAtUtc: "2021-06-01T00:00:00.000Z",
        }),
      ]),
    ).toBe(2021);
  });

  it("ignores layers that have nothing to do with ECMWF", () => {
    expect(
      ecmwfAttributionYear([
        layer({
          primarySource: "cmems",
          fallbackSource: null,
          catalogueUpdatedAtUtc: "2021-06-01T00:00:00.000Z",
        }),
      ]),
    ).toBeNull();
  });

  it("takes the NEWEST cycle when the ECMWF layers disagree", () => {
    expect(
      ecmwfAttributionYear([
        layer({ id: "wind_speed_10m", catalogueUpdatedAtUtc: "2024-12-31T00:00:00.000Z" }),
        layer({ id: "wind_direction_10m", catalogueUpdatedAtUtc: "2025-01-01T00:00:00.000Z" }),
      ]),
    ).toBe(2025);
  });

  it("returns null when no cycle has been ingested (production's default state)", () => {
    expect(ecmwfAttributionYear([layer({ catalogueUpdatedAtUtc: null })])).toBeNull();
  });

  it("returns null for an empty catalogue rather than inventing a year", () => {
    expect(ecmwfAttributionYear([])).toBeNull();
  });

  it("ignores an unparseable künye instead of throwing on the whole page", () => {
    expect(ecmwfAttributionYear([layer({ catalogueUpdatedAtUtc: "not-a-date" })])).toBeNull();
  });

  it("reads the year in UTC, so a late-December cycle cannot roll over on the renderer", () => {
    // The instant is 31 December in UTC and 1 January in İstanbul. The licence year must
    // follow the data, not the machine that rendered the page.
    expect(
      ecmwfAttributionYear([layer({ catalogueUpdatedAtUtc: "2026-12-31T23:00:00.000Z" })]),
    ).toBe(2026);
  });

  it("does not consider the forecast horizon, which points into the future", () => {
    // `horizonEndUtc` on the fixture is in 2030; the answer must still be the cycle year.
    expect(ecmwfAttributionYear([layer()])).toBe(2026);
  });
});
