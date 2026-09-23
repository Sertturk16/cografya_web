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
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Gamepad2, ArrowRight, Home, Waves, Flame } from "lucide-react";

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
              { label: "Türkiye İlleri", path: "/turkiye" },
            ]}
            locale={locale}
            surface="localized"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Türkiye İlleri"
              lede={
                <>
                  Haritada bir ile tıkla ya da aşağıdaki listeden seç. Her ilin nüfusu, yüzölçümü,
                  yeryüzü şekilleri ve iklimi kendi sayfasında.
                </>
              }
            />

            {/* Verified Metric Strip */}
            {/* Two of these four are DATA — `provinces.length` and the summed district count —
                so they take the measurement branch and `absent` becomes a compile-time question
                the page has to answer.

                ONE RULE FOR ALL FOUR DATA-BACKED TILES IN THIS PR, and it is `MetricValue`'s own
                first doctrine: ZERO IS A READING. No tile converts a 0 into the absent state.
                An earlier round guarded this one with `totalDistricts > 0 ? … : null`, which
                turned a degraded summary's `0` into "İlçe sayısı yok" — a live copy change on a
                page this PR claims not to change, and inconsistent with the two sibling tiles that
                had no such guard. `absent` fires only when the value is genuinely `null`/
                `undefined`/`NaN`.

                AND TODAY THAT NEVER HAPPENS. `provinces.length` and a `reduce` are numbers by
                construction, so every `absent` string in this PR is TYPE-REQUIRED AND CURRENTLY
                UNREACHABLE — required copy, not shipped copy, and it renders in no state the app
                can reach. Do not read them in the diff as new user-facing text, and do not
                describe them as runtime guards: making them live is an UPSTREAM change, in whether
                an `apiGet` failure surfaces as `null` rather than `[]`. That is the accepted cost
                of making the decision compulsory — `MetricValue` requires the caller to answer
                "what if it is not there" even when the honest answer is "it always arrives" — and
                it is not a defect to paper over with a `> 0` guard that changes live copy. */}
            <StatGrid gutter="hero">
              <StatTile
                label="İl sayısı"
                value={totalProvinces}
                unit="İl"
                tone="primary"
                absent={{ label: "İl listesi yok", hint: "Liste yüklenemedi" }}
              />
              <StatTile label="Coğrafi bölge" fact="7" tone="secondary" />
              <StatTile
                label="İlçe sayısı"
                value={totalDistricts}
                tone="accent"
                absent={{ label: "İlçe sayısı yok", hint: "Özet verisi gelmedi" }}
              />
              <StatTile label="Yüzölçümü (HGM)" fact="783.562 km²" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: INTERACTIVE REALISTIC VECTOR MAP EXPLORER & REGIONS HUB BANNER */}
        <V2TurkeyMapExplorer
          provinces={provinces}
          regionsSection={
            <div className="rounded-3xl border border-border bg-gradient-to-r from-card via-card to-muted/40 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <span className="text-xs text-muted-foreground">1941 Coğrafya Kongresi</span>
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                  7 Coğrafi Bölge, 21 Bölüm
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Yedi bölgeyi bir tabloda yan yana karşılaştır: illeri, nüfusu, yüzölçümü ve en
                  yüksek zirveleri.
                </p>
              </div>
              <Link href="/turkiye/bolge" className="shrink-0">
                <Button variant="primary" size="md" rightIcon={<ArrowRight className="size-4" />}>
                  Bölgelere Git
                </Button>
              </Link>
            </div>
          }
        />

        {/* SECTION 3: 3-HUB CROSS-LINK CARDS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              Oyun, Deniz ve Deprem Sayfaları
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Harita Oyunu */}
            <Link href="/oyun" className="group block">
              <Card className="h-full hover:border-secondary/60 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                <CardHeader>
                  <div className="size-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-white transition-colors">
                    <Gamepad2 className="size-6" />
                  </div>
                  <CardTitle className="text-xl">Dilsiz Haritada İl Bul</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Sorulan yeri haritada bulup puan topla. Üç mod var: bölgeleri bul, 81 ili bul ya
                    da bir bölge seçip yalnız onun illerini bul.
                  </CardDescription>
                  <div className="pt-3 flex items-center text-xs font-semibold text-secondary group-hover:translate-x-1 transition-transform">
                    <span>Oyunu Aç</span>
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
                  <CardTitle className="text-xl">Denizler ve Kıyılar</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Dört denizi karşılaştır. Kıyı illerinin açığında seçilen 30 noktada su
                    sıcaklığı, dalga ve rüzgâr izlenir; sıcaklık verisi Copernicus&apos;tan gelir.
                  </CardDescription>
                  <div className="pt-3 flex items-center text-xs font-semibold text-accent group-hover:translate-x-1 transition-transform">
                    <span>Denizlere Bak</span>
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
                  <CardTitle className="text-xl">Son Depremler</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    AFAD&apos;ın kaydettiği son depremler. Kuzey Anadolu, Doğu Anadolu ve Batı
                    Anadolu fay hatlarını anlatan sayfa da oradan açılır.
                  </CardDescription>
                  <div className="pt-3 flex items-center text-xs font-semibold text-destructive group-hover:translate-x-1 transition-transform">
                    <span>Depremlere Bak</span>
                    <ArrowRight className="size-3.5 ml-1" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>
      </PageContainer>
    </>
  );
}
