import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getProvincesResilient, getMapSummaryResilient } from "@/lib/api/provinces";
import { getMarinePointsSafe } from "@/lib/api/marine";
import { coastalPlateCodes } from "@/lib/marine/coastal";
import { regionSlug } from "@/lib/game/region-slug";
import type { ProvinceListItem, ProvinceMapSummary } from "@/lib/api/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2TurkeyMapExplorer, type ProvinceItem } from "@/components/v2/v2-turkey-map-explorer";
import { V2TurkeyRegions } from "@/components/v2/v2-turkey-regions";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Map as MapIcon,
  Gamepad2,
  ArrowRight,
  Home,
  ChevronRight,
  Waves,
  Flame,
} from "lucide-react";

export const revalidate = 3600;

interface V2TurkiyePageProps {
  params: Promise<{ locale: Locale }>;
}

function slugForLocale(province: ProvinceListItem, locale: Locale): string {
  return locale === "en" ? province.slugEn : province.slugTr;
}

export async function generateMetadata({ params }: V2TurkiyePageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Türkiye İller Atlası v2 — 81 İl İnteraktif Haritası ve Coğrafyası",
    description: "Türkiye'nin 81 ili, 7 coğrafi bölgesi, fiziki haritaları, demografisi, iklim normalleri ve canlı deniz/deprem telemetrisi.",
    alternates: {
      canonical: "/v2/turkiye",
    },
  };
}

export default async function V2TurkiyePage({ params }: V2TurkiyePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [rawProvinces, rawSummary, rawMarinePoints] = await Promise.all([
    getProvincesResilient(),
    getMapSummaryResilient(),
    getMarinePointsSafe(),
  ]);

  const coastalSet = coastalPlateCodes(rawMarinePoints);

  const summaryMap = new Map<string, ProvinceMapSummary>();
  for (const s of rawSummary) {
    summaryMap.set(s.plateCode, s);
  }

  const provinces: ProvinceItem[] = rawProvinces.map((prov) => {
    const sum = summaryMap.get(prov.plateCode);
    const region = prov.region;
    const regionId = regionSlug(region);
    return {
      id: prov.plateCode,
      name: prov.nameTr,
      plateCode: prov.plateCode,
      slug: slugForLocale(prov, locale),
      path: `/v2/turkiye/${slugForLocale(prov, locale)}`,
      region,
      regionId,
      population: sum?.population ?? null,
      populationYear: sum?.populationYear ?? null,
      areaKm2: sum?.areaKm2 ?? null,
      districtCount: sum?.districtCount ?? null,
      coastal: coastalSet.has(prov.plateCode),
    };
  });

  const totalProvinces = provinces.length || 81;
  const totalDistricts = rawSummary.reduce((acc, s) => acc + (s.districtCount || 0), 0) || 973;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Türkiye İlleri Atlası v2",
            description: "Türkiye'nin 81 ili, 7 coğrafi bölgesi, fiziki haritaları, demografisi ve canlı telemetrisi.",
            path: "/v2/turkiye",
            locale,
          }),
          itemListJsonLd({
            name: "Türkiye İlleri",
            items: provinces.map((p) => ({
              name: p.name,
              path: p.path,
            })),
          }),
        ]}
      />

      <div>
        {/* V2 Header */}
        <V2Header />

        {/* Live Telemetry Ticker */}
        <V2LiveTicker />

        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">
          {/* Breadcrumb & Header Hero */}
          <div className="space-y-4">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/v2" className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Home className="size-3.5" />
                <span>Ana Sayfa</span>
              </Link>
              <ChevronRight className="size-3.5" />
              <span className="text-foreground font-semibold">Türkiye İller Atlası v2</span>
            </nav>

            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm" icon={<MapIcon className="size-3.5" />}>
                    Coğrafya Atlası v2
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    {totalProvinces} İl &amp; 7 Bölge
                  </Badge>
                </div>

                <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                  Türkiye İlleri &amp; Coğrafi Bölgeler Atlası
                </h1>

                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                  81 ilin jeomorfolojik yapısı, demografik dağılımı, iklim normalleri, canlı deniz suyu sıcaklıkları ve aktif fay hatları tek ekranda.
                </p>
              </div>

              {/* Verified Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">{totalProvinces} İl</span>
                  <span className="text-xs text-muted-foreground font-medium">Mülki İdare Birimi</span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">7 Bölge</span>
                  <span className="text-xs text-muted-foreground font-medium">Coğrafi Bölüm &amp; Havza</span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">{totalDistricts}</span>
                  <span className="text-xs text-muted-foreground font-medium">Toplam İlçe Sayısı</span>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">783.562 km²</span>
                  <span className="text-xs text-muted-foreground font-medium">Resmî Yüzölçümü (HGM)</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: INTERACTIVE REALISTIC VECTOR MAP EXPLORER & 7 REGIONS GUIDE */}
          <V2TurkeyMapExplorer
            provinces={provinces}
            regionsSection={<V2TurkeyRegions />}
          />

          {/* SECTION 3: 3-HUB CROSS-LINK CARDS */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary tracking-wider uppercase">İlişkili Modüller</span>
                <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                  Türkiye Atlası Ekosistem Araçları
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Harita Oyunu */}
              <Link href="/v2/oyun" className="group block">
                <Card className="h-full hover:border-secondary/60 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                  <CardHeader>
                    <div className="size-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-white transition-colors">
                      <Gamepad2 className="size-6" />
                    </div>
                    <CardTitle className="text-xl">Harita Sınavı &amp; İl Bulma</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Dilsiz harita üzerinde 81 ili en kısa sürede bulup puan toplayın, bölge testlerinde hızınızı sınayın.
                    </CardDescription>
                    <div className="pt-3 flex items-center text-xs font-semibold text-secondary group-hover:translate-x-1 transition-transform">
                      <span>Oyunu Başlat</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>

              {/* Card 2: Deniz Telemetrisi */}
              <Link href="/v2/deniz" className="group block">
                <Card className="h-full hover:border-accent/60 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                  <CardHeader>
                    <div className="size-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-3 group-hover:bg-accent group-hover:text-white transition-colors">
                      <Waves className="size-6" />
                    </div>
                    <CardTitle className="text-xl">Canlı Deniz Telemetrisi</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      27 kıyı ilimizin çevre denizlerindeki Copernicus SST deniz suyu sıcaklıkları, dalga boyu ve rüzgar vektörleri.
                    </CardDescription>
                    <div className="pt-3 flex items-center text-xs font-semibold text-accent group-hover:translate-x-1 transition-transform">
                      <span>Denizleri İncele</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>

              {/* Card 3: Canlı Deprem Radarı */}
              <Link href="/v2/deprem" className="group block">
                <Card className="h-full hover:border-destructive/60 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                  <CardHeader>
                    <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3 group-hover:bg-destructive group-hover:text-white transition-colors">
                      <Flame className="size-6" />
                    </div>
                    <CardTitle className="text-xl">Canlı Deprem Radarı</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      81 ilimizi etkileyen Kuzey, Doğu ve Batı Anadolu aktif fay hatları ve AFAD/Kandilli son sarsıntılar.
                    </CardDescription>
                    <div className="pt-3 flex items-center text-xs font-semibold text-destructive group-hover:translate-x-1 transition-transform">
                      <span>Radarı Aç</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </section>

          {/* SECTION 4: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
          <V2SourcesSection scope="turkiye" />
        </main>
      </div>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
