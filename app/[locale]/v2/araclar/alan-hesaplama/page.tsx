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
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  Layers,
  Home,
  ChevronRight,
  Sparkles,
  Scale,
} from "lucide-react";

export const revalidate = 86400;

interface V2AreaPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: V2AreaPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Haritada Çokgen Alan Hesaplama v2 — Küresel Yüzölçümü ve Çevre Ölçümü",
    description: "Türkiye haritasında dilediğiniz köşe noktalarıyla çokgenler oluşturarak km², Hektar ve Dönüm cinsinden gerçek küresel yüzölçümü ve çevre uzunluğunu L'Huilier teoremiyle hesaplayın.",
    alternates: {
      canonical: "/v2/araclar/alan-hesaplama",
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
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={learningResourceJsonLd({
          name: "Haritada Çokgen Alan Hesaplama v2",
          description: "Haritada kapattığınız çokgenin alanını ve çevresini küresel trigonometriyle hesaplayın.",
          path: "/v2/araclar/alan-hesaplama",
          locale,
          learningResourceType: "Interactive tool",
          teaches: "Küresel çokgen alanı, L'Huilier teoremi, izdüşüm alan, yüzölçümü, hektar, dönüm",
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
            <span className="text-foreground font-semibold">Alan Hesaplama</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Layers className="size-3.5" />}>
                  Küresel Çokgen Yüzölçümü
                </Badge>
                <Badge variant="secondary" size="sm">
                  L&apos;Huilier Küresel Trigonometri
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                Çokgen Yüzölçümü &amp; Alan Hesabı
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Harita üzerinde dilediğiniz köşe noktalarını işaretleyerek kapalı çokgenler çizin; küresel açı fazlalığı (Spherical Excess) formülleriyle km², Hektar, Dönüm ve çevre uzunluğunu anında hesaplayın.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">L&apos;Huilier</span>
                <span className="text-xs text-muted-foreground font-medium">Küresel Açı Fazlalığı Teoremi</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">3 Birim</span>
                <span className="text-xs text-muted-foreground font-medium">km², Hektar, Dönüm Çıktısı</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">Çevre</span>
                <span className="text-xs text-muted-foreground font-medium">Kapalı Çevre (Perimeter) Uzunluğu</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">WGS84</span>
                <span className="text-xs text-muted-foreground font-medium">Eğri Yüzey Alan Modeli</span>
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
  );
}
