import type { Metadata } from "next";
import { getFormatter, setRequestLocale } from "next-intl/server";
import {
  getMarinePointsSafe,
  getMarineOverviewSafe,
  getMarineLayersSafe,
} from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarineOverviewPoint } from "@/lib/api/types";
import { collectionPageJsonLd, learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2MarineMapExplorer, type MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { V2MarineBasinCards } from "@/components/v2/v2-marine-basin-cards";
import { V2MarineOceanographyGuide } from "@/components/v2/v2-marine-oceanography-guide";
import { V2MarineLayerCatalogue } from "@/components/v2/v2-marine-layer-catalogue";
import { V2MarineFaqAccordion } from "@/components/v2/v2-marine-faq-accordion";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import {
  Waves,
  Home,
  ChevronRight,
} from "lucide-react";
import { marineBlockValues, oldestValidAt, maxGridDistanceKm } from "@/lib/marine/vintage";

export const revalidate = 900;

interface V2DenizPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Denizler & Kıyılar Atlası v2 — Canlı Deniz Telemetrisi ve Su Sıcaklıkları",
    description:
      "Karadeniz, Marmara, Ege ve Akdeniz'in 30 kıyı istasyonundan saatlik su sıcaklığı, dalga boyu, rüzgâr vektörleri ve oşinografi modelleri.",
    alternates: {
      canonical: "/v2/deniz",
    },
  };
}

export default async function V2DenizPage({ params }: V2DenizPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const format = await getFormatter();

  // Fetch points, live overview, layers and provinces
  const [rawPoints, rawOverview, rawLayers, rawProvinces] = await Promise.all([
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
    getMarineLayersSafe(),
    getProvincesResilient(),
  ]);

  // Province lookup map by plateCode
  const provinceByPlate = new Map<string, { name: string; slug: string }>();
  for (const prov of rawProvinces) {
    provinceByPlate.set(prov.plateCode, {
      name: prov.nameTr,
      slug: locale === "en" ? prov.slugEn : prov.slugTr,
    });
  }

  // Live overview value map
  const overviewMap = new Map<string, MarineOverviewPoint>();
  if (rawOverview?.points) {
    for (const item of rawOverview.points) {
      overviewMap.set(item.point.slugTr, item);
    }
  }

  // Combine into rich MarinePointData
  const marinePoints: MarinePointData[] = rawPoints.map((pt) => {
    const live = overviewMap.get(pt.slugTr);
    const prov = provinceByPlate.get(pt.plateCode);

    let validAtFormatted: string | null = null;
    let gridDist: number | null = null;
    if (live) {
      const rowValues = marineBlockValues(live);
      const oldest = oldestValidAt(rowValues);
      if (oldest) {
        validAtFormatted = format.dateTime(oldest, {
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
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Denizler & Kıyılar Atlası v2",
            description:
              "Karadeniz, Marmara, Ege ve Akdeniz'in 30 kıyı istasyonundan saatlik su sıcaklığı, dalga yüksekliği ve oşinografi verileri.",
            path: "/v2/deniz",
            locale,
          }),
          learningResourceJsonLd({
            name: "Denizler & Kıyılar Atlası v2",
            description:
              "Karadeniz, Marmara, Ege ve Akdeniz'in 30 kıyı istasyonundan saatlik su sıcaklığı, dalga yüksekliği ve oşinografi verileri.",
            path: "/v2/deniz",
            locale,
            learningResourceType: "Article",
            teaches: "Türkiye denizlerinin oşinografik yapısı, su sıcaklığı ve dalga rejimleri",
          }),
        ]}
      />

      {/* V2 Header */}
      <V2Header />

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-16">
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/v2"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Denizler &amp; Kıyılar Atlası v2</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Waves className="size-3.5" />}>
                  Mavi Vatan Oşinografi Portalı v2
                </Badge>
                <Badge variant="secondary" size="sm">
                  30 Canlı Telemetri İstasyonu
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                Denizler &amp; Kıyılar Atlası
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Karadeniz, Marmara, Ege ve Akdeniz havzalarının saatlik deniz suyu sıcaklıkları, dalga boyları, tuzluluk oranları, akıntı rejimleri ve 28 kıyı ilinin oşinografik yapısı.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  4 Deniz
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Farklı Havza &amp; Akıntı
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-cyan-600 block">
                  30 Nokta
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Saatlik Telemetri İstasyonu
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                  28 İl
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Denize Kıyısı Olan Şehir
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">
                  8.333 km
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Toplam Kıyı Uzunluğu (HGM)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE REALISTIC TURKEY & SEA MAP EXPLORER */}
        <V2MarineMapExplorer marinePoints={marinePoints} locale={locale} />

        {/* SECTION 2: 4 SEA BASINS COMPREHENSIVE GUIDE */}
        <V2MarineBasinCards />

        {/* SECTION 3: COASTAL TYPES & OCEANOGRAPHY GUIDE */}
        <V2MarineOceanographyGuide />

        {/* SECTION 4: MEASUREMENT LAYERS CATALOGUE */}
        <V2MarineLayerCatalogue layers={rawLayers} />

        {/* SECTION 5: PEDAGOGICAL FAQ ACCORDION */}
        <V2MarineFaqAccordion />

        {/* SECTION 6: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
        <V2SourcesSection scope="deniz" />
      </main>

      {/* V2 Footer */}
      <V2Footer />
    </div>
  );
}
