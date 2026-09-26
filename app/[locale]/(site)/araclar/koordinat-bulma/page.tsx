import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildProvincePoints, type ProvinceArea } from "@/lib/tools/province-points";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { COORDINATE_TOOL, TOOLS_SURFACE } from "@/lib/tools/tool-registry";
import { V2RelatedTools } from "@/components/v2/v2-related-tools";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolWorkbench } from "@/components/v2/v2-tool-workbench";
import { V2ToolEducationalContent } from "@/components/v2/v2-tool-educational-content";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { PlateSkeleton } from "@/components/patterns/page-skeleton";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { MapPin, Home } from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";
import { Card } from "@/components/ui/card";

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
    title: "Haritada Koordinat Bulma: Enlem, Boylam ve WGS84 Koordinatı",
    description:
      "Haritaya tıkla ya da listeden il seç: noktanın enlem ve boylamını ondalık derece ve derece-dakika-saniye olarak, UTM dilimini ve hangi ilde olduğunu gör.",
  });
}

async function CoordinatesWorkbench({ locale }: { locale: Locale }) {
  const provinces = await getProvincesResilient();
  const provincePoints = buildProvincePoints(provinces);

  const provinceAreas: ProvinceArea[] = provinces.map((province) => ({
    plateCode: province.plateCode,
    name: province.nameTr,
    slug: locale === "en" ? province.slugEn : province.slugTr,
  }));

  return (
    <V2ToolWorkbench
      mode="coordinates"
      provincePoints={provincePoints}
      provinceAreas={provinceAreas}
      downloadName="cografya-koordinat"
    />
  );
}

export default async function V2CoordinatesToolPage({ params }: V2CoordinatesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Koordinat Bulma",
          description: "Haritada seçtiğin noktanın enlemini, boylamını ve WGS84 koordinatını bul.",
          path: "/araclar/koordinat-bulma",
          locale,
          learningResourceType: "Interactive tool",
          teaches:
            "Enlem, boylam, WGS84 koordinat sistemi, derece-dakika-saniye ve ondalık derece dönüşümü",
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
              { label: "Koordinat Bulma", path: "/araclar/koordinat-bulma" },
            ]}
            locale={locale}
            surface={TOOLS_SURFACE}
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Haritada Koordinat Bulma"
              badges={
                <Badge variant="primary" size="sm" icon={<MapPin className="size-3.5" />}>
                  Enlem ve boylamı elle girebilirsin
                </Badge>
              }
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={
                <>
                  Bir yerin adresi iki sayıdır: enlemi ve boylamı. Haritada bir noktaya tıkla ya da
                  bir il seç; o noktanın koordinatını iki ayrı yazımla, düştüğü ili ve UTM dilimini
                  gösterir.
                </>
              }
            />

            {/* Metric Strip */}
            <StatGrid gutter="hero">
              <StatTile label="GPS'in de kullandığı sistem" fact="WGS84" tone="primary" />
              <StatTile
                label="Ondalık derece ve derece-dakika-saniye"
                fact="2 yazım"
                tone="secondary"
              />
              <StatTile label="UTM dilimlerinin genişliği" fact="6°" tone="accent" />
              <StatTile label="Noktanın hangi ilde olduğu bulunur" fact="81 il" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: STANDALONE COORDINATE WORKBENCH */}
        <Suspense fallback={<PlateSkeleton aspect="map" />}>
          <CoordinatesWorkbench locale={locale} />
        </Suspense>

        {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
        <V2ToolEducationalContent mode="coordinates" />

        {/* The tier exit. Both locales — an English reader was as stuck as a Turkish
              one, and the labels are already bilingual. */}
        <V2RelatedTools current={COORDINATE_TOOL.pathname} />
      </PageContainer>
    </>
  );
}
