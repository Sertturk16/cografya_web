import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { sourcesMessage } from "@/lib/geo/country-sources";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * STRUCTURAL GUARD for the country page's Kaynaklar line (→ PR #47 review TA47-M3; the
 * province sibling lives in `lib/climate/climate-messages.test.ts`).
 *
 * ## The invariant (ruling AP-2 — UNCHANGED)
 *
 * A sentence printed corpus-wide on ~199 country pages may not assert a fact belonging to
 * ONE country. That is what made the Geostat defect so wide: the string carried
 * "(Gürcistan için Geostat 2024 sayımı)" — a footnote true of exactly one country — so Çad,
 * Brezilya and Japonya each cited Georgia's census as a source for their own population
 * (UX tour B13, ruling AP-2).
 *
 * ## What changed, and why (→ DEC 2026-08-07c)
 *
 * This guard used to enforce that invariant through a PROXY: "the sentence carries no ICU
 * placeholder". The proxy fell on the wrong side. The static sentence it protected still
 * hardcoded `Dünya Bankası` as the population credit — an assertion that is FALSE on five
 * pages (GL/CY/QN/TW/TR), i.e. the very defect class AP-2 exists to prevent, just quietly.
 *
 * DEC 2026-08-05j (owner-ruled) made the credit data-driven: the api resolves
 * `populationSourceNameTr/En` per country and the page interpolates it. A placeholder fed
 * per entity does not breach AP-2 — it SATISFIES it, because each page then asserts only
 * its own source. Deferring per-country credits to a `/veri-kaynaklari` page was option C
 * of that same ruling and was REJECTED, so the old comment pointing there is gone.
 *
 * The invariant is therefore unchanged and the proxy is replaced: instead of banning every
 * placeholder, the guard now pins EXACTLY which placeholder each key must carry, in the
 * positive `REQUIRED_PLACEHOLDERS` shape already used by
 * `lib/climate/climate-messages.test.ts`. That is strictly stronger — it also catches a
 * dropped or renamed interpolation, which the old ban could not see.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts the SHAPE of the sentence — which
 * placeholder, no country-specific qualifier, the §16 semicolon ceiling, ICU-formattable —
 * and never the wording of the source list or the name of any institution. Pinning
 * "CYSTAT" here would nail the api's seed to a web test.
 */

/** The two Kaynaklar keys and the placeholder set each one must carry, exactly. */
const REQUIRED_PLACEHOLDERS = {
  /** The default line: the population credit is interpolated per country. */
  sources: ["populationSource"],
  /**
   * The variant for a country whose `population` is null (today: Antarktika alone). The
   * population clause is dropped entirely, so this key must carry NO placeholder — if it
   * ever grew one, the page would print a raw `{populationSource}` at the reader.
   */
  sourcesNoPopulation: [],
} as const satisfies Record<string, readonly string[]>;

const SOURCE_KEYS = Object.keys(REQUIRED_PLACEHOLDERS) as (keyof typeof REQUIRED_PLACEHOLDERS)[];

/**
 * Country-specific tokens that must never appear in a string every country page prints.
 * `Geostat` is the one that shipped; the country names are the trailing edge of the same
 * mistake (a qualifier naming ONE country inside the shared sentence). Checked on BOTH
 * keys — the no-population variant is corpus-wide by construction too, even though exactly
 * one page reaches it today.
 */
const COUNTRY_SPECIFIC_TOKENS = [
  "Geostat",
  "Gürcistan",
  "Georgia",
  // Added with the no-population variant (PR #54). That key is written FOR one page, so
  // naming the entity in it would be the Geostat shape again — the string must describe
  // which fields it credits, never which country it was cut for.
  "Antarktika",
  "Antarctica",
] as const;

/**
 * `CONTENT-STYLE.md` §16: at most ONE semicolon per paragraph. The Kaynaklar line renders
 * as a single `<p>`, so the whole string is one paragraph. `sources` carried FOUR in both
 * locales before this work; `sourcesNoPopulation` is new here and never carried any. The
 * ceiling is pinned for both so the next edit cannot quietly reintroduce the chain.
 */
const MAX_SEMICOLONS_PER_PARAGRAPH = 1;

