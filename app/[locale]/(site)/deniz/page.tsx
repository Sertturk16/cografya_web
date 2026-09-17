import type { Metadata } from "next";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { getMarinePointsSafe, getMarineOverviewSafe, getMarineLayersSafe } from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarineOverviewPoint } from "@/lib/api/types";
import { collectionPageJsonLd, learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2MarineMapExplorer, type MarinePointData } from "@/components/v2/v2-marine-map-explorer";
import { V2MarineBasinCards } from "@/components/v2/v2-marine-basin-cards";
import { V2MarineOceanographyGuide } from "@/components/v2/v2-marine-oceanography-guide";
import { V2MarineLayerCatalogue } from "@/components/v2/v2-marine-layer-catalogue";
import { V2MarineFaqAccordion } from "@/components/v2/v2-marine-faq-accordion";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { MarineAttribution } from "@/components/marine/marine-attribution";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Waves, Home, ChevronRight, Layers, ArrowRight } from "lucide-react";
import { marineBlockValues, oldestValidAt, maxGridDistanceKm } from "@/lib/marine/vintage";
import { marineShowsValues } from "@/lib/marine/overview";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";

export const revalidate = 900;

interface V2DenizPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2DenizPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    surface: "trNarrative",
    hrefForLocale: () => "/deniz",
    title: "Denizler & Kıyılar Atlası — Deniz Telemetrisi ve Su Sıcaklıkları",
    description:
      "Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktası: su sıcaklığı, dalga boyu, rüzgâr vektörleri ve oşinografi modelleri.",
  });
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

  // The one signal that decides whether this render may make a value/"live" claim in prose —
  // false whenever MARINE_ENABLED is off (prod today) or the overview payload is otherwise
  // empty. Copy above the fold must not promise hourly telemetry the value band cannot back
  // up (mirrors the reasoning already recorded in `app/[locale]/(site)/deniz/page.tsx`, the V1 hub).
  const showValues = marineShowsValues(rawOverview);

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
          collectionPageJsonLd({
            name: "Denizler & Kıyılar Atlası",
            description:
              "Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktası: su sıcaklığı, dalga yüksekliği ve oşinografi verileri.",
            path: "/deniz",
            locale,
          }),
          learningResourceJsonLd({
            name: "Denizler & Kıyılar Atlası",
            description:
              "Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktası: su sıcaklığı, dalga yüksekliği ve oşinografi verileri.",
            path: "/deniz",
            locale,
            learningResourceType: "Article",
            teaches: "Türkiye denizlerinin oşinografik yapısı, su sıcaklığı ve dalga rejimleri",
          }),
        ]}
      />

      {/* V2 Header */}

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      {/* Breadcrumb & Header Hero */}
      <div className="space-y-4">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="size-3.5" />
            <span>Ana Sayfa</span>
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-semibold">Denizler &amp; Kıyılar Atlası</span>
        </nav>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm" icon={<Waves className="size-3.5" />}>
                Mavi Vatan Oşinografi Portalı
              </Badge>
              <Badge variant="secondary" size="sm">
                {showValues ? "30 Canlı Telemetri İstasyonu" : "30 Referans Noktası"}
              </Badge>
            </div>

            <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
              Denizler &amp; Kıyılar Atlası
            </h1>

            <V2EnWorkInProgressNotice locale={locale} />

            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {showValues ? (
                <>
                  Karadeniz, Marmara, Ege ve Akdeniz havzalarının saatlik deniz suyu sıcaklıkları,
                  dalga boyları, tuzluluk oranları, akıntı rejimleri ve 28 kıyı ilinin oşinografik
                  yapısı.
                </>
              ) : (
                <>
                  Karadeniz, Marmara, Ege ve Akdeniz açığındaki 30 referans noktasının kapsadığı
                  deniz suyu sıcaklığı, dalga boyu, rüzgâr ve akıntı büyüklükleri; 28 kıyı ilinin
                  oşinografik yapısıyla birlikte. Güncel ölçüm değerleri şu an yayında değil.
                </>
              )}
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
                {showValues ? "Saatlik Telemetri İstasyonu" : "Referans İzleme Noktası"}
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
              <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
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

      {/* SUBMARINE FAULTS CALLOUT BANNER */}
      <div className="p-5 rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-500/5 via-card to-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
            <Layers className="size-5" />
          </div>
          <div>
            <span className="font-heading text-base font-bold text-foreground block">
              Denizaltı Sismotektoniği &amp; Aktif Fay Hatları
            </span>
            <span className="text-xs text-muted-foreground block">
              Kuzey Anadolu Fayı&apos;nın Marmara Denizi derin çukurlarındaki geçişi ve Ege açılma
              tektoniği.
            </span>
          </div>
        </div>
        <Link
          href="/deprem/fay-hatlari"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 font-bold text-xs group gap-1.5",
          )}
        >
          <span>Fay Hatları Atlasına Git</span>
          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* SECTION 4: MEASUREMENT LAYERS CATALOGUE */}
      <V2MarineLayerCatalogue layers={rawLayers} />

      {/* SECTION 5: PEDAGOGICAL FAQ ACCORDION */}
      <V2MarineFaqAccordion />

      {/* SECTION 6: ATTRIBUTION, LICENCE AND EDUCATIONAL-USE NOTICE
            The ECMWF and Copernicus Marine wording is the LICENCE, not copy — published
            verbatim, in English, in both locales (see the component's docblock). Ungated: this
            hub describes and catalogues the derived material on every render, so the notice is
            owed on every render. The V2 rewrite dropped this block and left only the card grid
            below, whose ECMWF "legal quote" was a paraphrase nobody could source. */}
      <MarineAttribution layers={rawLayers} headingId="deniz-sources" />

      {/* SECTION 7: SOURCES (KAYNAKÇA) — the bibliography, in our words. It sits alongside the
            attribution block above and never in place of it. */}
      <V2SourcesSection scope="deniz" />

      {/* V2 Footer */}
    </>
  );
}
