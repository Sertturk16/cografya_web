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
import { TR_GATED_FIELD_LEXEMES } from "./en-gated-lexemes";

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
    sovereigntyNote: null,
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

  it("treats population/area ZERO as a real fact (gate is `!== null`, never truthiness)", () => {
    // A future refactor to `if (population)` would silently drop a 0-population row to the
    // area tier. No live row carries 0, but the DTO allows it and the gate's intent is
    // explicit — this pins it.
    const zeroPop = selectCountryMetaDescription({
      ...base,
      population: 0,
      areaKm2: 1000,
      neighborCount: 2,
    });
    expect(zeroPop.key).toBe(POPULATION_DESCRIPTION_KEY[countryDescriptionVariant(base.isoCode)]);
    expect(zeroPop.params.population).toBe(0);

    const zeroArea = selectCountryMetaDescription({
      ...base,
      population: null,
      areaKm2: 0,
      neighborCount: 2,
    });
    expect(zeroArea.key).toBe(AREA_DESCRIPTION_KEY);
    expect(zeroArea.params.area).toBe(0);
  });

  it("selects the same tier in both locales (facts render on both, no locale gate)", () => {
    const facts = { population: null, areaKm2: 1000, neighborCount: 2 } as const;
    const tr = selectCountryMetaDescription({ ...base, locale: "tr", ...facts });
    const en = selectCountryMetaDescription({ ...base, locale: "en", ...facts });
    expect(en.key).toBe(tr.key);
    expect(en.params).toEqual(tr.params);
  });
});

describe("selectCountryMetaDescription — special-status rows short-circuit the chain", () => {
  // Structure/invariant only: what is pinned is that a row carrying the api's
  // `sovereigntyNoteTr` marker never reaches the ISO-keyed rotation or the capital tier, so
  // its SERP framing cannot be decided by a checksum over an internal code. No country facts
  // are asserted here (CONVENTIONS §2).
  const special = {
    locale: "tr",
    isoCode: "ZZ",
    name: "Fixture",
    continent: "Fixture Continent",
    capital: "Fixture City",
    sovereigntyNote: "Fixture sovereignty note.",
  } as const;

  it("routes to the fixed variant-1 skeleton regardless of the ISO code", () => {
    // Every alpha-2 code, including the ones whose checksum would otherwise pick variant
    // 0 or 2 — the property under test is that the code no longer decides.
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of letters) {
      for (const b of letters) {
        const sel = selectCountryMetaDescription({
          ...special,
          isoCode: `${a}${b}`,
          population: 1_000,
          areaKm2: 5_000,
          neighborCount: 3,
        });
        expect(sel.key).toBe(POPULATION_DESCRIPTION_KEY[1]);
      }
    }
  });

  it("never reaches the area, neighbour or capital tier when facts are missing", () => {
    const sel = selectCountryMetaDescription({
      ...special,
      population: null,
      areaKm2: 5_000,
      neighborCount: 3,
    });
    // Not a tier SKIP: the area/neighbour skeletons carry the same copula the branch exists
    // to avoid, so the only fallthrough is the (copula-free) generic.
    expect(sel.key).toBe(GENERIC_DESCRIPTION_KEY);
    expect(sel.params).toEqual({ name: "Fixture", continent: "Fixture Continent" });
  });

  it("leaves ordinary rows on the normal chain", () => {
    const sel = selectCountryMetaDescription({
      ...special,
      sovereigntyNote: null,
      population: null,
      areaKm2: 5_000,
      neighborCount: 3,
    });
    expect(sel.key).toBe(AREA_DESCRIPTION_KEY);
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

  it("no tier NAMES a fact-sheet figure its own gate does not guarantee (prose, not ICU)", () => {
    // The test above catches an interpolated fact; this one catches a fact named in the
    // PROSE tail, which is the hole the PR #22 review found (the EN generic tier promised
    // "its capital" on the one branch where capital is null by construction). Placeholders
    // are stripped first, so what is inspected is only the copy a searcher reads.
    //
    // Scope = the three NULLABLE fact-sheet figures. The TR-only narrative sections named in
    // the TR copy (yeryüzü şekilleri / iklim / hidrografya) are deliberately NOT in scope:
    // they are non-null across the whole closed corpus and no tier selects against them, so
    // a static word list would be wrong there (that finding was adversarially refuted).
    const FACT_WORDS = {
      population: ["nüfus", "population"],
      area: ["yüzölçüm", "area"],
      capital: ["başkent", "capital"],
    } as const;
    type Fact = keyof typeof FACT_WORDS;
    const guaranteed: Record<string, readonly Fact[]> = {
      [POPULATION_DESCRIPTION_KEY[0]]: ["population"],
      [POPULATION_DESCRIPTION_KEY[1]]: ["population"],
      [POPULATION_DESCRIPTION_KEY[2]]: ["population"],
      [AREA_DESCRIPTION_KEY]: ["area"],
      [NEIGHBORS_DESCRIPTION_KEY]: [],
      [CAPITAL_DESCRIPTION_KEY]: ["capital"],
      [GENERIC_DESCRIPTION_KEY]: [],
    };
    for (const [locale, messages] of Object.entries(countryDetail)) {
      for (const [key, allowedFacts] of Object.entries(guaranteed)) {
        const prose = (messages[key] ?? "").replace(/\{[^}]*\}/g, " ").toLowerCase();
        for (const fact of Object.keys(FACT_WORDS) as Fact[]) {
          if (allowedFacts.includes(fact)) continue;
          for (const word of FACT_WORDS[fact]) {
            expect(
              prose.includes(word),
              `${locale}.CountryDetail.${key} promises "${fact}", which its gate does not guarantee`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("the skeletons a special-status row can reach never predicate statehood", () => {
    // The whole point of the `isSpecialStatusRow` early return (PR #22 filter, C1/I1): a
    // contested row's SERP snippet states location and a concrete figure, and leaves
    // recognition to the owner-ruled `sovereigntyNoteTr`. A future copy pass that reflows a
    // copula back into either reachable skeleton silently re-opens it, so it is pinned here.
    const copulas = ["bir ülkedir", "bir ülke.", "is a country"];
    for (const [locale, messages] of Object.entries(countryDetail)) {
      for (const key of [POPULATION_DESCRIPTION_KEY[1], GENERIC_DESCRIPTION_KEY]) {
        const template = (messages[key] ?? "").toLowerCase();
        for (const copula of copulas) {
          expect(
            template.includes(copula),
            `${locale}.CountryDetail.${key} predicates statehood ("${copula}")`,
          ).toBe(false);
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
    //
    // The list moved to `lib/seo/en-gated-lexemes.ts` (→ PR #55 `CR55-M1`). It used to be a
    // local literal here while `lib/geo/country-sources.test.ts` kept a second, shorter copy
    // for the same invariant on the `Sources:` sentence — two lists, divergent on the day the
    // second landed. Promising a section and crediting its source are two failure modes of
    // one rule, so both guards now read one list.
    for (const key of [
      ...Object.values(POPULATION_DESCRIPTION_KEY),
      AREA_DESCRIPTION_KEY,
      NEIGHBORS_DESCRIPTION_KEY,
      CAPITAL_DESCRIPTION_KEY,
      GENERIC_DESCRIPTION_KEY,
    ]) {
      const template = (countryDetail.en[key] ?? "").toLowerCase();
      for (const word of TR_GATED_FIELD_LEXEMES) {
        expect(template.includes(word), `en.CountryDetail.${key} promises "${word}"`).toBe(false);
      }
    }
  });
});
