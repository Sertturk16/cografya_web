import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildProvincePoints } from "@/lib/tools/province-points";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { DISTANCE_TOOL, TOOLS_SURFACE } from "@/lib/tools/tool-registry";
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
import { Route, Home } from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";
import { Card } from "@/components/ui/card";

export const revalidate = 86400;

interface V2DistancePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2DistancePageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    // The whole tier's surface, from `lib/tools/tool-registry.ts` — the same constant
    // `app/sitemap.ts` hands `sitemapEntriesFor`, so the head and the sitemap cannot
    // disagree about this page. It read `"noindex"` while the tier lived under `/v2`.
    surface: TOOLS_SURFACE,
    hrefForLocale: () => "/araclar/mesafe-olcme",
    title: "Haritada Kuş Uçuşu Mesafe Ölçme — İller Arası Mesafe",
    description:
      "İki nokta ya da çok duraklı bir rota arasındaki kuş uçuşu mesafeyi km ve deniz mili olarak ölç; uçuş süresini ve kaba karayolu tahminini de gör.",
  });
}

async function DistanceWorkbench({ locale }: { locale: Locale }) {
  const provinces = await getProvincesResilient();
  const provincePoints = buildProvincePoints(provinces);
  const provinceAreas = provinces.map((p) => ({
    plateCode: p.plateCode,
    name: p.nameTr,
    slug: locale === "en" ? p.slugEn : p.slugTr,
  }));
  return (
    <V2ToolWorkbench
      initialMode="distance"
      lockMode={true}
      provincePoints={provincePoints}
      provinceAreas={provinceAreas}
      downloadName="cografya-mesafe"
    />
  );
}

export default async function V2DistanceToolPage({ params }: V2DistancePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Kuş Uçuşu Mesafe Ölçme",
          description:
            "İki nokta ya da çok duraklı bir rota boyunca kuş uçuşu mesafeyi haritada ölç.",
          path: "/araclar/mesafe-olcme",
          locale,
          learningResourceType: "Interactive tool",
          teaches: "Kuş uçuşu mesafe, büyük daire yayı, Haversine formülü, çizgi ölçek",
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
              { label: "Mesafe Ölçme", path: "/araclar/mesafe-olcme" },
            ]}
            locale={locale}
            surface={TOOLS_SURFACE}
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Haritada Kuş Uçuşu Mesafe Ölçme"
              badges={
                <Badge variant="primary" size="sm" icon={<Route className="size-3.5" />}>
                  Duraklı rotanın toplamını verir
                </Badge>
              }
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={
                <>
                  Haritaya tıkla ya da listeden iki il seç: aradaki kuş uçuşu mesafe hemen çıkar.
                  Uçakla kaç dakika süreceğini ve yolun kabaca kaç kilometre tutacağını da görürsün.
                </>
              }
            />

            {/* Metric Strip */}
            <StatGrid gutter="hero">
              <StatTile label="Mesafeyi hesaplayan formül" fact="Haversine" tone="primary" />
              {/* `fact`, not `value={6371}`. THE LINE THIS PR DRAWS: `MetricValue` guards
                  against a page promising a reading it does not have, which is a statement
                  about DATA. These four are constants typed into the copy — a documented
                  radius, a cruising speed — and there is nothing for an `absent` state to
                  describe. The tiles fed by real data DO take the measurement branch; see
                  `turkiye`, `dunya` and `kitaplar`. */}
              <StatTile label="Dünya'nın ortalama yarıçapı" fact="6.371 km" tone="secondary" />
              <StatTile label="Uçuş süresinde varsayılan hız" fact="800 km/sa" tone="accent" />
              <StatTile label="Karayolu tahmini: kuş uçuşu ×" fact="1,28" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: STANDALONE DISTANCE WORKBENCH */}
        <Suspense fallback={<PlateSkeleton aspect="map" />}>
          <DistanceWorkbench locale={locale} />
        </Suspense>

        {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
        <V2ToolEducationalContent mode="distance" />

        {/* The tier exit. Both locales — an English reader was as stuck as a Turkish
              one, and the labels are already bilingual. */}
        <V2RelatedTools current={DISTANCE_TOOL.pathname} />
      </PageContainer>
    </>
  );
}
