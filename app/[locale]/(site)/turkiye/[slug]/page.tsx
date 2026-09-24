import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AirPollutionSection } from "@/components/air/air-pollution-section";
import { ClimateSection } from "@/components/climate/climate-section";
import { ProvinceEarthquakeSection } from "@/components/earthquake/province-earthquake-section";
import { V2FavoriteButton } from "@/components/v2/v2-favorite-button";
import { ProvinceMarineSection } from "@/components/marine/province-marine-section";
import { MarineDataNotice } from "@/components/marine/marine-data-notice";
import { EarthquakeAttribution } from "@/components/earthquake/earthquake-attribution";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2ProvinceLocatorMap } from "@/components/v2/v2-province-locator-map";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { SOURCE_NOTE } from "@/components/patterns/source-note";

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
import { hasMarinePoint, provinceMarineBlocks, provinceShowsMarine } from "@/lib/marine/coastal";
import { hasSeaCoast } from "@/lib/geo/coastal-provinces";
import { Link } from "@/i18n/navigation";
import { routing, type AppPathname, type Locale } from "@/i18n/routing";
import { selectSimilarClimateProvinces } from "@/lib/climate/similar-climate";
import { climateBlockGates } from "@/lib/climate/climate-block-gates";
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
  Droplets,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";
import { Card } from "@/components/ui/card";
import { tr } from "@/lib/text/format-number";

export const revalidate = 120;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

/**
 * THE SEVEN REGION TREATMENTS, ON THE TOKEN SET THAT ALREADY MEANS "REGION".
 *
 * These were seven raw Tailwind hues (amber, teal, emerald, yellow, cyan, stone, orange) with a
 * hand-written `dark:` half each — 28 of this file's 65 raw palette classes. They are gone, and
 * NOT onto a bridge token: colouring by coğrafi bölge is an unordered CATEGORICAL encoding, and
 * `docs/design.md` rule 1 ("brand chrome never encodes data") forbids spending brand chrome on
 * it. The repo already ships the right set — `--region-*`, the Okabe-Ito qualitative palette,
 * seven members for seven regions, declared in `:root` beside the other data ramps.
 *
 * Reusing it also removes a disagreement rather than adding one: `turkiye/bolge/[slug]` paints
 * each region's map with `--region-*` while telling the reader in a badge of an unrelated hue —
 * Marmara amber beside Marmara blue. The two pages now name the same region the same colour.
 *
 * The hues are frozen light (no `--region-*` has a dark half), so they are used ONLY as a 10-15%
 * tint under `text-foreground`, never as text or as the sole carrier of anything — the badge
 * spells the region's name out. The three alphas are the ones the raw classes carried (`/15` fill,
 * `/30` edge, `/10` gradient), unchanged: a hue at 30% is a hue at 30%, so this is a like-for-like
 * translation and nothing here is retuned by eye. Measured with `lib/theme/contrast.ts`, `text-foreground` on the
 * badge tint over the hero band (region/15 over region/10 over `--background`): light 10.18-13.32,
 * dark 8.66-12.92, worst case İç Anadolu in dark at 8.66:1. T-031c adds `--region-*-tint` and
 * `--region-*-text` members to `app/globals.css`, which this branch may not touch; when they land
 * these eight arbitrary values become those tokens with no other change.
 *
 * `accentColor` is not here because it was DEAD — seven more raw classes with no reader in this
 * file. It went with them rather than being converted.
 */
const REGION_THEMES: Record<
  string,
  {
    nameTr: string;
    slug: string;
    badgeClass: string;
    gradient: string;
  }
