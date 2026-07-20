import { describe, expect, it } from "vitest";
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
