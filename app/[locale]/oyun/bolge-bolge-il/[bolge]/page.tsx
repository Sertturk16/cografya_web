import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GameScreen } from "@/components/game/game-screen";
import { getRegionLabels } from "@/components/game/region-labels";
import { routing, type Locale } from "@/i18n/routing";
import { REGION_KEYS, regionFromSlug, regionSlug } from "@/lib/game/region-slug";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale; bolge: string }>;
}

/**
 * Seven regions × two locales, all known at build time and all cheap — the region
 * identifier is the same string in both locales (`lib/game/region-slug.ts`), so this list
 * is one map over a constant.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    REGION_KEYS.map((region) => ({ locale, bolge: regionSlug(region) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, bolge } = await params;
  const region = regionFromSlug(bolge);
  if (!region) notFound();

  const t = await getTranslations({ locale, namespace: "Game" });
  const regionLabels = await getRegionLabels();

  return buildMetadata({
    locale,
    hrefForLocale: () => ({ pathname: "/oyun/bolge-bolge-il/[bolge]", params: { bolge } }),
    title: t("modeMetaTitle", { mode: regionLabels[region], brand: t("brandName") }),
    description: t("regionRoundDescription", { region: regionLabels[region] }),
    titleAbsolute: true,
    // See `../bolge-bulma/page.tsx` — every play screen is `noindex` in both locales
    // (→ DEC 2026-07-30p).
    surface: "noindex",
  });
}

/**
 * Mode 3, step 2 — the chosen region's own round.
 *
 * The map here draws ONLY this region's provinces (→ DEC 2026-07-30p): the rest of the
 * country is not dimmed, it is absent, and the frame is refitted to what is left. The
 * point is not tidiness — at the same on-screen width a Marmara province is several times
 * the size it is inside a whole-country map, which is the small-province touch-target
 * problem solved by geometry instead of by asking the player to pinch.
 *
 * An unknown region slug is a real 404, never a fallback region (`ENGINEERING.md` §4 #6).
 */
export default async function RegionRoundPage({ params }: PageProps) {
  const { locale, bolge } = await params;
  const region = regionFromSlug(bolge);
  if (!region) notFound();

  setRequestLocale(locale);
  const regionLabels = await getRegionLabels();

  return (
    <div className="container page">
      <GameScreen
        locale={locale}
        mode="provinces"
        modeName={regionLabels[region]}
        region={region}
      />
    </div>
  );
}
