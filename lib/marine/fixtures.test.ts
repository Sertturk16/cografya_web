import { describe, expect, it } from "vitest";
import type { MarineLayer, MarineOverview, MarineValue } from "@/lib/api/types";
import coldBootFixture from "@/test/fixtures/marine/overview-cold-boot.json";
import overviewFixture from "@/test/fixtures/marine/overview.json";
import twoPointFixture from "@/test/fixtures/marine/province-conditions-two-point.json";
import { marineDirectionView } from "./direction";
import { buildMarineVintage, marineBlockValues, maxGridDistanceKm, oldestValidAt } from "./vintage";
import { marineValueView } from "./value-state";

/**
 * THE FIXTURE CORPUS AND ITS COVERAGE PROMISE.
 *
 * `/api/marine/overview` answers 404 until M4, so the whole value band was built against
 * these files. They are derived by hand from the FROZEN OpenAPI schema — every field of
 * `MarineValueDto` is present in every value, never omitted — and from the real thirty-point
 * list, so the shapes are the ones the api will actually send.
 *
 * They are committed rather than left in a scratch directory for one reason: they are the
 * only place the degraded renders exist until a provider actually degrades. A screenshot of
 * "what a stale Marmara looks like" is worth nothing if the payload behind it cannot be
 * reproduced six weeks later.
 *
 * THIS FILE IS WHAT KEEPS THEM HONEST. A fixture nothing reads rots silently, so the corpus
 * is asserted here to still contain every state it claims to cover, and the pure helpers are
 * run end-to-end over it. STRUCTURAL ONLY (`CONVENTIONS.md` §2): no assertion says a wave is
 * 0.8 m anywhere, only that each render path is exercised by something.
 *
 * The typing is a deliberate `as`: these are hand-authored payloads standing in for an api
 * response, and the compiler checking them against the contract type is exactly the guard
 * that catches a fixture drifting away from the schema it was derived from.
 */

const overview = overviewFixture as MarineOverview;
const coldBoot = coldBootFixture as MarineOverview;

const everyValue: MarineValue[] = overview.points.flatMap(marineBlockValues);

describe("overview fixture — the corpus covers every render", () => {
  it("carries all thirty reference points across all four seas", () => {
    expect(overview.points).toHaveLength(30);
    expect(new Set(overview.points.map((block) => block.point.seaBasin)).size).toBe(4);
  });

  it("is publishable (dataAvailable), so the band renders from it", () => {
    expect(overview.dataAvailable).toBe(true);
  });

  it.each(["ok", "no_data", "not_supported", "unavailable"] as const)(
    "contains at least one %s value",
    (status) => {
      expect(everyValue.some((value) => value.status === status)).toBe(true);
    },
  );

  it("contains at least one stale value AND one fresh value", () => {
    expect(everyValue.some((value) => value.freshness === "stale")).toBe(true);
    expect(everyValue.some((value) => value.freshness === "fresh")).toBe(true);
  });

  it("produces all five distinguishable renders", () => {
    const renders = new Set(
      everyValue.map((value) => {
        const view = marineValueView(value);
        return view.kind === "value" ? (view.stale ? "value:stale" : "value:fresh") : view.status;
      }),
    );

    expect(renders).toEqual(
      new Set(["value:fresh", "value:stale", "noData", "notSupported", "unavailable"]),
    );
  });

  it("keeps the Marmara's wave fields permanently unsupported, not merely empty", () => {
    // The one product truth the five-render rule exists for: CMEMS carries no wave field in
    // the Marmara at all, so it must never render like a transient gap.
    const marmara = overview.points.filter((block) => block.point.seaBasin === "marmara");
    expect(marmara.length).toBeGreaterThan(0);
    for (const block of marmara) {
      expect(block.waveHeight.status).toBe("not_supported");
      expect(block.waveDirection.status).toBe("not_supported");
    }
  });

  it("never carries a value alongside a non-ok status, or a freshness without one", () => {
    // The contract's own invariants, asserted against the fixtures so a hand-edited payload
    // cannot quietly teach the components to expect an impossible shape.
    for (const value of everyValue) {
      if (value.status === "ok") continue;
      expect(value.value).toBeNull();
      expect(value.freshness).toBeNull();
    }
  });
});

