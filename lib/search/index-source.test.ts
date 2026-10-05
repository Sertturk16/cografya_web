import { describe, expect, it } from "vitest";
import type { CountryListItem, ProvinceListItem } from "@/lib/api/types";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { buildSearchIndex, type IndexHref, type SearchIndexMessageKey } from "./index-source";
import type { SearchEntityKind, SearchIndexRecord } from "./types";

/**
 * Structural invariants of index construction (CONVENTIONS §2 — synthetic entities for the
 * api-fed kinds; the contract under test is "which field feeds which locale", not any real
 * place's data). The static kinds (regions, continents, seas, tools, pages) come from repo
 * tables, so their COUNTS and route shapes are asserted, plus the few names the task's
 * acceptance queries depend on.
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
  climateCurriculumNameTr: null,
  climateAnnualMeanTempC: null,
  // Null on purpose: the search index never reads a coordinate, so a fixture that carried
  // one would imply a dependency this module does not have.
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

/** A stand-in for `getPathname`: locale prefix plus the route with its slug filled in. */
const fakePathOf = (locale: "tr" | "en") => (href: IndexHref) => {
  const prefix = locale === "en" ? "/en" : "";
  if (typeof href === "string") return `${prefix}${href}`;
  return `${prefix}${href.pathname.replace("[slug]", href.params.slug)}`;
};

/** Resolves a key against the real catalogue, so a key the builder asks for must exist. */
const textOf = (locale: "tr" | "en") => (key: SearchIndexMessageKey) => {
  const catalogue = (locale === "en" ? enMessages : trMessages).SearchIndex as unknown;
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalogue);
  if (typeof value !== "string") throw new Error(`missing SearchIndex.${key} (${locale})`);
  return value;
};

const build = (
  locale: "tr" | "en",
  sources: {
    provinces?: readonly ProvinceListItem[] | null;
    countries?: readonly CountryListItem[] | null;
  } = {},
) =>
  buildSearchIndex({
    provinces: sources.provinces === undefined ? PROVINCES : sources.provinces,
    countries: sources.countries === undefined ? COUNTRIES : sources.countries,
    locale,
    pathOf: fakePathOf(locale),
    text: textOf(locale),
  });

const ofKind = (records: readonly SearchIndexRecord[], kind: SearchEntityKind) =>
  records.filter((record) => record[2] === kind);

describe("buildSearchIndex", () => {
  it("emits every kind, with the api-fed ones first", () => {
    const kinds = build("tr").map(([, , kind]) => kind);
    expect([...new Set(kinds)]).toEqual(["p", "c", "r", "k", "s", "t", "g"]);
  });

  it("holds the seven regions, seven continents, four seas, three tools and six pages", () => {
    const records = build("tr");
    expect(ofKind(records, "r")).toHaveLength(7);
    expect(ofKind(records, "k")).toHaveLength(7);
    expect(ofKind(records, "s")).toHaveLength(4);
    expect(ofKind(records, "t")).toHaveLength(3);
    expect(ofKind(records, "g")).toHaveLength(6);
  });

  it("uses the Turkish province name in BOTH locales (the DTO carries no nameEn)", () => {
    expect(ofKind(build("tr"), "p")[0]?.[0]).toBe("Şavlak");
    expect(ofKind(build("en"), "p")[0]?.[0]).toBe("Şavlak");
  });

  it("uses the per-locale country and continent names", () => {
    expect(ofKind(build("tr"), "c")[0]?.[0]).toBe("Ülkeadı");
    expect(ofKind(build("en"), "c")[0]?.[0]).toBe("Countryname");
    expect(ofKind(build("tr"), "k").map(([name]) => name)).toContain("Asya");
    expect(ofKind(build("en"), "k").map(([name]) => name)).toContain("Asia");
  });

  it("names a region and a sea that share a word as two separate records", () => {
    const names = build("tr").map(([name, , kind]) => `${kind}:${name}`);
    expect(names).toContain("r:Karadeniz Bölgesi");
    expect(names).toContain("s:Karadeniz");
    expect(names).toContain("r:Ege Bölgesi");
    expect(names).toContain("s:Ege Denizi");
  });

  it("routes each locale through its own slug", () => {
    // The failure this pins is a locale leak: an English index pointing at Turkish slugs
    // would 404 every hit on `/en/...`.
    expect(ofKind(build("tr"), "p")[0]?.[1]).toBe("/turkiye/savlak");
    expect(ofKind(build("en"), "p")[0]?.[1]).toBe("/en/turkiye/savlak-en");
    expect(ofKind(build("tr"), "c")[0]?.[1]).toBe("/dunya/ulkeadi");
    expect(ofKind(build("en"), "c")[0]?.[1]).toBe("/en/dunya/countryname");
    expect(ofKind(build("tr"), "k").map(([, path]) => path)).toContain("/dunya/kita/asya");
    expect(ofKind(build("en"), "k").map(([, path]) => path)).toContain("/en/dunya/kita/asia");
  });

  it("sends regions, seas, tools and pages to their routes", () => {
    const paths = (kind: SearchEntityKind) => ofKind(build("tr"), kind).map(([, path]) => path);
    expect(paths("r")).toContain("/turkiye/bolge/karadeniz");
    expect(paths("r")).toContain("/turkiye/bolge/ic-anadolu");
    expect(paths("s").sort()).toEqual([
      "/deniz/akdeniz",
      "/deniz/ege",
      "/deniz/karadeniz",
      "/deniz/marmara",
    ]);
    expect(paths("t")).toContain("/araclar/mesafe-olcme");
    expect(paths("g")).toEqual(["/turkiye", "/dunya", "/deniz", "/oyun", "/deprem", "/kitaplar"]);
  });

  it("builds every path through the injected builder, never by concatenation here", () => {
    const records = buildSearchIndex({
      provinces: PROVINCES,
      countries: COUNTRIES,
      locale: "tr",
      pathOf: () => "SENTINEL",
      text: textOf("tr"),
    });
    expect(new Set(records.map(([, path]) => path))).toEqual(new Set(["SENTINEL"]));
  });

  it("carries search keywords only on tools and pages", () => {
    for (const record of build("tr")) {
      const hasKeywords = record.length === 4 && record[3].trim().length > 0;
      expect(hasKeywords, record[0]).toBe(record[2] === "t" || record[2] === "g");
    }
  });

  it("drops only the kind whose source failed", () => {
    // A province api outage must not take continents, seas or tools down with it.
    const withoutProvinces = build("tr", { provinces: null });
    expect(ofKind(withoutProvinces, "p")).toHaveLength(0);
    expect(ofKind(withoutProvinces, "c")).toHaveLength(1);
    expect(ofKind(withoutProvinces, "k")).toHaveLength(7);

    const withoutBoth = build("tr", { provinces: null, countries: null });
    expect(ofKind(withoutBoth, "p")).toHaveLength(0);
    expect(ofKind(withoutBoth, "c")).toHaveLength(0);
    expect(withoutBoth.length).toBe(7 + 7 + 4 + 3 + 6);
  });
});
