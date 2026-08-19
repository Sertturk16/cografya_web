import { describe, expect, it } from "vitest";
import type { CountryListItem, ProvinceListItem } from "@/lib/api/types";
import { buildSearchIndex } from "./index-source";

/**
 * Structural invariants of index construction (CONVENTIONS §2 — synthetic entities; the
 * contract under test is "which field feeds which locale", not any real place's data).
 */
// Real typed literals, not double casts: every consumed field is non-nullable in the
// generated contract, so building the full shape is cheap and a contract change now breaks
// the test instead of being hidden by an assertion (review M15). `ZZ` is a synthetic-fixture
// ISO code reserved by CONVENTIONS §5 for exactly this.
const province = (nameTr: string, slugTr: string, slugEn: string): ProvinceListItem => ({
  plateCode: "00",
  nameTr,
  slugTr,
  slugEn,
  region: "MARMARA",
  climateKoppen: null,
  climateAnnualMeanTempC: null,
  // Added when the api began publishing the il-merkezi point (CBS-P2 E0). Null here on
  // purpose: the search index never reads a coordinate, so a fixture that carried one would
  // imply a dependency this module does not have. The comment above is the reason this
  // breakage is welcome — the contract change surfaced as a compile error rather than hiding.
  latitude: null,
  longitude: null,
});

const country = (
  nameTr: string,
  nameEn: string,
  slugTr: string,
  slugEn: string,
): CountryListItem => ({
  isoCode: "ZZ",
  nameTr,
  nameEn,
  slugTr,
  slugEn,
  continent: "AVRUPA",
});

const PROVINCES = [province("Şavlak", "savlak", "savlak-en")];
const COUNTRIES = [country("Ülkeadı", "Countryname", "ulkeadi", "countryname")];

const build = (locale: "tr" | "en") =>
  buildSearchIndex({
    provinces: PROVINCES,
    countries: COUNTRIES,
    locale,
    provincePath: (slug) => `${locale === "en" ? "/en" : ""}/turkiye/${slug}`,
    countryPath: (slug) => `${locale === "en" ? "/en" : ""}/dunya/${slug}`,
  });

describe("buildSearchIndex", () => {
  it("emits one record per entity, provinces before countries", () => {
    expect(build("tr")).toHaveLength(2);
    expect(build("tr").map(([, , kind]) => kind)).toEqual(["p", "c"]);
  });

  it("uses the Turkish province name in BOTH locales (the DTO carries no nameEn)", () => {
    expect(build("tr")[0]?.[0]).toBe("Şavlak");
    expect(build("en")[0]?.[0]).toBe("Şavlak");
  });

  it("uses the per-locale country name", () => {
    expect(build("tr")[1]?.[0]).toBe("Ülkeadı");
    expect(build("en")[1]?.[0]).toBe("Countryname");
  });

  it("routes each locale through its own slug", () => {
    // The failure this pins is a locale leak: an English index pointing at Turkish slugs
    // would 404 every hit on `/en/...`.
    expect(build("tr").map(([, path]) => path)).toEqual(["/turkiye/savlak", "/dunya/ulkeadi"]);
    expect(build("en").map(([, path]) => path)).toEqual([
      "/en/turkiye/savlak-en",
      "/en/dunya/countryname",
    ]);
  });

  it("builds every path through the injected builders, never by concatenation here", () => {
    // If the module ever hand-built a path, these sentinel builders would not appear in the
    // output and this assertion would fail.
    const records = buildSearchIndex({
      provinces: PROVINCES,
      countries: COUNTRIES,
      locale: "tr",
      provincePath: (slug) => `P:${slug}`,
      countryPath: (slug) => `C:${slug}`,
    });
    expect(records.map(([, path]) => path)).toEqual(["P:savlak", "C:ulkeadi"]);
  });

  it("returns an empty index when nothing is published", () => {
    expect(
      buildSearchIndex({
        provinces: [],
        countries: [],
        locale: "tr",
        provincePath: (s) => s,
        countryPath: (s) => s,
      }),
    ).toEqual([]);
  });
});
