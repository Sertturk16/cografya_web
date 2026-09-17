import type { Metadata } from "next";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { getMarinePointsSafe, getMarineOverviewSafe, getMarineLayersSafe } from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { Locale } from "@/i18n/routing";
import type { MarineOverviewPoint } from "@/lib/api/types";
import { breadcrumbJsonLd, learningResourceJsonLd, faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SeaBasinDetailView } from "@/components/v2/v2-sea-basin-detail-view";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { MarineAttribution } from "@/components/marine/marine-attribution";
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

  const [rawPoints, rawOverview, rawProvinces, rawLayers] = await Promise.all([
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
    getProvincesResilient(),
    getMarineLayersSafe(),
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-14">
        <V2SeaBasinDetailView data={basinData} marinePoints={marinePoints} locale={locale} />

        {/* ECMWF + Copernicus Marine attribution, licence and educational-use notice — the SAME
            component and the SAME verbatim strings `/deniz` and the province pages render, never
            a second copy (`components/marine/marine-attribution.tsx`).

            THIS PAGE OWED IT AND DID NOT CARRY IT. The telemetry table above publishes
            `sst`, `waveHeight` and `windSpeed10m` under a heading that names "CMEMS & ECMWF
            Açık Deniz Modelleri", and the only credit on the page was the bibliography card
            below — whose `cmems` and `ecmwf-marine` entries deliberately carry NO `legalQuote`,
            because "the licence lives in the attribution block". The block was on no basin page,
            so ECMWF's required notice was rendered nowhere in the product for these values.

            UNGATED, like `/deniz`'s and unlike the province page's: the heading and the table
            describe the derived material on every render, including the render where the API
            published nothing and the cells read "—". The notice is owed to the claim as much as
            to the numbers. */}
        <MarineAttribution layers={rawLayers} headingId="basin-marine-sources" />

        {/* The bibliography — what this page is built on, in our words. It sits AFTER the
            attribution block and never in place of it. */}
        <V2SourcesSection scope="deniz" />
      </div>
    </>
  );
}
