import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import type { CountryMapSummary, ProvinceMapSummary } from "@/lib/api/types";
import { pickFeaturedCountries, pickFeaturedProvinces } from "./featured";

/**
 * The featured-card selection contract.
 *
 * SYNTHETIC FIXTURES, deliberately (`CONVENTIONS.md` §2, → DEC 2026-07-12): the invariants
 * under test are structural — order, cap, locale, and above all "a curated slug the api does
 * not publish produces NO card" — and they must hold for any entity. Asserting them against
 * real province or country data would turn a structural guard into a geography-fact test that
 * breaks whenever the seed changes.
 */

function province(slugTr: string, over: Partial<ProvinceMapSummary> = {}): ProvinceMapSummary {
  return {
    plateCode: "99",
    nameTr: `${slugTr}-tr`,
    region: "MARMARA",
    slugTr,
    slugEn: `${slugTr}-en`,
    population: 1234,
    populationYear: 2024,
    areaKm2: 100,
    districtCount: 5,
    ...over,
  };
}

function country(slugTr: string, over: Partial<CountryMapSummary> = {}): CountryMapSummary {
  return {
    isoCode: "ZZ",
    nameTr: `${slugTr}-tr`,
    nameEn: `${slugTr}-en`,
    continent: "AVRUPA",
    slugTr,
    slugEn: `${slugTr}-en`,
    population: 5678,
    populationYear: null,
    areaKm2: 200,
    neighborCount: 3,
    ...over,
  };
}

describe("pickFeaturedProvinces", () => {
  it("drops a curated slug the api does not publish (no soft-404 link is constructible)", () => {
    const picked = pickFeaturedProvinces([province("alpha")], "tr", ["alpha", "retired", "gone"]);

    expect(picked.map((item) => item.slug)).toEqual(["alpha"]);
  });

  it("keeps the CURATED order, not the api's", () => {
    const summaries = [province("alpha"), province("beta"), province("gamma")];

    const picked = pickFeaturedProvinces(summaries, "tr", ["gamma", "alpha", "beta"]);

    expect(picked.map((item) => item.slug)).toEqual(["gamma", "alpha", "beta"]);
  });

  it("never exceeds the cap", () => {
    const summaries = [province("a"), province("b"), province("c"), province("d")];

    expect(pickFeaturedProvinces(summaries, "tr", ["a", "b", "c", "d"], 2)).toHaveLength(2);
  });

  it("emits the LOCALE's slug and never leaks the other one", () => {
    const summaries = [province("alpha", { slugEn: "alpha-english" })];

    expect(pickFeaturedProvinces(summaries, "tr", ["alpha"])[0]?.slug).toBe("alpha");
    expect(pickFeaturedProvinces(summaries, "en", ["alpha"])[0]?.slug).toBe("alpha-english");
  });

  it("returns an empty list — not a throw — when the api published nothing", () => {
    expect(pickFeaturedProvinces([], "tr", ["alpha"])).toEqual([]);
  });

  it("carries a null population through rather than substituting a number", () => {
    const summaries = [province("alpha", { population: null, populationYear: null })];

    expect(pickFeaturedProvinces(summaries, "tr", ["alpha"])[0]?.population).toBeNull();
  });

  it("passes the region through as the CONTRACT ENUM, not a translated string", () => {
    const summaries = [province("alpha", { region: "KARADENIZ" })];

    expect(pickFeaturedProvinces(summaries, "tr", ["alpha"])[0]?.region).toBe("KARADENIZ");
  });
});

describe("pickFeaturedCountries", () => {
  it("drops a curated slug the api does not publish", () => {
    expect(pickFeaturedCountries([country("alpha")], "tr", ["missing"])).toEqual([]);
  });

  it("emits the locale's name AND slug together", () => {
    const countries = [country("alpha", { nameTr: "Alfa", nameEn: "Alpha", slugEn: "alpha-en" })];

    expect(pickFeaturedCountries(countries, "tr", ["alpha"])[0]).toMatchObject({
      name: "Alfa",
      slug: "alpha",
    });
    expect(pickFeaturedCountries(countries, "en", ["alpha"])[0]).toMatchObject({
      name: "Alpha",
      slug: "alpha-en",
    });
  });

  it("keeps the curated order and the cap", () => {
    const countries = [country("a"), country("b"), country("c")];

    expect(pickFeaturedCountries(countries, "tr", ["c", "b", "a"], 2).map((i) => i.slug)).toEqual([
      "c",
      "b",
    ]);
  });

  it("carries a null population through rather than substituting a number", () => {
    const countries = [country("alpha", { population: null })];

    expect(pickFeaturedCountries(countries, "tr", ["alpha"])[0]?.population).toBeNull();
  });

  it("passes the continent through as the CONTRACT ENUM, not a translated string", () => {
    const countries = [country("alpha", { continent: "OKYANUSYA" })];

    expect(pickFeaturedCountries(countries, "tr", ["alpha"])[0]?.continent).toBe("OKYANUSYA");
  });
});

/**
 * The hrefs the cards carry are built by `getPathname`, never by string concatenation — the
 * same rule the SEO layer is held to (`lib/seo/routes.fixture.ts`). This exercises the REAL
 * routing table, so a localized-segment change (`/turkiye` ↔ `/en/turkiye`) can never leave
 * the homepage pointing at a path that no longer exists.
 */
describe("featured card hrefs", () => {
  it("resolve through the routing table for both locales", () => {
    const trHref = getPathname({
      locale: "tr",
      href: { pathname: "/turkiye/[slug]", params: { slug: "alpha" } },
    });
    const enHref = getPathname({
      locale: "en",
      href: { pathname: "/dunya/[slug]", params: { slug: "alpha-en" } },
    });

    expect(trHref.startsWith("/")).toBe(true);
    expect(trHref).toContain("alpha");
    expect(enHref.startsWith("/en/")).toBe(true);
    expect(enHref).toContain("alpha-en");
  });
});
