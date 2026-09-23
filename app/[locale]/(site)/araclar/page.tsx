import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { TOOLS_SURFACE } from "@/lib/tools/tool-registry";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolsHub } from "@/components/v2/v2-tools-hub";
import { V2GisMethodologyGuide } from "@/components/v2/v2-gis-methodology-guide";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Compass, Home } from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";
import { Card } from "@/components/ui/card";

export const revalidate = 86400;

interface V2AraclarPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2AraclarPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // The whole tier's surface, from `lib/tools/tool-registry.ts` — the same constant
    // `app/sitemap.ts` hands `sitemapEntriesFor`, so the head and the sitemap cannot
    // disagree about this page. It read `"noindex"` while the tier lived under `/v2`.
    surface: TOOLS_SURFACE,
    hrefForLocale: () => "/araclar",
    title: "CBS & Coğrafi Ölçüm Araçları — Mesafe, Koordinat ve Alan Hesaplama",
    description:
      "İnteraktif harita üzerinde kuş uçuşu jeodezik mesafe ölçümü, enlem/boylam koordinat tespiti ve çokgen alan hesabı.",
  });
}

export default async function V2AraclarPage({ params }: V2AraclarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "CBS & Coğrafi Ölçüm Araçları",
            description:
              "İnteraktif harita üzerinde kuş uçuşu jeodezik mesafe ölçümü, enlem/boylam koordinat tespiti ve çokgen alan hesabı.",
            path: "/araclar",
            locale,
          }),
          itemListJsonLd({
            name: "CBS Coğrafi Ölçüm Araçları",
            items: [
              { name: "Kuş Uçuşu Mesafe Ölçer", path: "/araclar" },
              { name: "Koordinat Bulucu & GPS", path: "/araclar" },
              { name: "Çokgen Yüzölçümü ve Alan Hesabı", path: "/araclar" },
            ],
          }),
        ]}
      />

      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Harita Araçları", path: "/araclar" },
            ]}
            locale={locale}
            surface={TOOLS_SURFACE}
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Harita Araçları"
              badges={
                <Badge variant="primary" size="sm" icon={<Compass className="size-3.5" />}>
                  Ölçmek için kayıt gerekmez
                </Badge>
              }
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={
                <>
                  Türkiye haritasına nokta koy. İki yer arasındaki kuş uçuşu mesafeyi, bir yerin
                  enlem ve boylamını ya da çizdiğin bir şeklin alanını hemen gör.
                </>
              }
            />

            {/* Metric Strip */}
            <StatGrid gutter="hero">
              <StatTile
                label="GPS'in de kullandığı koordinat sistemi"
                fact="WGS84"
                tone="primary"
              />
              <StatTile label="Hesaplarda Dünya'nın yarıçapı" fact="6.371 km" tone="secondary" />
              <StatTile label="Listeden seçilebilen il merkezi" fact="81 il" tone="accent" />
              <StatTile label="Alan sonucu: km², hektar, dönüm" fact="3 birim" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: INTERACTIVE 3-IN-1 GIS WORKBENCH */}
        <V2ToolsHub />

        {/* SECTION 2: GIS & GEODESY METHODOLOGY GUIDE */}
        <V2GisMethodologyGuide />
      </PageContainer>
    </>
  );
}
