import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AirPollutionSection } from "@/components/air/air-pollution-section";
import { ClimateSection } from "@/components/climate/climate-section";
import { ProvinceEarthquakeSection } from "@/components/earthquake/province-earthquake-section";
import { V2FavoriteButton } from "@/components/v2/v2-favorite-button";
import { ProvinceMarineSection } from "@/components/marine/province-marine-section";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ProvinceLocatorMap } from "@/components/v2/v2-province-locator-map";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEarthquakeMetaSafe, getProvinceEarthquakesSafe } from "@/lib/api/earthquakes";
import {
  getMarineLayersSafe,
  getMarinePointsSafe,
  getMarineProvinceConditionsSafe,
} from "@/lib/api/marine";
import {
  byPlateCode,
  getProvinceBySlug,
  getProvinces,
  getProvincesResilient,
} from "@/lib/api/provinces";
import type { ProvinceDetail, ProvinceListItem } from "@/lib/api/types";
import { isCoastalPlate, provinceMarineBlocks, provinceShowsMarine } from "@/lib/marine/coastal";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { selectSimilarClimateProvinces } from "@/lib/climate/similar-climate";
import { administrativeAreaJsonLd, type GeoPropertyValue, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  selectProvinceMetaDescription,
  selectProvinceMetaTitle,
} from "@/lib/seo/province-description";
import { headingName, PROVINCE_HEADING_CASE } from "@/lib/text/heading-name";
import {
  MapPin,
  Compass,
  Users,
  Maximize2,
  Mountain,
  Waves,
  CloudSun,
  Home,
  ChevronRight,
  Droplets,
  ArrowUpRight,
  Activity,
  Info,
} from "lucide-react";

export const revalidate = 120;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

const REGION_THEMES: Record<
  string,
  { nameTr: string; badgeClass: string; gradient: string; accentColor: string }
> = {
  MARMARA: {
    nameTr: "Marmara Bölgesi",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    gradient: "from-amber-500/10 via-background to-background",
    accentColor: "text-amber-600",
  },
  EGE: {
    nameTr: "Ege Bölgesi",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    gradient: "from-teal-500/10 via-background to-background",
    accentColor: "text-teal-600",
  },
  AKDENIZ: {
    nameTr: "Akdeniz Bölgesi",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    gradient: "from-emerald-500/10 via-background to-background",
    accentColor: "text-emerald-600",
  },
  IC_ANADOLU: {
    nameTr: "İç Anadolu Bölgesi",
    badgeClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    gradient: "from-yellow-500/10 via-background to-background",
    accentColor: "text-yellow-600",
  },
  KARADENIZ: {
    nameTr: "Karadeniz Bölgesi",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    gradient: "from-cyan-500/10 via-background to-background",
    accentColor: "text-cyan-600",
  },
  DOGU_ANADOLU: {
    nameTr: "Doğu Anadolu Bölgesi",
    badgeClass: "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30",
    gradient: "from-stone-500/10 via-background to-background",
    accentColor: "text-stone-600",
  },
  GUNEYDOGU_ANADOLU: {
    nameTr: "Güneydoğu Anadolu Bölgesi",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    gradient: "from-orange-500/10 via-background to-background",
    accentColor: "text-orange-600",
  },
};

function slugForLocale(province: ProvinceDetail | ProvinceListItem, locale: Locale): string {
  return locale === "en" ? province.slugEn : province.slugTr;
}

