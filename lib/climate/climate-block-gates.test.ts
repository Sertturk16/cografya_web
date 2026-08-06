import { describe, expect, it } from "vitest";
import { climateBlockGates, type ClimateBlockInput } from "./climate-block-gates";

/**
 * The climate block's gating rules (→ PR #47 review TA47-M1; `citeCurriculumSource` →
 * WEB-KOPPEN plan §5).
 *
 * Structural only (`CONVENTIONS.md` §2): every case below is about which parts of the block
 * render for a given SHAPE of data. No case asserts a geographic fact.
 */

const base: ClimateBlockInput = {
  isTr: true,
  hasClimateClass: false,
  hasClimateSeries: false,
  hasSimilarClimate: false,
  hasCurriculumName: false,
};

const gates = (over: Partial<ClimateBlockInput>) => climateBlockGates({ ...base, ...over });

describe("climateBlockGates", () => {
  it("renders nothing at all when the province has no climate content", () => {
    expect(gates({})).toEqual({
      showSection: false,
      showClass: false,
      citeClassSource: false,
      citeCurriculumSource: false,
    });
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
        citeCurriculumSource: false,
      });
    });

    it("suppresses the whole block on EN even with a curriculum name", () => {
      expect(gates({ hasClimateClass: true, hasCurriculumName: true, isTr: false })).toEqual({
        showSection: false,
        showClass: false,
        citeClassSource: false,
        citeCurriculumSource: false,
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

  describe("the curriculum-name source citation (WEB-KOPPEN plan §5)", () => {
    it("cites the MEB curriculum source only when a class line renders AND a name exists", () => {
      expect(gates({ hasClimateClass: true, hasCurriculumName: true }).citeCurriculumSource).toBe(
        true,
      );
    });

    it("does NOT cite the MEB source when the value line falls back to code-only", () => {
      // Contract-legal null-name branch (plan §3 V-1): the value line still renders
      // ("Köppen: <kod>" only), but nothing MEB-sourced is on the page.
      expect(gates({ hasClimateClass: true, hasCurriculumName: false }).citeCurriculumSource).toBe(
        false,
      );
    });

    it("does NOT cite the MEB source when the class line itself does not render", () => {
      // A curriculum name with no class/Köppen code at all is not a real api shape today, but
      // the gate must not cite a source for a line that never renders regardless.
      expect(
        gates({ hasClimateClass: false, hasCurriculumName: true, hasClimateSeries: true })
          .citeCurriculumSource,
      ).toBe(false);
    });

    it("never cites the curriculum source on EN", () => {
      expect(
        gates({ hasClimateClass: true, hasCurriculumName: true, isTr: false }).citeCurriculumSource,
      ).toBe(false);
    });
  });
});