/**
 * The lexeme each locale's template puts immediately in front of the population credit.
 *
 * This is the only structural handle on the property that makes `sourcesNoPopulation` a
 * distinct key rather than a copy of `sources`: that it credits NO population source
 * (→ PR #54 `TA54-M2`). Every other assertion here is negative or shape-only, so before
 * this one it was possible to rewrite the variant back to "… nüfus Dünya Bankası." and
 * keep the whole suite green — the hardcoded-false-credit shape `DEC 2026-08-05j` exists
 * to end, walking back in through the single page nobody watches.
 *
 * It is a TEMPLATE lexeme, not a geography fact, so `CONVENTIONS.md` §2's ban on per-entity
 * literal facts is not engaged. The two assertions below move together: if the wording ever
 * changes, both fail at once and one constant is updated, rather than the invariant rotting
 * silently.
 */
const POPULATION_LEXEME: Record<string, string> = { tr: "nüfus", en: "population" };

/**
 * Lexemes the ENGLISH Kaynaklar sentence may not contain, because the field each one names
 * is `isTr`-gated in `app/[locale]/dunya/[slug]/page.tsx` and therefore never drawn on an
 * English page (→ PR #54 `CR54-M2` + `n`).
 *
 * ## What shipped, and what the finding got wrong
 *
 * The EN sentence credited four things an English reader cannot see: the UN M49 SUBREGION
 * (`isTr && showsSubregionCard(...)`, and the field is `unSubregionTr` — there is no EN
 * counterpart), the government form (`isTr && governmentFormTr !== null`), the currency
 * (`isTr && currencyNameTr !== null`) and the physical-geography prose (`landformNoteTr`,
 * `climateNoteTr`, `hydrographyNoteTr`, `independenceNoteTr` — all `isTr`).
 *
 * The CONTINENT is deliberately NOT on this list. `CR54-M2` read "continent and region
 * classification" as ONE credited item and assumed both halves were gated; they are not.
 * `country.continent` is a locale-independent enum key printed through the `Continents`
 * namespace with no gate at all, so the M49 credit is EARNED on an English page. Deleting
 * it would be the same defect pointing the other way: a rendered field left uncredited.
 * That is why `"continent"` must never be added here.
 *
 * ## Why a ban list, and the limit of one
 *
 * This is the mirror of {@link POPULATION_LEXEME}: a TEMPLATE lexeme, not a geography fact,
 * so `CONVENTIONS.md` §2's ban on per-entity literal facts is not engaged — no country, no
 * institution, no figure appears here. It matches substrings literally, so a REWORDED credit
 * ("form of government", "the region it sits in") would slip through. It is kept anyway: this
 * defect class shipped once and survived a full review round, and a guard that pins the exact
 * wording that shipped beats no guard at all.
 *
 * ## When this list must CHANGE, not be deleted
 *
 * These fields are gated by locale, not by whether they exist. When `EN_CONTENT_READY`
 * (`lib/seo/indexing.ts`) is flipped and the `isTr` gates come out, the English page starts
 * rendering all four — at which point the sentence must credit them again and this list
 * empties. The flip checklist in that file names this test so the content wave finds it.
 */
const TR_GATED_FIELD_LEXEMES = ["region", "currenc", "government", "physical geography"] as const;

const catalogues = { tr: trMessages.CountryDetail, en: enMessages.CountryDetail } as const;

