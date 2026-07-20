import { describe, expect, it } from "vitest";
import { selectSimilarClimateProvinces } from "./similar-climate";

/**
 * Structural invariants of the same-Köppen cross-link selection (CONVENTIONS §2 — no real
 * 81-province facts; invented plate codes and Köppen labels only). Guards the filter
 * (same class + self-exclusion), the NUMERIC ordering, and the cap — a future refactor to
 * a lexicographic `.sort()` or a dropped self-check would break one of these.
 */
const p = (plateCode: string, climateKoppen: string | null, nameTr = `P${plateCode}`) => ({
  plateCode,
  climateKoppen,
  nameTr,
});

describe("selectSimilarClimateProvinces", () => {
  it("keeps only same-Köppen provinces and excludes the current one", () => {
    const current = p("01", "Csa");
    const all = [current, p("02", "Csa"), p("03", "Dsb"), p("04", "Csa")];
    const result = selectSimilarClimateProvinces(all, current);
    expect(result.map((r) => r.plateCode)).toEqual(["02", "04"]);
    expect(result.some((r) => r.plateCode === "01")).toBe(false);
  });

  it("orders by plate code NUMERICALLY, not lexicographically", () => {
    // Lexicographic order would put "10" before "2"; numeric order must not.
    const all = [p("10", "BSk"), p("2", "BSk"), p("09", "BSk")];
    const current = p("99", "BSk");
    const result = selectSimilarClimateProvinces([...all, current], current);
    expect(result.map((r) => r.plateCode)).toEqual(["2", "09", "10"]);
  });

  it("caps the list at max (default 5) when the class is larger", () => {
    const all = Array.from({ length: 9 }, (_, i) => p(String(i + 1).padStart(2, "0"), "Csa"));
    const current = p("50", "Csa");
    const result = selectSimilarClimateProvinces([...all, current], current);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.plateCode)).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("honours a custom max", () => {
    const all = Array.from({ length: 6 }, (_, i) => p(String(i + 1).padStart(2, "0"), "Cfa"));
    const current = p("50", "Cfa");
    expect(selectSimilarClimateProvinces([...all, current], current, 3)).toHaveLength(3);
  });

  it("returns [] when the current province has no Köppen code", () => {
    const all = [p("01", "Csa"), p("02", "Csa")];
    expect(selectSimilarClimateProvinces(all, p("03", null))).toEqual([]);
  });

  it("returns [] when no other province shares the class (no throw)", () => {
    const current = p("01", "BSk");
    const all = [current, p("02", "Dsb")];
    expect(selectSimilarClimateProvinces(all, current)).toEqual([]);
  });

  it("does not mutate the input array order", () => {
    const all = [p("10", "Csa"), p("02", "Csa"), p("09", "Csa")];
    const before = all.map((r) => r.plateCode);
    selectSimilarClimateProvinces(all, p("99", "Csa"));
    expect(all.map((r) => r.plateCode)).toEqual(before);
  });
});
