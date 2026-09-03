import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2FavoriteButton } from "@/components/v2/v2-favorite-button";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { LocatorMap } from "@/components/map/locator-map";
import { ProseNote } from "@/components/prose-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  byIsoCode,
  getCountries,
  getCountryBySlug,
  getCountriesResilient,
} from "@/lib/api/countries";
import type { CountryDetail, CountryListItem } from "@/lib/api/types";
import { neighborCountryNameTr } from "@/lib/geo/neighbor-country-names";
import { neighborViaTerritory } from "@/lib/geo/neighbor-via-territory";
import { hasFlag } from "@/lib/geo/flag-set";
import { isSpecialStatusRow, showsCountryFlag, showsSovereigntyNote } from "@/lib/geo/sovereignty";
import { showsSubregionCard } from "@/lib/geo/subregion";
import { COUNTRY_SHAPES } from "@/lib/map/world-countries.generated";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { selectCountryMetaDescription } from "@/lib/seo/country-description";
import { countryJsonLd, type GeoPropertyValue, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  COUNTRY_HEADING_CASE,
  COUNTRY_HEADING_KEY,
  headingName,
  type CountryHeadingSlot,
} from "@/lib/text/heading-name";
import {
  Globe,
  Compass,
  Users,
  Maximize2,
  Home,
  ChevronRight,
  ArrowUpRight,
  Building2,
  Scroll,
} from "lucide-react";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

function slugForLocale(country: CountryDetail | CountryListItem, locale: Locale): string {
  return locale === "en" ? country.slugEn : country.slugTr;
}

function nameForLocale(country: CountryDetail | CountryListItem, locale: Locale): string {
  return locale === "en" ? country.nameEn : country.nameTr;
}

const COUNTRY_SHAPE_BY_ISO = new Map(COUNTRY_SHAPES.map((shape) => [shape.iso, shape.d] as const));

type Neighbor =
  | { kind: "link"; label: string; slug: string; iso: string }
  | { kind: "text"; label: string; iso: string };

