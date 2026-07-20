import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import {
  AREA_DESCRIPTION_KEY,
  CLIMATE_DESCRIPTION_KEY,
  CLIMATE_TITLE_KEY,
  GENERIC_DESCRIPTION_KEY,
  GENERIC_TITLE_KEY,
  POPULATION_DESCRIPTION_KEY,
  provinceDescriptionVariant,
  selectProvinceMetaDescription,
  selectProvinceMetaTitle,
} from "./province-description";

describe("provinceDescriptionVariant", () => {
  it("is deterministic: plateCode % 3", () => {
    expect(provinceDescriptionVariant("03")).toBe(0); // 3 % 3
    expect(provinceDescriptionVariant("34")).toBe(1); // 34 % 3 = 1
    expect(provinceDescriptionVariant("35")).toBe(2); // 35 % 3 = 2
    expect(provinceDescriptionVariant("06")).toBe(0); // 6 % 3
    expect(provinceDescriptionVariant("01")).toBe(1); // Adana
    expect(provinceDescriptionVariant("81")).toBe(0); // Düzce, 81 % 3
  });

  it("maps every province of a plate range across all three variants", () => {
    const seen = new Set<number>();
    for (let code = 1; code <= 81; code++) {
      seen.add(provinceDescriptionVariant(String(code).padStart(2, "0")));
    }
    // All three variants are actually used across the 81-province corpus.
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("falls back to variant 0 when parseInt yields no finite number", () => {
    // Only a value with no leading digits reaches the fallback ("" / "abc" → NaN → 0).
    expect(provinceDescriptionVariant("")).toBe(0);
    expect(provinceDescriptionVariant("abc")).toBe(0);
  });

  it("exposes a total key map for every variant", () => {
    expect(CLIMATE_DESCRIPTION_KEY[0]).toBe("metaDescriptionClimate0");
    expect(CLIMATE_DESCRIPTION_KEY[1]).toBe("metaDescriptionClimate1");
    expect(CLIMATE_DESCRIPTION_KEY[2]).toBe("metaDescriptionClimate2");
  });
});

describe("selectProvinceMetaDescription — fallback chain × locale gate", () => {
  const climate = { derived: { annualMeanTempC: 18.5, annualPrecipitationMm: 1136.4 } };
  // A synthetic province; no real 81-province facts are asserted (CONVENTIONS §2). The
  // plate code "34" → variant 1 is used only to prove the climate tier routes THROUGH the
  // variant selector, not to assert any specific province's copy.
  const base = { plateCode: "34", name: "Fixture", region: "Fixture Region" } as const;

  it("TR + climate present → climate tier, routed by plateCode, with temp/precip params", () => {
    const sel = selectProvinceMetaDescription({
      ...base,
      locale: "tr",
      climate,
      population: 1_000_000,
      areaKm2: 5000,
    });
    expect(sel.key).toBe(CLIMATE_DESCRIPTION_KEY[provinceDescriptionVariant(base.plateCode)]);
    expect(sel.params.temp).toBe(18.5);
    // precip is rounded for snippet readability; temp is passed through (api 1-decimal).
    expect(sel.params.precip).toBe(1136);
    expect(sel.params.name).toBe("Fixture");
    expect(sel.params.region).toBe("Fixture Region");
  });

  it("EN never takes the climate tier even with climate data present (noindex gate)", () => {
    const sel = selectProvinceMetaDescription({
      ...base,
      locale: "en",
      climate,
      population: 1_000_000,
      areaKm2: 5000,
    });
    // EN falls straight to the population tier — the load-bearing TR-gate.
    expect(sel.key).toBe(POPULATION_DESCRIPTION_KEY);
    expect(sel.params.population).toBe(1_000_000);
    expect(sel.params.temp).toBeUndefined();
  });

  it("TR + no climate + population → population tier", () => {
    const sel = selectProvinceMetaDescription({
      ...base,
      locale: "tr",
      climate: null,
      population: 850_000,
      areaKm2: 5000,
    });
    expect(sel.key).toBe(POPULATION_DESCRIPTION_KEY);
    expect(sel.params.population).toBe(850_000);
  });

  it("TR + no climate + no population + area → area tier", () => {
    const sel = selectProvinceMetaDescription({
      ...base,
      locale: "tr",
      climate: null,
      population: null,
      areaKm2: 7200,
    });
    expect(sel.key).toBe(AREA_DESCRIPTION_KEY);
    expect(sel.params.area).toBe(7200);
  });

  it("all facts null → region-only generic tier (never throws)", () => {
    const sel = selectProvinceMetaDescription({
      ...base,
      locale: "tr",
      climate: null,
      population: null,
      areaKm2: null,
    });
    expect(sel.key).toBe(GENERIC_DESCRIPTION_KEY);
    expect(sel.params).toEqual({ name: "Fixture", region: "Fixture Region" });
  });
});

describe("selectProvinceMetaTitle — climate-gated, TR-only, deterministic (W3)", () => {
  const climate = { derived: { annualMeanTempC: 18.5, annualPrecipitationMm: 1136.4 } };

  it("TR + climate present → climate-targeted title key with the province name", () => {
    const sel = selectProvinceMetaTitle({ locale: "tr", climate, name: "Fixture" });
    expect(sel.key).toBe(CLIMATE_TITLE_KEY);
    expect(sel.params).toEqual({ name: "Fixture" });
  });

  it("TR + no climate → generic title key", () => {
    const sel = selectProvinceMetaTitle({ locale: "tr", climate: null, name: "Fixture" });
    expect(sel.key).toBe(GENERIC_TITLE_KEY);
  });

  it("EN never takes the climate title even with climate data (noindex gate)", () => {
    const sel = selectProvinceMetaTitle({ locale: "en", climate, name: "Fixture" });
    expect(sel.key).toBe(GENERIC_TITLE_KEY);
  });
});

describe("meta-description keys exist in both locale catalogues (I7 regression guard)", () => {
  // A typo'd key would silently ship a dotted-string ("ProvinceDetail.metaDescriptionX")
  // into a production <meta> — next-intl's default logs console.error but does NOT fail the
  // build. This asserts every key the selector can emit is present in both catalogues.
  const emittableKeys = [
    ...Object.values(CLIMATE_DESCRIPTION_KEY),
    POPULATION_DESCRIPTION_KEY,
    AREA_DESCRIPTION_KEY,
    GENERIC_DESCRIPTION_KEY,
    GENERIC_TITLE_KEY,
    CLIMATE_TITLE_KEY,
  ];
  const catalogues = { tr: trMessages, en: enMessages } as const;

  for (const [locale, messages] of Object.entries(catalogues)) {
    const provinceDetail = messages.ProvinceDetail as Record<string, unknown>;
    for (const key of emittableKeys) {
      it(`${locale}.json ProvinceDetail.${key} is a non-empty string`, () => {
        expect(typeof provinceDetail[key]).toBe("string");
        expect((provinceDetail[key] as string).length).toBeGreaterThan(0);
      });
    }
  }
});
