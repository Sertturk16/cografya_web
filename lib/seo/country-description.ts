import type { Locale } from "@/i18n/routing";

/**
 * Deterministic meta-description variant selection for country pages — the `/dunya` twin of
 * `province-description.ts`, built to close the country half of the 2026-07-21 FENER retro
 * audit (§B2.2 "no concrete fact", §B2.3/§B10.2 "one skeleton across the corpus",
 * §B10.3 "0% of descriptions carry a concrete fact").
 *
 * Everything it needs is already on `CountryDetailDto` and already rendered on the page:
 * NO api change, NO extra build-time fetch.
 */
export type CountryDescriptionVariant = 0 | 1 | 2;

/**
 * The variant index for a country, from its ISO 3166-1 alpha-2 code.
 *
 * **Why `isoCode` is the country analogue of the province's `plateCode`** (the key chosen in
 * W2 for the same job): both are the entity's official, immutable, always-present short
 * code. `isoCode` is non-null on the DTO for every row — the api even self-assigns codes to
 * the special-status entities (`QN` for KKTC, `XK` for Kosova, → DEC 2026-07-13), so there
 * is no null branch to invent a fallback for.
 *
 * Rejected alternatives, for the record:
 * - `slugTr` — slugs are editorial and can legitimately be revised; a revision would
 *   silently rewrite a live `<meta>` for a URL whose content did not change.
 * - `isoCodeAlpha3` — nullable (KKTC and Kosova have none), so it would need a fallback
 *   that is itself an undocumented second key.
 *
 * The choice is **deterministic, never random**: a random pick would emit a different
 * `<meta>` from build to build for the same URL, which is SEO churn. Alpha-2 codes are
 * letters rather than digits, so the code is summed to an integer first; measured across the
 * live 196-country corpus the buckets come out 66 / 57 / 73 — varied, not degenerate.
 * `charCodeAt` is never negative, so `((n % 3) + 3) % 3` is defensive only (it mirrors the
 * province helper and keeps the modulo correct if the input ever changes shape). An empty
 * code yields variant 0 rather than throwing: the description is best-effort chrome and is
 * never a reason to 500 a page.
 */
export function countryDescriptionVariant(isoCode: string): CountryDescriptionVariant {
  let sum = 0;
  for (let i = 0; i < isoCode.length; i++) {
    sum += isoCode.charCodeAt(i);
  }
  return (((sum % 3) + 3) % 3) as CountryDescriptionVariant;
}

/** The three population-tier description message keys, indexed by variant. */
export const POPULATION_DESCRIPTION_KEY: Record<CountryDescriptionVariant, string> = {
  0: "metaDescriptionPopulation0",
  1: "metaDescriptionPopulation1",
  2: "metaDescriptionPopulation2",
};

/**
 * The remaining fallback tiers. Each tier's copy may only promise what a page reaching THAT
 * tier actually renders (SEO-POLICY §B2.6) — e.g. the area tier never mentions population,
 * because it is selected precisely when population is absent. Single-sourced here so the
 * catalogue-totality test and the selector reference the same literals.
 */
export const AREA_DESCRIPTION_KEY = "metaDescriptionArea";
export const NEIGHBORS_DESCRIPTION_KEY = "metaDescriptionNeighbors";
export const CAPITAL_DESCRIPTION_KEY = "metaDescriptionCapital";
export const GENERIC_DESCRIPTION_KEY = "metaDescription";

export interface CountryDescriptionInput {
  locale: Locale;
  isoCode: string;
  population: number | null;
  areaKm2: number | null;
  /** Server-derived neighbour count; always present, 0 for island nations. */
  neighborCount: number;
  /** The capital in the ACTIVE locale (capitalNameTr / capitalNameEn), or null. */
  capital: string | null;
  name: string;
  /** The localized continent label (already resolved through the Continents catalogue). */
  continent: string;
}

export interface CountryDescriptionSelection {
  key: string;
  params: Record<string, string | number>;
}

/**
 * Selects the meta-description message key + ICU params for a country page, applying the
 * graceful fallback chain **population → area → neighbour count → capital → continent-only
 * generic**. Pure and DOM-free (returns the key/params, not the rendered string) so the
 * routing is unit-testable without i18n or jsdom — the caller does the `t(key, params)`.
 *
 * Notes on the chain, in the order a reviewer will ask about them:
 *
 * - **Population is the top tier and the only one that rotates.** Three skeleton-distinct
 *   variants (SEO-POLICY §A2/#4: the corpus must not collapse to one sentence shape when the
 *   entity name is masked) are spread deterministically by `countryDescriptionVariant`. The
 *   lower tiers do not rotate because they have a handful of members at most — rotation
 *   there would buy nothing and cost four more strings per locale.
 * - **The neighbour tier requires `neighborCount > 0`.** A zero is a real number but not a
 *   usable prose fact, and turning it into one ("has no land neighbours") would be an
 *   editorial claim about borders — unacceptable on the sovereignty rows (Kıbrıs
 *   Cumhuriyeti / KKTC both carry 0 in the seed, → DEC 2026-07-13). Zero therefore falls
 *   through to the capital tier, which is a real named feature (§A2/#1 counts a named
 *   feature as a concrete fact).
 * - **No locale gate.** Unlike the province climate tier, every fact used here — population,
 *   area, neighbour count, capital, continent — renders in the fact sheet on BOTH locales,
 *   so no tier can promise content the EN page lacks. What the EN *copy* may promise is
 *   narrower than TR (the narrative sections are `isTr`-gated), and that is handled in the
 *   `en.json` strings, not by a branch here.
 * - Against today's seed the tiers resolve as 191 / 4 / 0 / 1 / 0 across the 196 countries.
 *   The empty tiers are guards, not dead code: they are the honest answer for a future row
 *   seeded with fewer facts, and each one still carries a concrete fact.
 */
export function selectCountryMetaDescription(
  input: CountryDescriptionInput,
): CountryDescriptionSelection {
  const { isoCode, population, areaKm2, neighborCount, capital, name, continent } = input;

  if (population !== null) {
    const variant = countryDescriptionVariant(isoCode);
    return {
      key: POPULATION_DESCRIPTION_KEY[variant],
      params: { name, continent, population },
    };
  }
  if (areaKm2 !== null) {
    return { key: AREA_DESCRIPTION_KEY, params: { name, continent, area: areaKm2 } };
  }
  if (neighborCount > 0) {
    return { key: NEIGHBORS_DESCRIPTION_KEY, params: { name, continent, neighborCount } };
  }
  if (capital !== null) {
    return { key: CAPITAL_DESCRIPTION_KEY, params: { name, continent, capital } };
  }
  return { key: GENERIC_DESCRIPTION_KEY, params: { name, continent } };
}
