import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolsHub } from "@/components/v2/v2-tools-hub";
import { V2GisMethodologyGuide } from "@/components/v2/v2-gis-methodology-guide";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Badge } from "@/components/ui/badge";
import { Compass, Home, ChevronRight } from "lucide-react";

export const revalidate = 86400;

interface V2AraclarPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "CBS & Coğrafi Ölçüm Araçları v2 — Mesafe, Koordinat ve Alan Hesaplama",
    description:
      "İnteraktif harita üzerinde kuş uçuşu jeodezik mesafe ölçümü, enlem/boylam koordinat tespiti ve çokgen alan hesabı.",
    alternates: {
      canonical: "/v2/araclar",
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function V2AraclarPage({ params }: V2AraclarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "CBS & Coğrafi Ölçüm Araçları v2",
            description:
              "İnteraktif harita üzerinde kuş uçuşu jeodezik mesafe ölçümü, enlem/boylam koordinat tespiti ve çokgen alan hesabı.",
            path: "/v2/araclar",
            locale,
          }),
          itemListJsonLd({
            name: "CBS Coğrafi Ölçüm Araçları",
            items: [
              { name: "Kuş Uçuşu Mesafe Ölçer", path: "/v2/araclar" },
              { name: "Koordinat Bulucu & GPS", path: "/v2/araclar" },
              { name: "Çokgen Yüzölçümü ve Alan Hesabı", path: "/v2/araclar" },
            ],
          }),
        ]}
      />

      <div>
        {/* V2 Header */}
        <V2Header />

        {/* Live Telemetry Ticker */}
        <V2LiveTicker />

        <main
          id="main-content"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14"
        >
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
              <span className="text-foreground font-semibold">CBS Araçları v2</span>
            </nav>

            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" icon={<Compass className="size-3.5" />}>
                    Coğrafi Bilgi Sistemleri v2
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    3&apos;ü 1 Arada Ölçüm Stüdyosu
                  </Badge>
                </div>

                <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                  CBS Harita &amp; Jeodezik Ölçüm Laboratuvarı
                </h1>

                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                  Harita üzerinde dilediğiniz noktaları işaretleyerek gerçek jeodezik mesafeyi,
                  enlem/boylam koordinatlarını ve küresel çokgen yüzölçümünü WGS84 hassasiyetiyle
                  anında hesaplayın.
                </p>
              </div>

              {/* Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                    WGS84
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Küresel Elipsoid Modeli
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                    Haversine
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Büyük Daire Eğrilik Hesabı
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                    3 Birim
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    km², Hektar, Dönüm Çıktısı
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">
                    UTM + DMS
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Çift Projeksiyon Desteği
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: INTERACTIVE 3-IN-1 GIS WORKBENCH */}
          <V2ToolsHub />

          {/* SECTION 2: GIS & GEODESY METHODOLOGY GUIDE */}
          <V2GisMethodologyGuide />

          {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
          <V2SourcesSection scope="araclar" />
        </main>
      </div>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
