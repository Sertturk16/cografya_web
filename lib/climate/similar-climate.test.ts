import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { selectSimilarClimateProvinces } from "./similar-climate";

/**
 * Structural invariants of the same-Köppen "en yakın 5" cross-link selection
 * (→ DEC 2026-07-20b; CONVENTIONS §2 — no real 81-province facts; invented plate codes,
 * Köppen labels and temperatures only). Guards the class filter + self-exclusion, the
 * nearest-by-annual-mean ranking, the NUMERIC plate-code tie-break, null-sibling
 * exclusion, the own-null plate-order fallback, and the cap.
 */
const p = (
  plateCode: string,
  climateKoppen: string | null,
  climateAnnualMeanTempC: number | null,
  nameTr = `P${plateCode}`,
) => ({ plateCode, climateKoppen, climateAnnualMeanTempC, nameTr });

describe("selectSimilarClimateProvinces", () => {
  it("keeps only same-Köppen provinces and excludes the current one", () => {
    const current = p("01", "Csa", 18);
    const all = [current, p("02", "Csa", 17), p("03", "Dsb", 9), p("04", "Csa", 19)];
    const result = selectSimilarClimateProvinces(all, current, 18);
    expect(result.map((r) => r.plateCode).sort()).toEqual(["02", "04"]);
    expect(result.some((r) => r.plateCode === "01")).toBe(false);
  });

  it("ranks by NEAREST annual mean temperature to the current province", () => {
    const current = p("50", "Csa", 15);
    const all = [
      p("10", "Csa", 20), // |20-15| = 5
      p("11", "Csa", 16), // |16-15| = 1  ← nearest
      p("12", "Csa", 12), // |12-15| = 3
      p("13", "Csa", 18), // |18-15| = 3  (ties 12, higher plate)
      current,
    ];
    const result = selectSimilarClimateProvinces(all, current, 15, 3);
    // nearest first: 16 (Δ1), then the Δ3 pair by plate order (12 before 13)
    expect(result.map((r) => r.plateCode)).toEqual(["11", "12", "13"]);
  });

  it("fires the plate-order tie-break for OPPOSITE-SIDE equidistant 1-decimal ties (C1)", () => {
    // own 18.9; sib 19.2 (own+0.3) and 18.6 (own−0.3) are equidistant but on OPPOSITE sides,
    // so on raw doubles |19.2−18.9| and |18.9−18.6| differ by ~3.55e-15. Quantizing to tenths
    // makes both distances an exact 3 → the NUMERIC plate-order tie-break decides.
    // GUARD DESIGN: the below-own temp (18.6) MUST sit on the HIGHER plate ("30"), and the
    // above-own temp (19.2) on the LOWER plate ("07"). On a raw-double comparator |18.6−18.9|
    // is the marginally-smaller delta, so 18.6@"30" sorts first → ["30","07"] — CONTRADICTING
    // plate order. Only tenths-quantization ties them and yields plate order ["07","30"].
    // (If the temps were swapped onto the other plates, the raw-double order would coincide
    // with plate order and this guard would pass on the OLD comparator too — a no-op.)
    const current = p("50", "Csa", 18.9);
    const all = [p("07", "Csa", 19.2), p("30", "Csa", 18.6), current];
    const result = selectSimilarClimateProvinces(all, current, 18.9);
    // Both at Δ0.3 → NUMERIC plate order: "07" before "30" (regardless of insertion order).
    expect(result.map((r) => r.plateCode)).toEqual(["07", "30"]);
  });

  it("breaks ranking ties by plate code NUMERICALLY, not lexicographically", () => {
    // All equidistant from 15; "9" must precede "10" (numeric), not follow it (lexical).
    const current = p("50", "BSk", 15);
    const all = [p("10", "BSk", 20), p("2", "BSk", 20), p("9", "BSk", 20), current];
    const result = selectSimilarClimateProvinces(all, current, 15);
    expect(result.map((r) => r.plateCode)).toEqual(["2", "9", "10"]);
  });

  it("EXCLUDES siblings whose annual mean is null from the ranked result", () => {
    const current = p("50", "Csa", 15);
    const all = [p("10", "Csa", 16), p("11", "Csa", null), p("12", "Csa", 14), current];
    const result = selectSimilarClimateProvinces(all, current, 15);
    expect(result.map((r) => r.plateCode)).toEqual(["10", "12"]);
    expect(result.some((r) => r.climateAnnualMeanTempC === null)).toBe(false);
  });

  it("falls back to plate order when the CURRENT province has no annual mean", () => {
    // Köppen set but ownAnnualMeanTempC null → cannot rank by temp; plate order, incl.
    // null-temp siblings (the fallback does not need a temperature).
    const current = p("50", "Csa", null);
    const all = [p("10", "Csa", 16), p("02", "Csa", null), p("09", "Csa", 14), current];
    const result = selectSimilarClimateProvinces(all, current, null);
    expect(result.map((r) => r.plateCode)).toEqual(["02", "09", "10"]);
  });

  it("caps the own-null plate-order FALLBACK at max too, not just the ranked path (I1)", () => {
    // ownAnnualMeanTempC null → plate-order fallback. With more than `max` siblings its
    // `.slice(0, max)` must still cap; the earlier fallback test had only 3 siblings so the
    // cap was never exercised on this path.
    const current = p("50", "Csa", null);
    const all = Array.from({ length: 7 }, (_, i) =>
      p(String(i + 1).padStart(2, "0"), "Csa", i === 3 ? null : 10 + i),
    );
    const result = selectSimilarClimateProvinces([...all, current], current, null);
    expect(result).toHaveLength(5);
    // Plate order, INCLUDING the null-temp sibling ("04") which the fallback keeps.
    expect(result.map((r) => r.plateCode)).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("caps the ranked list at max (default 5)", () => {
    const current = p("50", "Csa", 15);
    const all = Array.from({ length: 9 }, (_, i) =>
      p(String(i + 1).padStart(2, "0"), "Csa", 15 + i),
    );
    const result = selectSimilarClimateProvinces([...all, current], current, 15);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.plateCode)).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("honours a custom max", () => {
    const current = p("50", "Cfa", 15);
    const all = Array.from({ length: 6 }, (_, i) =>
      p(String(i + 1).padStart(2, "0"), "Cfa", 15 + i),
    );
    expect(selectSimilarClimateProvinces([...all, current], current, 15, 3)).toHaveLength(3);
  });

  it("returns [] when the current province has no Köppen code", () => {
    const all = [p("01", "Csa", 18), p("02", "Csa", 17)];
    expect(selectSimilarClimateProvinces(all, p("03", null, 12), 12)).toEqual([]);
  });

  it("returns [] when no other province shares the class (no throw)", () => {
    const current = p("01", "BSk", 11);
    const all = [current, p("02", "Dsb", 9)];
    expect(selectSimilarClimateProvinces(all, current, 11)).toEqual([]);
  });

  it("does not mutate the input array order", () => {
    const all = [p("10", "Csa", 20), p("02", "Csa", 16), p("09", "Csa", 14)];
    const before = all.map((r) => r.plateCode);
    selectSimilarClimateProvinces(all, p("99", "Csa", 15), 15);
    expect(all.map((r) => r.plateCode)).toEqual(before);
  });
});

describe("similar-climate i18n keys exist in both locale catalogues (I2 regression guard)", () => {
  // Same failure class the province-description I7 guard closed: a typo'd or missing key
  // would silently ship a dotted-string ("ProvinceDetail.similarClimateX") into rendered
  // HTML — next-intl logs a console.error but does NOT fail the build. Every ProvinceDetail
  // key this block renders (W2's heading/intro + W2.1's anchor) must exist, non-empty, in
  // BOTH catalogues (the anchor is EN-future-facing but must still resolve if the gate opens).
  const requiredKeys = ["similarClimateHeading", "similarClimateIntro", "similarClimateAnchor"];
  const catalogues = { tr: trMessages, en: enMessages } as const;

  for (const [locale, messages] of Object.entries(catalogues)) {
    const provinceDetail = messages.ProvinceDetail as Record<string, unknown>;
    for (const key of requiredKeys) {
      it(`${locale}.json ProvinceDetail.${key} is a non-empty string`, () => {
        expect(typeof provinceDetail[key]).toBe("string");
        expect((provinceDetail[key] as string).length).toBeGreaterThan(0);
      });
    }
  }
});