export async function generateStaticParams() {
  const provinces = await getProvincesResilient();
  return routing.locales.flatMap((locale) =>
    provinces.map((province) => ({ locale, slug: slugForLocale(province, locale) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const province = await getProvinceBySlug(slug);
  if (!province) return {};

  const t = await getTranslations({ locale, namespace: "ProvinceDetail" });
  const tRegions = await getTranslations({ locale, namespace: "Regions" });
  const name = province.nameTr;
  const region = tRegions(province.region);

  const { key: descriptionKey, params: descriptionParams } = selectProvinceMetaDescription({
    locale,
    plateCode: province.plateCode,
    climate: province.climate,
    population: province.population,
    areaKm2: province.areaKm2,
    name,
    region,
  });
  const description = t(descriptionKey, descriptionParams);

  const { key: titleKey, params: titleParams } = selectProvinceMetaTitle({
    locale,
    name,
    climate: province.climate,
  });
  const title = t(titleKey, titleParams);

  return buildMetadata({
    locale,
    title: `${title} | V2 Atlas`,
    description,
    surface: "noindex",
    hrefForLocale: (l) => ({
      pathname: "/turkiye/[slug]",
      params: { slug: slugForLocale(province, l) },
    }),
  });
}

export default async function V2ProvinceDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const province = await getProvinceBySlug(slug);
  if (!province) {
    notFound();
  }

  const marinePointsPromise = getMarinePointsSafe();
  const provinceEarthquakesPromise = getProvinceEarthquakesSafe(province.plateCode);
  const earthquakeMetaPromise = getEarthquakeMetaSafe();

  const t = await getTranslations("ProvinceDetail");
  const tRegions = await getTranslations("Regions");
  const format = await getFormatter();

  const name = province.nameTr;
  const region = tRegions(province.region);
  const isTr = locale === "tr";
  const regionTheme = REGION_THEMES[province.region] ?? REGION_THEMES.MARMARA!;

  const introText =
    isTr && province.introTr !== null
      ? province.introTr
      : province.population !== null
        ? t("introFallbackPopulation", { name, region, population: province.population })
        : province.areaKm2 !== null
          ? t("introFallbackArea", { name, region, area: province.areaKm2 })
          : t("introFallback", { name });

  const path = `/v2/turkiye/${slugForLocale(province, locale)}`;

  let neighbors: ProvinceListItem[] = [];
  let similarClimate: ProvinceListItem[] = [];
  try {
    const all = await getProvinces();
    const byCode = byPlateCode(all);
    neighbors = province.neighborPlateCodes
      .map((code) => byCode.get(code))
      .filter((p): p is ProvinceListItem => p !== undefined);
    const ownAnnualMeanTempC = province.climate?.derived.annualMeanTempC ?? null;
    similarClimate = selectSimilarClimateProvinces(all, province, ownAnnualMeanTempC);
  } catch (error) {
    console.warn(`[province:${slug}] cross-links skipped: ${String(error)}`);
  }

  const marinePoints = await marinePointsPromise;
  const isCoastal = isCoastalPlate(marinePoints, province.plateCode);
  const [marineLayers, marineConditions] = isCoastal
    ? await Promise.all([
        getMarineLayersSafe(),
        getMarineProvinceConditionsSafe(province.plateCode),
      ])
    : [[], null];

  const marineBlocks = provinceMarineBlocks(marineConditions);
  const showMarine = provinceShowsMarine(marineConditions);

  const provinceEarthquakes = await provinceEarthquakesPromise;
  const earthquakeMeta = await earthquakeMetaPromise;

  const additionalProperty: GeoPropertyValue[] = [];
  additionalProperty.push({ name: t("plateCode"), value: province.plateCode });
  if (province.population !== null) {
    additionalProperty.push({
      name: t("population"),
      value: province.population,
      ...(province.populationYear !== null ? { description: String(province.populationYear) } : {}),
    });
  }
  if (province.areaKm2 !== null) {
    additionalProperty.push({
      name: t("area"),
      value: province.areaKm2,
      unitText: t("areaUnit"),
      unitCode: "KMQ",
    });
  }
  if (province.districtCount !== null) {
    additionalProperty.push({ name: t("districtCount"), value: province.districtCount });
  }
  if (province.populationDensity !== null) {
    additionalProperty.push({
      name: t("populationDensity"),
      value: province.populationDensity,
      unitText: t("populationDensityUnit"),
    });
  }
  if (province.elevationM !== null) {
    additionalProperty.push({
      name: t("elevation"),
      value: province.elevationM,
      unitText: t("elevationUnit"),
      unitCode: "MTR",
    });
  }

  const geo =
    province.latitude !== null && province.longitude !== null
      ? { latitude: province.latitude, longitude: province.longitude }
      : null;

  const landformNote = isTr ? province.landformNoteTr : null;
  const hydrographyFeatures = province.hydrographyFeatures;
  const showHydrography =
    isTr &&
    (province.hydrographyNoteTr !== null ||
      (hydrographyFeatures !== null && hydrographyFeatures.length > 0));
  const showLandform = isTr && (landformNote !== null || showHydrography);
  const showSettlement =
    isTr &&
    (province.settlementNoteTr !== null ||
      province.urbanizationRate !== null ||
      province.netMigrationRate !== null);
  const showEconomy = isTr && province.economyIndicator !== null;
  const economyIndicator = province.economyIndicator;
  const climateSeries = isTr ? province.climate : null;
  const pm25Annual = province.pm25Annual;

  const sectionHeading = (slot: keyof typeof PROVINCE_HEADING_CASE): string =>
    headingName(locale, name, PROVINCE_HEADING_CASE[slot]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <JsonLd
        schema={administrativeAreaJsonLd({
          name,
          path,
          locale,
          geo,
          additionalProperty,
          containedInPlace: { name: "Türkiye" },
          dateModified: province.updatedAt,
        })}
      />
      <V2Header />
      <V2LiveTicker />

      {/* HERO BANNER SECTION */}
      <section
        className={`relative border-b border-border bg-gradient-to-b ${regionTheme.gradient} pt-8 pb-12 overflow-hidden`}
      >
        {/* Glow backdrop */}
        <div className="absolute top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 max-w-7xl relative z-10 space-y-6">
          {/* Breadcrumb Bar */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap"
          >
            <Link
              href="/v2"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <Link href="/v2/turkiye" className="hover:text-foreground transition-colors">
              Türkiye Atlası
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold flex items-center gap-1">
              <span>{name}</span>
              <span className="font-mono text-[11px] opacity-75">({province.plateCode})</span>
            </span>
          </nav>

          {/* Main Title & Action Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={regionTheme.badgeClass}>
                  {region}
                </Badge>
                <Badge variant="primary" className="font-mono font-bold tracking-wider">
                  TR-{province.plateCode}
                </Badge>
                {isCoastal ? (
                  <Badge
                    variant="outline"
                    className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 flex items-center gap-1"
                  >
                    <Waves className="size-3" /> Kıyı İli
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    🌾 İç Kara
                  </Badge>
                )}
                {province.climateClassTr && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <CloudSun className="size-3 mr-1" />{" "}
                    {province.climateCurriculumNameTr || province.climateClassTr}
                  </Badge>
                )}
              </div>

              <h1 className="font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
                {name}
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
                {introText}
              </p>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <V2FavoriteButton target={{ kind: "province", plateCode: province.plateCode }} />
              <Link href={`/v2/turkiye`}>
                <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
                  Tüm İller
                </Button>
              </Link>
            </div>
          </div>

          {/* 4 BIG KEY STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {/* 1. Nüfus */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Toplam Nüfus</span>
                <Users className="size-4 text-primary" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {province.population ? `${format.number(province.population)}` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Yoğunluk:</span>
                <span className="font-mono font-semibold text-foreground">
                  {province.populationDensity ? `${province.populationDensity} kişi/km²` : "—"}
                </span>
              </div>
            </div>

            {/* 2. Yüzölçümü */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Yüzölçümü</span>
                <Maximize2 className="size-4 text-teal-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {province.areaKm2 ? `${format.number(province.areaKm2)} km²` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>İlçe Sayısı:</span>
                <span className="font-mono font-semibold text-foreground">
                  {province.districtCount ? `${province.districtCount} İlçe` : "—"}
                </span>
              </div>
            </div>

            {/* 3. Rakım & Fiziki */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Ortalama Rakım</span>
                <Mountain className="size-4 text-amber-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {province.elevationM !== null ? `${province.elevationM} m` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Köppen:</span>
                <span className="font-mono font-semibold text-primary">
                  {province.climateKoppen || "—"}
                </span>
              </div>
            </div>

            {/* 4. Koordinatlar */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Coğrafi Konum</span>
                <MapPin className="size-4 text-rose-600" />
              </div>
              <div className="font-mono font-bold text-sm sm:text-base text-foreground pt-1">
                {province.latitude ? `${province.latitude.toFixed(2)}°K` : "—"},{" "}
                {province.longitude ? `${province.longitude.toFixed(2)}°D` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Plaka Kodu:</span>
                <span className="font-mono font-bold text-foreground">TR-{province.plateCode}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BODY CONTENT CONTAINER */}
      <main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">
        {/* GEOGRAPHY & LOCATOR SPLIT ROW */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Prose & Physical Highlights */}
          <div className="lg:col-span-7 space-y-6">
            {/* Overview Card */}
            {showLandform && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    Coğrafi Konum &amp; Yapı
                  </Badge>
                </div>
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  {sectionHeading("landform")} Fiziki Coğrafyası ve Arazi Özellikleri
                </h2>
                {landformNote && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{landformNote}</p>
                )}

                {/* Hydrography & Water Bodies */}
                {showHydrography && (
                  <div className="pt-4 border-t border-border space-y-3">
                    {province.hydrographyNoteTr && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Droplets className="size-3.5 text-cyan-600" />
                          <span>{sectionHeading("hydrography")} Su Kaynakları ve Havzaları</span>
                        </span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {province.hydrographyNoteTr}
                        </p>
                      </div>
                    )}

                    {hydrographyFeatures && hydrographyFeatures.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-semibold text-muted-foreground block">
                          Önemli Su Kaynakları:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {hydrographyFeatures.map((feat, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20 text-xs py-1"
                            >
                              <Droplets className="size-3 mr-1" />
                              <span>{feat.name}</span>
                              <span className="opacity-70 text-[10px] ml-1">({feat.type})</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Demographics & Socio-Economic Indicators Card */}
            {(showSettlement || showEconomy) && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    size="sm"
                    className="bg-primary/10 text-primary border-primary/30"
                  >
                    Sosyo-Ekonomik Göstergeler
                  </Badge>
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {sectionHeading("settlement")} Nüfus, Yerleşme ve Ekonomik Yapı
                </h3>

                {/* Settlement Prose Note */}
                {province.settlementNoteTr && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {province.settlementNoteTr}
                  </p>
                )}

                {/* Demographics Metrics */}
                {(province.urbanizationRate !== null || province.netMigrationRate !== null) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {province.urbanizationRate !== null && (
                      <div className="p-3.5 rounded-2xl bg-muted/50 space-y-1">
                        <span className="text-muted-foreground block">Şehirleşme Oranı</span>
                        <span className="font-heading font-bold text-lg text-foreground">
                          %{province.urbanizationRate.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {province.netMigrationRate !== null && (
                      <div className="p-3.5 rounded-2xl bg-muted/50 space-y-1">
                        <span className="text-muted-foreground block">Net Göç Hızı</span>
                        <span className="font-heading font-bold text-lg text-primary">
                          ‰{province.netMigrationRate.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Economic Geography Indicator (TÜİK GSYH Payı) */}
                {showEconomy && economyIndicator && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Activity className="size-3.5" /> {economyIndicator.label}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {economyIndicator.year}
                      </span>
                    </div>
                    <div className="font-heading font-extrabold text-2xl text-amber-900 dark:text-amber-200">
                      {economyIndicator.value}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Kaynak: {economyIndicator.source}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 5 Columns: Clean Mini Locator & Neighbor Provinces */}
          <div className="lg:col-span-5 space-y-6">
            {/* Locator Mini Map Container (Edge-to-Edge, Zero Margin Padding) */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="size-4 text-primary" />
                  <h3 className="font-heading font-bold text-base text-foreground">
                    Türkiye Haritasındaki Konumu
                  </h3>
                </div>
                <Badge variant="outline" size="sm" className="font-mono text-[11px]">
                  TR-{province.plateCode}
                </Badge>
              </div>

              {/* Ultra-crisp Clean V2 Province Locator Map */}
              <V2ProvinceLocatorMap plateCode={province.plateCode} provinceName={name} />

              {/* Neighboring Provinces Chips */}
              {neighbors.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2.5">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Komşu İller ({neighbors.length} İl):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {neighbors.map((nb) => (
                      <Link
                        key={nb.plateCode}
                        href={{
                          pathname: "/v2/turkiye/[slug]",
                          params: { slug: slugForLocale(nb, locale) },
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted hover:bg-primary/15 hover:text-primary border border-border transition-colors group cursor-pointer"
                      >
                        <span className="font-mono text-[10px] opacity-70">#{nb.plateCode}</span>
                        <span>{nb.nameTr}</span>
                        <ArrowUpRight className="size-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Climate Provinces Chips */}
              {similarClimate.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Benzer İklimli İller ({province.climateKoppen || "Köppen"}):
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-primary/10 text-primary border-primary/20"
                    >
                      {province.climateKoppen}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {similarClimate.map((sc) => (
                      <Link
                        key={sc.plateCode}
                        href={{
                          pathname: "/v2/turkiye/[slug]",
                          params: { slug: slugForLocale(sc, locale) },
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted hover:bg-teal-500/15 hover:text-teal-700 dark:hover:text-teal-300 border border-border transition-colors group cursor-pointer"
                      >
                        <span className="font-mono text-[10px] opacity-70">#{sc.plateCode}</span>
                        <span>{sc.nameTr}</span>
                        {sc.climateAnnualMeanTempC !== null && (
                          <span className="font-mono text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                            ·{" "}
                            {format.number(sc.climateAnnualMeanTempC, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{" "}
                            °C
                          </span>
                        )}
                        <ArrowUpRight className="size-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CLIMATE SECTION */}
        {climateSeries && (
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">
                {`${sectionHeading("climate")} İklim Özellikleri & Yağış Grafiği`}
              </h2>
            </div>

            {/* MEB Müfredat ve MGM Köppen Açıklama Rehberi */}
            <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    {province.climateCurriculumNameTr || province.climateClassTr}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-foreground">
                    Köppen: {province.climateKoppen}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground italic">
                  Ders kitabı adı ile Köppen kodu illerin çoğunda örtüşmez.
                </span>
              </div>

              {province.climateCurriculumNoteTr && (
                <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                  {province.climateCurriculumNoteTr}
                </p>
              )}

              {province.climateNoteTr && (
                <details className="text-xs text-muted-foreground group" open>
                  <summary className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors select-none py-1">
                    ▼ MGM Sınıflandırma ve Metodoloji Notu
                  </summary>
                  <p className="mt-2 pl-3 border-l-2 border-primary/40 text-muted-foreground leading-relaxed">
                    {province.climateNoteTr}
                  </p>
                </details>
              )}
            </div>

            <ClimateSection
              locale={locale}
              provinceName={name}
              plateCode={province.plateCode}
              climate={climateSeries}
            />
          </section>
        )}

        {/* AIR QUALITY & MARINE ENVIRONMENT ROW */}
        {pm25Annual && showMarine ? (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <AirPollutionSection
                locale={locale}
                provinceName={name}
                headingName={sectionHeading("airPollution")}
                plateCode={province.plateCode}
                pm25={pm25Annual}
              />
            </div>
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <ProvinceMarineSection
                locale={locale}
                provinceName={name}
                blocks={marineBlocks}
                layers={marineLayers}
                headingId="province-marine"
              />
            </div>
          </section>
        ) : pm25Annual ? (
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
            <AirPollutionSection
              locale={locale}
              provinceName={name}
              headingName={sectionHeading("airPollution")}
              plateCode={province.plateCode}
              pm25={pm25Annual}
            />
          </section>
        ) : showMarine ? (
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
            <ProvinceMarineSection
              locale={locale}
              provinceName={name}
              blocks={marineBlocks}
              layers={marineLayers}
              headingId="province-marine"
            />
          </section>
        ) : null}

        {/* EARTHQUAKE MONITORING SECTION */}
        {provinceEarthquakes !== null && earthquakeMeta !== null && (
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <ProvinceEarthquakeSection
              locale={locale}
              provinceName={name}
              plateCode={province.plateCode}
              list={provinceEarthquakes}
              headingId="province-earthquake"
            />
            {earthquakeMeta.disclaimerTr && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
                <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{earthquakeMeta.disclaimerTr}</span>
              </div>
            )}
          </section>
        )}

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/v2/turkiye">
            <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
              ← Türkiye Atlası&apos;na Dön (Tüm İller)
            </Button>
          </Link>
          <Link href="/v2">
            <Button variant="ghost" size="sm" leftIcon={<Home className="size-4" />}>
              Ana Sayfa
            </Button>
          </Link>
        </div>

        {/* UNIFIED COMPREHENSIVE DATA SOURCES (KAYNAKÇA) */}
        <V2SourcesSection scope="turkiye" />
      </main>
    </div>
  );
}
