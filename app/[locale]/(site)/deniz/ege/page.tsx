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
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { MarineDataNotice } from "@/components/marine/marine-data-notice";
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
    hrefForLocale: () => "/deniz/ege",
    title: "Ege Denizi Fiziki Coğrafyası, Enine Kıyılar & Canlı Telemetri | Coğrafya Gurmesi",
    description:
      "Ege Denizi'nin 5 istasyonundan canlı su sıcaklığı, enine kıyı morfolojisi, geniş kıta sahanlığı ve graben sistemleri.",
  });
}

export default async function V2EgePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const format = await getFormatter();
  const basinData = SEA_BASINS_DETAIL.ege;

  // No layer catalogue read any more. It was fetched for one reason — `MarineAttribution`
  // derives ECMWF's required copyright YEAR from the ingested cycle's künye — and that block
  // now renders on `/hakkimizda`, which does the read itself.
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

  // Filter ONLY aegean points
  const aegeanRawPoints = rawPoints.filter((pt) => pt.seaBasin === "aegean");

  const marinePoints: MarinePointData[] = aegeanRawPoints.map((pt) => {
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
      isStraits: false,
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
            { name: "Ege Denizi", path: "/deniz/ege" },
          ]),
          learningResourceJsonLd({
            name: "Ege Denizi Coğrafi Analizi ve Enine Kıyı Morfolojisi Rehberi",
            description: basinData.physicalGeography.content,
            path: "/deniz/ege",
            locale,
            learningResourceType: "Article",
            teaches:
              "Ege Denizi'nin enine kıyı morfolojisi, kıta sahanlığı, adaları ve graben akıntıları",
          }),
          faqPageJsonLd(basinData.faq),
        ]}
      />

      <V2LiveTicker />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-14">
        <V2SeaBasinDetailView data={basinData} marinePoints={marinePoints} locale={locale} />

        {/* THE SAFETY DISCLAIMER, BESIDE THE VALUES — plus a link to the licence text.

            The telemetry table above publishes `sst`, `waveHeight` and `windSpeed10m` under a
            heading that names "CMEMS & ECMWF Açık Deniz Modelleri". The ECMWF and Copernicus
            Marine LICENCE notices for those values are now published once, on `/hakkimizda`,
            and reached from the link in this block — CC BY 4.0 §3(a)(2) allows the required
            information to be carried by a hyperlink, and ECMWF Open Data is CC BY 4.0.

            What is NOT a licence notice, and therefore did not move, is
            `Marine.disclaimer.educationalOnly`: a reader looking at a sea temperature and a
            wave height on this page has to see "not for maritime, navigational or
            safety-of-life decisions" on this page. That sentence is the body of this block.

            UNGATED, like `/deniz`'s and unlike the province page's: the heading and the table
            describe the derived material on every render, including the render where the API
            published nothing and the cells read "—". The notice is owed to the claim as much as
            to the numbers. */}
        <MarineDataNotice />

        {/* The bibliography — what this page is built on, in our words. It sits AFTER the
            notice above and never in place of it, and its `cmems` / `ecmwf-marine` cards carry
            no `legalQuote`: the licence text lives on `/hakkimizda`, linked from that notice. */}
        <V2SourcesSection scope="deniz" />
      </div>
    </>
  );
}
