import type {
  Continent,
  CountryMapSummary,
  GeographicRegion,
  ProvinceMapSummary,
} from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";

/**
 * The homepage's featured province / country cards: a CURATED list, intersected with what
 * the api actually publishes.
 *
 * ## Why curated rather than derived (plan §4.1, mechanism M1)
 *
 * The two derivable orderings both fail the page's job. "Top N by population" is İstanbul,
 * Ankara, İzmir forever — it teaches nothing and never changes. "Most complete page" is not a
 * field the contract carries, so it cannot be read. The point of these six cards is a spread
 * of regions and continents that invites a reader in, and that is an editorial judgement, not
 * a query. So it is written down, in one place, with its reasoning.
 *
 * ## The safety that makes this shippable: INTERSECTION, always
 *
 * A hand-written slug list is a standing invitation to link at a page that does not exist —
 * the soft-404 class `ENGINEERING.md` §4 #6 bans. So the list is never rendered directly:
 * `pickFeatured*` looks each slug up in the api's published set and DROPS anything it cannot
 * resolve. A retired or renamed entity silently produces one card fewer; it can never produce
 * a 404 link. That is also why the curated keys are TR slugs specifically — `slugTr` is the
 * api's stable editorial key, while the rendered href is always the locale's own slug.
 *
 * ## Rotation is deliberately absent (YAGNI)
 *
 * A date-seeded rotation was considered and deferred: it would change the HTML on every ISR
 * window for no measured benefit. The shape here takes it without a rewrite — a seed
 * parameter and a rotate-before-slice — so nothing has to be undone if it is ever wanted.
 */

/**
 * The featured provinces, in render order (TR slugs — the api's stable editorial key).
 *
 * Chosen for REGIONAL SPREAD, which is the one property a reader can feel on sight:
 * Rize (Karadeniz), İstanbul (Marmara), Mersin (Akdeniz) — a wet north coast, the country's
 * largest city, a southern Mediterranean province. Changing this list is an editorial act
 * (owner-approved from rendered samples), not a refactor.
 */
export const FEATURED_PROVINCE_SLUGS: readonly string[] = ["rize", "istanbul", "mersin"];

/**
 * The featured countries, in render order (TR slugs).
 *
 * Chosen for CONTINENTAL SPREAD and for the recognisable/unfamiliar balance the geography
 * brief asks for: Brezilya (Güney Amerika), Japonya (Asya), Çad (Afrika).
 */
export const FEATURED_COUNTRY_SLUGS: readonly string[] = ["brezilya", "japonya", "cad"];

/** How many cards each row may show. A cap, not a promise — the intersection may yield fewer. */
export const FEATURED_LIMIT = 3;

/** One province card's data, already localized. Presentation-free: the component only prints. */
export interface FeaturedProvince {
  /** Plaka kodu — the stable React key. */
  readonly plateCode: string;
  /** Display name. Provinces carry no `nameEn`, so this is `nameTr` in both locales. */
  readonly name: string;
  /** Contract enum → the `Regions` i18n namespace. Never a pre-translated string. */
  readonly region: GeographicRegion;
  /** The LOCALE's slug (`slugTr` on tr, `slugEn` on en). */
  readonly slug: string;
  /** The single fact on the card, or `null` — a card with no number prints no number row. */
  readonly population: number | null;
  /** The year that population belongs to, or `null`. */
  readonly populationYear: number | null;
}

/** One country card's data, already localized. */
export interface FeaturedCountry {
  /** ISO alpha-2 — the stable React key. */
  readonly isoCode: string;
  /** Display name in the render locale (`nameTr` / `nameEn`). */
  readonly name: string;
  /** Contract enum → the `Continents` i18n namespace. */
  readonly continent: Continent;
  /** The LOCALE's slug. */
  readonly slug: string;
  /** The single fact on the card, or `null` — same rule as the province card. */
  readonly population: number | null;
  /** The year that population belongs to; the contract publishes none for most countries. */
  readonly populationYear: number | null;
}

