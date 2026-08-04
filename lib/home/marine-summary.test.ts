import { describe, expect, it } from "vitest";
import type {
  MarineOverview,
  MarineOverviewPoint,
  MarinePointListItem,
  MarineValue,
} from "@/lib/api/types";
import { marineShowsValues } from "@/lib/marine/overview";
import { buildMarineHomeSummary, marineScope, marineSummaryShowsValues } from "./marine-summary";

/**
 * The homepage marine digest's contract.
 *
 * SYNTHETIC FIXTURES ONLY (`CONVENTIONS.md` §2, → DEC 2026-07-12). Not one assertion here says
 * anything about the temperature of an actual sea — the invariants are that a non-`ok` value
 * never reaches a number, that an empty cell is unrepresentable, and that this surface can
 * never claim values when `/deniz` would not. Those must hold whatever the providers publish.
 */

let displayOrder = 0;

function point(over: Partial<MarinePointListItem> = {}): MarinePointListItem {
  displayOrder += 1;
  return {
    slugTr: `nokta-${displayOrder}`,
    slugEn: `point-${displayOrder}`,
    nameTr: `Nokta ${displayOrder}`,
    nameEn: `Point ${displayOrder}`,
    coastLabelTr: "A denizi",
    coastLabelEn: "Sea A",
    plateCode: "01",
    latitude: 40,
    longitude: 30,
    seaBasin: "black_sea",
    displayOrder,
    ...over,
  };
}

function value(over: Partial<MarineValue> = {}): MarineValue {
  return {
    value: 20,
    unit: "celsius",
    status: "ok",
    freshness: "fresh",
    validAtUtc: "2026-08-04T06:00:00.000Z",
    fetchedAtUtc: "2026-08-04T06:10:00.000Z",
    modelRunAtUtc: "2026-08-04T00:00:00.000Z",
    staleSinceUtc: null,
    source: "cmems",
    datasetId: "synthetic",
    gridLatitude: 40,
    gridLongitude: 30,
    distanceKm: 1,
    ...over,
  };
}

function block(
  pointOver: Partial<MarinePointListItem>,
  values: Partial<Record<"sst" | "wave", Partial<MarineValue>>> = {},
): MarineOverviewPoint {
  return {
    point: point(pointOver),
    seaSurfaceTemperature: value(values.sst ?? {}),
    waveHeight: value({ unit: "m", value: 0.5, ...(values.wave ?? {}) }),
    waveDirection: value({ unit: "degree_true", value: 180, status: "no_data" }),
    windSpeed10m: value({ unit: "meter_per_second", value: 4, source: "ecmwf" }),
    windDirection10m: value({ unit: "degree_true", value: 200, source: "ecmwf" }),
  };
}

function overview(points: MarineOverviewPoint[], dataAvailable = true): MarineOverview {
  return {
    points,
    generatedAtUtc: "2026-08-04T06:15:00.000Z",
    dataAvailable,
    attributions: [],
  };
}