/** Placeholder names an ICU pattern actually declares, in source order. */
function declaredPlaceholders(pattern: string): string[] {
  return [...pattern.matchAll(/\{\s*([a-zA-Z][a-zA-Z0-9_]*)/g)].map((match) => match[1] ?? "");
}

describe("CountryDetail sources line", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(SOURCE_KEYS)("resolves %s to a non-empty string", (key) => {
        expect(typeof catalogue[key]).toBe("string");
        expect(catalogue[key].trim().length).toBeGreaterThan(0);
      });

      it.each(SOURCE_KEYS)("declares exactly the placeholders %s is allowed", (key) => {
        expect(declaredPlaceholders(catalogue[key]).sort()).toEqual(
          [...REQUIRED_PLACEHOLDERS[key]].sort(),
        );
      });

      it.each(SOURCE_KEYS)("keeps %s free of any country-specific qualifier", (key) => {
        for (const token of COUNTRY_SPECIFIC_TOKENS) {
          expect(catalogue[key]).not.toContain(token);
        }
      });

      it.each(SOURCE_KEYS)("holds %s to the §16 semicolon ceiling", (key) => {
        expect((catalogue[key].match(/;/g) ?? []).length).toBeLessThanOrEqual(
          MAX_SEMICOLONS_PER_PARAGRAPH,
        );
      });

      it("credits a population source in `sources` and none in `sourcesNoPopulation`", () => {
        const lexeme = POPULATION_LEXEME[locale];
        expect(lexeme).toBeDefined();
        expect(catalogue.sources).toContain(lexeme);
        expect(catalogue.sourcesNoPopulation).not.toContain(lexeme);
      });

      it.each(SOURCE_KEYS)("formats %s through next-intl and substitutes it", (key) => {
        // Turkish carries apostrophes ("Bakanlığı'ndan"), which ICU treats as quoting when
        // they touch a brace — an editor moving one next to `{populationSource}` would
        // silently stop the substitution. Run the REAL pipeline (`createTranslator`, the
        // sync sibling of the page's `getTranslations`) with a structural stub value, never
        // a real institution name.
        const stub = "__SOURCE__";
        const t = createTranslator({
          locale,
          messages: { CountryDetail: catalogue },
          namespace: "CountryDetail",
          onError: (error) => {
            throw error;
          },
        });
        const formatted = t(
          key,
          Object.fromEntries(REQUIRED_PLACEHOLDERS[key].map((name) => [name, stub])),
        );

        expect(formatted).not.toMatch(/[{}]/);
        if (REQUIRED_PLACEHOLDERS[key].length > 0) {
          expect(formatted).toContain(stub);
        }
      });
    });
  }
});

describe("CountryDetail sources line — EN credit scope", () => {
  it.each(SOURCE_KEYS)("credits nothing in %s that the EN page does not render", (key) => {
    const sentence = catalogues.en[key].toLowerCase();
    for (const lexeme of TR_GATED_FIELD_LEXEMES) {
      expect(sentence).not.toContain(lexeme);
    }
  });

  it("keeps the credits the EN page DOES earn", () => {
    // The negative test above has one failure mode: satisfying it by deleting the whole
    // sentence. These four are rendered on every English country page — continent
    // unconditionally, the others whenever the api has the value — so they are pinned
    // positively. Lexemes only; no institution name, no country, no figure.
    for (const key of SOURCE_KEYS) {
      const sentence = catalogues.en[key].toLowerCase();
      for (const lexeme of ["country", "continent", "area", "neighbouring"]) {
        expect(sentence).toContain(lexeme);
      }
    }
  });
});

/**
 * SELECTION guard (→ PR #54 `TA54-M3`). The catalogue tests above prove both sentences are
 * well formed; they cannot prove the page picks the right one. These two failure modes are
 * independent — the catalogue can be perfect while the branch is inverted — and the branch
 * used to live inside the Server Component, which `vitest.config.ts` never collects.
 *
 * Structural only: no institution name, no country name, no population figure.
 */
describe("sourcesMessage", () => {
  it("credits the resolved source and passes it through untouched", () => {
    // A structural stub. The web must not transform the api's institution names — no
    // casing, no article, no trimming — so the value is asserted identical, not merely
    // present.
    const resolved = "__SOURCE__";
    expect(sourcesMessage(resolved)).toEqual({
      key: "sources",
      values: { populationSource: resolved },
    });
  });

  it("takes the no-population sentence when the contract says `null`", () => {
    expect(sourcesMessage(null)).toEqual({ key: "sourcesNoPopulation", values: {} });
  });

  it.each([
    ["undefined — an api older than the field (deploy skew)", undefined],
    ["empty string — present but carrying no credit", ""],
  ])("takes the no-population sentence off-contract: %s", (_case, value) => {
    // Neither state is reachable through the committed contract, which is exactly why an
    // exact `=== null` check missed them: TypeScript proves them impossible against the
    // spec, and the web never validates the response body at runtime.
    expect(sourcesMessage(value)).toEqual({ key: "sourcesNoPopulation", values: {} });
  });

  it("never invents a credit of its own", () => {
    // The api field comment forbids a client-side `?? "Dünya Bankası"` default. The unknown
    // state must select the sentence written for it, never fabricate a source.
    for (const empty of [null, undefined, ""]) {
      const message = sourcesMessage(empty);
      expect(message.key).toBe("sourcesNoPopulation");
      expect(Object.keys(message.values)).toHaveLength(0);
    }
  });
});
