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
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Home, Maximize2 } from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";
import { Card } from "@/components/ui/card";

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
              { label: "Harita Araçları", href: "/araclar", path: "/araclar" },
              { label: "Alan Hesaplama", path: "/araclar/alan-hesaplama" },
            ]}
            locale={locale}
            surface={TOOLS_SURFACE}
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Haritada Alan Hesaplama"
              badges={
                <Badge variant="primary" size="sm" icon={<Maximize2 className="size-3.5" />}>
                  Sonuçta çevre uzunluğu yazılır
                </Badge>
              }
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={
                <>
                  Ölçmek istediğin yerin kenarına köşe köşe nokta koy. Üçüncü noktadan sonra şekil
                  kapanır ve içinde kalan alan km², hektar ve dönüm olarak yazılır.
                </>
              }
            />

            {/* Metric Strip */}
            <StatGrid gutter="hero">
              <StatTile label="Şekli kapatmak için gereken köşe" fact="En az 3" tone="primary" />
              <StatTile
                label="Sonucun birimleri: km², hektar, dönüm"
                fact="3 birim"
                tone="secondary"
              />
              <StatTile
                label="Alan bu yarıçaplı bir küre üstünde bulunur"
                fact="6.371 km"
                tone="accent"
              />
              <StatTile label="1 km² kaç dönüm eder" fact="1.000 dönüm" tone="primary" />
            </StatGrid>
          </Card>
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

        {/* The tier exit. Both locales — an English reader was as stuck as a Turkish
              one, and the labels are already bilingual. */}
        <V2RelatedTools current={AREA_TOOL.pathname} />
      </PageContainer>
    </>
  );
}
