import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { searchFallbackHref } from "@/lib/search/fallback-href";
import { SearchCombobox } from "./search-combobox";

/**
 * The header search (→ DEC 2026-08-04i §2). Server half: it resolves the fallback href and
 * the user-facing strings, then hands them to the client island.
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
export async function SiteSearch({ locale }: { locale: Locale }) {
  const t = await getTranslations("Search");

  return (
    <SearchCombobox
      locale={locale}
      fallbackHref={searchFallbackHref(locale)}
      indexUrl={`/api/search-index/${locale}`}
      labels={{
        label: t("label"),
        triggerLabel: t("triggerLabel"),
        placeholder: t("placeholder"),
        openLabel: t("openLabel"),
        closeLabel: t("closeLabel"),
        noResults: t("noResults"),
        resultCount: t("resultCount"),
        seeAll: t("seeAll"),
        province: t("province"),
        country: t("country"),
        loadFailed: t("loadFailed"),
      }}
    />
  );
}
