import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
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
