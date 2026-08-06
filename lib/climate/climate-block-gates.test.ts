import { describe, expect, it } from "vitest";
import { climateBlockGates, type ClimateBlockInput } from "./climate-block-gates";

/**
 * The climate block's gating rules (→ PR #47 review TA47-M1; `citeCurriculumSource` →
 * WEB-KOPPEN plan §5; `hasClimateNote`/I4 fix and `showCurriculumNote` extraction →
 * PR #51 review).
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
  // Defaults to `true` (the caveat present) so every PRE-EXISTING case below keeps testing
  // only the dimension it names — flipping it to `false` is its own dimension, covered in
  // "the curriculum-name source citation" below (PR #51 review I4).
  hasClimateNote: true,
  hasCurriculumNoteText: false,
};

const gates = (over: Partial<ClimateBlockInput>) => climateBlockGates({ ...base, ...over });

describe("climateBlockGates", () => {
  it("renders nothing at all when the province has no climate content", () => {
    expect(gates({})).toEqual({
      showSection: false,
      showClass: false,
      citeClassSource: false,
      citeCurriculumSource: false,
      showCurriculumNote: false,
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
        showCurriculumNote: false,
      });
    });

    it("suppresses the whole block on EN even with a curriculum name", () => {
      expect(gates({ hasClimateClass: true, hasCurriculumName: true, isTr: false })).toEqual({
        showSection: false,
        showClass: false,
        citeClassSource: false,
        citeCurriculumSource: false,
        showCurriculumNote: false,
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

    it("does NOT cite the MEB source when the value line falls back to code-only (null-name branch)", () => {
      // Contract-legal null-name branch (plan §3 V-1): the value line still renders
      // ("Köppen: <kod>" only), but nothing MEB-sourced is on the page. This covers only ONE
      // of the two independent fallbacks that can suppress the name — see the next case for
      // the other (null-note) branch, which PR #51 review I4 found this gate used to miss.
      expect(gates({ hasClimateClass: true, hasCurriculumName: false }).citeCurriculumSource).toBe(
        false,
      );
    });

    it("does NOT cite the MEB source when the caveat itself is absent, even with a name (I4 — null-note branch)", () => {
      // The OTHER independent fallback (`page.tsx`'s `climateNoteTr === null` → `climateClassOnly`):
      // the MGM class name prints and NO curriculum-name segment renders at all, regardless of
      // `hasCurriculumName`. PR #51 review found the gate checked only the null-name branch
      // above and still cited MEB here — attributing a name that was never on the page.
      expect(
        gates({ hasClimateClass: true, hasCurriculumName: true, hasClimateNote: false })
          .citeCurriculumSource,
      ).toBe(false);
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

  describe("the curriculum-note block (V-2 asymmetry — PR #51 review, curriculum-note-asymmetry-untested)", () => {
    // The api's `climateCurriculumNoteTr` is populated for a MINORITY of provinces (some have
    // it, most don't); the invariant under test is the SHAPE of that asymmetry — present text
    // renders, absent text renders NOTHING (never a placeholder) — never a specific count.
    it("shows the note only when the section AND the note text both exist", () => {
      expect(gates({ hasClimateClass: true, hasCurriculumNoteText: true }).showCurriculumNote).toBe(
        true,
      );
    });

    it("shows nothing — not a placeholder — when the note text is absent", () => {
      expect(
        gates({ hasClimateClass: true, hasCurriculumNoteText: false }).showCurriculumNote,
      ).toBe(false);
    });

    it("does not show the note when the class line itself does not render, even with note text", () => {
      // Mirrors the citation gate's own "class line must render" guard: a note with no
      // class/Köppen pair at all is not a real api shape today, but the derivation must not
      // depend on that being true.
      expect(
        gates({ hasClimateClass: false, hasCurriculumNoteText: true, hasClimateSeries: true })
          .showCurriculumNote,
      ).toBe(false);
    });

    it("never shows the note on EN, even with note text", () => {
      expect(
        gates({ hasClimateClass: true, hasCurriculumNoteText: true, isTr: false })
          .showCurriculumNote,
      ).toBe(false);
    });
  });
});
