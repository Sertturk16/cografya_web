import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getCountriesResilient, getCountryMapSummaryResilient } from "@/lib/api/countries";
import { hasFlag } from "@/lib/geo/flag-set";
import type { CountryListItem, CountryMapSummary, Continent } from "@/lib/api/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2WorldMapExplorer, type WorldCountryItem } from "@/components/v2/v2-world-map-explorer";
import { V2WorldContinents } from "@/components/v2/v2-world-continents";
import { V2WorldStatsSpotlight } from "@/components/v2/v2-world-stats-spotlight";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Compass,
  Gamepad2,
  ArrowRight,
  Sparkles,
  Home,
  ChevronRight,
  Layers,
  MapPin,
  Users,
} from "lucide-react";

export const revalidate = 86400;

interface V2DunyaPageProps {
  params: Promise<{ locale: Locale }>;
}

function slugForLocale(country: { slugTr: string; slugEn: string }, locale: Locale): string {
  return locale === "en" ? country.slugEn : country.slugTr;
}

const SPECIAL_STATUS_ISO_CODES = new Set(["QN", "CY", "IL", "PS", "TW", "XK"]);

export async function generateMetadata({ params }: V2DunyaPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Dünya Ülkeleri & Kıtalar Atlası v2 — İnteraktif Dünya Haritası",
    description:
      "Dünyanın 199 ülke ve bölgesi, 7 kıtası, bayrakları, nüfus verileri, yüzölçümleri ve coğrafi ekstremleri tek ekranda.",
    alternates: {
      canonical: "/v2/dunya",
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function V2DunyaPage({ params }: V2DunyaPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

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
    const flagVisible = hasFlagAsset && (!isSpecialStatus || locale === "tr");

    return {
      isoCode: c.isoCode,
      nameTr: c.nameTr,
      nameEn: c.nameEn,
      continent: c.continent,
      slugTr: c.slugTr,
      slugEn: c.slugEn,
      path: `/v2/dunya/${slug}`,
      entityType: sum?.entityType,
      population: sum?.population ?? null,
      areaKm2: sum?.areaKm2 ?? null,
      neighborCount: sum?.neighborCount ?? 0,
      hasFlag: flagVisible,
    };
  });

  const totalCountries = countries.length || 199;

  const continentCounts: Partial<Record<Continent, number>> = {};
  for (const c of countries) {
    continentCounts[c.continent as Continent] =
      (continentCounts[c.continent as Continent] || 0) + 1;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Dünya Ülkeleri & Kıtalar Atlası v2",
            description:
              "Dünyanın 199 ülke ve bölgesi, 7 kıtası, bayrakları, nüfus verileri, yüzölçümleri ve coğrafi ekstremleri.",
            path: "/v2/dunya",
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

      {/* Top Bars */}
      <div>
        <V2Header />
        <V2LiveTicker />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-14 flex-1 w-full pb-16">
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
            <span className="text-foreground font-semibold">Dünya Atlası v2</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Globe className="size-3.5" />}>
                  Dünya Coğrafya Portalı v2
                </Badge>
                <Badge variant="secondary" size="sm">
                  {totalCountries} Ülke & 7 Kıta
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                Dünya Ülkeleri &amp; Kıtalar Atlası
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Gezegenimizin 7 kıtası, {totalCountries} ülke ve bölgesi, bayrakları, demografik
                dağılımı, yeryüzü şekilleri ve coğrafi ekstremleri tek ekranda.
              </p>
            </div>

            {/* Verified Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  {totalCountries} Ülke
                </span>
                <span className="text-xs text-muted-foreground font-medium">Ülke &amp; Bölge</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  7 Kıta
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Coğrafi Kara Kütlesi
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                  ~8.1 Milyar
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Dünya Nüfusu (BM WPP)
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">
                  148.9M km²
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Karasal Alan (USGS/NASA)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE VECTOR WORLD MAP WITH INTEGRATED MIDDLE SECTIONS & 199 COUNTRIES CATALOGUE */}
        <V2WorldMapExplorer
          countries={countries}
          locale={locale}
          middleSections={
            <div className="space-y-12 my-6">
              {/* SECTION 2: 7 CONTINENTS COMPREHENSIVE GUIDE */}
              <V2WorldContinents countryCounts={continentCounts} />

              {/* SECTION 3: WORLD SUPERLATIVES & EXTREMES */}
              <V2WorldStatsSpotlight />
            </div>
          }
        />

        {/* SECTION 4: GAMIFICATION & EXPLORER BANNER */}
        <section className="rounded-3xl border border-[var(--color-secondary,#4f6d30)]/40 bg-gradient-to-r from-[var(--color-surface,#f1e9de)] via-card to-[var(--color-surface,#f1e9de)] p-6 sm:p-10 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" size="sm" icon={<Gamepad2 className="size-3.5" />}>
                Coğrafya Sınavı &amp; Harita Oyunu
              </Badge>
              <span className="text-xs font-semibold text-secondary">Etkileşimli Öğrenme</span>
            </div>
            <h3 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)]">
              Dünya Coğrafyasını ve Ülkeleri Ne Kadar İyi Tanıyorsun?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Dilsiz dünya haritası üzerinde ülkeleri bulun, kıta testlerinde hızınızı sınayın ve
              puan toplayarak lider tablosunda yükselin.
            </p>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <Link href="/v2/oyun">
              <Button
                variant="primary"
                size="lg"
                className="w-full md:w-auto shadow-md"
                rightIcon={<ArrowRight className="size-4" />}
              >
                Harita Oyununu Başlat
              </Button>
            </Link>
          </div>
        </section>

        {/* SECTION 5: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
        <V2SourcesSection scope="dunya" />
      </main>

      {/* V2 Footer */}
      <V2Footer />
    </div>
  );
}
