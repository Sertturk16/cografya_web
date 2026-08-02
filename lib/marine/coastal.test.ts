import { describe, expect, it } from "vitest";
import type {
  MarineConditions,
  MarinePointListItem,
  MarineProvinceConditions,
} from "@/lib/api/types";
import singlePointFixture from "@/test/fixtures/marine/province-conditions-single-point.json";
import twoPointFixture from "@/test/fixtures/marine/province-conditions-two-point.json";
import {
  coastalPlateCodes,
  isCoastalPlate,
  provinceMarineBlocks,
  provinceShowsMarine,
} from "./coastal";

/**
 * The coastal gate and the province publish signal — structural only
 * (`CONVENTIONS.md` §2). Nothing here asserts WHICH provinces have a coast: that is a
 * geographic fact, it lives in the api, and a test that pinned the twenty-seven codes would
 * be the second source this module exists to avoid.
 */

/** A point carrying only the fields the gate reads; the rest is contract padding. */
function point(overrides: Pick<MarinePointListItem, "slugTr" | "plateCode">): MarinePointListItem {
  return {
    slugEn: overrides.slugTr,
    nameTr: "Fixture",
    nameEn: "Fixture",
    coastLabelTr: "Fixture açıkları",
    coastLabelEn: "Fixture offshore",
    latitude: 41,
    longitude: 29,
    seaBasin: "black_sea",
    displayOrder: 1,
    ...overrides,
  };
}

describe("coastalPlateCodes — the coastal set is derived, never listed", () => {
  it("returns one entry per distinct plaka", () => {
    const codes = coastalPlateCodes([
      point({ slugTr: "a", plateCode: "57" }),
      point({ slugTr: "b", plateCode: "35" }),
    ]);

    expect(codes).toEqual(new Set(["57", "35"]));
  });

  it("counts a two-point province ONCE", () => {
    // İstanbul, Çanakkale and Balıkesir each publish two points. The question this set
    // answers is "has a coast", not "how many points" — 30 points, 27 plakas.
    const codes = coastalPlateCodes([
      point({ slugTr: "istanbul-karadeniz-aciklari", plateCode: "34" }),
      point({ slugTr: "istanbul-marmara-aciklari", plateCode: "34" }),
    ]);

    expect(codes.size).toBe(1);
    expect(codes.has("34")).toBe(true);
  });

  it("is empty for an empty point list", () => {
    expect(coastalPlateCodes([])).toEqual(new Set());
  });
});

describe("isCoastalPlate — the gate that decides whether a /conditions call happens", () => {
  const points = [point({ slugTr: "sinop-aciklari", plateCode: "57" })];

  it.each([
    ["a plaka in the point set", "57", true],
    ["a plaka that is not", "42", false],
  ] as const)("%s → %s", (_label, plateCode, expected) => {
    expect(isCoastalPlate(points, plateCode)).toBe(expected);
  });

  it("gates EVERY province off when the point list could not be read", () => {
    // The fail-soft points read answers `[]` on an outage. "We cannot tell which provinces
    // have a coast" must mean no section — never a section assembled from a guess.
    expect(isCoastalPlate([], "57")).toBe(false);
  });

  it("matches on the plaka string exactly, with no numeric coercion", () => {
    // Plakas are zero-padded strings in the contract ("08"), and "8" is a different province
    // page's parameter, not the same one written differently.
    expect(isCoastalPlate([point({ slugTr: "a", plateCode: "08" })], "8")).toBe(false);
  });
});

describe("provinceMarineBlocks / provinceShowsMarine — ONE publish signal", () => {
  const twoPoint = twoPointFixture as MarineProvinceConditions;
  const singlePoint = singlePointFixture as MarineProvinceConditions;

  /** A payload shaped like the contract's, with the block list swapped out. */
  function conditions(marinePoints: MarineConditions[]): MarineProvinceConditions {
    return { plateCode: "57", marinePoints, attributions: [] };
  }

  it("treats the fail-soft null as no blocks, not as no sea", () => {
    expect(provinceMarineBlocks(null)).toEqual([]);
    expect(provinceShowsMarine(null)).toBe(false);
  });

  it("treats an empty block list as nothing to publish", () => {
    expect(provinceShowsMarine(conditions([]))).toBe(false);
  });

  it("publishes a one-block and a two-block province alike", () => {
    expect(provinceShowsMarine(singlePoint)).toBe(true);
    expect(provinceShowsMarine(twoPoint)).toBe(true);
    expect(provinceMarineBlocks(twoPoint)).toHaveLength(2);
  });

  it("passes the api's blocks through in order, adding and removing nothing", () => {
    // The section renders `displayOrder` as the api sent it; a helper that sorted, filtered
    // or deduplicated here would be a second opinion about the coastal traverse.
    expect(provinceMarineBlocks(twoPoint)).toEqual(twoPoint.marinePoints);
  });

  it("keeps the boolean and the list in agreement by construction", () => {
    // The O1 lesson: the section and the licence block read ONE answer. Asserted as an
    // invariant over every shape this module can be handed.
    for (const input of [null, conditions([]), singlePoint, twoPoint]) {
      expect(provinceShowsMarine(input)).toBe(provinceMarineBlocks(input).length > 0);
    }
  });
});