> = {
  MARMARA: {
    nameTr: "Marmara Bölgesi",
    slug: "marmara",
    badgeClass: "bg-[var(--region-marmara)]/15 text-foreground border-[var(--region-marmara)]/30",
    gradient: "from-[var(--region-marmara)]/10 via-background to-background",
  },
  EGE: {
    nameTr: "Ege Bölgesi",
    slug: "ege",
    badgeClass: "bg-[var(--region-ege)]/15 text-foreground border-[var(--region-ege)]/30",
    gradient: "from-[var(--region-ege)]/10 via-background to-background",
  },
  AKDENIZ: {
    nameTr: "Akdeniz Bölgesi",
    slug: "akdeniz",
    badgeClass: "bg-[var(--region-akdeniz)]/15 text-foreground border-[var(--region-akdeniz)]/30",
    gradient: "from-[var(--region-akdeniz)]/10 via-background to-background",
  },
  IC_ANADOLU: {
    nameTr: "İç Anadolu Bölgesi",
    slug: "ic-anadolu",
    badgeClass:
      "bg-[var(--region-ic-anadolu)]/15 text-foreground border-[var(--region-ic-anadolu)]/30",
    gradient: "from-[var(--region-ic-anadolu)]/10 via-background to-background",
  },
  KARADENIZ: {
    nameTr: "Karadeniz Bölgesi",
    slug: "karadeniz",
    badgeClass:
      "bg-[var(--region-karadeniz)]/15 text-foreground border-[var(--region-karadeniz)]/30",
    gradient: "from-[var(--region-karadeniz)]/10 via-background to-background",
  },
  DOGU_ANADOLU: {
    nameTr: "Doğu Anadolu Bölgesi",
    slug: "dogu-anadolu",
    badgeClass:
      "bg-[var(--region-dogu-anadolu)]/15 text-foreground border-[var(--region-dogu-anadolu)]/30",
    gradient: "from-[var(--region-dogu-anadolu)]/10 via-background to-background",
  },
  GUNEYDOGU_ANADOLU: {
    nameTr: "Güneydoğu Anadolu Bölgesi",
    slug: "guneydogu-anadolu",
    badgeClass:
      "bg-[var(--region-guneydogu-anadolu)]/15 text-foreground border-[var(--region-guneydogu-anadolu)]/30",
    gradient: "from-[var(--region-guneydogu-anadolu)]/10 via-background to-background",
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
    // No ` | V2 Atlas`. `/v2` was retired in T-032 PR3 but the label outlived the route and kept
    // shipping in `<title>`, OG and Twitter. It was also a second brand suffix: `buildMetadata`
    // leaves the title relative, so the root layout's `%s · Coğrafya Gurmesi` template already
    // appends the brand — this rendered "… | V2 Atlas · Coğrafya Gurmesi".
    title,
    description,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    surface: "trNarrative",
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
          : // `introFallbackRegion`, not `introFallback` — the latter is not a key in either
            // catalogue, and this is the last-resort branch (no intro, no population, no area),
            // so no seeded province reaches it today and the dotted key string never showed up
            // on a page. It also takes `region`, which the missing-key form silently dropped.
            t("introFallbackRegion", { name, region });

  const path = `/turkiye/${slugForLocale(province, locale)}`;

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
  // Marine data is fetched only for provinces with a reference point; the "Kıyı İli" badge
  // reads the fixed coastal list instead, because Edirne has a coast but no point.
  const provinceHasMarinePoint = hasMarinePoint(marinePoints, province.plateCode);
  const isCoastal = hasSeaCoast(province.plateCode);
  const [marineLayers, marineConditions] = provinceHasMarinePoint
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

  /**
   * The climate block's gates, as ONE decision (`lib/climate/climate-block-gates.ts`).
   *
   * The section itself was already gated on `climateSeries`, which is TR-only — but three OTHER
   * places printed the classification outside it: the hero badge, the fact-sheet's "Köppen" row
   * and the similar-climate chips' heading. None was gated on the locale, so an English province
   * page showed a bare Köppen code while the mandatory MGM caveat (`climateNoteTr`, untranslated
   * Turkish) sat inside the section that renders nothing there. `CONVENTIONS.md` §6 forbids
   * exactly that pairing, and this module exists so the four sites cannot disagree about it.
   */
  const climate = climateBlockGates({
    isTr,
    hasClimateClass: province.climateClassTr !== null && province.climateKoppen !== null,
    hasClimateSeries: climateSeries !== null,
    hasSimilarClimate: similarClimate.length > 0,
    hasCurriculumName: province.climateCurriculumNameTr !== null,
    // The defense-in-depth fallback: with no caveat the class line shows neither the curriculum
    // name nor the code, so nothing MEB- or MGM-sourced is on the page (PR #51 review I4).
    hasClimateNote: province.climateNoteTr !== null,
    hasCurriculumNoteText: province.climateCurriculumNoteTr !== null,
  });
  const pm25Annual = province.pm25Annual;

  const sectionHeading = (slot: keyof typeof PROVINCE_HEADING_CASE): string =>
    headingName(locale, name, PROVINCE_HEADING_CASE[slot]);

  return (
    <>
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
      <V2LiveTicker />

      {/* HERO BANNER SECTION */}
      <section
        className={`relative isolate border-b border-border bg-gradient-to-b ${regionTheme.gradient} pt-8 pb-12 overflow-hidden`}
      >
        {/* Glow backdrop */}
        <div className="absolute -z-10 top-0 right-1/4 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <PageContainer space="band">
          {/* Breadcrumb Bar */}
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Türkiye İlleri", href: "/turkiye", path: "/turkiye" },
              {
                label: region,
                // A concrete, already-interpolated path, not the `"/turkiye/bolge/[slug]"`
                // route pattern `AppPathname` itself enumerates — the cast
                // `components/patterns/breadcrumbs.tsx` documents for exactly this shape.
                href: `/turkiye/bolge/${regionTheme.slug}` as AppPathname,
                path: `/turkiye/bolge/${regionTheme.slug}`,
              },
              { label: `${name} (${province.plateCode})`, path },
            ]}
            locale={locale}
            surface="trNarrative"
          />

          {/* Main Title & Action Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <PageHero
              tier="detail"
              heading={name}
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={introText}
              badges={
                <>
                  <Link
                    href={{
                      pathname: "/turkiye/bolge/[slug]",
                      params: { slug: regionTheme.slug },
                    }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Badge variant="outline" className={`${regionTheme.badgeClass} cursor-pointer`}>
                      {region}
                    </Badge>
                  </Link>
                  {isCoastal ? (
                    <Badge variant="info" className="flex items-center gap-1">
                      <Waves className="size-3" /> Kıyı İli
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Kıyısı Yok
                    </Badge>
                  )}
                  {climate.showClass && (
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20"
                    >
                      <CloudSun className="size-3 mr-1" />{" "}
                      {province.climateCurriculumNameTr || province.climateClassTr}
                    </Badge>
                  )}
                </>
              }
            />

            {/* Top Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <V2FavoriteButton target={{ kind: "province", plateCode: province.plateCode }} />
              <Link href={`/turkiye`}>
                <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
                  Tüm İller
                </Button>
              </Link>
            </div>
          </div>

          {/* 4 BIG KEY STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {/* 1. Nüfus */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">
                  {province.populationYear !== null
                    ? `Nüfus (${province.populationYear})`
                    : "Nüfus"}
                </span>
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
            </Card>

            {/* 2. Yüzölçümü */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Yüzölçümü</span>
                <Maximize2 className="size-4 text-accent" />
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
            </Card>

            {/* 3. Rakım & Fiziki */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Rakım (il merkezi)</span>
                <Mountain className="size-4 text-secondary" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {province.elevationM !== null ? `${province.elevationM} m` : "—"}
              </div>
              {/* Dropped, not dashed: an em dash here would still be a classification row on a
                  page that carries no caveat for it. */}
              {climate.showClass && (
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Köppen:</span>
                  <span className="font-mono font-semibold text-primary">
                    {province.climateKoppen}
                  </span>
                </div>
              )}
            </Card>

            {/* 4. Koordinatlar */}
            <Card variant="glass" space="1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Konum (il merkezi)</span>
                <MapPin className="size-4 text-primary" />
              </div>
              <div className="font-mono font-bold text-sm sm:text-base text-foreground pt-1">
                {province.latitude ? `${tr(province.latitude, 2)}°K` : "—"},{" "}
                {province.longitude ? `${tr(province.longitude, 2)}°D` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Plaka Kodu:</span>
                <span className="font-mono font-bold text-foreground">TR-{province.plateCode}</span>
              </div>
            </Card>
          </div>

          {/* The providers behind the four cards above. Only the base figures and, when the
              Köppen row is on screen, MGM's classification: the other sections carry their own
              source lines (ERA5-Land, ACAG, AFAD, Copernicus) where they render. */}
          <p className={SOURCE_NOTE}>
            <span className="font-semibold text-foreground">{t("sourcesLabel")}: </span>
            {t("sources", {
              year: province.populationYear !== null ? String(province.populationYear) : "none",
            })}
            {climate.citeClassSource && (
              <> {t("sourcesExtra", { list: t("sourcesClimateClass") })}</>
            )}
          </p>
        </PageContainer>
      </section>

      {/* BODY CONTENT CONTAINER — empty since T-046 filled it in. T-032 (`d2039b6`) de-nested
          the `<main>` landmark into `(site)/layout.tsx` and deleted the
          `<main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">` that wrapped
          everything below, without replacing the width, the padding or the rhythm: only this
          marker survived, and the body rendered edge-to-edge at viewport width with no gutter on
          all 81 province routes. `default` is 56px between sections where the deleted wrapper was
          48px — `PageContainer`'s rhythm union is closed on purpose and has no 48px member, and
          reopening it for 8px would reopen the passthrough it exists to close. */}
      <PageContainer space="default">
        {/* GEOGRAPHY & LOCATOR SPLIT ROW */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Prose & Physical Highlights */}
          <div className="lg:col-span-7 space-y-6">
            {/* Overview Card */}
            {showLandform && (
              <Card variant="panel" space="4">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  {sectionHeading("landform")} Yeryüzü Şekilleri
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
                          <Droplets className="size-3.5 text-info" />
                          <span>{sectionHeading("hydrography")} Su Kaynakları</span>
                        </span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {province.hydrographyNoteTr}
                        </p>
                      </div>
                    )}

                    {hydrographyFeatures && hydrographyFeatures.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-semibold text-muted-foreground block">
                          Başlıca akarsu, göl ve barajlar:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {hydrographyFeatures.map((feat, idx) => (
                            <Badge key={idx} variant="info" className="text-xs py-1">
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
              </Card>
            )}

            {/* Demographics & Socio-Economic Indicators Card */}
            {(showSettlement || showEconomy) && (
              <Card variant="panel" space="5">
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {sectionHeading("settlement")} Nüfus ve Ekonomi
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
                          %{tr(province.urbanizationRate, 1)}
                        </span>
                      </div>
                    )}
                    {province.netMigrationRate !== null && (
                      <div className="p-3.5 rounded-2xl bg-muted/50 space-y-1">
                        <span className="text-muted-foreground block">Net Göç Hızı</span>
                        <span className="font-heading font-bold text-lg text-primary">
                          ‰{tr(province.netMigrationRate, 2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Economic Geography Indicator (TÜİK GSYH Payı) */}
                {showEconomy && economyIndicator && (
                  <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-warning-strong flex items-center gap-1.5">
                        <Activity className="size-3.5" /> {economyIndicator.label}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {economyIndicator.year}
                      </span>
                    </div>
                    <div className="font-heading font-extrabold text-2xl text-warning-strong">
                      {economyIndicator.value}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Kaynak: {economyIndicator.source}
                    </div>
                  </div>
                )}
              </Card>
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

              {/* Region Association Reference */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Bağlı Olduğu Coğrafi Bölge:
                </span>
                <Link
                  href={{
                    pathname: "/turkiye/bolge/[slug]",
                    params: { slug: regionTheme.slug },
                  }}
                  className="text-primary hover:underline font-semibold inline-flex items-center gap-1 group"
                >
                  <span>{region}</span>
                  <ArrowUpRight className="size-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>

              {/* Neighboring Provinces Chips */}
              {neighbors.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2.5">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Komşu İller ({neighbors.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {neighbors.map((nb) => (
                      <Link
                        key={nb.plateCode}
                        href={{
                          pathname: "/turkiye/[slug]",
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
              {climate.showSection && similarClimate.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      İklimi Benzeyen İller:
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
                          pathname: "/turkiye/[slug]",
                          params: { slug: slugForLocale(sc, locale) },
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted hover:bg-info/15 hover:text-info-strong border border-border transition-colors group cursor-pointer"
                      >
                        <span className="font-mono text-[10px] opacity-70">#{sc.plateCode}</span>
                        <span>{sc.nameTr}</span>
                        {sc.climateAnnualMeanTempC !== null && (
                          <span className="font-mono text-[10px] font-semibold text-info-strong">
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
          <Card as="section" variant="panel" space="6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">
                {`${sectionHeading("climate")} İklim`}
              </h2>
            </div>

            {/* MEB Müfredat ve MGM Köppen Açıklama Rehberi */}
            <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                {climate.showClass && (
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" size="sm">
                      {province.climateCurriculumNameTr || province.climateClassTr}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-foreground">
                      Köppen: {province.climateKoppen}
                    </span>
                  </div>
                )}
                <span className="text-[11px] text-muted-foreground italic">
                  Ders kitabı adı ile Köppen kodu illerin çoğunda örtüşmez.
                </span>
              </div>

              {climate.showCurriculumNote && (
                <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                  {province.climateCurriculumNoteTr}
                </p>
              )}

              {province.climateNoteTr && (
                <details className="text-xs text-muted-foreground group" open>
                  <summary className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors select-none py-1">
                    MGM&apos;nin sınıflandırma notu
                  </summary>
                  <p className="mt-2 pl-3 border-l-2 border-primary/40 text-muted-foreground leading-relaxed">
                    {province.climateNoteTr}
                  </p>
                </details>
              )}
            </div>

            {/* climate-dark-scope — T-018 added this wrapper so a frozen V1 CSS Module could
                survive dark mode: `app/globals.css` shadows exactly four raw Terra tokens
                (--color-ink, --color-slate, --color-surface, --color-border) for this subtree.
                T-033 task 4 retired that module, so nothing inside reads those four any more
                and the wrapper is now inert.

                IT STAYS, for two reasons and until a task that owns `app/globals.css` retires
                the rule with it. `components/air/air-pollution.structure.test.ts` asserts this
                subtree exists and that <AirPollutionSection> never enters it — the PM2.5 chart
                draws its axis ink as alphas of --color-ink, which resolves to 1.05:1 on its own
                white plot in here. And the shadow is why `climate-chart.tsx` draws ITS plot
                scaffolding from --color-ink-dark instead: see that file's docblock. */}
            <div className="climate-dark-scope">
              <ClimateSection
                locale={locale}
                provinceName={name}
                plateCode={province.plateCode}
                climate={climateSeries}
              />
            </div>
          </Card>
        )}

        {/* AIR QUALITY & MARINE ENVIRONMENT ROW */}
        {pm25Annual && showMarine ? (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card variant="panel">
              <AirPollutionSection
                locale={locale}
                provinceName={name}
                headingName={sectionHeading("airPollution")}
                plateCode={province.plateCode}
                pm25={pm25Annual}
              />
            </Card>
            <Card variant="panel">
              <ProvinceMarineSection
                locale={locale}
                provinceName={name}
                blocks={marineBlocks}
                layers={marineLayers}
                headingId="province-marine"
              />
            </Card>
          </section>
        ) : pm25Annual ? (
          <Card as="section" variant="panel">
            <AirPollutionSection
              locale={locale}
              provinceName={name}
              headingName={sectionHeading("airPollution")}
              plateCode={province.plateCode}
              pm25={pm25Annual}
            />
          </Card>
        ) : showMarine ? (
          <Card as="section" variant="panel">
            <ProvinceMarineSection
              locale={locale}
              provinceName={name}
              blocks={marineBlocks}
              layers={marineLayers}
              headingId="province-marine"
            />
          </Card>
        ) : null}

        {/* EARTHQUAKE MONITORING SECTION */}
        {provinceEarthquakes !== null && earthquakeMeta !== null && (
          <Card as="section" variant="panel" space="4">
            <ProvinceEarthquakeSection
              locale={locale}
              provinceName={name}
              plateCode={province.plateCode}
              list={provinceEarthquakes}
              headingId="province-earthquake"
            />
            {/* The disclaimer used to be repeated here as an amber callout. It now renders
                exactly once, in `EarthquakeAttribution` at the foot of the page, alongside the
                provider notices it belongs with — one mandated string, one render site. */}
          </Card>
        )}

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/turkiye">
            <Button variant="outline" size="sm" leftIcon={<Compass className="size-4" />}>
              Türkiye Haritasına Dön
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" leftIcon={<Home className="size-4" />}>
              Ana Sayfa
            </Button>
          </Link>
        </div>

        {/* The marine safety disclaimer, beside this province's values, plus a link to the
            licence text — the SAME component `/deniz`, the four basin pages and the home page
            render (`components/marine/marine-data-notice.tsx`).

            ECMWF's and Copernicus Marine's required wording no longer renders here: it is
            published once, on `/hakkimizda`, and CC BY 4.0 §3(a)(2) lets a hyperlink carry the
            required information. What could NOT be centralized is
            `Marine.disclaimer.educationalOnly` — it is not a licence notice, and a reader
            looking at this province's sea temperature has to read "can güvenliği kararlarında
            kullanılamaz" on this page, not one click away. That sentence is this block.

            Still gated on the same `showMarine` signal as the values themselves, so the two
            cannot come apart in either direction. */}
        {showMarine && <MarineDataNotice />}

        {/* AFAD's own required notice, from the PROVINCE payload's attributions — not the
            global meta's — because this section shows this province's events. The disclaimer
            comes from the global meta, which is where it is published. Gated on the same pair
            the section itself is gated on. */}
        {provinceEarthquakes !== null && earthquakeMeta !== null && (
          <EarthquakeAttribution
            attributions={provinceEarthquakes.meta.attributions}
            disclaimerTr={earthquakeMeta.disclaimerTr}
            heading={t("earthquakeSourcesHeading")}
          />
        )}
      </PageContainer>
    </>
  );
}
