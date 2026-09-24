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
import { PlaySuspense } from "@/components/patterns/page-skeleton";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2GameScreen } from "@/components/v2/v2-game-screen";

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
    surface: "noindex",
  });
}

async function ProvinceGame({
  locale,
  modeName,
  regionLabels,
}: {
  locale: Locale;
  modeName: string;
  regionLabels: Awaited<ReturnType<typeof getRegionLabels>>;
}) {
  const summaries = await getMapSummaryResilient();
  const allShapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  const targetEntries = toTargetEntries(allShapes);

  return (
    <V2GameScreen
      mode="provinces"
      modeName={modeName}
      shapes={allShapes}
      targetEntries={targetEntries}
      regionLabels={regionLabels}
      allowEarlyFinish={true}
      provinceUrlTemplate={getPathname({
        locale,
        href: { pathname: "/turkiye/[slug]", params: { slug: SLUG_PLACEHOLDER } },
      })}
      submitModeTag={buildGameRoundModeTag("provinces", null)}
      viewBox={MAP_VIEWBOX}
      currentPath="/oyun/81-il"
    />
  );
}

export default async function V2ProvinceModePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");
  const regionLabels = await getRegionLabels(locale);

  return (
    <>
      <V2Header />
      <V2LiveTicker />
      <PlaySuspense>
        <ProvinceGame locale={locale} modeName={t("mode2Name")} regionLabels={regionLabels} />
      </PlaySuspense>
    </>
  );
}
