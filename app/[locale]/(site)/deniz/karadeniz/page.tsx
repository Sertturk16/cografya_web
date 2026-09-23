import type { Metadata } from "next";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { getMarinePointsSafe, getMarineOverviewSafe } from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { Locale } from "@/i18n/routing";
import type { MarineOverviewPoint } from "@/lib/api/types";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { FaqSection } from "@/components/patterns/faq-section";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SeaBasinDetailView } from "@/components/v2/v2-sea-basin-detail-view";
import { PageContainer } from "@/components/patterns/page-container";
import { MarineDataNotice } from "@/components/marine/marine-data-notice";
import type { MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { breadcrumbListSchema, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs";
import { SEA_BASINS_DETAIL } from "@/lib/marine/sea-basins-detail";
import { marineBlockValues, oldestValidAt, maxGridDistanceKm } from "@/lib/marine/vintage";
import { Home } from "lucide-react";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "trOnly",
    hrefForLocale: () => "/deniz/karadeniz",
    title: "Karadeniz Fiziki Coğrafyası & Canlı Telemetri Atlası | Coğrafya Gurmesi",
    description:
      "Karadeniz'in 15 kıyı istasyonundan canlı su sıcaklığı, dalga boyu, akıntı rejimleri, 200m H2S tabakası ve fiziki coğrafya analizi.",
  });
}

export default async function V2KaradenizPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const format = await getFormatter();
  const basinData = SEA_BASINS_DETAIL.karadeniz;
  /* SPLIT AT THE BOUNDARY, not narrowed by the type alone. `V2SeaBasinDetailView` is a
     Client Component, so whatever object it is handed is serialised into the Flight payload
     in this page's HTML — every field, read or not. It stopped reading `data.faq` in PR5,
     so `faq` was being shipped to the browser for nothing, and on `/en/sea/*` that meant
     untranslated Turkish prose on a page whose FAQ block is deliberately hidden.
     `data={basinData}` would still type-check against `SeaBasinViewData` — excess-property
     checking does not apply to a variable — so the field has to be removed for real. `faq`
     then feeds `<FaqSection>` below, which is the only thing that still wants it. */
  const { faq: basinFaq, ...basinView } = basinData;

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

  // Filter ONLY black_sea points
  const blackSeaRawPoints = rawPoints.filter((pt) => pt.seaBasin === "black_sea");

  const marinePoints: MarinePointData[] = blackSeaRawPoints.map((pt) => {
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

  // The ONE array: feeds both the visible nav (`V2SeaBasinDetailView` renders it through
  // `BreadcrumbsNav`, the client-safe half of `components/patterns/breadcrumbs.tsx`) and the
  // `breadcrumbListSchema` call below. `V2SeaBasinDetailView` is a Client Component and cannot
  // render `Breadcrumbs` itself any more (that half imports `lib/seo/json-ld`, which is
  // `server-only`) — the emission moved up here instead of splitting the array in two.
  const breadcrumbItems: BreadcrumbTrailItem[] = [
    { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
    { label: "Denizler ve Kıyılar", href: "/deniz", path: "/deniz" },
    { label: basinData.fullNameTr, path: "/deniz/karadeniz" },
  ];

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          // The `BreadcrumbList` schema, gated exactly the way `Breadcrumbs` gates it
          // internally — this page IS that gate's server component, standing in for
          // `V2SeaBasinDetailView`, which cannot render it (see the comment above). One
          // implementation (`breadcrumbListSchema`, `components/patterns/breadcrumbs.tsx`),
          // four callers (this page and its three basin siblings) plus `Breadcrumbs` itself.
          ...breadcrumbListSchema(breadcrumbItems, locale, "trOnly"),
          learningResourceJsonLd({
            name: "Karadeniz Coğrafi Analizi ve Oşinografi Rehberi",
            description: basinData.physicalGeography.content,
            path: "/deniz/karadeniz",
            locale,
            learningResourceType: "Article",
            teaches:
              "Karadeniz'in fiziki coğrafyası, akıntıları, H2S tabakası ve kıyı yer şekilleri",
          }),
        ]}
      />

      <V2LiveTicker />

      <PageContainer>
        <V2SeaBasinDetailView
          data={basinView}
          marinePoints={marinePoints}
          breadcrumbItems={breadcrumbItems}
          /* The FAQ block is built HERE and handed to the view as a prop. `FaqSection` emits the
             `FAQPage` JSON-LD beside the questions from the one `basinData.faq` array, which is
             why the `faqPageJsonLd(basinData.faq)` line that used to sit in the schema array
             above is gone: the schema and the markup are now one array in one component, not two
             halves in two files pairing only by an exemption. It cannot be imported inside
             `V2SeaBasinDetailView` — that is a Client Component and `FaqSection` reaches
             `server-only` (see the view's `faq` prop docblock). `"trOnly"` is this page's own
             surface constant, the one `generateMetadata` and `breadcrumbListSchema` already
             pass.

             TR-ONLY UNTIL T-040 (owner, 2026-09-19). `basinData.faq` is Turkish prose with no
             English counterpart, so the EN twin was rendering Turkish questions under English
             chrome. `structuredData="trOnly"` already withheld the FAQPage schema — the markup
             was the gap. The gate sits HERE, where the element is built, rather than inside the
             view: the view is a Client Component that only renders whatever node it is handed, so
             passing `null` is what "no FAQ" means to it. `faq` is typed `React.ReactNode`, which
             already admits `null`, so nothing had to be widened. */
          faq={
            locale === "tr" ? (
              <FaqSection
                heading={`${basinData.nameTr} Hakkında Sıkça Sorulan Sorular`}
                locale={locale}
                items={basinFaq}
                structuredData="trOnly"
              />
            ) : null
          }
        />

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
      </PageContainer>
    </>
  );
}
