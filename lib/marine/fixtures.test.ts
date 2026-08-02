import { describe, expect, it } from "vitest";
import type {
  MarineLayer,
  MarineOverview,
  MarineProvinceConditions,
  MarineValue,
} from "@/lib/api/types";
import notPublishableFixture from "@/test/fixtures/marine/overview-not-publishable.json";
import overviewFixture from "@/test/fixtures/marine/overview.json";
import singlePointFixture from "@/test/fixtures/marine/province-conditions-single-point.json";
import twoPointFixture from "@/test/fixtures/marine/province-conditions-two-point.json";
import { marineDirectionView } from "./direction";
import { buildMarineVintage, marineBlockValues, maxGridDistanceKm, oldestValidAt } from "./vintage";
import { hasNumber, marineValueView } from "./value-state";

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
 * that catches a fixture drifting away from the schema it was derived from. Every fixture is
 * cast to the REAL contract alias, including the province one whose route the web does not
 * consume until W2b — a cast to a hand-rolled two-field shape would have advertised that
 * guard without providing it.
 */

const overview = overviewFixture as MarineOverview;
const notPublishable = notPublishableFixture as MarineOverview;

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

  it("carries BOTH halves of a broken wind pair, in both directions", () => {
    // A wind pair is two independent values and they diverge upstream (M4b flagged exactly
    // this on the ECMWF side). Two different renders follow, and the corpus has to hold both
    // or its coverage promise is only half true:
    //
    //   magnitude present, direction absent → the speed renders, its bearing reports itself;
    //   direction present, magnitude absent → the cell prints the magnitude's status word
    //                                         ALONE and the orphaned bearing is swallowed,
    //                                         because an angle with nothing travelling along
    //                                         it is not a fact a reader can use.
    //
    // The second was missing until the PR #36 review; nothing else in the corpus reaches the
    // early return in `ValueCell` with a live bearing sitting behind it.
    const magnitudeWithoutDirection = overview.points.some(
      (block) =>
        hasNumber(marineValueView(block.windSpeed10m)) &&
        !hasNumber(marineValueView(block.windDirection10m)),
    );
    const directionWithoutMagnitude = overview.points.some(
      (block) =>
        hasNumber(marineValueView(block.windDirection10m)) &&
        !hasNumber(marineValueView(block.windSpeed10m)),
    );

    expect(magnitudeWithoutDirection).toBe(true);
    expect(directionWithoutMagnitude).toBe(true);
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

describe("not-publishable fixture — the contract's do-not-publish signal", () => {
  /**
   * WHAT THIS FIXTURE IS, AND WHAT IT IS NOT (it was called `overview-cold-boot` until the
   * PR #36 review, and the name was doing the misleading).
   *
   * It is the `dataAvailable: false` PUBLISH GATE: the api telling the page not to commit
   * this render at all. That is the state the band's outermost branch keys on, and the only
   * state this file exercises.
   *
   * A genuinely cold api cache looks nothing like it. Live verification on 2026-08-02
   * produced one (`Owner's Inbox/w2-deniz-degerler/w2a-live-samples/`, frames 07–08): all
   * thirty blocks present, wind and waves still `ok` from Postgres, sea surface temperature
   * `unavailable` across the board. That shape is covered by the main corpus above, which
   * carries every non-ok status on real blocks — not here.
   */
  it("is a 200-shaped payload with no points and dataAvailable false", () => {
    expect(notPublishable.dataAvailable).toBe(false);
    expect(notPublishable.points).toEqual([]);
  });
});

describe("two-point province fixture — the locked two-point policy, as data", () => {
  const province = twoPointFixture as MarineProvinceConditions;

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

  it("labels each block by its own sea, and never by the province name", () => {
    // `coastLabel*` is what the two `<h3>`s render. If both blocks carried the same label the
    // section would show two identical headings over two different sets of numbers, which is
    // the two-point policy failing visibly rather than in the data.
    const labels = province.marinePoints.map((entry) => entry.point.coastLabelTr);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.trim().length).toBeGreaterThan(0);
  });

  it("keeps the two blocks' künye independent", () => {
    // Each block prints its OWN künye. The Marmara point's wave fields carry no timestamps at
    // all (`not_supported`), so a section-wide line would have to speak for a point that has
    // nothing to say.
    for (const entry of province.marinePoints) {
      expect(buildMarineVintage(marineBlockValues(entry)).length).toBeGreaterThan(0);
    }
  });
});

describe("single-point province fixture — the degraded province render", () => {
  /**
   * The other half of the province corpus. The two-point fixture proves independence; this
   * one proves a SINGLE province block can carry every degraded state at once, which is what
   * a reader actually meets when a provider is having a bad afternoon:
   *
   *   wind      → a real number and a drawn arrow
   *   wave      → a real number, STALE, with the instant it stopped refreshing
   *   wave dir  → `no_data` — covered here, nothing right now
   *   sea temp  → `unavailable` — we cannot reach the source
   *
   * Together with the two-point fixture's permanent `not_supported`, the province surface's
   * corpus covers all five renders without a single fact literal.
   */
  const province = singlePointFixture as MarineProvinceConditions;
  const block = province.marinePoints[0];

  it("carries exactly one block, so no sub-heading layer is opened", () => {
    expect(province.marinePoints).toHaveLength(1);
  });

  it("holds a value, a stale value, a no_data and an unavailable in ONE block", () => {
    expect(block).toBeDefined();
    if (block === undefined) return;

    const renders = new Set(
      marineBlockValues(block).map((value) => {
        const view = marineValueView(value);
        return view.kind === "value" ? (view.stale ? "value:stale" : "value:fresh") : view.status;
      }),
    );

    expect(renders).toEqual(new Set(["value:fresh", "value:stale", "noData", "unavailable"]));
  });

  it("still produces a künye — a degraded block does not lose its provenance", () => {
    expect(block).toBeDefined();
    if (block === undefined) return;

    expect(oldestValidAt(marineBlockValues(block))).not.toBeNull();
    expect(maxGridDistanceKm(marineBlockValues(block))).not.toBeNull();
  });

  it("never carries a value alongside a non-ok status, or a freshness without one", () => {
    expect(block).toBeDefined();
    if (block === undefined) return;

    for (const value of marineBlockValues(block)) {
      if (value.status === "ok") continue;
      expect(value.value).toBeNull();
      expect(value.freshness).toBeNull();
    }
  });
});
