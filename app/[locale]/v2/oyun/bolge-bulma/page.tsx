import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import { buildGameShapes, toTargetEntries } from "@/lib/game/map-shapes";
import { getRegionLabels } from "@/components/game/region-labels";
import { SLUG_PLACEHOLDER } from "@/lib/game/province-url";
import { buildGameRoundModeTag } from "@/lib/game/round-mode-tag";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2GameScreen } from "@/components/v2/v2-game-screen";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Game" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/v2/oyun/bolge-bulma",
    title: t("modeMetaTitle", { mode: t("mode1Name"), brand: t("brandName") }),
    description: t("mode1Body"),
    titleAbsolute: true,
    surface: "noindex",
  });
}

export default async function V2RegionModePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");

  const summaries = await getMapSummaryResilient();
  const regionLabels = await getRegionLabels(locale);
  const allShapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  const targetEntries = toTargetEntries(allShapes);

  const provinceUrlTemplate = getPathname({
    locale,
    href: { pathname: "/v2/turkiye/[slug]", params: { slug: SLUG_PLACEHOLDER } },
  });
  const submitModeTag = buildGameRoundModeTag("regions", null);

  return (
    <V2GameScreen
      mode="regions"
      modeName={t("mode1Name")}
      shapes={allShapes}
      targetEntries={targetEntries}
      regionLabels={regionLabels}
      allowEarlyFinish={false}
      provinceUrlTemplate={provinceUrlTemplate}
      submitModeTag={submitModeTag}
      viewBox={MAP_VIEWBOX}
    />
  );
}
