import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import {
  AREA_DESCRIPTION_KEY,
  CAPITAL_DESCRIPTION_KEY,
  countryDescriptionVariant,
  GENERIC_DESCRIPTION_KEY,
  NEIGHBORS_DESCRIPTION_KEY,
  POPULATION_DESCRIPTION_KEY,
  selectCountryMetaDescription,
} from "./country-description";

describe("countryDescriptionVariant", () => {
  it("is deterministic for a given ISO code", () => {
    // Same input → same variant, always. Called twice on purpose: the property under test is
    // stability, which is the whole reason the key is not random.
    expect(countryDescriptionVariant("CL")).toBe(countryDescriptionVariant("CL"));
    expect(countryDescriptionVariant("QN")).toBe(countryDescriptionVariant("QN"));
  });

  it("returns 0 | 1 | 2 for every two-letter code and uses all three buckets", () => {
    const seen = new Set<number>();
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of letters) {
      for (const b of letters) {
        const v = countryDescriptionVariant(`${a}${b}`);
        expect([0, 1, 2]).toContain(v);
        seen.add(v);
      }
    }
    // All three variants are actually reachable across the alpha-2 space (the degenerate
    // case this guards is a keying function that collapses onto one bucket).
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("never throws on a degenerate code", () => {
    expect(countryDescriptionVariant("")).toBe(0);
  });

  it("exposes a total key map for every variant", () => {
    expect(POPULATION_DESCRIPTION_KEY[0]).toBe("metaDescriptionPopulation0");
    expect(POPULATION_DESCRIPTION_KEY[1]).toBe("metaDescriptionPopulation1");
    expect(POPULATION_DESCRIPTION_KEY[2]).toBe("metaDescriptionPopulation2");
  });
});

describe("selectCountryMetaDescription — fallback chain", () => {
  // A synthetic country; no real country facts are asserted (CONVENTIONS §2 — tests check
  // structure/invariants, never the data itself).
  const base = {
    locale: "tr",
    isoCode: "ZZ",
    name: "Fixture",
    continent: "Fixture Continent",
    capital: "Fixture City",
  } as const;

  it("population present → population tier, routed through the variant selector", () => {
    const sel = selectCountryMetaDescription({
      ...base,
      population: 19_600_000,
      areaKm2: 756_950,
      neighborCount: 3,
    });
    expect(sel.key).toBe(POPULATION_DESCRIPTION_KEY[countryDescriptionVariant(base.isoCode)]);
    expect(sel.params.population).toBe(19_600_000);
    expect(sel.params.name).toBe("Fixture");
    expect(sel.params.continent).toBe("Fixture Continent");
  });

  it("no population + area → area tier (and never mentions the missing population)", () => {
    const sel = selectCountryMetaDescription({
      ...base,
      population: null,
      areaKm2: 267_668,
      neighborCount: 3,
    });
    expect(sel.key).toBe(AREA_DESCRIPTION_KEY);
    expect(sel.params.area).toBe(267_668);
    expect(sel.params.population).toBeUndefined();
  });

  it("no population/area + neighbours → neighbour tier", () => {
    const sel = selectCountryMetaDescription({
      ...base,
      population: null,
      areaKm2: null,
      neighborCount: 4,
    });
    expect(sel.key).toBe(NEIGHBORS_DESCRIPTION_KEY);
    expect(sel.params.neighborCount).toBe(4);
  });

  it("a ZERO neighbour count is NOT treated as a fact and falls through", () => {
    // Load-bearing: "0 neighbours" would have to be rendered as a border claim, which is not
    // acceptable copy on the sovereignty rows (Kıbrıs Cumhuriyeti / KKTC both carry 0).
    const sel = selectCountryMetaDescription({
      ...base,
      population: null,
      areaKm2: null,
      neighborCount: 0,
    });
    expect(sel.key).toBe(CAPITAL_DESCRIPTION_KEY);
    expect(sel.params.capital).toBe("Fixture City");
  });

  it("all facts null → continent-only generic tier (never throws)", () => {
    const sel = selectCountryMetaDescription({
      ...base,
      capital: null,
      population: null,
      areaKm2: null,
      neighborCount: 0,
    });
    expect(sel.key).toBe(GENERIC_DESCRIPTION_KEY);
    expect(sel.params).toEqual({ name: "Fixture", continent: "Fixture Continent" });
  });

  it("selects the same tier in both locales (facts render on both, no locale gate)", () => {
    const facts = { population: null, areaKm2: 1000, neighborCount: 2 } as const;
    const tr = selectCountryMetaDescription({ ...base, locale: "tr", ...facts });
    const en = selectCountryMetaDescription({ ...base, locale: "en", ...facts });
    expect(en.key).toBe(tr.key);
    expect(en.params).toEqual(tr.params);
  });
});

describe("meta-description keys exist in both locale catalogues (I7 regression guard)", () => {
  // A typo'd key would silently ship a dotted-string ("CountryDetail.metaDescriptionX") into
  // a production <meta>: next-intl logs console.error but does NOT fail the build. This
  // asserts every key the selector can emit is present in both catalogues.
  const emittableKeys = [
    ...Object.values(POPULATION_DESCRIPTION_KEY),
    AREA_DESCRIPTION_KEY,
    NEIGHBORS_DESCRIPTION_KEY,
    CAPITAL_DESCRIPTION_KEY,
    GENERIC_DESCRIPTION_KEY,
  ];
  const catalogues = { tr: trMessages, en: enMessages } as const;

  for (const [locale, messages] of Object.entries(catalogues)) {
    const countryDetail = messages.CountryDetail as Record<string, unknown>;
    for (const key of emittableKeys) {
      it(`${locale}.json CountryDetail.${key} is a non-empty string`, () => {
        expect(typeof countryDetail[key]).toBe("string");
        expect((countryDetail[key] as string).length).toBeGreaterThan(0);
      });
    }
  }
});

describe("description copy honesty (SEO-POLICY §B2.6)", () => {
  const countryDetail = {
    tr: trMessages.CountryDetail as Record<string, string>,
    en: enMessages.CountryDetail as Record<string, string>,
  };

  it("no tier interpolates a fact its own gate does not guarantee", () => {
    // The chain's gates: population tier ⇒ population; area tier ⇒ area; neighbour tier ⇒
    // neighbourCount; capital tier ⇒ capital; generic ⇒ nothing but name + continent. A
    // string that interpolates a placeholder outside its tier would render an ICU error or,
    // worse, a promise the page cannot keep.
    const allowed: Record<string, ReadonlySet<string>> = {
      [POPULATION_DESCRIPTION_KEY[0]]: new Set(["name", "continent", "population"]),
      [POPULATION_DESCRIPTION_KEY[1]]: new Set(["name", "continent", "population"]),
      [POPULATION_DESCRIPTION_KEY[2]]: new Set(["name", "continent", "population"]),
      [AREA_DESCRIPTION_KEY]: new Set(["name", "continent", "area"]),
      [NEIGHBORS_DESCRIPTION_KEY]: new Set(["name", "continent", "neighborCount"]),
      [CAPITAL_DESCRIPTION_KEY]: new Set(["name", "continent", "capital"]),
      [GENERIC_DESCRIPTION_KEY]: new Set(["name", "continent"]),
    };
    for (const [locale, messages] of Object.entries(countryDetail)) {
      for (const [key, permitted] of Object.entries(allowed)) {
        const template = messages[key] ?? "";
        // ICU placeholders: {name}, {population, number}, …
        const used = [...template.matchAll(/\{\s*(\w+)/g)].map((m) => m[1] as string);
        for (const placeholder of used) {
          expect(
            permitted.has(placeholder),
            `${locale}.CountryDetail.${key} interpolates {${placeholder}}`,
          ).toBe(true);
        }
      }
    }
  });

  it("the three population variants are skeleton-distinct in both locales", () => {
    // SEO-POLICY §B10.2: with the entity name masked the corpus must not collapse to one
    // string. Masking here is crude on purpose — it only removes the interpolations, so what
    // is compared is the sentence SHAPE, which is exactly the property under audit.
    for (const messages of Object.values(countryDetail)) {
      const masked = Object.values(POPULATION_DESCRIPTION_KEY).map((key) =>
        (messages[key] ?? "").replace(/\{[^}]*\}/g, "{}"),
      );
      expect(new Set(masked).size).toBe(3);
    }
  });

  it("EN copy never promises the TR-only narrative sections (PR #19 lesson)", () => {
    // EN country pages render chrome + fact sheet only: landform / climate / hydrography /
    // independence prose is all `isTr`-gated. og:title and og:description are emitted even
    // on a noindex page, so an EN string must not advertise content the page does not have.
    const forbidden = [
      "climate",
      "landform",
      "physical geography",
      "relief",
      "hydrography",
      "rivers",
      "independence",
      "currency",
      "official language",
      "government",
    ];
    for (const key of [
      ...Object.values(POPULATION_DESCRIPTION_KEY),
      AREA_DESCRIPTION_KEY,
      NEIGHBORS_DESCRIPTION_KEY,
      CAPITAL_DESCRIPTION_KEY,
      GENERIC_DESCRIPTION_KEY,
    ]) {
      const template = (countryDetail.en[key] ?? "").toLowerCase();
      for (const word of forbidden) {
        expect(template.includes(word), `en.CountryDetail.${key} promises "${word}"`).toBe(false);
      }
    }
  });
});
