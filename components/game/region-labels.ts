import { getTranslations } from "next-intl/server";
import type { RegionLabels } from "@/lib/game/target";

/**
 * The seven bölge names in the active locale, from the SHARED `Regions` namespace — so the
 * game, the province pages and the map hub can never disagree about what a region is
 * called.
 *
 * Written out key by key rather than looped over `REGION_KEYS`: next-intl types message
 * keys, and a computed key opts out of that check silently. The compiler still holds the
 * set complete, because `RegionLabels` is `Record<GeographicRegion, string>` and
 * `GeographicRegion` comes from the api contract.
 */
export async function getRegionLabels(): Promise<RegionLabels> {
  const t = await getTranslations("Regions");
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
