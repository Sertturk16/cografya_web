import type { Metadata } from "next";
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
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Route, Home } from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";

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
    title: "Haritada Kuş Uçuşu Mesafe Ölçme — Büyük Daire Jeodezik Hesaplama",
    description:
      "İki veya çok duraklı noktalar arasında WGS84 küresel elipsoid modeli ve Haversine formülü ile kuş uçuşu mesafe, uçuş süresi ve karayolu tahmini hesaplama.",
  });
}

export default async function V2DistanceToolPage({ params }: V2DistancePageProps) {
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
          name: "Haritada Kuş Uçuşu Mesafe Ölçme",
          description:
            "İki nokta ya da çok duraklı güzergâh boyunca büyük daire jeodezik uzaklığını haritada ölçün.",
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
              { label: "CBS Araçları", href: "/araclar", path: "/araclar" },
              { label: "Mesafe Ölçme", path: "/araclar/mesafe-olcme" },
            ]}
            locale={locale}
            surface={TOOLS_SURFACE}
          />

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <PageHero
              tier="hub"
              heading="Haritada Kuş Uçuşu Mesafe Ölçme"
              badges={
                <>
                  <Badge variant="primary" size="sm" icon={<Route className="size-3.5" />}>
                    Jeodezik Kuş Uçuşu Mesafe
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    WGS84 Haversine Modeli
                  </Badge>
                </>
              }
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={
                <>
                  Türkiye haritasında dilediğiniz noktaları işaretleyerek ya da 81 il merkezinden
                  seçerek noktalar arası jeodezik mesafeyi, tahmini uçuş süresini ve karayolu
                  farkını anında hesaplayın.
                </>
              }
            />

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  Haversine
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Büyük Daire Yayı Denklemi
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  6.371 km
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  WGS84 Ortalama Dünya Yarıçapı
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                  800 km/s
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Seyir Hızı Uçuş Simülasyonu
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  %28 Eğim
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Topoğrafik Karayolu Katsayısı
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: STANDALONE DISTANCE WORKBENCH */}
        <V2ToolWorkbench
          initialMode="distance"
          lockMode={true}
          provincePoints={provincePoints}
          provinceAreas={provinceAreas}
          downloadName="cografya-mesafe"
        />

        {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
        <V2ToolEducationalContent mode="distance" />

        {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES */}
        {/* The tier exit. Both locales — an English reader was as stuck as a Turkish
              one, and the labels are already bilingual. */}
        <V2RelatedTools current={DISTANCE_TOOL.pathname} />

        <V2SourcesSection scope="araclar" />
      </PageContainer>
    </>
  );
}
