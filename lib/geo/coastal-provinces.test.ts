import { describe, expect, it } from "vitest";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { SEA_BASINS_DETAIL } from "@/lib/marine/sea-basins-detail";
import { COASTAL_PLATE_CODES, hasSeaCoast } from "./coastal-provinces";

describe("COASTAL_PLATE_CODES — Türkiye's coastal provinces", () => {
  it("has exactly 28 provinces", () => {
    expect(COASTAL_PLATE_CODES.size).toBe(28);
  });

  it("includes Edirne (22), whose coast has no marine reference point", () => {
    expect(hasSeaCoast("22")).toBe(true);
  });

  it("leaves out inland provinces", () => {
    for (const inland of ["06", "42", "80", "65"]) {
      expect(hasSeaCoast(inland)).toBe(false);
    }
  });

  it("names only real plates from the province map", () => {
    const plates = new Set(PROVINCE_SHAPES.map((shape) => shape.plateCode));
    expect(plates.size).toBe(81);
    for (const code of COASTAL_PLATE_CODES) {
      expect(plates.has(code)).toBe(true);
    }
  });

  it("matches the union of the four sea pages' coastal-province lists", () => {
    const union = new Set(
      Object.values(SEA_BASINS_DETAIL).flatMap((basin) =>
        basin.coastalProvinces.map((province) => province.plate),
      ),
    );
    expect(union).toEqual(new Set(COASTAL_PLATE_CODES));
  });
});
