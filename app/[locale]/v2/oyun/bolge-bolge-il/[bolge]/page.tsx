import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import { viewBoxForPaths } from "@/lib/game/map-bbox";
import { buildGameShapes, toTargetEntries } from "@/lib/game/map-shapes";
import { getRegionLabels } from "@/components/game/region-labels";
import { REGION_KEYS, regionFromSlug, regionSlug } from "@/lib/game/region-slug";
import { SLUG_PLACEHOLDER } from "@/lib/game/province-url";
import { buildGameRoundModeTag } from "@/lib/game/round-mode-tag";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2GameScreen } from "@/components/v2/v2-game-screen";

interface PageProps {
  params: Promise<{ locale: Locale; bolge: string }>;
}

export function generateStaticParams() {
  return REGION_KEYS.flatMap((region) => [
    { locale: "tr" as const, bolge: regionSlug(region) },
    { locale: "en" as const, bolge: regionSlug(region) },
  ]);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, bolge } = await params;
  const region = regionFromSlug(bolge);
  if (!region) return { title: "Bölge Bulunamadı" };

  const t = await getTranslations({ locale, namespace: "Game" });
  const regionLabels = await getRegionLabels(locale);
  const regionName = regionLabels[region];

  return buildMetadata({
    locale,
    hrefForLocale: () => ({ pathname: "/v2/oyun/bolge-bolge-il/[bolge]", params: { bolge } }),
    title: t("modeMetaTitle", { mode: `${regionName} İlleri`, brand: t("brandName") }),
    description: `${regionName} kapsamındaki illeri dilsiz haritada bulma sınavı.`,
    titleAbsolute: true,
    surface: "noindex",
  });
}

export default async function V2RegionalProvinceModePage({ params }: PageProps) {
  const { locale, bolge } = await params;
  setRequestLocale(locale);

  const region = regionFromSlug(bolge);
  if (!region) notFound();

  const summaries = await getMapSummaryResilient();
  const regionLabels = await getRegionLabels(locale);
  const allShapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  const shapes = allShapes.filter((shape) => shape.target?.region === region);
  const targetEntries = toTargetEntries(shapes);

  const viewBox = viewBoxForPaths(shapes.map((s) => s.d)) ?? MAP_VIEWBOX;
  const provinceUrlTemplate = getPathname({
    locale,
    href: { pathname: "/v2/turkiye/[slug]", params: { slug: SLUG_PLACEHOLDER } },
  });
  const submitModeTag = buildGameRoundModeTag("provinces", region);
  const regionName = regionLabels[region];

  return (
    <V2GameScreen
      mode="provinces"
      modeName={`${regionName} İlleri`}
      shapes={shapes}
      targetEntries={targetEntries}
      regionLabels={regionLabels}
      allowEarlyFinish={false}
      provinceUrlTemplate={provinceUrlTemplate}
      submitModeTag={submitModeTag}
      region={region}
      viewBox={viewBox}
    />
  );
}
