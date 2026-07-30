import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { RegionLabels } from "@/lib/game/target";

/**
 * The seven bölge names in the given locale, from the SHARED `Regions` namespace — so the
 * game, the province pages and the map hub can never disagree about what a region is
 * called.
 *
 * The locale is a REQUIRED argument rather than the request-scoped one, because the first
 * caller is a `generateMetadata`. There it works either way today — an ancestor layout's
 * `setRequestLocale` has already populated the cache next-intl would fall back on — but
 * that is an ordering guarantee held by a different file, and every other
 * `generateMetadata` in this repo passes its locale explicitly. Made explicit here too, so
 * an EN title can never silently come back Turkish.
 *
 * Written out key by key rather than looped over `REGION_KEYS`: next-intl types message
 * keys, and a computed key opts out of that check silently. The compiler still holds the
 * set complete, because `RegionLabels` is `Record<GeographicRegion, string>` and
 * `GeographicRegion` comes from the api contract.
 */
export async function getRegionLabels(locale: Locale): Promise<RegionLabels> {
  const t = await getTranslations({ locale, namespace: "Regions" });
  return {
    MARMARA: t("MARMARA"),
    EGE: t("EGE"),
    AKDENIZ: t("AKDENIZ"),
    IC_ANADOLU: t("IC_ANADOLU"),
    KARADENIZ: t("KARADENIZ"),
    DOGU_ANADOLU: t("DOGU_ANADOLU"),
    GUNEYDOGU_ANADOLU: t("GUNEYDOGU_ANADOLU"),
  };
}
