import type { Locale } from "@/i18n/routing";
import { countryIndexHref, provinceIndexHref } from "@/lib/search/index-hrefs";
import { SearchCombobox } from "./search-combobox";

/**
 * The header search (→ DEC 2026-08-04i §2). Server half: it resolves the two hub-index hrefs
 * for this locale and picks the matching index endpoint, then hands them to the client island.
 *
 * It deliberately resolves NO user-facing strings. The island reads them from
 * `useTranslations` itself, which is what lets a count be formatted with real ICU
 * pluralisation at the point the count is known (PR #45 review I1/M6).
 *
 * The island is what renders — including on the server. Before hydration (and forever, if
 * the bundle never arrives) it is a real `<a>` pointing at the alphabetical province index,
 * so the control in the first HTML response is a working link rather than an inert box. The
 * combobox replaces it in place, inside the same fixed-size slot, so the upgrade costs no
 * layout shift.
 *
 * No search-results URL is ever produced: selecting a hit navigates straight to the entity's
 * own page. A crawlable `/ara?q=…` surface would be an unbounded set of thin pages and a
 * direct `SEO-POLICY.md` §B12.2 doorway exposure. For the same reason no `SearchAction`
 * markup is emitted — Google removed the sitelinks search box on 2024-11-21, so it would be
 * dead structured data.
 */
export function SiteSearch({ locale }: { locale: Locale }) {
  return (
    <SearchCombobox
      provinceIndexHref={provinceIndexHref(locale)}
      countryIndexHref={countryIndexHref(locale)}
      indexUrl={`/api/search-index/${locale}`}
    />
  );
}