/**
 * The card's single fact, as a MESSAGE KEY + its number — or `null` for "print no row".
 *
 * Two decisions live here, and both are the silent-regression kind, which is why they are a
 * tested pure function rather than an inline arrow in the page component (the plan's own rule:
 * all logic goes under `lib/` as a pure function).
 *
 * 1. A `null` population prints NO row rather than a dash — the map hover card's rule, for the
 *    same reason: a placeholder dash reads as a fault where an absence is simply an absence.
 *    Note it is an explicit `=== null` check: a population of 0 is a real number and must
 *    still print, so a truthiness test would be a bug.
 * 2. A `null` year drops the year clause instead of printing an empty parenthesis — which is
 *    the ordinary case for countries, whose contract publishes no `populationYear`.
 *
 * It returns a KEY and not a string, the way `MARINE_UNIT_KEY` does: translation and number
 * formatting need the request's locale, so they stay in the component while the BRANCHING
 * stays here, inside the node-environment test harness.
 */
export type FeaturedFact =
  | { readonly labelKey: "population"; readonly population: number }
  | { readonly labelKey: "populationWithYear"; readonly year: number; readonly population: number };

export function featuredPopulationFact(
  population: number | null,
  year: number | null,
): FeaturedFact | null {
  if (population === null) return null;
  return year === null
    ? { labelKey: "population", population }
    : { labelKey: "populationWithYear", year, population };
}

/**
 * Curated slugs ∩ published provinces, in the CURATED order, capped at `limit`.
 *
 * The order is the list's, not the api's: these three were picked as a sequence. Unresolvable
 * slugs are dropped silently by design — the alternative (rendering the card anyway) is the
 * soft-404 this function exists to make impossible.
 */
export function pickFeaturedProvinces(
  summaries: readonly ProvinceMapSummary[],
  locale: Locale,
  slugs: readonly string[] = FEATURED_PROVINCE_SLUGS,
  limit: number = FEATURED_LIMIT,
): FeaturedProvince[] {
  const published = new Map(summaries.map((province) => [province.slugTr, province]));

  const picked: FeaturedProvince[] = [];
  for (const slug of slugs) {
    if (picked.length >= limit) break;
    const province = published.get(slug);
    if (province === undefined) continue;
    picked.push({
      plateCode: province.plateCode,
      name: province.nameTr,
      region: province.region,
      slug: locale === "en" ? province.slugEn : province.slugTr,
      population: province.population,
      populationYear: province.populationYear,
    });
  }
  return picked;
}

/**
 * Curated slugs ∩ published countries — the country mirror of `pickFeaturedProvinces`.
 *
 * It reads the MAP-SUMMARY payload rather than the plain country list, for the same reason the
 * province side does: the summary is the purpose-built lean payload that already carries the
 * one numeric fact a card shows, so the page joins one endpoint instead of two and the chip's
 * count is the count of entities the cards can actually resolve against. The plan left this
 * open as an assumption to VERIFY rather than guess (§12 #5) — `CountryMapSummaryDto` does
 * publish `population`, so no api work was needed and the card carries a fact.
 */
export function pickFeaturedCountries(
  countries: readonly CountryMapSummary[],
  locale: Locale,
  slugs: readonly string[] = FEATURED_COUNTRY_SLUGS,
  limit: number = FEATURED_LIMIT,
): FeaturedCountry[] {
  const published = new Map(countries.map((country) => [country.slugTr, country]));

  const picked: FeaturedCountry[] = [];
  for (const slug of slugs) {
    if (picked.length >= limit) break;
    const country = published.get(slug);
    if (country === undefined) continue;
    picked.push({
      isoCode: country.isoCode,
      name: locale === "en" ? country.nameEn : country.nameTr,
      continent: country.continent,
      slug: locale === "en" ? country.slugEn : country.slugTr,
      population: country.population,
      populationYear: country.populationYear,
    });
  }
  return picked;
}