export async function generateStaticParams() {
  const countries = await getCountriesResilient();
  return routing.locales.flatMap((locale) =>
    countries.map((country) => ({ locale, slug: slugForLocale(country, locale) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const country = await getCountryBySlug(slug);
  if (!country) return {};

  const t = await getTranslations({ locale, namespace: "CountryDetail" });
  const tContinents = await getTranslations({ locale, namespace: "Continents" });
  const name = nameForLocale(country, locale);
  const continent = tContinents(country.continent);

  const { key: descriptionKey, params: descriptionParams } = selectCountryMetaDescription({
    locale,
    isoCode: country.isoCode,
    population: country.population,
    areaKm2: country.areaKm2,
    neighborCount: country.neighborCount,
    capital: locale === "en" ? country.capitalNameEn : country.capitalNameTr,
    sovereigntyNote: country.sovereigntyNoteTr,
    name,
    continent,
  });

  return buildMetadata({
    locale,
    surface: "noindex",
    hrefForLocale: (l) => ({
      pathname: "/v2/dunya/[slug]",
      params: { slug: slugForLocale(country, l) },
    }),
    title: `${t("metaTitle", { name })} | V2 Dünya Atlası`,
    description: t(descriptionKey, descriptionParams),
    openGraphType: "article",
  });
}

export default async function V2CountryDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const country = await getCountryBySlug(slug);
  if (!country) {
    notFound();
  }

  const t = await getTranslations("CountryDetail");
  const tContinents = await getTranslations("Continents");
  const format = await getFormatter();

  const isTr = locale === "tr";
  const name = nameForLocale(country, locale);
  const continent = tContinents(country.continent);
  const capital = locale === "en" ? country.capitalNameEn : country.capitalNameTr;

  const path = `/v2/dunya/${slugForLocale(country, locale)}`;

  const neighborLabel = (nName: string, iso: string): string => {
    const via = neighborViaTerritory(country.isoCode, iso, locale);
    return via === null ? nName : t(via.key, { name: nName, territory: via.territory });
  };

  const neighbors: Neighbor[] = [];
  try {
    const byIso = byIsoCode(await getCountries());
    const seen = new Set<string>();
    for (const iso of country.neighborIsoCodes) {
      if (seen.has(iso)) continue;
      seen.add(iso);
      const seeded = byIso.get(iso);
      if (seeded) {
        neighbors.push({
          kind: "link",
          label: neighborLabel(nameForLocale(seeded, locale), iso),
          slug: slugForLocale(seeded, locale),
          iso,
        });
      } else if (isTr) {
        const textName = neighborCountryNameTr(iso);
        if (textName) neighbors.push({ kind: "text", label: neighborLabel(textName, iso), iso });
      }
    }
  } catch (error) {
    console.warn(`[v2:country:${slug}] neighbour resolution skipped: ${String(error)}`);
  }

  const additionalProperty: GeoPropertyValue[] = [];
  if (country.population !== null) {
    additionalProperty.push({ name: t("population"), value: country.population });
  }
  if (country.areaKm2 !== null) {
    additionalProperty.push({
      name: t("area"),
      value: country.areaKm2,
      unitText: t("areaUnit"),
      unitCode: "KMK",
    });
  }
  additionalProperty.push({ name: t("neighborCount"), value: country.neighborCount });

  const geo =
    country.capitalLatitude !== null && country.capitalLongitude !== null
      ? { latitude: country.capitalLatitude, longitude: country.capitalLongitude }
      : null;

  const introText =
    isTr && country.introTr !== null
      ? country.introTr
      : country.population !== null
        ? t("introFallbackPopulation", { name, continent, population: country.population })
        : country.areaKm2 !== null
          ? t("introFallbackArea", { name, continent, area: country.areaKm2 })
          : t("introFallbackContinent", { name, continent });

  const landformNote = isTr ? country.landformNoteTr : null;
  const climateNote = isTr ? country.climateNoteTr : null;
  const independenceNote = isTr ? country.independenceNoteTr : null;
  const hydrographyNote = isTr ? country.hydrographyNoteTr : null;

  const entityNamedHeadings = !isSpecialStatusRow(country.sovereigntyNoteTr);
  const sectionHeading = (slot: CountryHeadingSlot): string =>
    entityNamedHeadings
      ? t(COUNTRY_HEADING_KEY[slot].named, {
          name: headingName(locale, name, COUNTRY_HEADING_CASE[slot]),
        })
      : t(COUNTRY_HEADING_KEY[slot].plain);

  const sovereigntyNote = showsSovereigntyNote(locale, country.sovereigntyNoteTr)
    ? country.sovereigntyNoteTr
    : null;
  const showsFlag = showsCountryFlag(locale, country.sovereigntyNoteTr);
  const officialLanguages = isTr ? country.officialLanguagesTr : null;
  const countryShapeD = COUNTRY_SHAPE_BY_ISO.get(country.isoCode);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <JsonLd
        schema={countryJsonLd({
          name,
          path,
          locale,
          geo,
          additionalProperty,
          isoCode: country.isoCode,
          containedInPlace: { name: continent },
          dateModified: country.updatedAt,
        })}
      />
      <V2Header />
      <V2LiveTicker />

      {/* HERO BANNER */}
      <section className="relative border-b border-border bg-gradient-to-b from-primary/10 via-background to-background pt-8 pb-12 overflow-hidden">
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
            <Link href="/v2/dunya" className="hover:text-foreground transition-colors">
              Dünya Atlası
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold flex items-center gap-1.5">
              <span>{name}</span>
              <span className="font-mono text-[11px] opacity-75">({country.isoCode})</span>
            </span>
          </nav>

          {/* Title & Flag Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {showsFlag && hasFlag(country.isoCode) && (
                  /* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9 */
                  <img
                    src={`/flags/${country.isoCode.toUpperCase()}.svg`}
                    alt={`${name} bayrağı`}
                    width={32}
                    height={22}
                    className="w-8 h-5.5 object-cover rounded-xs border border-border shadow-xs"
                  />
                )}
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  {continent}
                </Badge>
                {isTr && showsSubregionCard(continent, country.unSubregionTr) && (
                  <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                    {country.unSubregionTr}
                  </Badge>
                )}
                <Badge variant="secondary" className="font-mono font-bold tracking-wider">
                  ISO: {country.isoCode} {country.isoCodeAlpha3 ? `/ ${country.isoCodeAlpha3}` : ""}
                </Badge>
              </div>

              <h1 className="font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
                {name}
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
                {introText}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <V2FavoriteButton target={{ kind: "country", isoCode: country.isoCode }} />
              <Link href="/v2/dunya">
                <Button variant="outline" size="sm" leftIcon={<Globe className="size-4" />}>
                  Tüm Ülkeler
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
                {country.population ? format.number(country.population) : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                <span>Kaynak: </span>
                <span className="font-semibold text-foreground">
                  {locale === "en"
                    ? country.populationSourceNameEn || "World Bank"
                    : country.populationSourceNameTr || "Dünya Bankası"}
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
                {country.areaKm2 ? `${format.number(country.areaKm2)} km²` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                <span>Komşu Sayısı: </span>
                <span className="font-mono font-semibold text-foreground">
                  {country.neighborCount}
                </span>
              </div>
            </div>

            {/* 3. Başkent */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Başkent</span>
                <Building2 className="size-4 text-amber-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {capital || "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                <span>Para Birimi: </span>
                <span className="font-semibold text-foreground">
                  {country.currencyNameTr || country.currencyCode || "—"}
                </span>
              </div>
            </div>

            {/* 4. Yönetim & Dil */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Yönetim Şekli</span>
                <Scroll className="size-4 text-rose-600" />
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground pt-1 leading-snug">
                {country.governmentFormTr || "—"}
              </div>
              <div className="text-[11px] text-muted-foreground pt-0.5">
                <span>Resmi Dil: </span>
                <span className="font-semibold text-foreground">
                  {officialLanguages && officialLanguages.length > 0
                    ? officialLanguages.join(", ")
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BODY CONTENT CONTAINER */}
      <main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">
        {/* GEOGRAPHY & LOCATOR SPLIT ROW */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Prose & Facts */}
          <div className="lg:col-span-7 space-y-6">
            {/* Overview & Physical Geography Card */}
            {(landformNote || independenceNote) && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    Fiziki Coğrafya &amp; Arazi
                  </Badge>
                </div>
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  {`${sectionHeading("landform")} ve Coğrafi Konumu`}
                </h2>
                {landformNote && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{landformNote}</p>
                )}

                {/* Historical Independence / National Day Highlight */}
                {independenceNote && (
                  <div className="mt-4 p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Scroll className="size-3.5 text-rose-600" />
                      <span>Tarihsel Kuruluş ve Millî Gün</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {independenceNote}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Climate & Weather Card */}
            {climateNote && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm">
                    İklim Özellikleri
                  </Badge>
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {sectionHeading("climate")}
                </h3>
                <ProseNote
                  text={climateNote}
                  className="text-sm text-muted-foreground leading-relaxed"
                />
              </div>
            )}

            {/* Hydrography Card */}
            {hydrographyNote && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    size="sm"
                    className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
                  >
                    Hidrografya
                  </Badge>
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {sectionHeading("hydrography")}
                </h3>
                <ProseNote
                  text={hydrographyNote}
                  className="text-sm text-muted-foreground leading-relaxed"
                />
              </div>
            )}

            {/* Sovereignty Note if applicable */}
            {sovereigntyNote && (
              <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    size="sm"
                    className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  >
                    Egemenlik ve Tanınma Durumu
                  </Badge>
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {t("sovereigntyHeading")}
                </h3>
                <ProseNote
                  text={sovereigntyNote}
                  className="text-sm text-muted-foreground leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Right 5 Columns: Locator Map & Neighbors */}
          <div className="lg:col-span-5 space-y-6">
            {/* Locator Mini Map */}
            {countryShapeD && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-primary" />
                    <h3 className="font-heading font-bold text-base text-foreground">
                      Dünya Haritasındaki Konumu
                    </h3>
                  </div>
                  <Badge variant="outline" size="sm" className="font-mono text-[11px]">
                    {country.isoCode}
                  </Badge>
                </div>

                <LocatorMap
                  kind="country"
                  locale={locale}
                  d={countryShapeD}
                  alt={t("locationAlt", {
                    name: headingName(locale, name, COUNTRY_HEADING_CASE.location),
                  })}
                />
              </div>
            )}

            {/* Neighboring Countries Card */}
            {neighbors.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
                    <Globe className="size-4 text-secondary" />
                    <span>Komşu Ülkeler ({neighbors.length})</span>
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {neighbors.map((nb) =>
                    nb.kind === "link" ? (
                      <Link
                        key={nb.iso}
                        href={{ pathname: "/v2/dunya/[slug]", params: { slug: nb.slug } }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted hover:bg-primary/15 hover:text-primary border border-border transition-colors group cursor-pointer"
                      >
                        <span className="font-mono text-[10px] opacity-70">#{nb.iso}</span>
                        <span>{nb.label}</span>
                        <ArrowUpRight className="size-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      <span
                        key={nb.iso}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted/40 border border-border/60 text-muted-foreground"
                      >
                        <span className="font-mono text-[10px] opacity-70">#{nb.iso}</span>
                        <span>{nb.label}</span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/v2/dunya">
            <Button variant="outline" size="sm" leftIcon={<Globe className="size-4" />}>
              ← Dünya Atlası&apos;na Dön (Tüm Ülkeler)
            </Button>
          </Link>
          <Link href="/v2">
            <Button variant="ghost" size="sm" leftIcon={<Home className="size-4" />}>
              Ana Sayfa
            </Button>
          </Link>
        </div>

        {/* DATA SOURCES & CITATIONS (KAYNAKÇA) */}
        <V2SourcesSection scope="dunya" />
      </main>
    </div>
  );
}
