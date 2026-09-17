import type { Metadata } from "next";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { getMarinePointsSafe, getMarineOverviewSafe } from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { Locale } from "@/i18n/routing";
import type { MarineOverviewPoint } from "@/lib/api/types";
import { breadcrumbJsonLd, learningResourceJsonLd, faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SeaBasinDetailView } from "@/components/v2/v2-sea-basin-detail-view";
import type { MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { SEA_BASINS_DETAIL } from "@/lib/marine/sea-basins-detail";
import { marineBlockValues, oldestValidAt, maxGridDistanceKm } from "@/lib/marine/vintage";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => "/deniz/marmara",
    title: "Marmara Denizi Fiziki Coğrafyası, Boğazlar & Canlı Telemetri | Coğrafya Gurmesi",
    description:
      "Marmara'nın 6 kıyı istasyonundan canlı su sıcaklığı, iki tabakalı zıt akıntı rejimleri, KAF derin çukurları ve iç deniz coğrafyası.",
  });
}

export default async function V2MarmaraPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const format = await getFormatter();
  const basinData = SEA_BASINS_DETAIL.marmara;

  const [rawPoints, rawOverview, rawProvinces] = await Promise.all([
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
    getProvincesResilient(),
  ]);

  const provinceByPlate = new Map<string, { name: string; slug: string }>();
  for (const prov of rawProvinces) {
    provinceByPlate.set(prov.plateCode, {
      name: prov.nameTr,
      slug: locale === "en" ? prov.slugEn : prov.slugTr,
    });
  }

  const overviewMap = new Map<string, MarineOverviewPoint>();
  if (rawOverview?.points) {
    for (const item of rawOverview.points) {
      overviewMap.set(item.point.slugTr, item);
    }
  }

  // Filter ONLY marmara points
  const marmaraRawPoints = rawPoints.filter((pt) => pt.seaBasin === "marmara");

  const marinePoints: MarinePointData[] = marmaraRawPoints.map((pt) => {
    const live = overviewMap.get(pt.slugTr);
    const prov = provinceByPlate.get(pt.plateCode);

    let validAtFormatted: string | null = null;
    let gridDist: number | null = null;
    if (live) {
      const rowValues = marineBlockValues(live);
      const oldest = oldestValidAt(rowValues);
      if (oldest) {
        validAtFormatted =
          format.dateTime(oldest, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          }) + " UTC";
      }
      gridDist = maxGridDistanceKm(rowValues);
    }

    const windSpeed = live?.windSpeed10m?.value ?? null;
    const isStraits = pt.plateCode === "34" || pt.plateCode === "17";

    return {
      slugTr: pt.slugTr,
      slugEn: pt.slugEn,
      nameTr: pt.nameTr,
      nameEn: pt.nameEn,
      coastLabelTr: pt.coastLabelTr,
      coastLabelEn: pt.coastLabelEn,
      plateCode: pt.plateCode,
      latitude: pt.latitude,
      longitude: pt.longitude,
      seaBasin: pt.seaBasin,
      displayOrder: pt.displayOrder,
      sst: live?.seaSurfaceTemperature?.value ?? null,
      waveHeight: live?.waveHeight?.value ?? null,
      waveDirection: live?.waveDirection?.value ?? null,
      windSpeed10m: windSpeed,
      windDirection10m: live?.windDirection10m?.value ?? null,
      windSpeedKmh: windSpeed !== null ? windSpeed * 3.6 : null,
      validAt: validAtFormatted,
      gridDistanceKm: gridDist,
      isStraits,
      provinceName: prov?.name ?? `İl ${pt.plateCode}`,
      provinceSlug: prov?.slug ?? "",
    };
  });

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          breadcrumbJsonLd([
            { name: "Ana Sayfa", path: "/" },
            { name: "Denizler & Kıyılar Atlası", path: "/deniz" },
            { name: "Marmara Denizi", path: "/deniz/marmara" },
          ]),
          learningResourceJsonLd({
            name: "Marmara Denizi Coğrafi Analizi ve İki Tabakalı Akıntı Rehberi",
            description: basinData.physicalGeography.content,
            path: "/deniz/marmara",
            locale,
            learningResourceType: "Article",
            teaches:
              "Marmara Denizi'nin tektoniği, boğaz akıntıları, çukurlukları ve çevre sorunları",
          }),
          faqPageJsonLd(basinData.faq),
        ]}
      />

      <V2LiveTicker />

      <V2SeaBasinDetailView data={basinData} marinePoints={marinePoints} locale={locale} />
    </>
  );
}
