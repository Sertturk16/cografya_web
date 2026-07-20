import { describe, expect, it } from "vitest";
import { CLIMATE_DESCRIPTION_KEY, provinceDescriptionVariant } from "./province-description";

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

  it("falls back to variant 0 for a non-numeric plate code", () => {
    expect(provinceDescriptionVariant("")).toBe(0);
    expect(provinceDescriptionVariant("abc")).toBe(0);
  });

  it("exposes a total key map for every variant", () => {
    expect(CLIMATE_DESCRIPTION_KEY[0]).toBe("metaDescriptionClimate0");
    expect(CLIMATE_DESCRIPTION_KEY[1]).toBe("metaDescriptionClimate1");
    expect(CLIMATE_DESCRIPTION_KEY[2]).toBe("metaDescriptionClimate2");
  });
});
