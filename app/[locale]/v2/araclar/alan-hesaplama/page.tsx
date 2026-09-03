import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildProvincePoints } from "@/lib/tools/province-points";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolWorkbench } from "@/components/v2/v2-tool-workbench";
import { V2ToolEducationalContent } from "@/components/v2/v2-tool-educational-content";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Badge } from "@/components/ui/badge";
import { Compass, Layers, Home, ChevronRight, Sparkles, Maximize2 } from "lucide-react";

export const revalidate = 86400;

interface V2AreaPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2AreaPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Haritada Alan & Yüzölçümü Hesaplama v2 — Çokgen (Polygon) Ölçümü",
    description:
      "İnteraktif harita üzerinde çokgen çizerek WGS84 küresel elipsoid jeodezik modeliyle km², hektar, dönüm ve metrekare cinsinden gerçek yüzölçümü ve çevre uzunluğu hesaplama.",
    alternates: {
      canonical: "/v2/araclar/alan-hesaplama",
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function V2AreaToolPage({ params }: V2AreaPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const provinces = await getProvincesResilient();
  const provincePoints = buildProvincePoints(provinces);
  const provinceAreas = provinces.map((p) => ({
    plateCode: p.plateCode,
    name: p.nameTr,
    slug: locale === "en" ? p.slugEn : p.slugTr,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Alan & Yüzölçümü Hesaplama v2",
          description:
            "Haritada çokgen köşe noktaları belirleyerek jeodezik poligon alanını hesaplayın.",
          path: "/v2/araclar/alan-hesaplama",
          locale,
          learningResourceType: "Interactive tool",
          teaches:
            "İzdüşüm alanı, gerçek alan, küresel trigonometri, çokgen alan hesabı, km², hektar, dönüm",
        })}
      />

      <div>
        {/* V2 Header */}
        <V2Header />

        {/* Live Telemetry Ticker */}
        <V2LiveTicker />

        <main
          id="main-content"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-12"
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
              <Link href="/v2/araclar" className="hover:text-foreground transition-colors">
                CBS Araçları
              </Link>
              <ChevronRight className="size-3.5" />
              <span className="text-foreground font-semibold">Alan Hesaplama</span>
            </nav>

            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" icon={<Maximize2 className="size-3.5" />}>
                    Çokgen (Polygon) Yüzölçümü
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    L&apos;Huilier Jeodezik Teoremi
                  </Badge>
                </div>

                <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                  Haritada Alan &amp; Yüzölçümü Hesaplama
                </h1>

                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                  Harita üzerinde en az 3 nokta işaretleyerek çizdiğiniz çokgenin gerçek yüzölçümünü
                  km², Hektar, Dönüm ve m² cinsinden WGS84 küresel elipsoid modeliyle anında
                  hesaplayın.
                </p>
              </div>

              {/* Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                    4 Birim
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    km², Hektar, Dönüm ve m²
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                    L&apos;Huilier
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Küresel Üçgenleme Algoritması
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                    Çevre (P)
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Kapalı Çevre (Perimeter) Uzunluğu
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">
                    WGS84
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Eğri Yüzey Alan Modeli
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: STANDALONE AREA WORKBENCH */}
          <V2ToolWorkbench
            initialMode="area"
            lockMode={true}
            provincePoints={provincePoints}
            provinceAreas={provinceAreas}
            downloadName="cografya-v2-alan"
          />

          {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
          <V2ToolEducationalContent mode="area" />

          {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES */}
          <V2SourcesSection scope="araclar" />
        </main>
      </div>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
