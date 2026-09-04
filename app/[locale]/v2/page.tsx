import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getCountryMapSummaryResilient } from "@/lib/api/countries";
import {
  getMarineOverviewSafe,
  getMarinePointsSafe,
  MARINE_VALUES_REVALIDATE_SECONDS,
} from "@/lib/api/marine";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  featuredPopulationFact,
  pickDailyCountries,
  pickDailyProvinces,
} from "@/lib/home/featured";
import type { FeaturedCardItem } from "@/components/home/featured-cards";
import {
  buildMarineHomeSummary,
  marineScope,
  marineSummaryShowsValues,
} from "@/lib/home/marine-summary";
import { MARINE_VALUE_FRACTION_DIGITS } from "@/lib/marine/units";
import { VintageLine } from "@/components/marine/vintage-line";
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
import { Waves, Gamepad2, ArrowRight, Clock } from "lucide-react";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2Hero } from "@/components/v2/v2-hero";
import { V2LearningPaths } from "@/components/v2/v2-learning-paths";
import { V2InteractiveTools } from "@/components/v2/v2-interactive-tools";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";

interface V2PageProps {
  params: Promise<{ locale: Locale }>;
}

export const revalidate: typeof MARINE_VALUES_REVALIDATE_SECONDS = 900;

export async function generateMetadata({ params }: V2PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return buildMetadata({
    locale,
    surface: "noindex",
    hrefForLocale: () => "/v2",
    title: `${t("metaTitle")}`,
    description: t("metaDescription"),
  });
}

