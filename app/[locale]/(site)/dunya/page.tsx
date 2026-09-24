import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCountriesResilient, getCountryMapSummaryResilient } from "@/lib/api/countries";
import { hasFlag } from "@/lib/geo/flag-set";
import { SPECIAL_STATUS_ISO_CODES } from "@/lib/geo/special-status-isos";
import { showsCountryFlagForStatus } from "@/lib/geo/sovereignty";
import type { CountryMapSummary, Continent } from "@/lib/api/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { pickHubDescription } from "@/lib/seo/hub-description";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { PlateSkeleton, StatTileSkeleton } from "@/components/patterns/page-skeleton";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2WorldMapExplorer, type WorldCountryItem } from "@/components/v2/v2-world-map-explorer";
import { V2WorldContinents } from "@/components/v2/v2-world-continents";
import { V2WorldStatsSpotlight } from "@/components/v2/v2-world-stats-spotlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gamepad2, ArrowRight, Home } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * `force-dynamic`: same reasoning as the V1 `/dunya` twin — a build-time api outage would
 * bake an empty country list AND an inert, unlinked map into this hub, breaking its entire
 * browsing purpose until the next ISR revalidation (T-020's bug class). The previous
 * `revalidate = 86400` meant that broken state could persist for up to 24 hours.
 */
export const dynamic = "force-dynamic";

interface V2DunyaPageProps {
  params: Promise<{ locale: Locale }>;
}

function slugForLocale(country: { slugTr: string; slugEn: string }, locale: Locale): string {
  return locale === "en" ? country.slugEn : country.slugTr;
}

export async function generateMetadata({ params }: V2DunyaPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dunya" });
  // Cached by the same ISR entry the page body reads, so this is not a second round trip.
  const countries = await getCountriesResilient();
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    hrefForLocale: () => "/dunya",
    title: "Dünya Atlası — İnteraktif Dünya Haritası ve Ülkeler",
    /**
     * The count comes from the FETCH, never from a literal (`lib/seo/hub-description.ts`).
     * `getCountriesResilient` degrades to an empty list on an api blip; a description still
     * promising 199 countries is SEO-POLICY §B2.6, and T-032 PR3 made this page indexable again.
     */
    description: pickHubDescription(
      t("metaDescription", { count: countries.length }),
      t("metaDescriptionFallback"),
      countries.length,
    ),
  });
}

async function loadDunyaHub(locale: Locale) {
  // Fetch country summary and resilient list
  const [mapSummaries, rawCountries] = await Promise.all([
    getCountryMapSummaryResilient(),
    getCountriesResilient(),
  ]);

  const summaryMap = new Map<string, CountryMapSummary>();
  for (const s of mapSummaries) {
    summaryMap.set(s.isoCode, s);
  }

  // Combine data into WorldCountryItem
  const countries: WorldCountryItem[] = rawCountries.map((c) => {
    const sum = summaryMap.get(c.isoCode);
    const slug = slugForLocale(c, locale);
    const isSpecialStatus = SPECIAL_STATUS_ISO_CODES.has(c.isoCode.toUpperCase());
    const hasFlagAsset = hasFlag(c.isoCode);
    // User Decision 1-A & DEC 2026-09-03a md.2: Special-status flags display in Turkish
    // with special-status badging. In English, flags are suppressed per DEC 2026-08-08h and
    // DEC 2026-08-08l B2 until English sovereignty notes (FU-SOVNOTE-EN) land.
    //
    // The rule comes from `lib/geo/sovereignty.ts`, not from a copy of it written here. This
    // line used to restate the module's condition inline, which agreed with it by coincidence;
    // the module's own docblock rules that the coupling be expressed as a dependency.
    // Membership still comes from the ISO set, because the list DTO this page consumes carries
    // no `sovereigntyNoteTr`.
    const flagVisible = hasFlagAsset && showsCountryFlagForStatus(locale, isSpecialStatus);

    return {
      isoCode: c.isoCode,
      nameTr: c.nameTr,
      nameEn: c.nameEn,
      continent: c.continent,
      slugTr: c.slugTr,
      slugEn: c.slugEn,
      path: `/dunya/${slug}`,
      entityType: sum?.entityType,
      population: sum?.population ?? null,
      areaKm2: sum?.areaKm2 ?? null,
      neighborCount: sum?.neighborCount ?? 0,
      hasFlag: flagVisible,
      isSpecialStatus,
    };
  });

  // NO `|| 199`. A degraded fetch lists nothing; claiming 199 anyway is the same invention as a
  // hardcoded meta description, one layer down.
  const totalCountries = countries.length;

  const continentCounts: Partial<Record<Continent, number>> = {};
  for (const c of countries) {
    continentCounts[c.continent as Continent] =
      (continentCounts[c.continent as Continent] || 0) + 1;
  }

  return {
    countries,
    totalCountries,
    continentCounts,
  };
}

