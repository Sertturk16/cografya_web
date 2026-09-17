import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildProvincePoints } from "@/lib/tools/province-points";
import type { ProvinceArea } from "@/components/tools/tool-island";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { COORDINATE_TOOL, TOOLS_SURFACE } from "@/lib/tools/tool-registry";
import { V2RelatedTools } from "@/components/v2/v2-related-tools";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolWorkbench } from "@/components/v2/v2-tool-workbench";
import { V2ToolEducationalContent } from "@/components/v2/v2-tool-educational-content";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, ChevronRight } from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";

export const revalidate = 86400;

interface V2CoordinatesPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2CoordinatesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // The whole tier's surface, from `lib/tools/tool-registry.ts` — the same constant
    // `app/sitemap.ts` hands `sitemapEntriesFor`, so the head and the sitemap cannot
    // disagree about this page. It read `"noindex"` while the tier lived under `/v2`.
    surface: TOOLS_SURFACE,
    hrefForLocale: () => "/araclar/koordinat-bulma",
    title: "Haritada Koordinat Bulma & Dönüştürme — Enlem, Boylam ve WGS84 GPS",
    description:
      "İnteraktif harita üzerinde tıklayarak veya arama yaparak Ondalık Derece (DD), Derece-Dakika-Saniye (DMS) ve UTM koordinatlarını WGS84 standardında tespit edin.",
  });
}

export default async function V2CoordinatesToolPage({ params }: V2CoordinatesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const provinces = await getProvincesResilient();
  const provincePoints = buildProvincePoints(provinces);

  const provinceAreas: ProvinceArea[] = provinces.map((province) => ({
    plateCode: province.plateCode,
    name: province.nameTr,
    slug: locale === "en" ? province.slugEn : province.slugTr,
  }));

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Koordinat Bulma & Dönüştürme",
          description:
            "Haritada dilediğiniz noktanın enlem, boylam ve WGS84 coğrafi koordinatlarını bulun.",
          path: "/araclar/koordinat-bulma",
          locale,
          learningResourceType: "Interactive tool",
          teaches: "Enlem, boylam, WGS84 koordinat sistemi, DMS ve ondalık derece dönüşümü",
        })}
      />

      <V2LiveTicker />

      <PageContainer>
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
            <Link href="/araclar" className="hover:text-foreground transition-colors">
              CBS Araçları
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Koordinat Bulucu</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<MapPin className="size-3.5" />}>
                  Coğrafi Koordinat Tespit &amp; GPS
                </Badge>
                <Badge variant="secondary" size="sm">
                  WGS84 (EPSG:4326)
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
                Haritada Koordinat Bulma &amp; Dönüştürme
              </h1>

              <V2EnWorkInProgressNotice locale={locale} />

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Harita üzerinde tıkladığınız herhangi bir noktanın veya seçtiğiniz il merkezinin
                Ondalık Derece (DD), Derece Dakika Saniye (DMS) ve UTM izdüşüm koordinatlarını
                anında görüntüleyin.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  WGS84
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  EPSG:4326 Jeodezik Standart
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  DMS + DD
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Çift Format Koordinat Gösterimi
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                  UTM Zonu
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  6° Dilimli Düzlemsel Izgara
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  İl Tespiti
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Otomatik Sınır Eşleme (Polygon)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: STANDALONE COORDINATE WORKBENCH */}
        <V2ToolWorkbench
          initialMode="coordinates"
          lockMode={true}
          provincePoints={provincePoints}
          provinceAreas={provinceAreas}
          downloadName="cografya-koordinat"
        />

        {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
        <V2ToolEducationalContent mode="coordinates" />

        {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES */}
        {/* The tier exit. Both locales — an English reader was as stuck as a Turkish
              one, and the labels are already bilingual. */}
        <V2RelatedTools current={COORDINATE_TOOL.pathname} />

        <V2SourcesSection scope="araclar" />
      </PageContainer>
    </>
  );
}
