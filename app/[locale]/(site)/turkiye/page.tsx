import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProvincesResilient, getMapSummaryResilient } from "@/lib/api/provinces";
import { getMarinePointsSafe } from "@/lib/api/marine";
import { coastalPlateCodes } from "@/lib/marine/coastal";
import { regionSlug } from "@/lib/game/region-slug";
import type { ProvinceListItem, ProvinceMapSummary } from "@/lib/api/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { pickHubDescription } from "@/lib/seo/hub-description";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2TurkeyMapExplorer, type ProvinceItem } from "@/components/v2/v2-turkey-map-explorer";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { PageContainer } from "@/components/patterns/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Map as MapIcon, Gamepad2, ArrowRight, Home, Waves, Flame } from "lucide-react";

/**
 * `force-dynamic`: same reasoning as the V1 `/turkiye` twin — a build-time api outage would
 * bake an empty province list AND an inert, unlinked map into this hub, breaking its entire
 * browsing purpose until the next ISR revalidation (T-020's bug class).
 * `app/[locale]/(site)/hesabim/page.tsx` already accepts this trade-off for a hub-shaped page.
 */
export const dynamic = "force-dynamic";

interface V2TurkiyePageProps {
  params: Promise<{ locale: Locale }>;
}

function slugForLocale(province: ProvinceListItem, locale: Locale): string {
  return locale === "en" ? province.slugEn : province.slugTr;
}

export async function generateMetadata({ params }: V2TurkiyePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Turkiye" });
  // Cached by the same ISR entry the page body reads, so this is not a second round trip.
  const provinces = await getProvincesResilient();
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    hrefForLocale: () => "/turkiye",
    title: "Türkiye İller Atlası — 81 İl İnteraktif Haritası ve Coğrafyası",
    /**
     * The count comes from the FETCH, never from a literal (`lib/seo/hub-description.ts`).
     *
     * This read "Türkiye'nin 81 ili, …" as a fixed string. `getProvincesResilient` degrades to an
     * empty list on an api blip — that is its whole point — and the page then renders no
     * provinces while its description, and its `CollectionPage` structured data, still promise
     * 81. SEO-POLICY §B2.6 is about exactly that: a description must not promise content the
     * page does not have. T-032 PR3 made this page indexable again, so the promise is now live.
     */
    description: pickHubDescription(
      t("metaDescription", { count: provinces.length }),
      t("metaDescriptionFallback"),
      provinces.length,
    ),
  });
}