async function CountryCountTile() {
  const { totalCountries } = await loadDunyaHub("tr");
  return (
    <StatTile
      label="Ülke ve bölge"
      value={totalCountries}
      unit="Ülke"
      tone="primary"
      absent={{ label: "Ülke listesi yok", hint: "Liste şu an yüklenemedi" }}
    />
  );
}

async function DunyaExplorer({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Dunya" });
  const { countries, totalCountries, continentCounts } = await loadDunyaHub(locale);
  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Dünya Atlası",
            // Structured data may not carry what the page does not show (SEO-POLICY §B5 5.7).
            description: pickHubDescription(
              t("metaDescription", { count: totalCountries }),
              t("metaDescriptionFallback"),
              totalCountries,
            ),
            path: "/dunya",
            locale,
          }),
          itemListJsonLd({
            name: "Dünya Ülkeleri",
            items: countries.map((c) => ({
              name: locale === "en" ? c.nameEn : c.nameTr,
              path: c.path,
            })),
          }),
        ]}
      />
      <V2WorldMapExplorer
        countries={countries}
        locale={locale}
        middleSections={
          <div key="v2-world-middle-sections" className="space-y-12 my-6">
            {/* SECTION 2: 7 CONTINENTS COMPREHENSIVE GUIDE */}
            <V2WorldContinents countryCounts={continentCounts} />

            {/* SECTION 3: WORLD SUPERLATIVES & EXTREMES */}
            <V2WorldStatsSpotlight />
          </div>
        }
      />
    </>
  );
}

export default async function V2DunyaPage({ params }: V2DunyaPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Dünya Atlası", path: "/dunya" },
            ]}
            locale={locale}
            surface="localized"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Dünya Atlası"
              lede={
                <>
                  Haritada bir ülke seçince nüfusu ve yüzölçümü görünür; oradan ülkenin sayfasına
                  geçersin. Kıtalar, dünyanın rekorları ve ülkelerin tam listesi haritanın altında.
                </>
              }
            />

            {/* Verified Metric Strip */}
            {/* The first tile is DATA — `countries.length` — so it takes the measurement
                branch and `absent` becomes a compile-time question the page has to answer.
                The other three are copy. No `> 0 ? … : null` guard — zero is a reading; see
                `turkiye/page.tsx` for the one rule all four data-backed tiles in this PR share,
                and for why the `absent` copy below is type-required but unreachable today. */}
            <StatGrid gutter="hero">
              <Suspense fallback={<StatTileSkeleton />}>
                <CountryCountTile />
              </Suspense>
              <StatTile label="Kıta" fact="7" tone="secondary" />
              <StatTile label="Dünya nüfusu" fact="~8,1 milyar" hint="BM tahmini" tone="accent" />
              <StatTile label="Kara alanı" fact="~148,9 milyon km²" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: INTERACTIVE VECTOR WORLD MAP WITH INTEGRATED MIDDLE SECTIONS & 199 COUNTRIES CATALOGUE */}
        <Suspense fallback={<PlateSkeleton aspect="world" />}>
          <DunyaExplorer locale={locale} />
        </Suspense>

        {/* SECTION 4: GAMIFICATION & EXPLORER BANNER */}
        <section className="rounded-3xl border border-secondary/40 bg-gradient-to-r from-muted via-card to-muted p-6 sm:p-10 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" size="sm" icon={<Gamepad2 className="size-3.5" />}>
                Harita oyunları
              </Badge>
            </div>
            <h3 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
              Haritayı Ezbere Biliyor musun?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Oyunlar şimdilik Türkiye haritasında: sorulan ili ya da bölgeyi dilsiz haritada bul.
              Oynamak için giriş yapman gerekir; bitirdiğin turların puanı lider tablosuna girer.
            </p>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <Link href="/oyun">
              <Button
                variant="primary"
                size="lg"
                className="w-full md:w-auto shadow-md"
                rightIcon={<ArrowRight className="size-4" />}
              >
                Oyunlara Git
              </Button>
            </Link>
          </div>
        </section>

        {/* NO SOURCES SECTION. The `dunya` scope is gone: this hub draws no map and reads five
            api fields, none of which carries a source this page could name. The block listed the
            UN, the World Bank, the CIA World Factbook, USGS/NASA and IHO GEBCO under "Bu Sayfada
            Kullanılan Veri Setleri" — five institutions whose data is traceable to nothing here. */}
      </PageContainer>
    </>
  );
}
