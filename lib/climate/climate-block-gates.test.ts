import { describe, expect, it } from "vitest";
import { climateBlockGates, type ClimateBlockInput } from "./climate-block-gates";

/**
 * The climate block's gating rules (→ PR #47 review TA47-M1).
 *
 * Structural only (`CONVENTIONS.md` §2): every case below is about which parts of the block
 * render for a given SHAPE of data. No case asserts a geographic fact.
 */

const base: ClimateBlockInput = {
  isTr: true,
  hasClimateClass: false,
  hasClimateSeries: false,
  hasSimilarClimate: false,
};

const gates = (over: Partial<ClimateBlockInput>) => climateBlockGates({ ...base, ...over });

describe("climateBlockGates", () => {
  it("renders nothing at all when the province has no climate content", () => {
    expect(gates({})).toEqual({ showSection: false, showClass: false, citeClassSource: false });
  });

  it.each([
    ["a class", { hasClimateClass: true }],
    ["a series", { hasClimateSeries: true }],
    ["similar-climate links", { hasSimilarClimate: true }],
  ])("opens the section for %s alone, so the block always has a heading", (_label, over) => {
    expect(gates(over).showSection).toBe(true);
  });

  it("shows the class line only when a class actually exists", () => {
    expect(gates({ hasClimateClass: true }).showClass).toBe(true);
    // A province with only a chart, or only cross-links, still gets the section — but there is
    // no classification to print, and printing one would be inventing it.
    expect(gates({ hasClimateSeries: true }).showClass).toBe(false);
    expect(gates({ hasSimilarClimate: true }).showClass).toBe(false);
  });

  describe("the EN gate", () => {
    it.each([
      ["class", { hasClimateClass: true }],
      ["series", { hasClimateSeries: true }],
      ["similar climate", { hasSimilarClimate: true }],
      ["everything", { hasClimateClass: true, hasClimateSeries: true, hasSimilarClimate: true }],
    ])("suppresses the whole block on EN even with %s", (_label, over) => {
      expect(gates({ ...over, isTr: false })).toEqual({
        showSection: false,
        showClass: false,
        citeClassSource: false,
      });
    });
  });

  describe("the source citation (UX tour B5)", () => {
    it("cites MGM's classification exactly when the class line renders", () => {
      // The defect: the base `sources` sentence claimed the classification unconditionally, so
      // every EN province page cited a section the isTr gate never renders.
      for (const over of [
        {},
        { hasClimateClass: true },
        { hasClimateSeries: true },
        { hasSimilarClimate: true },
        { hasClimateClass: true, isTr: false },
        { hasClimateClass: true, hasClimateSeries: true, hasSimilarClimate: true },
        { hasClimateClass: true, hasClimateSeries: true, isTr: false },
      ]) {
        const result = gates(over);
        expect(result.citeClassSource, JSON.stringify(over)).toBe(result.showClass);
      }
    });

    it("never cites the classification on EN", () => {
      expect(gates({ hasClimateClass: true, isTr: false }).citeClassSource).toBe(false);
    });
  });
});
