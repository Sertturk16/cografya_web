import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildProvincePoints } from "@/lib/tools/province-points";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { AREA_TOOL, TOOLS_SURFACE } from "@/lib/tools/tool-registry";
import { V2RelatedTools } from "@/components/v2/v2-related-tools";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolWorkbench } from "@/components/v2/v2-tool-workbench";
import { V2ToolEducationalContent } from "@/components/v2/v2-tool-educational-content";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Home, Maximize2 } from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";

export const revalidate = 86400;

interface V2AreaPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2AreaPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // The whole tier's surface, from `lib/tools/tool-registry.ts` — the same constant
    // `app/sitemap.ts` hands `sitemapEntriesFor`, so the head and the sitemap cannot
    // disagree about this page. It read `"noindex"` while the tier lived under `/v2`.
    surface: TOOLS_SURFACE,
    hrefForLocale: () => "/araclar/alan-hesaplama",
    title: "Haritada Alan & Yüzölçümü Hesaplama — Çokgen (Polygon) Ölçümü",
    description:
      "İnteraktif harita üzerinde çokgen çizerek WGS84 küresel elipsoid jeodezik modeliyle km², hektar, dönüm ve metrekare cinsinden gerçek yüzölçümü ve çevre uzunluğu hesaplama.",
  });
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
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Alan & Yüzölçümü Hesaplama",
          description:
            "Haritada çokgen köşe noktaları belirleyerek jeodezik poligon alanını hesaplayın.",
          path: "/araclar/alan-hesaplama",
          locale,
          learningResourceType: "Interactive tool",
          teaches:
            "İzdüşüm alanı, gerçek alan, küresel trigonometri, çokgen alan hesabı, km², hektar, dönüm",
        })}
      />

      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "CBS Araçları", href: "/araclar", path: "/araclar" },
              { label: "Alan Hesaplama", path: "/araclar/alan-hesaplama" },
            ]}
            locale={locale}
            surface={TOOLS_SURFACE}
          />

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <PageHero
              tier="hub"
              heading="Haritada Alan & Yüzölçümü Hesaplama"
              badges={
                <>
                  <Badge variant="primary" size="sm" icon={<Maximize2 className="size-3.5" />}>
                    Çokgen (Polygon) Yüzölçümü
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    L&apos;Huilier Jeodezik Teoremi
                  </Badge>
                </>
              }
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={
                <>
                  Harita üzerinde en az 3 nokta işaretleyerek çizdiğiniz çokgenin gerçek yüzölçümünü
                  km², Hektar, Dönüm ve m² cinsinden WGS84 küresel elipsoid modeliyle anında
                  hesaplayın.
                </>
              }
            />

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
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
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
          downloadName="cografya-alan"
        />

        {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
        <V2ToolEducationalContent mode="area" />

        {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES */}
        {/* The tier exit. Both locales — an English reader was as stuck as a Turkish
              one, and the labels are already bilingual. */}
        <V2RelatedTools current={AREA_TOOL.pathname} />

        <V2SourcesSection scope="araclar" />
      </PageContainer>
    </>
  );
}
