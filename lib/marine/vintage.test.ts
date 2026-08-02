import { describe, expect, it } from "vitest";
import type { MarineValue } from "@/lib/api/types";
import { buildMarineVintage, marineBlockValues, maxGridDistanceKm, oldestValidAt } from "./vintage";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). The instants below are synthetic and nothing here
 * asserts when a real model actually ran; what is under test is the grouping contract —
 * one line per provider, the oldest instant wins, an absent run time is omitted rather than
 * filled, and a value nobody can see contributes no künye.
 */

function value(overrides: Partial<MarineValue> = {}): MarineValue {
  return {
    value: 1,
    unit: "m",
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

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

describe("buildMarineVintage — grouping", () => {
  it("collapses many values of ONE provider into a single line", () => {
    const groups = buildMarineVintage([value(), value(), value()]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.source).toBe("ecmwf");
  });

  it("keeps two providers on two lines (wind is not sea temperature)", () => {
    const groups = buildMarineVintage([
      value({ source: "ecmwf" }),
      value({ source: "cmems", modelRunAtUtc: null }),
    ]);

    expect(groups.map((group) => group.source)).toEqual(["ecmwf", "cmems"]);
  });

  it("orders groups by first appearance in the payload, deterministically", () => {
    const groups = buildMarineVintage([
      value({ source: "cmems", modelRunAtUtc: null }),
      value({ source: "ecmwf" }),
    ]);

    expect(groups.map((group) => group.source)).toEqual(["cmems", "ecmwf"]);
  });

  it("derives the provider set from the DATA, not from a hardcoded list", () => {
    // The runtime case of the api adding a third provider before the web regenerates types.
    const exotic = { ...value(), source: "noaa" } as unknown as MarineValue;
    const groups = buildMarineVintage([value(), exotic]);

    expect(groups.map((group) => String(group.source))).toEqual(["ecmwf", "noaa"]);
  });
});

describe("buildMarineVintage — a künye may never overstate freshness", () => {
  it("reports the OLDEST validAtUtc across a group", () => {
    const groups = buildMarineVintage([
      value({ validAtUtc: "2026-08-02T12:00:00.000Z" }),
      value({ validAtUtc: "2026-08-02T09:00:00.000Z" }),
      value({ validAtUtc: "2026-08-02T15:00:00.000Z" }),
    ]);

    expect(iso(groups[0]?.validAt ?? null)).toBe("2026-08-02T09:00:00.000Z");
  });

  it("reports the OLDEST modelRunAtUtc across a group", () => {
    const groups = buildMarineVintage([
      value({ modelRunAtUtc: "2026-08-02T12:00:00.000Z" }),
      value({ modelRunAtUtc: "2026-08-02T00:00:00.000Z" }),
    ]);

    expect(iso(groups[0]?.modelRunAt ?? null)).toBe("2026-08-02T00:00:00.000Z");
  });

  it("collapses to the exact instant when the whole group agrees", () => {
    const groups = buildMarineVintage([value(), value(), value()]);

    expect(iso(groups[0]?.validAt ?? null)).toBe("2026-08-02T12:00:00.000Z");
    expect(iso(groups[0]?.modelRunAt ?? null)).toBe("2026-08-02T06:00:00.000Z");
  });

  it("a present instant beats an absent one rather than nulling the whole group", () => {
    const groups = buildMarineVintage([
      value({ modelRunAtUtc: null }),
      value({ modelRunAtUtc: "2026-08-02T06:00:00.000Z" }),
    ]);

    expect(iso(groups[0]?.modelRunAt ?? null)).toBe("2026-08-02T06:00:00.000Z");
  });
});

describe("buildMarineVintage — null is omitted, never filled", () => {
  it("leaves modelRunAt null for a provider that publishes none (CMEMS)", () => {
    const groups = buildMarineVintage([value({ source: "cmems", modelRunAtUtc: null })]);

    expect(groups[0]?.modelRunAt).toBeNull();
    expect(groups[0]?.validAt).not.toBeNull();
  });

  it("drops a value with no parseable instant at all", () => {
    expect(buildMarineVintage([value({ validAtUtc: null, modelRunAtUtc: null })])).toEqual([]);
  });

  it("drops an unparseable instant instead of rendering an Invalid Date", () => {
    const groups = buildMarineVintage([value({ validAtUtc: "not-a-date" })]);

    expect(groups[0]?.validAt).toBeNull();
    expect(iso(groups[0]?.modelRunAt ?? null)).toBe("2026-08-02T06:00:00.000Z");
  });
});

describe("buildMarineVintage — only values a reader can see carry a künye", () => {
  it.each(["no_data", "not_supported", "unavailable"] as const)("skips a %s value", (status) => {
    expect(buildMarineVintage([value({ status, value: null, freshness: null })])).toEqual([]);
  });

  it("skips a value the payload attributes to no provider", () => {
    expect(buildMarineVintage([value({ source: null })])).toEqual([]);
  });

  it("still counts a STALE value — it is on screen, marked, and has a künye", () => {
    const groups = buildMarineVintage([
      value({ freshness: "stale", staleSinceUtc: "2026-08-02T10:00:00.000Z" }),
    ]);

    expect(groups).toHaveLength(1);
  });

  it("returns an empty list when nothing qualifies, so no empty line is rendered", () => {
    expect(buildMarineVintage([])).toEqual([]);
  });
});

describe("oldestValidAt — one instant a row may honestly claim", () => {
  it("returns the oldest instant across providers", () => {
    const oldest = oldestValidAt([
      value({ source: "ecmwf", validAtUtc: "2026-08-02T12:00:00.000Z" }),
      value({ source: "cmems", validAtUtc: "2026-08-02T06:00:00.000Z", modelRunAtUtc: null }),
    ]);

    expect(iso(oldest)).toBe("2026-08-02T06:00:00.000Z");
  });

  it("returns null when nothing visible carries an instant", () => {
    expect(oldestValidAt([])).toBeNull();
    expect(oldestValidAt([value({ status: "no_data", value: null, freshness: null })])).toBeNull();
  });

  it("ignores a group that only has a run time", () => {
    expect(oldestValidAt([value({ validAtUtc: null })])).toBeNull();
  });
});

describe("maxGridDistanceKm — a bound, never a warning", () => {
  it("returns the largest offset among visible values", () => {
    expect(maxGridDistanceKm([value({ distanceKm: 1.2 }), value({ distanceKm: 4.8 })])).toBe(4.8);
  });

  it("ignores values nobody can see", () => {
    expect(
      maxGridDistanceKm([
        value({ status: "no_data", value: null, freshness: null, distanceKm: 99 }),
        value({ distanceKm: 1.2 }),
      ]),
    ).toBe(1.2);
  });

  it("returns null when no value reports an offset", () => {
    expect(maxGridDistanceKm([value({ distanceKm: null })])).toBeNull();
    expect(maxGridDistanceKm([])).toBeNull();
  });

  it("ignores a non-finite offset rather than printing NaN", () => {
    expect(maxGridDistanceKm([value({ distanceKm: Number.NaN })])).toBeNull();
  });

  it("keeps a genuine zero offset", () => {
    expect(maxGridDistanceKm([value({ distanceKm: 0 })])).toBe(0);
  });
});

describe("marineBlockValues", () => {
  it("flattens a block into its five values, directions included", () => {
    const block = {
      seaSurfaceTemperature: value({ unit: "celsius" }),
      waveHeight: value({ unit: "m" }),
      waveDirection: value({ unit: "degree_true" }),
      windSpeed10m: value({ unit: "meter_per_second" }),
      windDirection10m: value({ unit: "degree_true" }),
    };

    expect(marineBlockValues(block).map((entry) => entry.unit)).toEqual([
      "celsius",
      "m",
      "degree_true",
      "meter_per_second",
      "degree_true",
    ]);
  });
});
