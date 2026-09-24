import type { Metadata } from "next";
import { Suspense } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getCountryMapSummaryResilient } from "@/lib/api/countries";
import {
  getMarineOverviewSafe,
  getMarinePointsSafe,
  MARINE_VALUES_REVALIDATE_SECONDS,
} from "@/lib/api/marine";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import { getAllContinents } from "@/lib/geo/continents";
import { nationalPopulation } from "@/lib/geo/national-population";
import { tr } from "@/lib/text/format-number";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  featuredPopulationFact,
  pickDailyCountries,
  pickDailyProvinces,
  type FeaturedCardItem,
} from "@/lib/home/featured";
import {
  buildMarineHomeSummary,
  marineScope,
  marineSummaryShowsValues,
} from "@/lib/home/marine-summary";
import { MARINE_VALUE_FRACTION_DIGITS } from "@/lib/marine/units";
import { VintageLine } from "@/components/marine/vintage-line";
import { MarineDataNotice } from "@/components/marine/marine-data-notice";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Waves, ArrowRight, Clock } from "lucide-react";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2Hero } from "@/components/v2/v2-hero";
import { V2LearningPaths } from "@/components/v2/v2-learning-paths";
import { V2InteractiveTools } from "@/components/v2/v2-interactive-tools";
import { PageContainer } from "@/components/patterns/page-container";
import { InlineSkeleton, CardGridSkeleton } from "@/components/patterns/page-skeleton";

interface V2PageProps {
  params: Promise<{ locale: Locale }>;
}

export const revalidate: typeof MARINE_VALUES_REVALIDATE_SECONDS = 900;

export async function generateMetadata({ params }: V2PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    hrefForLocale: () => "/",
    // Absolute: `Home.metaTitle` already opens with the brand, so the root layout's
    // `%s · brand` template would print it twice.
    title: t("metaTitle"),
    titleAbsolute: true,
    description: t("metaDescription"),
  });
}

/**
 * A hardcoded literal, deliberately module-scope and unexported. This page is a Server
 * Component that pulls `next-intl/server` and API-fetch modules in at module scope, which is
 * not safe to import into `V2Hero` (a `"use client"` component), so a shared export would be a
 * liability rather than a convenience. It tracks the three mode routes in the `(play)` group:
 * `/oyun/bolge-bulma`, `/oyun/81-il`, `/oyun/bolge-bolge-il`.
 *
 * `lib/home/game-modes.test.ts` reads this literal out of the source and compares it with the
 * real directory count, so the number cannot drift from the routes without CI noticing.
 */
const V2_GAME_MODE_COUNT = 3;

/**
 * Hero stat trio (T-026): reuses the Home namespace's existing bilingual
 * statProvincesLabel/statCountriesLabel/statGameModesLabel copy (already correct in both
 * messages/tr.json and messages/en.json, same pattern as the V1 homepage's stat strip) so EN
 * renders real English numbers instead of showing nothing.
 *
 * Streamed independently of the rest of the page (T-037): the hero's `<h1>`/lede render
 * immediately from `V2HomePage`'s own translations, and this piece waits on the two resilient
 * map-summary fetches behind its own `Suspense` boundary.
 */
async function HeroStats({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const [provinces, countries] = await Promise.all([
    getMapSummaryResilient(),
    getCountryMapSummaryResilient(),
  ]);
  const totalProvinces = provinces.length;
  const totalCountries = countries.length;
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground font-medium flex-wrap">
      <span>
        <strong className="font-heading text-foreground">{totalProvinces}</strong>{" "}
        {t("statProvincesLabel", { count: totalProvinces })}
      </span>
      <span aria-hidden="true" className="text-border">
        &bull;
      </span>
      <span>
        <strong className="font-heading text-foreground">{totalCountries}</strong>{" "}
        {t("statCountriesLabel", { count: totalCountries })}
      </span>
      <span aria-hidden="true" className="text-border">
        &bull;
      </span>
      <span>
        <strong className="font-heading text-foreground">{V2_GAME_MODE_COUNT}</strong>{" "}
        {t("statGameModesLabel", { count: V2_GAME_MODE_COUNT })}
      </span>
    </div>
  );
}

/**
 * Section 1's Türkiye-card data line: "N il · 7 coğrafi bölge · nüfus …". Reads the resilient
 * provinces fetch and derives the national population from it (`null`, nothing printed, on a
 * partial fetch — see `lib/geo/national-population.ts`).
 */
