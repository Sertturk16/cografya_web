import { describe, expect, it } from "vitest";
import type { MarineValue } from "@/lib/api/types";
import {
  MARINE_VALUE_STATUS_KEY,
  hasNumber,
  marineValueView,
  type MarineValueStatusKind,
} from "./value-state";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Not one assertion here says what a wave height, a
 * wind speed or a sea temperature IS — every number below is an arbitrary synthetic input
 * whose only job is to be distinguishable from the next one. What is under test is the
 * classification contract: which of the five renders a given (status, freshness, value)
 * triple produces, including the triples the contract says cannot occur.
 */

/** A synthetic value. Defaults describe the ordinary case; each test overrides its axis. */
function value(overrides: Partial<MarineValue> = {}): MarineValue {
  return {
    value: 12.3,
    unit: "celsius",
    status: "ok",
    freshness: "fresh",
    validAtUtc: "2026-08-02T12:00:00.000Z",
    fetchedAtUtc: "2026-08-02T12:04:00.000Z",
    modelRunAtUtc: "2026-08-02T06:00:00.000Z",
    staleSinceUtc: null,
    source: "cmems",
    datasetId: null,
    gridLatitude: null,
    gridLongitude: null,
    distanceKm: null,
    ...overrides,
  };
}

describe("marineValueView — the four statuses × two freshnesses", () => {
  it("ok + fresh renders the number, unmarked", () => {
    const view = marineValueView(value({ status: "ok", freshness: "fresh", value: 7.5 }));

    expect(view).toMatchObject({ kind: "value", value: 7.5, stale: false });
  });

  it("ok + stale renders the number AND the stale instant", () => {
    const view = marineValueView(
      value({ status: "ok", freshness: "stale", staleSinceUtc: "2026-08-02T09:00:00.000Z" }),
    );

    expect(view).toMatchObject({
      kind: "value",
      stale: true,
      staleSinceUtc: "2026-08-02T09:00:00.000Z",
    });
  });

  it("carries the value's OWN unit through, not a caller-supplied one", () => {
    const view = marineValueView(value({ unit: "meter_per_second", value: 8.4 }));

    expect(view).toMatchObject({ kind: "value", unit: "meter_per_second" });
  });

  it.each([
    ["no_data", "noData"],
    ["not_supported", "notSupported"],
    ["unavailable", "unavailable"],
  ] as const)("%s becomes the distinct %s render", (status, expected) => {
    const view = marineValueView(value({ status, freshness: null, value: null }));

    expect(view).toEqual({ kind: "status", status: expected });
  });

  it("keeps no_data, not_supported and unavailable distinguishable from each other", () => {
    // The whole point of the five-render rule: a permanent product truth (the Marmara has no
    // wave field at all) must not read like a transient gap or like our own outage.
    const kinds = (["no_data", "not_supported", "unavailable"] as const).map((status) => {
      const view = marineValueView(value({ status, freshness: null, value: null }));
      return view.kind === "status" ? view.status : "value";
    });

    expect(new Set(kinds).size).toBe(3);
  });

  it("ignores freshness entirely once the status is not ok", () => {
    // The contract nulls `freshness` off the ok path; a payload that does not must still not
    // produce a "stale no-data".
    const view = marineValueView(value({ status: "no_data", freshness: "stale", value: null }));

    expect(view).toEqual({ kind: "status", status: "noData" });
  });
});

describe("marineValueView — contract-violating input degrades honestly", () => {
  it("ok with a null value is unavailable, not a blank cell", () => {
    expect(marineValueView(value({ status: "ok", value: null }))).toEqual({
      kind: "status",
      status: "unavailable",
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "ok with a non-finite value (%p) is unavailable, never printed",
    (bad) => {
      expect(marineValueView(value({ status: "ok", value: bad }))).toEqual({
        kind: "status",
        status: "unavailable",
      });
    },
  );

  it("a status this build has never heard of degrades to unavailable", () => {
    // The RUNTIME case of the api adding a fifth status before the web regenerates types.
    const exotic = { ...value(), status: "embargoed" } as unknown as MarineValue;

    expect(marineValueView(exotic)).toEqual({ kind: "status", status: "unavailable" });
  });

  it("ok with a null freshness is treated as fresh, never as stale", () => {
    const view = marineValueView(value({ status: "ok", freshness: null }));

    expect(view).toMatchObject({ kind: "value", stale: false });
  });

  it("zero is a value, not an absence", () => {
    // A dead-calm 0.0 m sea must render as a number; falsiness is not nullness.
    expect(marineValueView(value({ status: "ok", value: 0 }))).toMatchObject({
      kind: "value",
      value: 0,
    });
  });
});

describe("the status → message-key map", () => {
  it("covers every status kind the classifier can emit", () => {
    // Derived from the map's own type, so a sixth render cannot be added without its key.
    const kinds: MarineValueStatusKind[] = ["noData", "notSupported", "unavailable"];

    expect(Object.keys(MARINE_VALUE_STATUS_KEY).sort()).toEqual([...kinds].sort());
    for (const key of Object.values(MARINE_VALUE_STATUS_KEY)) {
      expect(key.startsWith("status.")).toBe(true);
    }
  });
});

describe("hasNumber", () => {
  it("narrows a value render and rejects every status render", () => {
    expect(hasNumber(marineValueView(value({ status: "ok", value: 1 })))).toBe(true);
    expect(hasNumber(marineValueView(value({ status: "no_data", value: null })))).toBe(false);
  });
});