describe("overview fixture — the direction gate is exercised in every branch", () => {
  /** A catalogue row carrying the two fields the gate reads; the rest is contract padding. */
  function layer(overrides: Pick<MarineLayer, "id" | "calmThreshold" | "directionConvention">) {
    return {
      labelTr: "Fixture",
      labelEn: "Fixture",
      unit: "m",
      primarySource: "cmems",
      fallbackSource: null,
      stepHours: 3,
      horizonEndUtc: null,
      updateFrequency: null,
      catalogueUpdatedAtUtc: null,
      colorStops: [],
      attributionId: "cmems",
      ...overrides,
    } satisfies MarineLayer;
  }

  // The thresholds and conventions the shadow api publishes today. Written out here rather
  // than read from a live catalogue so the corpus stays reproducible offline.
  const waveHeight = layer({ id: "wave_height", calmThreshold: 0.1, directionConvention: null });
  const waveDirection = layer({
    id: "wave_direction",
    calmThreshold: null,
    directionConvention: "from",
  });
  const windSpeed = layer({ id: "wind_speed_10m", calmThreshold: 0.5, directionConvention: null });
  const windDirection = layer({
    id: "wind_direction_10m",
    calmThreshold: null,
    directionConvention: "from",
  });

  const views = overview.points.flatMap((block) => [
    marineDirectionView({
      magnitude: block.windSpeed10m,
      magnitudeLayer: windSpeed,
      direction: block.windDirection10m,
      directionLayer: windDirection,
    }),
    marineDirectionView({
      magnitude: block.waveHeight,
      magnitudeLayer: waveHeight,
      direction: block.waveDirection,
      directionLayer: waveDirection,
    }),
  ]);

  it("draws arrows, shows calm, and stays silent — all three, from one payload", () => {
    expect(new Set(views.map((view) => view.kind))).toEqual(new Set(["arrow", "calm", "none"]));
  });

  it("puts every arrow's rotation inside [0,360)", () => {
    for (const view of views) {
      if (view.kind !== "arrow") continue;
      expect(view.rotationDeg).toBeGreaterThanOrEqual(0);
      expect(view.rotationDeg).toBeLessThan(360);
    }
  });
});

describe("overview fixture — the künye is derivable from it", () => {
  it("groups into one line per provider", () => {
    const groups = buildMarineVintage(everyValue);

    expect(groups.length).toBeGreaterThan(1);
    expect(new Set(groups.map((group) => group.source)).size).toBe(groups.length);
  });

  it("gives every row an instant and at least one row a grid offset", () => {
    const rows = overview.points.map(marineBlockValues);

    for (const row of rows) expect(oldestValidAt(row)).not.toBeNull();
    expect(rows.some((row) => maxGridDistanceKm(row) !== null)).toBe(true);
  });
});

describe("cold-boot fixture — the contract's do-not-publish signal", () => {
  it("is a 200-shaped payload with no points and dataAvailable false", () => {
    expect(coldBoot.dataAvailable).toBe(false);
    expect(coldBoot.points).toEqual([]);
  });
});

describe("two-point province fixture — the locked two-point policy, as data", () => {
  const province = twoPointFixture as {
    plateCode: string;
    marinePoints: { point: { seaBasin: string }; waveHeight: MarineValue }[];
  };

  it("carries two entries for one plaka, on two different seas", () => {
    expect(province.marinePoints).toHaveLength(2);
    expect(new Set(province.marinePoints.map((entry) => entry.point.seaBasin)).size).toBe(2);
  });

  it("lets the two disagree — one carries a wave reading, the other cannot", () => {
    // The binding policy: two points of one province are NEVER filled from each other, and a
    // province is never suppressed because one of its points is short of data. Encoded here
    // as a fixture invariant so W2b inherits it as a fact rather than as a paragraph.
    const statuses = province.marinePoints.map((entry) => entry.waveHeight.status);
    expect(new Set(statuses).size).toBe(2);
  });
});
