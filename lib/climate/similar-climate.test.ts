import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { selectSimilarClimateProvinces } from "./similar-climate";

/**
 * Structural invariants of the "en yakın 5" cross-link selection, grouped by the curriculum
 * climate name (CONVENTIONS §2 — no real 81-province facts; invented plate codes, climate
 * labels and temperatures only). Guards the curriculum-name filter + self-exclusion, Köppen
 * being ignored, the nearest-by-annual-mean ranking, the NUMERIC plate-code tie-break,
 * null-sibling exclusion, the own-null plate-order fallback, and the cap.
 */
const p = (
  plateCode: string,
  climateCurriculumNameTr: string | null,
  climateAnnualMeanTempC: number | null,
  nameTr = `P${plateCode}`,
  climateKoppen: string | null = "Csa",
) => ({ plateCode, climateCurriculumNameTr, climateAnnualMeanTempC, nameTr, climateKoppen });

describe("selectSimilarClimateProvinces", () => {
  it("keeps only same-curriculum-climate provinces and excludes the current one", () => {
    const current = p("01", "İklim A", 18);
    const all = [current, p("02", "İklim A", 17), p("03", "İklim B", 9), p("04", "İklim A", 19)];
    const result = selectSimilarClimateProvinces(all, current, 18);
    expect(result.map((r) => r.plateCode).sort()).toEqual(["02", "04"]);
    expect(result.some((r) => r.plateCode === "01")).toBe(false);
  });

  it("ranks by NEAREST annual mean temperature to the current province", () => {
    const current = p("50", "İklim A", 15);
    const all = [
      p("10", "İklim A", 20), // |20-15| = 5
      p("11", "İklim A", 16), // |16-15| = 1  ← nearest
      p("12", "İklim A", 12), // |12-15| = 3
      p("13", "İklim A", 18), // |18-15| = 3  (ties 12, higher plate)
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
    const current = p("50", "İklim A", 18.9);
    const all = [p("07", "İklim A", 19.2), p("30", "İklim A", 18.6), current];
    const result = selectSimilarClimateProvinces(all, current, 18.9);
    // Both at Δ0.3 → NUMERIC plate order: "07" before "30" (regardless of insertion order).
    expect(result.map((r) => r.plateCode)).toEqual(["07", "30"]);
  });

  it("breaks ranking ties by plate code NUMERICALLY, not lexicographically", () => {
    // All equidistant from 15; "9" must precede "10" (numeric), not follow it (lexical).
    const current = p("50", "İklim C", 15);
    const all = [p("10", "İklim C", 20), p("2", "İklim C", 20), p("9", "İklim C", 20), current];
    const result = selectSimilarClimateProvinces(all, current, 15);
    expect(result.map((r) => r.plateCode)).toEqual(["2", "9", "10"]);
  });

  it("EXCLUDES siblings whose annual mean is null from the ranked result", () => {
    const current = p("50", "İklim A", 15);
    const all = [p("10", "İklim A", 16), p("11", "İklim A", null), p("12", "İklim A", 14), current];
    const result = selectSimilarClimateProvinces(all, current, 15);
    expect(result.map((r) => r.plateCode)).toEqual(["10", "12"]);
    expect(result.some((r) => r.climateAnnualMeanTempC === null)).toBe(false);
  });

  it("falls back to plate order when the CURRENT province has no annual mean", () => {
    // Curriculum name set but ownAnnualMeanTempC null → cannot rank by temp; plate order, incl.
    // null-temp siblings (the fallback does not need a temperature).
    const current = p("50", "İklim A", null);
    const all = [p("10", "İklim A", 16), p("02", "İklim A", null), p("09", "İklim A", 14), current];
    const result = selectSimilarClimateProvinces(all, current, null);
    expect(result.map((r) => r.plateCode)).toEqual(["02", "09", "10"]);
  });

  it("caps the own-null plate-order FALLBACK at max too, not just the ranked path (I1)", () => {
    // ownAnnualMeanTempC null → plate-order fallback. With more than `max` siblings its
    // `.slice(0, max)` must still cap; the earlier fallback test had only 3 siblings so the
    // cap was never exercised on this path.
    const current = p("50", "İklim A", null);
    const all = Array.from({ length: 7 }, (_, i) =>
      p(String(i + 1).padStart(2, "0"), "İklim A", i === 3 ? null : 10 + i),
    );
    const result = selectSimilarClimateProvinces([...all, current], current, null);
    expect(result).toHaveLength(5);
    // Plate order, INCLUDING the null-temp sibling ("04") which the fallback keeps.
    expect(result.map((r) => r.plateCode)).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("caps the ranked list at max (default 5)", () => {
    const current = p("50", "İklim A", 15);
    const all = Array.from({ length: 9 }, (_, i) =>
      p(String(i + 1).padStart(2, "0"), "İklim A", 15 + i),
    );
    const result = selectSimilarClimateProvinces([...all, current], current, 15);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.plateCode)).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("honours a custom max", () => {
    const current = p("50", "İklim D", 15);
    const all = Array.from({ length: 6 }, (_, i) =>
      p(String(i + 1).padStart(2, "0"), "İklim D", 15 + i),
    );
    expect(selectSimilarClimateProvinces([...all, current], current, 15, 3)).toHaveLength(3);
  });

  it("returns [] when the current province has no curriculum climate name", () => {
    const all = [p("01", "İklim A", 18), p("02", "İklim A", 17)];
    expect(selectSimilarClimateProvinces(all, p("03", null, 12), 12)).toEqual([]);
  });

  it("never groups provinces that both lack a curriculum climate name", () => {
    // null === null must not make two unnamed provinces "similar".
    const current = p("03", null, 12);
    const all = [current, p("04", null, 12)];
    expect(selectSimilarClimateProvinces(all, current, 12)).toEqual([]);
  });

  it("EXCLUDES a same-Köppen province whose curriculum climate differs", () => {
    // The defect this rule fixes: one Köppen code spans several curriculum climate types.
    const current = p("06", "İklim A", 12, "P06", "Csa");
    const all = [
      current,
      p("01", "İklim B", 12.1, "P01", "Csa"),
      p("42", "İklim A", 11, "P42", "BSk"),
    ];
    expect(selectSimilarClimateProvinces(all, current, 12).map((r) => r.plateCode)).toEqual(["42"]);
  });

  it("INCLUDES a same-curriculum province whatever its Köppen code", () => {
    const current = p("53", "İklim D", 14, "P53", "Cfa");
    const all = [
      current,
      p("61", "İklim D", 14.5, "P61", "Cfb"),
      p("67", "İklim D", 13, "P67", "Cfa"),
    ];
    expect(selectSimilarClimateProvinces(all, current, 14).map((r) => r.plateCode)).toEqual([
      "61",
      "67",
    ]);
  });

  it("returns [] when no other province shares the class (no throw)", () => {
    const current = p("01", "İklim C", 11);
    const all = [current, p("02", "İklim B", 9)];
    expect(selectSimilarClimateProvinces(all, current, 11)).toEqual([]);
  });

  it("does not mutate the input array order", () => {
    const all = [p("10", "İklim A", 20), p("02", "İklim A", 16), p("09", "İklim A", 14)];
    const before = all.map((r) => r.plateCode);
    selectSimilarClimateProvinces(all, p("99", "İklim A", 15), 15);
    expect(all.map((r) => r.plateCode)).toEqual(before);
  });
});

describe("the province page labels the chips with the field they are grouped by", () => {
  // Source-read, the repo's usual form for a file under `app/` that vitest does not collect.
  const code = stripComments(
    readFileSync(
      fileURLToPath(new URL("../../app/[locale]/(site)/turkiye/[slug]/page.tsx", import.meta.url)),
      "utf8",
    ),
  );
  const chipsStart = code.indexOf("async function ProvinceLinkChips");
  const chipsEnd = code.indexOf("async function ProvinceEnvironmentRow", chipsStart);
  const chipsBody = code.slice(chipsStart, chipsEnd);

  it("shows the curriculum climate name on the badge, not the Köppen code", () => {
    expect(chipsStart).toBeGreaterThan(-1);
    expect(chipsEnd).toBeGreaterThan(chipsStart);
    expect(chipsBody).toMatch(/<Badge[^>]*>\s*\{province\.climateCurriculumNameTr\}\s*<\/Badge>/);
    expect(chipsBody).not.toMatch(/\{province\.climateKoppen\}/);
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
