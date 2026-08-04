import type { CountryListItem, ProvinceListItem } from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";
import type { SearchIndexRecord } from "./types";

/**
 * Builds the per-locale search index from the api list DTOs.
 *
 * Pure by construction: the path builders are passed IN rather than imported, so this
 * module never reaches for `getPathname` and stays testable in the node-only vitest config
 * (the same reason `lib/geo/alphabet.ts` takes a collation locale instead of guessing one).
 * The route handler supplies the real builders.
 *
 * Scope is provinces + countries only (owner rulings AL-4/AL-7): the 43 map territories have
 * no detail page to navigate to, and the static hubs are already one nav click away.
 */
export interface BuildSearchIndexArgs {
  readonly provinces: readonly ProvinceListItem[];
  readonly countries: readonly CountryListItem[];
  readonly locale: Locale;
  /** Localized `/turkiye/{slug}` path for a province slug. */
  readonly provincePath: (slug: string) => string;
  /** Localized `/dunya/{slug}` path for a country slug. */
  readonly countryPath: (slug: string) => string;
}

export function buildSearchIndex(args: BuildSearchIndexArgs): SearchIndexRecord[] {
  const { provinces, countries, locale, provincePath, countryPath } = args;
  const isEnglish = locale === "en";

  return [
    // Province labels are Turkish in BOTH locales — `ProvinceListItem` carries no `nameEn` —
    // exactly as the hub index renders them. Only the slug is per-locale.
    ...provinces.map((province): SearchIndexRecord => [
      province.nameTr,
      provincePath(isEnglish ? province.slugEn : province.slugTr),
      "p",
    ]),
    // Country DTOs carry a name per locale, so the English index searches English names.
    ...countries.map((country): SearchIndexRecord => [
      isEnglish ? country.nameEn : country.nameTr,
      countryPath(isEnglish ? country.slugEn : country.slugTr),
      "c",
    ]),
  ];
}
