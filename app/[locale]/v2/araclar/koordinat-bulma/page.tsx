import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildProvincePoints } from "@/lib/tools/province-points";
import type { ProvinceArea } from "@/components/tools/tool-island";
import { learningResourceJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ToolWorkbench } from "@/components/v2/v2-tool-workbench";
import { V2ToolEducationalContent } from "@/components/v2/v2-tool-educational-content";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  MapPin,
  Home,
  ChevronRight,
  Globe,
  Layers,
} from "lucide-react";

export const revalidate = 86400;

interface V2CoordinatePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2CoordinatePageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Haritada Koordinat Bulma ve Konum Tespiti v2 — WGS84, DMS & UTM",
    description: "Türkiye haritasında herhangi bir noktaya tıklayarak enlem/boylam, Derece-Dakika-Saniye (DMS), UTM projeksiyon zonu ve noktanın düştüğü il sınırlarını anında öğrenin.",
    alternates: {
      canonical: "/v2/araclar/koordinat-bulma",
    },
  };
}

export default async function V2CoordinateToolPage({ params }: V2CoordinatePageProps) {
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
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Koordinat Bulma ve Konum Tespiti v2",
          description: "Haritadaki bir noktanın enlemini, boylamını ve konumunu çift gösterimde okuyun.",
          path: "/v2/araclar/koordinat-bulma",
          locale,
          learningResourceType: "Interactive tool",
          teaches: "Coğrafi koordinatlar, enlem, boylam, DMS, WGS84, UTM projeksiyon zonları",
        })}
      />

      {/* V2 Header */}
      <V2Header />

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-12">
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/v2" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <Link href="/v2/araclar" className="hover:text-foreground transition-colors">
              CBS Araçları
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Koordinat Bulma</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" size="sm" icon={<MapPin className="size-3.5" />}>
                  Coğrafi Koordinat &amp; GPS
                </Badge>
                <Badge variant="primary" size="sm">
                  Çift Projeksiyon (WGS84 + UTM)
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                Koordinat &amp; Konum Bulucu
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Haritada dilediğiniz bir noktaya tıklayarak veya listeden il seçerek Ondalık Derece (DD), Derece-Dakika-Saniye (DMS) ve UTM Dilim (Zone) koordinatlarını ve noktanın hangi ilin sınırları içinde olduğunu öğrenin.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">WGS84 (DD)</span>
                <span className="text-xs text-muted-foreground font-medium">Ondalık Küresel Açısal Derece</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">DMS Formatı</span>
                <span className="text-xs text-muted-foreground font-medium">Derece-Dakika-Saniye Gösterimi</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">UTM Zonu</span>
                <span className="text-xs text-muted-foreground font-medium">6° Dilimli Düzlemsel Izgara</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">İl Tespiti</span>
                <span className="text-xs text-muted-foreground font-medium">Otomatik Sınır Eşleme (Polygon)</span>
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
          downloadName="cografya-v2-koordinat"
        />

        {/* SECTION 2: PEDAGOGICAL EDUCATIONAL & CBS GUIDE */}
        <V2ToolEducationalContent mode="coordinates" />

        {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES */}
        <V2SourcesSection scope="araclar" />
      </main>
    </div>
  );
}
