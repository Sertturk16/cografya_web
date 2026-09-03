import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildProvincePoints } from "@/lib/tools/province-points";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolWorkbench } from "@/components/v2/v2-tool-workbench";
import { V2ToolEducationalContent } from "@/components/v2/v2-tool-educational-content";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Badge } from "@/components/ui/badge";
import { Route, Home, ChevronRight } from "lucide-react";

export const revalidate = 86400;

interface V2DistancePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2DistancePageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    surface: "noindex",
    hrefForLocale: () => "/v2/araclar/mesafe-olcme",
    title: "Haritada Kuş Uçuşu Mesafe Ölçme v2 — Büyük Daire Jeodezik Hesaplama",
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
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Kuş Uçuşu Mesafe Ölçme v2",
          description:
            "İki nokta ya da çok duraklı güzergâh boyunca büyük daire jeodezik uzaklığını haritada ölçün.",
          path: "/v2/araclar/mesafe-olcme",
          locale,
          learningResourceType: "Interactive tool",
          teaches: "Kuş uçuşu mesafe, büyük daire yayı, Haversine formülü, çizgi ölçek",
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
              <span className="text-foreground font-semibold">Mesafe Ölçme</span>
            </nav>

            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" icon={<Route className="size-3.5" />}>
                    Jeodezik Kuş Uçuşu Mesafe
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    WGS84 Haversine Modeli
                  </Badge>
                </div>

                <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                  Haritada Kuş Uçuşu Mesafe Ölçme
                </h1>

                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                  Türkiye haritasında dilediğiniz noktaları işaretleyerek ya da 81 il merkezinden
                  seçerek noktalar arası jeodezik mesafeyi, tahmini uçuş süresini ve karayolu
                  farkını anında hesaplayın.
                </p>
              </div>

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
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">
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
            downloadName="cografya-v2-mesafe"
          />

          {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
          <V2ToolEducationalContent mode="distance" />

          {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES */}
          <V2SourcesSection scope="araclar" />
        </main>
      </div>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
