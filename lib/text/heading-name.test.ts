import { describe, expect, it } from "vitest";
import { headingName, PROVINCE_HEADING_CASE, type ProvinceHeadingSlot } from "./heading-name";

/**
 * Guards the two things the page-level heading logic used to do inline and untested: the
 * TR/EN locale gate (the PR #16 EN-slip regression class) and the per-section case
 * assignment. Structure/invariant tests — the suffix forms themselves are proven in
 * turkish-suffix.test.ts.
 */
describe("headingName — locale gate", () => {
  it("applies the Turkish suffix for TR", () => {
    expect(headingName("tr", "Antalya", "genitive")).toBe("Antalya'nın");
    expect(headingName("tr", "Antalya", "locative")).toBe("Antalya'da");
    expect(headingName("tr", "Kocaeli", "locative")).toBe("Kocaeli'nde");
  });

  it("returns the BARE name for EN — no Turkish suffix ever (PR #16 regression class)", () => {
    expect(headingName("en", "Antalya", "genitive")).toBe("Antalya");
    expect(headingName("en", "Antalya", "locative")).toBe("Antalya");
    expect(headingName("en", "Kocaeli", "locative")).toBe("Kocaeli");
  });
});

describe("PROVINCE_HEADING_CASE — per-section mapping", () => {
  it("assigns the intended genitive/locative split (3 + 3)", () => {
    expect(PROVINCE_HEADING_CASE.landform).toBe("genitive");
    expect(PROVINCE_HEADING_CASE.hydrography).toBe("genitive");
    expect(PROVINCE_HEADING_CASE.neighbors).toBe("genitive");
    expect(PROVINCE_HEADING_CASE.climate).toBe("locative");
    expect(PROVINCE_HEADING_CASE.settlement).toBe("locative");
    expect(PROVINCE_HEADING_CASE.economy).toBe("locative");
  });

  it("covers exactly the six §19 slots and only genitive/locative values", () => {
    const slots = Object.keys(PROVINCE_HEADING_CASE) as ProvinceHeadingSlot[];
    expect(slots).toHaveLength(6);
    for (const slot of slots) {
      expect(["genitive", "locative"]).toContain(PROVINCE_HEADING_CASE[slot]);
    }
  });
});
