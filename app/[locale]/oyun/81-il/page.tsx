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
    hrefForLocale: () => "/oyun/81-il",
    title: t("modeMetaTitle", { mode: t("mode2Name"), brand: t("brandName") }),
    description: t("mode2Body"),
    titleAbsolute: true,
    // See `bolge-bulma/page.tsx` — every play screen is `noindex` in both locales
    // (→ DEC 2026-07-30p).
    surface: "noindex",
  });
}

/** Mode 2 — 81 İl Bulma. Every seeded province, once, in shuffled order. */
export default async function ProvinceModePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");

  return (
    <div className="container page">
      <GameScreen locale={locale} mode="provinces" modeName={t("mode2Name")} />
    </div>
  );
}
