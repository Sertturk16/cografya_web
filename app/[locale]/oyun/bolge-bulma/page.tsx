import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GameScreen } from "@/components/game/game-screen";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Game" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/oyun/bolge-bulma",
    title: t("modeMetaTitle", { mode: t("mode1Name"), brand: t("brandName") }),
    description: t("mode1Body"),
    titleAbsolute: true,
    // `noindex, follow` in BOTH locales (→ DEC 2026-07-30p): a play screen, not a
    // document. `follow` keeps the links it carries in the crawl graph, and the surface
    // also drops the page out of the hreflang cluster and out of the sitemap —
    // `lib/seo/indexing.ts` is the single place that decides all three.
    surface: "noindex",
  });
}

/** Mode 1 — Bölge Bulma. Seven questions, one per coğrafi bölge. */
export default async function RegionModePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");

  return (
    <div className="container page">
      <GameScreen locale={locale} mode="regions" modeName={t("mode1Name")} />
    </div>
  );
}
