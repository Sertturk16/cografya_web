import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getEarthquakeListResilient } from "@/lib/api/earthquakes";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { EarthquakeEvent } from "@/lib/api/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2EarthquakeExplorer, type ProvinceMeta } from "@/components/v2/v2-earthquake-explorer";
import { V2FaultLinesGuide } from "@/components/v2/v2-fault-lines-guide";
import { V2EarthquakePreparedness } from "@/components/v2/v2-earthquake-preparedness";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Home,
  ChevronRight,
} from "lucide-react";

export const revalidate = 120;

interface V2DepremPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Canlı Deprem Takip & Sismik Fay Monitörü v2 — AFAD TDVMS Verileri",
    description: "Türkiye ve çevre coğrafyadaki son depremler, merkez üsleri, MTA diri fay hatları ve odak derinlikleri canlı harita üzerinde.",
    alternates: {
      canonical: "/v2/deprem",
    },
  };
}

export default async function V2DepremPage({ params }: V2DepremPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  let initialEvents: EarthquakeEvent[] = [];
  const provinceMap = new Map<string, ProvinceMeta>();

  try {
    const [list, rawProvinces] = await Promise.all([
      getEarthquakeListResilient(),
      getProvincesResilient(),
    ]);
    initialEvents = list?.items || [];
    for (const p of rawProvinces) {
      provinceMap.set(p.plateCode, {
        name: p.nameTr,
        slug: locale === "en" ? p.slugEn : p.slugTr,
      });
    }
  } catch (err) {
    console.warn("[v2/deprem] Live fetch degraded gracefully:", err);
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 overflow-x-clip">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Canlı Deprem Takip & Sismik Fay Monitörü v2",
            description: "Türkiye ve yakın çevresinde gerçekleşen son depremleri interaktif vektör harita üzerinde merkez üssü, odak derinliği ve fay hatlarıyla anlık takip edin.",
            path: "/v2/deprem",
            locale,
          }),
        ]}
      />

      {/* V2 Header */}
      <V2Header />

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-14">
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/v2" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Canlı Deprem Monitörü v2</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" size="sm" icon={<Flame className="size-3.5" />} dot>
                  Canlı Sismik Telemetri v2
                </Badge>
                <Badge variant="outline" size="sm">
                  T.C. İçişleri Bakanlığı AFAD (TDVMS)
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                Canlı Deprem Takip &amp; Sismik Fay Monitörü
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Türkiye ve yakın çevresinde gerçekleşen son depremleri interaktif vektör harita üzerinde merkez üssü, odak derinliği, büyüklük kademesi ve aktif fay zonlarıyla anlık inceleyin.
              </p>
            </div>

            {/* Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-destructive block">120 sn</span>
                <span className="text-xs text-muted-foreground font-medium">Veri Yenileme Aralığı</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">3 Fay Zonu</span>
                <span className="text-xs text-muted-foreground font-medium">KAF, DAF &amp; BAFS (MTA)</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">M 1.0 - 7.0+</span>
                <span className="text-xs text-muted-foreground font-medium">Hassas Büyüklük Skalası</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">81 İl</span>
                <span className="text-xs text-muted-foreground font-medium">İl Bazlı Yakınlık Analizi</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE REAL-TIME EARTHQUAKE MAP & DATA TABLE */}
        <V2EarthquakeExplorer
          initialEvents={initialEvents}
          provinceMap={provinceMap}
          defaultMinMagnitude={2.5}
          defaultWindowDays={7}
        />

        {/* SECTION 2: FAULT LINES & SEISMOTECTONIC GUIDE */}
        <V2FaultLinesGuide />

        {/* SECTION 3: PREPAREDNESS & ATTRIBUTION GUIDE */}
        <V2EarthquakePreparedness />

        {/* SECTION 4: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
        <V2SourcesSection scope="deprem" />
      </main>

      {/* V2 Footer */}
      <V2Footer />
    </div>
  );
}