export default async function V2TurkiyePage({ params }: V2TurkiyePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Turkiye" });

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
      path: `/turkiye/${slugForLocale(prov, locale)}`,
      region,
      regionId,
      population: sum?.population ?? null,
      populationYear: sum?.populationYear ?? null,
      areaKm2: sum?.areaKm2 ?? null,
      districtCount: sum?.districtCount ?? null,
      coastal: coastalSet.has(prov.plateCode),
    };
  });

  // NO `|| 81`, and — since 2026-09-17 — no `|| 973` either. The district total carried one for a
  // while directly beneath the comment forbidding it, which is how the rule reads when it is
  // enforced by a guard that opens one other file: `lib/geo/country-sources.test.ts` checks the
  // country page and nothing else, so this line was never in scope.
  //
  // `.reduce()` over an empty list is already 0, and 0 is the truth when the fetch degraded.
  const totalProvinces = provinces.length;
  const totalDistricts = rawSummary.reduce((acc, s) => acc + (s.districtCount ?? 0), 0);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Türkiye İlleri Atlası",
            // Structured data may not carry what the page does not show (SEO-POLICY §B5 5.7).
            description: pickHubDescription(
              t("metaDescription", { count: totalProvinces }),
              t("metaDescriptionFallback"),
              totalProvinces,
            ),
            path: "/turkiye",
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

      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Türkiye İller Atlası", path: "/turkiye" },
            ]}
            locale={locale}
            surface="localized"
          />

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<MapIcon className="size-3.5" />}>
                  Coğrafya Atlası
                </Badge>
                <Badge variant="secondary" size="sm">
                  {totalProvinces} İl &amp; 7 Bölge
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
                Türkiye İlleri &amp; Coğrafi Bölgeler Atlası
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                81 ilin jeomorfolojik yapısı, demografik dağılımı, iklim normalleri, canlı deniz
                suyu sıcaklıkları ve aktif fay hatları tek ekranda.
              </p>
            </div>

            {/* Verified Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  {totalProvinces} İl
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Mülki İdare Birimi
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  7 Bölge
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Coğrafi Bölüm &amp; Havza
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                  {totalDistricts}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Toplam İlçe Sayısı
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  783.562 km²
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Resmî Yüzölçümü (HGM)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE REALISTIC VECTOR MAP EXPLORER & REGIONS HUB BANNER */}
        <V2TurkeyMapExplorer
          provinces={provinces}
          regionsSection={
            <div className="rounded-3xl border border-border bg-gradient-to-r from-card via-card to-muted/40 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    Doğal &amp; Fiziki Coğrafya
                  </Badge>
                  <span className="text-xs text-muted-foreground">1941 Kongre Tasnifi</span>
                </div>
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                  Türkiye&apos;nin 7 Coğrafi Bölgesi &amp; 21 Alt Bölümü
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  İllerimizin ait olduğu 7 coğrafi bölgenin fiziki sınırları, iklim normalleri,
                  jeomorfolojik havzaları ve analitik karşılaştırma matrisini yeni rehberimizde
                  inceleyin.
                </p>
              </div>
              <Link href="/turkiye/bolge" className="shrink-0">
                <Button variant="primary" size="md" rightIcon={<ArrowRight className="size-4" />}>
                  Bölgeler Atlası&apos;na Git
                </Button>
              </Link>
            </div>
          }
        />

        {/* SECTION 3: 3-HUB CROSS-LINK CARDS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-primary tracking-wider uppercase">
                İlişkili Modüller
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                Türkiye Atlası Ekosistem Araçları
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Harita Oyunu */}
            <Link href="/oyun" className="group block">
              <Card className="h-full hover:border-secondary/60 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                <CardHeader>
                  <div className="size-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-white transition-colors">
                    <Gamepad2 className="size-6" />
                  </div>
                  <CardTitle className="text-xl">Harita Sınavı &amp; İl Bulma</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Dilsiz harita üzerinde 81 ili en kısa sürede bulup puan toplayın, bölge
                    testlerinde hızınızı sınayın.
                  </CardDescription>
                  <div className="pt-3 flex items-center text-xs font-semibold text-secondary group-hover:translate-x-1 transition-transform">
                    <span>Oyunu Başlat</span>
                    <ArrowRight className="size-3.5 ml-1" />
                  </div>
                </CardHeader>
              </Card>
            </Link>

            {/* Card 2: Deniz Telemetrisi */}
            <Link href="/deniz" className="group block">
              <Card className="h-full hover:border-accent/60 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                <CardHeader>
                  <div className="size-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-3 group-hover:bg-accent group-hover:text-white transition-colors">
                    <Waves className="size-6" />
                  </div>
                  <CardTitle className="text-xl">Canlı Deniz Telemetrisi</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    27 kıyı ilimizin çevre denizlerindeki Copernicus SST deniz suyu sıcaklıkları,
                    dalga boyu ve rüzgar vektörleri.
                  </CardDescription>
                  <div className="pt-3 flex items-center text-xs font-semibold text-accent group-hover:translate-x-1 transition-transform">
                    <span>Denizleri İncele</span>
                    <ArrowRight className="size-3.5 ml-1" />
                  </div>
                </CardHeader>
              </Card>
            </Link>

            {/* Card 3: Canlı Deprem Radarı */}
            <Link href="/deprem" className="group block">
              <Card className="h-full hover:border-destructive/60 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                <CardHeader>
                  <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3 group-hover:bg-destructive group-hover:text-white transition-colors">
                    <Flame className="size-6" />
                  </div>
                  <CardTitle className="text-xl">Canlı Deprem Radarı</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    81 ilimizi etkileyen Kuzey, Doğu ve Batı Anadolu aktif fay hatları ve AFAD son
                    sarsıntılar.
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

        {/* SECTION 4: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA)
              `omit` the two the `turkiye` scope carries for the PROVINCE page and this hub does
              not show: there are no monthly climate normals here (and the `era5` card carries
              the verbatim ECMWF quote with them) and no PM2.5 figure. The map, its inland-water
              layer and the province index earn the rest. */}
        <V2SourcesSection scope="turkiye" omit={["era5", "acag-pm25"]} />
      </PageContainer>
    </>
  );
}