async function ProvinceCountLine() {
  const provinces = await getMapSummaryResilient();
  const totalProvinces = provinces.length;
  // The sum of the 81 provinces' TÜİK figures; `null` (nothing printed) on a partial fetch.
  const population = nationalPopulation(provinces);
  return (
    <>
      {totalProvinces} il · 7 coğrafi bölge
      {population !== null &&
        ` · nüfus ${tr(population.total / 1_000_000, 1)} milyon (TÜİK ${population.year})`}
    </>
  );
}

/**
 * Section 1's Dünya-card data line: "N ülke · M kıta". Only `totalCountries` reads a fetch;
 * `totalContinents` is synchronous (`getAllContinents().length`) and is passed in from the
 * default export rather than re-derived here.
 */
async function CountryCountLine({ totalContinents }: { totalContinents: number }) {
  const countries = await getCountryMapSummaryResilient();
  const totalCountries = countries.length;
  return (
    <>
      {totalCountries} ülke · {totalContinents} kıta
    </>
  );
}

/** Section 4's body: the "Denizlerde Bugün" basin cards, the model vintage line and the marine
 *  safety notice — or the "not yet published" fallback alert. Reads the marine points/overview
 *  fetches; the heading row and the "Tüm Denizler" link stay in the default export. */
async function MarineToday({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const format = await getFormatter();
  const [marinePoints, marineOverview] = await Promise.all([
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
  ]);
  const marine = buildMarineHomeSummary(marineOverview, locale);
  const scope = marineScope(marinePoints);
  const showMarineValues = marineSummaryShowsValues(marine);

  return showMarineValues ? (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {marine.basins.map((basin) => {
          const tempDigits = basin.seaSurfaceTemperature
            ? MARINE_VALUE_FRACTION_DIGITS[basin.seaSurfaceTemperature.unit]
            : 1;
          const waveDigits = basin.waveHeight
            ? MARINE_VALUE_FRACTION_DIGITS[basin.waveHeight.unit]
            : 1;

          return (
            <Card
              key={basin.basin}
              className="hover:border-accent/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="info" size="sm" dot>
                    {basin.label}
                  </Badge>
                  <Waves className="size-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {basin.seaSurfaceTemperature && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border">
                    <span className="text-xs text-muted-foreground">Su Sıcaklığı</span>
                    <span className="font-heading font-bold text-base text-primary">
                      {format.number(basin.seaSurfaceTemperature.median, {
                        minimumFractionDigits: tempDigits,
                        maximumFractionDigits: tempDigits,
                      })}{" "}
                      °C
                    </span>
                  </div>
                )}

                {basin.waveHeight ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border">
                    <span className="text-xs text-muted-foreground">Dalga Yüksekliği</span>
                    <span className="font-heading font-bold text-base text-foreground">
                      {format.number(basin.waveHeight.median, {
                        minimumFractionDigits: waveDigits,
                        maximumFractionDigits: waveDigits,
                      })}{" "}
                      m
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-dashed border-border text-muted-foreground text-xs">
                    <span>Dalga Yüksekliği</span>
                    <span className="italic">Veri yok</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-0 text-[11px] text-muted-foreground justify-between border-t border-border/50 bg-muted/10">
                <span>{basin.seaSurfaceTemperature?.pointCount || 0} noktanın ortancası</span>
                <Link
                  href="/deniz"
                  className="text-accent hover:underline font-medium inline-flex items-center gap-0.5"
                >
                  Ayrıntılar <ArrowRight className="size-3" />
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Model Zaman Bilgisi */}
      <div className="p-3.5 rounded-2xl border border-border/80 bg-card/60 text-xs text-muted-foreground flex items-center gap-2.5 shadow-2xs">
        <Clock className="size-4 text-muted-foreground/80 shrink-0" />
        <VintageLine values={marine.values} />
      </div>

      {/* The marine safety disclaimer and the link to the licence text — the SAME
            component `/deniz`, the four basin pages and the 27 coastal province pages
            render.

            The four cards above publish each basin's median sea-surface temperature and
            wave height, which are CMEMS/ECMWF-derived values. ECMWF's and Copernicus
            Marine's required wording is published once, on `/hakkimizda`, reached from
            the link in this block (CC BY 4.0 §3(a)(2)); the sentence that must be beside
            the numbers rather than a click away — "eğitim amaçlıdır… can güvenliği
            kararlarında kullanılamaz" — is the body of the block itself.

            GATED on `showMarineValues`, the same expression the cards themselves are
            gated on — so the notice can neither go missing where a value appears nor
            appear where none does. The `else` branch below renders an "on its way"
            alert and no derived value, and owes nothing. */}
      <MarineDataNotice />
    </div>
  ) : (
    <Alert variant="info">
      <AlertTitle>Deniz değerleri henüz yayında değil</AlertTitle>
      <AlertDescription>
        {scope.pointCount > 0
          ? t("seaScope", {
              basins: scope.basinCount,
              points: scope.pointCount,
              provinces: scope.provinceCount,
            })
          : t("seaScopeFallback")}
      </AlertDescription>
    </Alert>
  );
}

/** Section 5's body: the "Bugün keşfet" featured province and country cards. Reads both
 *  resilient map-summary fetches and day-seeds the draw from them (`lib/home/featured.ts`); the
 *  `<section>` wrapper stays in the default export. */
async function FeaturedPlaces({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const tRegions = await getTranslations({ locale, namespace: "Regions" });
  const tContinents = await getTranslations({ locale, namespace: "Continents" });
  const tDetail = await getTranslations({ locale, namespace: "ProvinceDetail" });
  const format = await getFormatter();
  const [provinces, countries] = await Promise.all([
    getMapSummaryResilient(),
    getCountryMapSummaryResilient(),
  ]);
  const totalProvinces = provinces.length;
  const totalCountries = countries.length;

  const populationFact = (population: number | null, year: number | null) => {
    const fact = featuredPopulationFact(population, year);
    if (fact === null) return undefined;
    return {
      label:
        fact.labelKey === "populationWithYear"
          ? tDetail("populationWithYear", { year: fact.year })
          : tDetail("population"),
      value: format.number(fact.population),
    };
  };

  const now = new Date();

  const provinceCards: FeaturedCardItem[] = pickDailyProvinces(provinces, locale, now).map(
    (province) => ({
      id: province.plateCode,
      href: `/turkiye/${province.slug}`,
      name: province.name,
      meta: tRegions(province.region),
      fact: populationFact(province.population, province.populationYear),
    }),
  );

  const countryCards: FeaturedCardItem[] = pickDailyCountries(countries, locale, now).map(
    (country) => ({
      id: country.isoCode,
      href: `/dunya/${country.slug}`,
      name: country.name,
      meta: tContinents(country.continent),
      fact: populationFact(country.population, country.populationYear),
    }),
  );

  return (
    <>
      {/* Featured Provinces */}
      {provinceCards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                {t("discoverProvinces")}
              </h3>
            </div>
            <Link href="/turkiye">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
                Tüm İller ({totalProvinces})
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {provinceCards.map((card) => (
              <a
                key={card.id}
                href={card.href}
                className="group block p-6 rounded-2xl border border-border bg-card hover:border-primary/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" size="sm" className="font-medium">
                    {card.meta}
                  </Badge>
                  <span className="size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors">
                    <ArrowRight className="size-4" />
                  </span>
                </div>
                <h4 className="font-heading text-2xl font-bold text-foreground group-hover:text-primary transition-colors mt-2">
                  {card.name}
                </h4>
                {card.fact && (
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{card.fact.label}</span>
                    <span className="font-bold text-foreground font-mono">{card.fact.value}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Featured Countries */}
      {countryCards.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                {t("discoverCountries")}
              </h3>
            </div>
            <Link href="/dunya">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
                Tüm Ülkeler ({totalCountries})
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {countryCards.map((card) => (
              <a
                key={card.id}
                href={card.href}
                className="group block p-6 rounded-2xl border border-border bg-card hover:border-secondary/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" size="sm">
                    {card.meta}
                  </Badge>
                  <span className="size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-secondary group-hover:text-white transition-colors">
                    <ArrowRight className="size-4" />
                  </span>
                </div>
                <h4 className="font-heading text-2xl font-bold text-foreground group-hover:text-secondary transition-colors mt-2">
                  {card.name}
                </h4>
                {card.fact && (
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{card.fact.label}</span>
                    <span className="font-bold text-foreground font-mono">{card.fact.value}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default async function V2HomePage({ params }: V2PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");

  // Derived, not typed: the card said "6 Kıta" while `/dunya` — the page this card links to —
  // said "7 Kıta", and the registry has seven (Antarktika included). A hardcoded count drifts
  // from the page it advertises; this one had. Synchronous (`getAllContinents()` reads a local
  // registry, not the api), so it needs no `Suspense` boundary of its own.
  const totalContinents = getAllContinents().length;

  return (
    <>
      <JsonLd schema={[websiteJsonLd(locale), organizationJsonLd()]} />

      <V2LiveTicker />

      <PageContainer space="loose">
        {/* HERO SECTION */}
        <V2Hero
          title={t("heading")}
          lede={t("lede")}
          stats={
            <Suspense fallback={<InlineSkeleton width="lg" />}>
              <HeroStats locale={locale} />
            </Suspense>
          }
        />

        {/* SECTION 1: ATLAS SPOTLIGHT & COĞRAFİ MERKEZLER */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
                Türkiye ve Dünya Haritası
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Türkiye Hub Card */}
            <Card className="overflow-hidden hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
              <CardHeader className="space-y-2">
                <span className="text-xs font-mono text-muted-foreground">
                  <Suspense fallback={<InlineSkeleton width="md" />}>
                    <ProvinceCountLine />
                  </Suspense>
                </span>
                <CardTitle className="text-2xl">{t("mapHeading")}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {t("mapBody")}
                </CardDescription>
              </CardHeader>
              <CardFooter className="border-t border-border bg-muted/20">
                <Link href="/turkiye" className="w-full">
                  <Button
                    variant="primary"
                    className="w-full group-hover:scale-[1.01] transition-transform"
                    rightIcon={<ArrowRight className="size-4" />}
                  >
                    {t("mapLinkLabel")}
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Dünya Hub Card */}
            <Card className="overflow-hidden hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
              <CardHeader className="space-y-2">
                <span className="text-xs font-mono text-muted-foreground">
                  <Suspense fallback={<InlineSkeleton width="md" />}>
                    <CountryCountLine totalContinents={totalContinents} />
                  </Suspense>
                </span>
                <CardTitle className="text-2xl">{t("worldHeading")}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {t("worldBody")}
                </CardDescription>
              </CardHeader>
              <CardFooter className="border-t border-border bg-muted/20">
                <Link href="/dunya" className="w-full">
                  <Button
                    variant="secondary"
                    className="w-full group-hover:scale-[1.01] transition-transform"
                    rightIcon={<ArrowRight className="size-4" />}
                  >
                    {t("worldLinkLabel")}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* SECTION 2: COĞRAFYA YAYINLARI & DİJİTAL MODÜLLER */}
        <V2LearningPaths />

        {/* SECTION 3: CBS & JEODEZİK MESAFE LABORATUVARI */}
        <V2InteractiveTools />

        {/* SECTION 4: LIVE MARINE & COASTAL TELEMETRY */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-muted-foreground">
                Copernicus Marine Service ve ECMWF
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-primary mt-1">
                Denizlerde Bugün Su Sıcaklığı ve Dalga
              </h2>
            </div>
            <Link href="/deniz">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
                Tüm Denizler
              </Button>
            </Link>
          </div>

          <Suspense fallback={<CardGridSkeleton columns="2-4" count={4} />}>
            <MarineToday locale={locale} />
          </Suspense>
        </section>

        {/* SECTION 5: FEATURED PROVINCES & COUNTRIES VITRINI */}
        <section className="space-y-8">
          <Suspense fallback={<CardGridSkeleton columns="3" count={6} />}>
            <FeaturedPlaces locale={locale} />
          </Suspense>
        </section>

        {/* SECTION 6: GAMIFICATION CHALLENGE BANNER */}
        <section className="rounded-3xl border border-secondary/40 bg-gradient-to-r from-muted via-card to-muted p-6 sm:p-10 lg:p-12 shadow-md flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-primary leading-tight">
              {t("gameHeading")}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {t("gameBody")}
            </p>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <Link href="/oyun">
              <Button
                variant="primary"
                size="lg"
                className="w-full md:w-auto shadow-lg text-base h-12 px-6"
                rightIcon={<ArrowRight className="size-4" />}
              >
                {t("gameCta")}
              </Button>
            </Link>
          </div>
        </section>
      </PageContainer>
    </>
  );
}