describe("buildMarineHomeSummary", () => {
  it("is empty for a null payload (outage, or an api that does not serve the route)", () => {
    const summary = buildMarineHomeSummary(null, "tr");

    expect(summary.basins).toEqual([]);
    expect(summary.values).toEqual([]);
    expect(marineSummaryShowsValues(summary)).toBe(false);
  });

  it("honours the contract's dataAvailable publish gate", () => {
    const summary = buildMarineHomeSummary(overview([block({})], false), "tr");

    expect(marineSummaryShowsValues(summary)).toBe(false);
  });

  /**
   * The one-directional implication that keeps the homepage and `/deniz` from disagreeing:
   * whenever `/deniz` would render no values, this surface renders none either. The converse
   * is deliberately NOT asserted — a publishable payload whose every field came back
   * `no_data` passes the `/deniz` gate and correctly yields no card here, which is why the
   * page reads `marineSummaryShowsValues` rather than the overview gate.
   */
  it("never claims values when /deniz would not", () => {
    for (const payload of [null, overview([], true), overview([block({})], false)]) {
      if (marineShowsValues(payload)) continue;
      expect(marineSummaryShowsValues(buildMarineHomeSummary(payload, "tr"))).toBe(false);
    }
  });

  it("takes the median of the ok values only", () => {
    const summary = buildMarineHomeSummary(
      overview([
        block({}, { sst: { value: 10 } }),
        block({}, { sst: { value: 20 } }),
        block({}, { sst: { value: 30 } }),
        // A wildly wrong reading that is NOT ok must not move the median at all.
        block({}, { sst: { value: 999, status: "unavailable" } }),
      ]),
      "tr",
    );

    expect(summary.basins[0]?.seaSurfaceTemperature).toMatchObject({
      median: 20,
      pointCount: 3,
      unit: "celsius",
    });
  });

  it("treats not_supported and no_data alike here — both simply absent, never a dash", () => {
    for (const status of ["not_supported", "no_data"] as const) {
      const summary = buildMarineHomeSummary(
        overview([block({}, { wave: { status, value: null } })]),
        "tr",
      );

      expect(summary.basins[0]?.waveHeight).toBeNull();
      // The card still exists, because its OTHER quantity does.
      expect(summary.basins[0]?.seaSurfaceTemperature).not.toBeNull();
    }
  });

  it("prints NO card for a basin with nothing usable (an empty cell is unrepresentable)", () => {
    const summary = buildMarineHomeSummary(
      overview([
        block(
          { seaBasin: "aegean", coastLabelTr: "B denizi" },
          { sst: { status: "no_data", value: null }, wave: { status: "no_data", value: null } },
        ),
        block({ seaBasin: "black_sea", coastLabelTr: "A denizi" }),
      ]),
      "tr",
    );

    expect(summary.basins.map((basin) => basin.basin)).toEqual(["black_sea"]);
  });

  it("orders basins by the api's coastal traverse and labels them from the payload", () => {
    const summary = buildMarineHomeSummary(
      overview([
        block({
          seaBasin: "mediterranean",
          coastLabelTr: "Geç",
          coastLabelEn: "Late",
          displayOrder: 90,
        }),
        block({
          seaBasin: "black_sea",
          coastLabelTr: "Erken",
          coastLabelEn: "Early",
          displayOrder: 2,
        }),
      ]),
      "tr",
    );

    // Input order is Akdeniz-then-Karadeniz; the traverse decides, and it says otherwise.
    expect(summary.basins.map((basin) => basin.label)).toEqual(["Erken", "Geç"]);
  });

  it("labels in the render locale", () => {
    const payload = overview([block({ coastLabelTr: "Türkçe", coastLabelEn: "English" })]);

    expect(buildMarineHomeSummary(payload, "tr").basins[0]?.label).toBe("Türkçe");
    expect(buildMarineHomeSummary(payload, "en").basins[0]?.label).toBe("English");
  });

  it("hands the künye exactly the values that fed a printed number", () => {
    const summary = buildMarineHomeSummary(
      overview([block({}, { wave: { status: "not_supported", value: null } })]),
      "tr",
    );

    // Two quantities are digested; only one produced a number, so only its value may speak.
    expect(summary.values).toHaveLength(1);
    expect(summary.values.every((entry) => entry.status === "ok")).toBe(true);
  });

  it("abandons a quantity whose values disagree about their unit", () => {
    const summary = buildMarineHomeSummary(
      overview([
        block({}, { sst: { value: 10, unit: "celsius" } }),
        block({}, { sst: { value: 20, unit: "m" } }),
      ]),
      "tr",
    );

    expect(summary.basins[0]?.seaSurfaceTemperature).toBeNull();
  });
});

describe("marineScope", () => {
  it("counts basins, points and provinces from the payload", () => {
    const scope = marineScope([
      point({ seaBasin: "black_sea", plateCode: "55" }),
      point({ seaBasin: "black_sea", plateCode: "61" }),
      // Two points published under ONE province must count as one province.
      point({ seaBasin: "marmara", plateCode: "34" }),
      point({ seaBasin: "marmara", plateCode: "34" }),
    ]);

    expect(scope).toEqual({ basinCount: 2, pointCount: 4, provinceCount: 3 });
  });

  it("returns zeroes for an empty list so the caller can fall back", () => {
    expect(marineScope([])).toEqual({ basinCount: 0, pointCount: 0, provinceCount: 0 });
  });
});
