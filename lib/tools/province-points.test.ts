import { describe, expect, it } from "vitest";
import type { ProvinceListItem } from "@/lib/api/types";
import { buildProvincePoints, findProvincePoint } from "./province-points";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). No assertion here says where a real province is —
 * that is a fact the api owns and the provenance ledger sources. Every fixture below is
 * synthetic, and the names were chosen only because Turkish collation orders them in a way
 * a naive sort does not.
 */

function province(overrides: Partial<ProvinceListItem> & { plateCode: string }): ProvinceListItem {
  return {
    plateCode: overrides.plateCode,
    nameTr: overrides.nameTr ?? "Fixture",
    region: overrides.region ?? "IC_ANADOLU",
    slugTr: overrides.slugTr ?? "fixture",
    slugEn: overrides.slugEn ?? "fixture",
    climateKoppen: overrides.climateKoppen ?? null,
    climateAnnualMeanTempC: overrides.climateAnnualMeanTempC ?? null,
    latitude: overrides.latitude ?? null,
    longitude: overrides.longitude ?? null,
  };
}

describe("buildProvincePoints", () => {
  it("maps the api's published point onto the tool's coordinate shape", () => {
    const [option] = buildProvincePoints([
      province({ plateCode: "01", nameTr: "Bir", latitude: 39.5, longitude: 32.5 }),
    ]);
    expect(option).toBeDefined();
    expect(option?.point).toStrictEqual({ lon: 32.5, lat: 39.5 });
  });

  it("OMITS a province whose point the api does not publish", () => {
    // Never a polygon-centroid fallback (→ AK-27 md.2): that point is not the il merkezi, so
    // the tool would answer a distance the province page contradicts, and it would look
    // entirely plausible. A short picker is acceptable; a wrong one is not.
    const options = buildProvincePoints([
      province({ plateCode: "01", nameTr: "Var", latitude: 39.5, longitude: 32.5 }),
      province({ plateCode: "02", nameTr: "Yok", latitude: null, longitude: null }),
      province({ plateCode: "03", nameTr: "Yarim", latitude: 39.5, longitude: null }),
    ]);
    expect(options.map((o) => o.plateCode)).toStrictEqual(["01"]);
  });

  it("drops a non-finite coordinate as well as a null one", () => {
    const options = buildProvincePoints([
      province({ plateCode: "04", nameTr: "NaN", latitude: Number.NaN, longitude: 32 }),
    ]);
    expect(options).toStrictEqual([]);
  });

  it("orders names with the Turkish collator, not by code unit", () => {
    // The concrete failure a naive sort produces: every letter outside ASCII sorts after `z`,
    // so "Çorum" and "Şırnak" would fall to the end of the list instead of into place.
    const options = buildProvincePoints([
      province({ plateCode: "01", nameTr: "Zonguldak", latitude: 1, longitude: 1 }),
      province({ plateCode: "02", nameTr: "Çorum", latitude: 2, longitude: 2 }),
      province({ plateCode: "03", nameTr: "Ağrı", latitude: 3, longitude: 3 }),
      province({ plateCode: "04", nameTr: "Aydın", latitude: 4, longitude: 4 }),
      province({ plateCode: "05", nameTr: "Şırnak", latitude: 5, longitude: 5 }),
    ]);
    expect(options.map((o) => o.nameTr)).toStrictEqual([
      "Ağrı",
      "Aydın",
      "Çorum",
      "Şırnak",
      "Zonguldak",
    ]);
    // The control that the expectation above is not merely what `sort()` does anyway.
    const naive = ["Zonguldak", "Çorum", "Ağrı", "Aydın", "Şırnak"].sort();
    expect(naive).not.toStrictEqual(["Ağrı", "Aydın", "Çorum", "Şırnak", "Zonguldak"]);
  });

  it("returns an empty list for an empty catalogue", () => {
    expect(buildProvincePoints([])).toStrictEqual([]);
  });
});

describe("findProvincePoint", () => {
  const options = buildProvincePoints([
    province({ plateCode: "06", nameTr: "Alti", latitude: 39, longitude: 32 }),
  ]);

  it("finds an option by plaka kodu", () => {
    expect(findProvincePoint(options, "06")?.nameTr).toBe("Alti");
  });

  it("returns null for a code that is not in the list", () => {
    // The picker's value can arrive from a restored form state or a stale bfcache page, so
    // "not found" is a normal state and not an error.
    expect(findProvincePoint(options, "99")).toBeNull();
  });
});