export default async function V2HomePage({ params }: V2PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const tRegions = await getTranslations("Regions");
  const tContinents = await getTranslations("Continents");
  const tDetail = await getTranslations("ProvinceDetail");
  const format = await getFormatter();

  // Four parallel reads matching resilient architecture
  const [provinces, countries, marinePoints, marineOverview] = await Promise.all([
    getMapSummaryResilient(),
    getCountryMapSummaryResilient(),
    getMarinePointsSafe(),
    getMarineOverviewSafe(),
  ]);

  const totalProvinces = provinces.length || 81;
  const totalCountries = countries.length || 199;

  const marine = buildMarineHomeSummary(marineOverview, locale);
  const scope = marineScope(marinePoints);
  const showMarineValues = marineSummaryShowsValues(marine);

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
      href: `/v2/turkiye/${province.slug}`,
      name: province.name,
      meta: tRegions(province.region),
      fact: populationFact(province.population, province.populationYear),
    }),
  );

  const countryCards: FeaturedCardItem[] = pickDailyCountries(countries, locale, now).map(
    (country) => ({
      id: country.isoCode,
      href: `/v2/dunya/${country.slug}`,
      name: country.name,
      meta: tContinents(country.continent),
      fact: populationFact(country.population, country.populationYear),
    }),
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <JsonLd schema={[websiteJsonLd(locale), organizationJsonLd()]} />

      <div>
        {/* V2 Header */}
        <V2Header />

        {/* Live Telemetry Ticker Bar */}
        <V2LiveTicker />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-16">
          {/* HERO SECTION */}
          <V2Hero provinceCount={totalProvinces} countryCount={totalCountries} />

          {/* SECTION 1: ATLAS SPOTLIGHT & COĞRAFİ MERKEZLER */}
          <section className="space-y-6">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <Badge variant="outline" size="sm" className="mb-1">
                  Atlas &amp; Harita Merkezleri
                </Badge>
                <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)]">
                  Coğrafi Bölgeler &amp; Harita Keşifleri
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Türkiye Hub Card */}
              <Card className="overflow-hidden hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="primary" size="sm">
                      Türkiye Haritası
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {totalProvinces} İl · 7 Coğrafi Bölge
                    </span>
                  </div>
                  <CardTitle className="text-2xl">{t("mapHeading")}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {t("mapBody")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-muted-foreground block text-[11px]">Bölgeler</span>
                      <span className="font-heading font-bold text-base text-foreground">
                        7 Bölge
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-muted-foreground block text-[11px]">İller</span>
                      <span className="font-heading font-bold text-base text-foreground">
                        {totalProvinces} İl
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-muted-foreground block text-[11px]">Nüfus</span>
                      <span className="font-heading font-bold text-base text-foreground">
                        85+ Milyon
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border bg-muted/20">
                  <Link href="/v2/turkiye" className="w-full">
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
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" size="sm">
                      Dünya Atlası
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {totalCountries} Ülke · 6 Kıta
                    </span>
                  </div>
                  <CardTitle className="text-2xl">{t("worldHeading")}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {t("worldBody")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-muted-foreground block text-[11px]">Kıtalar</span>
                      <span className="font-heading font-bold text-base text-foreground">
                        6 Kıta
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-muted-foreground block text-[11px]">Başkentler</span>
                      <span className="font-heading font-bold text-base text-foreground">
                        190+ Başkent
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-muted-foreground block text-[11px]">Bayraklar</span>
                      <span className="font-heading font-bold text-base text-foreground">
                        SVG Vektör
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border bg-muted/20">
                  <Link href="/v2/dunya" className="w-full">
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm" icon={<Waves className="size-3.5" />}>
                    Canlı Deniz &amp; Kıyı Gözlemi
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Copernicus Marine Service &amp; ECMWF
                  </span>
                </div>
                <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] mt-1">
                  Bugün Denizler ve Canlı Sıcaklık / Dalga Modelleri
                </h2>
              </div>
              <Link href="/v2/deniz">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
                  Tüm Kıyıları İncele
                </Button>
              </Link>
            </div>

            {showMarineValues ? (
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
                              <span className="text-xs text-muted-foreground">
                                Dalga Yüksekliği
                              </span>
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
                              <span>Dalga Alanı</span>
                              <span className="italic">Desteklenmiyor</span>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="pt-0 text-[11px] text-muted-foreground justify-between border-t border-border/50 bg-muted/10">
                          <span>
                            {basin.seaSurfaceTemperature?.pointCount || 0} noktanın ortancası
                          </span>
                          <Link
                            href="/v2/deniz"
                            className="text-accent hover:underline font-medium inline-flex items-center gap-0.5"
                          >
                            Kıyı Detayı <ArrowRight className="size-3" />
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
              </div>
            ) : (
              <Alert variant="info">
                <AlertTitle>Deniz Telemetrisi Hazırlanıyor</AlertTitle>
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
            )}
          </section>

          {/* SECTION 5: FEATURED PROVINCES & COUNTRIES VITRINI */}
          <section className="space-y-8">
            {/* Featured Provinces */}
            {provinceCards.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <Badge variant="primary" size="sm" className="mb-1">
                      {t("eyebrowProvinces")}
                    </Badge>
                    <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                      {t("discoverProvinces")}
                    </h3>
                  </div>
                  <Link href="/v2/turkiye">
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
                          <span className="font-bold text-foreground font-mono">
                            {card.fact.value}
                          </span>
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
                    <Badge variant="outline" size="sm" className="mb-1">
                      {t("eyebrowCountries")}
                    </Badge>
                    <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                      {t("discoverCountries")}
                    </h3>
                  </div>
                  <Link href="/v2/dunya">
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
                          <span className="font-bold text-foreground font-mono">
                            {card.fact.value}
                          </span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* SECTION 6: GAMIFICATION CHALLENGE BANNER */}
          <section className="rounded-3xl border border-[var(--color-secondary,#4f6d30)]/40 bg-gradient-to-r from-[var(--color-surface,#f1e9de)] via-card to-[var(--color-surface,#f1e9de)] p-6 sm:p-10 lg:p-12 shadow-md flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" size="sm" icon={<Gamepad2 className="size-3.5" />}>
                  {t("eyebrowGame")}
                </Badge>
                <span className="text-xs font-semibold text-secondary">3 İnteraktif Oyun Modu</span>
              </div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                {t("gameHeading")}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Dilsiz haritada Türkiye illerini ve dünya ülkelerini tahmin edin, zamana karşı
                yarışın ve harita hafızanızı geliştirin.
              </p>
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <Link href="/v2/oyun">
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

          {/* SECTION 7: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
          <V2SourcesSection scope="home" />
        </div>
      </div>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
