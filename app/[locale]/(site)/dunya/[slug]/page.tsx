import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2FavoriteButton } from "@/components/v2/v2-favorite-button";
import { V2RichProse } from "@/components/v2/v2-rich-prose";
import { LocatorMap } from "@/components/map/locator-map";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
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
import { sourcesMessage } from "@/lib/geo/country-sources";
import { hasFlag } from "@/lib/geo/flag-set";
import {
  isSpecialStatusRow,
  showsCountryFlag,
  showsCountryFlagForStatus,
  showsSovereigntyNote,
} from "@/lib/geo/sovereignty";
import { showsSubregionCard } from "@/lib/geo/subregion";
import { SPECIAL_STATUS_ISO_CODES } from "@/lib/geo/special-status-isos";
import { COUNTRY_SHAPES } from "@/lib/map/world-countries.generated";
import { CONTINENT_META } from "@/lib/map/continent-theme";
import { CONTINENT_KEY_TO_SLUG } from "@/lib/geo/continents";
import { Link } from "@/i18n/navigation";
import { routing, type AppPathname, type Locale } from "@/i18n/routing";
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
  ArrowUpRight,
  Building2,
  Scroll,
  Layers,
  MapPin,
  Coins,
  Languages,
  Mountain,
  Waves,
  CloudSun,
  ShieldAlert,
  FileText,
} from "lucide-react";
import { V2EnWorkInProgressNotice } from "@/components/v2/v2-en-work-in-progress-notice";

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
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    surface: "trNarrative",
    hrefForLocale: (l) => ({
      pathname: "/dunya/[slug]",
      params: { slug: slugForLocale(country, l) },
    }),
    // No ` | V2 Dünya Atlası` — the retired route prefix, plus a second brand suffix on top of the
    // root layout's `%s · Coğrafya Gurmesi` template. See the province page for the same fix.
    title: t("metaTitle", { name }),
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
  const localizedStatusLabel = locale === "en" ? country.statusLabelEn : country.statusLabelTr;
  const continentTheme = CONTINENT_META[country.continent] ?? CONTINENT_META.AVRUPA!;
  const continentSlug = CONTINENT_KEY_TO_SLUG[country.continent] ?? "afrika";

  const path = `/dunya/${slugForLocale(country, locale)}`;

  const neighborLabel = (nName: string, iso: string): string => {
    const via = neighborViaTerritory(country.isoCode, iso, locale);
    return via === null ? nName : t(via.key, { name: nName, territory: via.territory });
  };

  const neighbors: Neighbor[] = [];
  try {
    const allCountries = await getCountries();
    const byIso = byIsoCode(allCountries);
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
      : country.entityType !== "country"
        ? country.population !== null
          ? t("introFallbackNonCountryPopulation", { name, population: country.population })
          : country.areaKm2 !== null
            ? t("introFallbackNonCountryArea", { name, area: country.areaKm2 })
            : t("introFallbackNonCountryContinent", { name, continent })
        : country.population !== null
          ? t("introFallbackPopulation", { name, continent, population: country.population })
          : country.areaKm2 !== null
            ? t("introFallbackArea", { name, continent, area: country.areaKm2 })
            : t("introFallbackContinent", { name, continent });

  const landformNote = isTr ? country.landformNoteTr : null;
  const climateNote = isTr ? country.climateNoteTr : null;
  /**
   * Which population-source clause this page prints — decided in `lib/geo/country-sources.ts`
   * rather than inline, because `vitest.config.ts` collects `lib/**` and `components/**` only:
   * a branch inside this async Server Component has no gate at all.
   */
  const populationSource = sourcesMessage(
    locale === "en" ? country.populationSourceNameEn : country.populationSourceNameTr,
  );

  const independenceNote = isTr ? country.independenceNoteTr : null;
  const hydrographyNote = isTr ? country.hydrographyNoteTr : null;
  const settlementNote = isTr ? country.settlementNoteTr : null;
  const economyNote = isTr ? country.economyNoteTr : null;
  const governanceNote = isTr ? country.governanceNoteTr : null;
  const governmentFormForLocale = isTr ? country.governmentFormTr : null;
  const currencyNameForLocale = isTr ? country.currencyNameTr : null;

  const isSpecialStatus = isSpecialStatusRow(country.sovereigntyNoteTr);
  const isSpecialGeography = isSpecialStatus || country.entityType === "special";
  const entityNamedHeadings = !isSpecialStatus;
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

  // §5.2.1 — the governance-card fallback renders only when it has something to say; on EN
  // that is true only for the two rows with a localized status label (GL, AQ).
  const showsGovernanceFallback = Boolean(
    governmentFormForLocale ||
    localizedStatusLabel ||
    (officialLanguages && officialLanguages.length > 0),
  );
  // §5.2.1 layout consequence — on EN, section 3's left column has nothing left in it once
  // the governance fallback is suppressed (sovereigntyNote/settlementNote/economyNote are all
  // isTr-gated too), so the identity card spans the full width instead of leaving a gap.
  const hasLeftColumnCards = Boolean(
    sovereigntyNote || governanceNote || showsGovernanceFallback || settlementNote || economyNote,
  );
  // §5.2.3 Decision 0 — the neighbours section is suppressed for the four special-geography
  // rows at zero neighbours (Decision 2), AND for the divergent state where the contract says
  // there are neighbours but the resolved array came back empty because the fetch failed
  // (asserts nothing rather than rendering a false "no border" claim, VALB133R2-NEW-I1).
  const showsNeighbourSection =
    !(isSpecialGeography && country.neighborCount === 0) &&
    !(country.neighborCount > 0 && neighbors.length === 0);

  return (
    <>
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
      <V2LiveTicker />

      {/* HERO BANNER SECTION */}
      <section
        className={`relative isolate border-b border-border bg-gradient-to-b ${continentTheme.gradient} pt-8 pb-12 overflow-hidden`}
      >
        {/* Glow backdrop with continent accent */}
        <div
          className={`absolute -z-10 top-0 right-1/4 size-96 ${continentTheme.glowColor} rounded-full blur-3xl pointer-events-none`}
        />

        <PageContainer space="band">
          {/* Breadcrumb Bar */}
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Dünya Atlası", href: "/dunya", path: "/dunya" },
              {
                label: continent,
                // A concrete, already-interpolated path, not the `"/dunya/kita/[slug]"` route
                // pattern `AppPathname` itself enumerates — the cast
                // `components/patterns/breadcrumbs.tsx` documents for exactly this shape.
                href: `/dunya/kita/${continentSlug}` as AppPathname,
                path: `/dunya/kita/${continentSlug}`,
              },
              { label: `${name} (${country.isoCode})`, path },
            ]}
            locale={locale}
            surface="trNarrative"
          />

          {/* Title & Flag Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <PageHero
              tier="detail"
              heading={name}
              notice={<V2EnWorkInProgressNotice locale={locale} />}
              lede={introText}
              badges={
                <>
                  {showsFlag && hasFlag(country.isoCode) && (
                    /* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9 */
                    <img
                      src={`/flags/${country.isoCode.toUpperCase()}.svg`}
                      /* From the catalogue, never a literal: the V2 rewrite inlined this image in
                       place of `CountryFlag` and hardcoded the TR string, so the EN page read
                       "France bayrağı". `CountryDetail.flagAlt` has carried both wordings all
                       along. An informative image, so a real alt — never `alt=""`. */
                      alt={t("flagAlt", { name })}
                      width={36}
                      height={24}
                      className="w-9 h-6 object-cover rounded-xs border border-border shadow-sm"
                    />
                  )}
                  <Link
                    href={{
                      pathname: "/dunya/kita/[slug]",
                      params: { slug: CONTINENT_KEY_TO_SLUG[country.continent] ?? "afrika" },
                    }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Badge
                      variant="outline"
                      className={`${continentTheme.badgeClass} cursor-pointer`}
                    >
                      {continent}
                    </Badge>
                  </Link>
                  {isTr && showsSubregionCard(continent, country.unSubregionTr) && (
                    <Badge
                      variant="outline"
                      className="bg-muted text-muted-foreground border-border"
                    >
                      {country.unSubregionTr}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="font-mono font-bold tracking-wider">
                    ISO: {country.isoCode}{" "}
                    {country.isoCodeAlpha3 ? `/ ${country.isoCodeAlpha3}` : ""}
                  </Badge>
                  {country.entityType !== "country" ? (
                    localizedStatusLabel ? (
                      <Badge
                        variant="outline"
                        className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                      >
                        {localizedStatusLabel}
                      </Badge>
                    ) : null
                  ) : isSpecialStatus ? (
                    <Badge
                      variant="outline"
                      className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    >
                      {t("specialStatusBadge")}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    >
                      {t("sovereignEntityBadge")}
                    </Badge>
                  )}
                  {country.neighborCount === 0 ? (
                    isSpecialGeography ? null : (
                      <Badge
                        variant="outline"
                        className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 flex items-center gap-1"
                      >
                        <Waves className="size-3" /> {t("islandChipLabel")}
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      {t("landNeighboursChip", { count: country.neighborCount })}
                    </Badge>
                  )}
                </>
              }
            />

            {/* Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <V2FavoriteButton target={{ kind: "country", isoCode: country.isoCode }} />
              <Link href="/dunya">
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
                <span className="text-xs font-medium">{t("kpiPopulationTitle")}</span>
                <Users className="size-4 text-primary" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {country.population ? format.number(country.population) : "—"}
              </div>
              {/* NO CLIENT-SIDE DEFAULT. This read `?? "Dünya Bankası"` / `?? "World Bank"`,
                  which the contract prohibits in as many words: "İstemcide sabitlemeyin veya
                  kendi varsayılanınızı eklemeyin (`?? "Dünya Bankası"`) — tek doğruluk kaynağı
                  burasıdır" (`CountryDetailDto.populationSourceNameTr`). The field is null if and
                  only if `population` is null — today that is Antarctica alone — so the fallback
                  did not paper over a gap, it credited the World Bank with a population figure
                  that does not exist. The contract's instruction for that state is to drop the
                  clause entirely, never to write "no source". `sourcesMessage` in
                  `lib/geo/country-sources.ts` is where that decision lives, and it is truthy
                  rather than `!== null` on purpose: an api that predates the field yields
                  `undefined`, which an exact null check misses. */}
              {/* NOT `truncate max-w-[130px]` any more. At 360 px that clipped the institution to
                  "Dünya Bank…" — and this line is the whole reason the country page needs no
                  bibliography block: the source travels beside the number instead. Truncating it
                  is the one place that argument does not survive contact with a phone. Wrapping
                  costs a second line on the narrowest screens and loses nothing; the `title` went
                  with the clipping, since a tooltip repeating text that is now fully visible is
                  the redundant kind T-036 removed everywhere else. */}
              {populationSource.key === "sources" && (
                <div className="text-[11px] text-muted-foreground flex flex-wrap items-baseline justify-between gap-x-2">
                  <span>{t("kpiSourceLabel")}</span>
                  <span className="font-semibold text-foreground text-right">
                    {populationSource.values.populationSource}
                    {country.populationYear ? ` (${country.populationYear})` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Yüzölçümü */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{t("kpiAreaTitle")}</span>
                <Maximize2 className="size-4 text-teal-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground">
                {country.areaKm2
                  ? `${country.areaIsApproximate ? "≈ " : ""}${format.number(country.areaKm2)} km²`
                  : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>{t("kpiLandNeighboursLabel")}</span>
                <span className="font-mono font-semibold text-foreground">
                  {country.neighborCount === 0
                    ? isSpecialGeography
                      ? "0"
                      : t("kpiIslandNeighbourValue")
                    : t("kpiNeighbourCountriesValue", { count: country.neighborCount })}
                </span>
              </div>
            </div>

            {/* 3. Başkent ve Konum */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{t("kpiCapitalTitle")}</span>
                <Building2 className="size-4 text-amber-600" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-foreground truncate">
                {capital || "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>{t("kpiCoordinatesLabel")}</span>
                <span className="font-mono font-semibold text-foreground">
                  {country.capitalLatitude !== null && country.capitalLongitude !== null
                    ? `${Math.abs(country.capitalLatitude).toFixed(1)}°${t(country.capitalLatitude >= 0 ? "coordinateNorth" : "coordinateSouth")}, ${Math.abs(country.capitalLongitude).toFixed(1)}°${t(country.capitalLongitude >= 0 ? "coordinateEast" : "coordinateWest")}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* 4. Yönetim & Para Birimi */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card/85 backdrop-blur-md shadow-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{t("kpiGovernmentFormTitle")}</span>
                <Scroll className="size-4 text-rose-600" />
              </div>
              <div className="font-heading font-bold text-sm sm:text-base text-foreground pt-1 leading-snug truncate">
                {country.governmentFormTr || "—"}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
                <span>{t("kpiCurrencyLabel")}</span>
                <span className="font-semibold text-foreground truncate max-w-[120px]">
                  {currencyNameForLocale || country.currencyCode || "—"}
                </span>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* QUICKNAV / JUMP NAVIGATION BAR (STICKY, SCROLLBAR HIDDEN) */}
      <nav
        aria-label={t("sectionNavAriaLabel")}
        className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border py-2.5 overflow-x-auto scrollbar-none"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
            <Layers className="size-3.5" /> {t("sectionNavLabel")}
          </span>
          <a
            href="#konum-ve-harita"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            {t("sectionNavLocation")}
          </a>
          {(climateNote || hydrographyNote) && (
            <a
              href="#iklim-ve-hidrografya"
              className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
            >
              {t("sectionNavClimateHydrography")}
            </a>
          )}
          <a
            href="#yonetim-ve-demografi"
            className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
          >
            {t("sectionNavGovernance")}
          </a>
          {showsNeighbourSection && (
            <a
              href="#komsular"
              className="px-3 py-1 rounded-full bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0"
            >
              {t("sectionNavBorders")}
            </a>
          )}
        </div>
      </nav>

      {/* BODY CONTENT CONTAINER */}
      {/* SECTION 1: KONUM, DÜNYA HARİTASI VE COĞRAFİ KİMLİK */}
      <section id="konum-ve-harita" className="scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Landform Prose & Geographical Keyfacts */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
              <div className="space-y-2 border-b border-border/70 pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    {t("physicalGeographyBadge")}
                  </Badge>
                </div>
                <h2 className="font-heading text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                  <Mountain className="size-6 text-primary shrink-0" />
                  <span>
                    {t("landformHeadingWithLocation", { heading: sectionHeading("landform") })}
                  </span>
                </h2>
              </div>

              {landformNote ? (
                <V2RichProse text={landformNote} />
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{introText}</p>
              )}

              {/* 4 Quick Geodata Cards (fills space purposefully and gives key reference points) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                    <Globe className="size-3.5 text-primary" /> {t("quickFactContinentRegion")}
                  </span>
                  <span className="font-heading font-semibold text-sm text-foreground block">
                    {continent} {isTr && country.unSubregionTr ? `(${country.unSubregionTr})` : ""}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                    <MapPin className="size-3.5 text-rose-600" /> {t("quickFactCapitalCoordinates")}
                  </span>
                  <span className="font-mono font-semibold text-sm text-foreground block">
                    {country.capitalLatitude !== null && country.capitalLongitude !== null
                      ? `${Math.abs(country.capitalLatitude).toFixed(2)}°${t(country.capitalLatitude >= 0 ? "coordinateNorth" : "coordinateSouth")}, ${Math.abs(country.capitalLongitude).toFixed(2)}°${t(country.capitalLongitude >= 0 ? "coordinateEast" : "coordinateWest")}`
                      : t("quickFactNotSpecified")}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                    <Coins className="size-3.5 text-amber-600" /> {t("quickFactCurrency")}
                  </span>
                  <span className="font-semibold text-sm text-foreground block">
                    {currencyNameForLocale || country.currencyCode || "—"}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                    <Languages className="size-3.5 text-teal-600" />{" "}
                    {t("quickFactOfficialLanguages")}
                  </span>
                  <span
                    className="font-semibold text-sm text-foreground truncate block"
                    title={officialLanguages?.join(", ") || "—"}
                  >
                    {officialLanguages && officialLanguages.length > 0
                      ? officialLanguages.join(", ")
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Historical Independence / National Day Highlight */}
              {independenceNote && (
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5">
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
          </div>

          {/* Right 5 Columns: World Locator Map Card & Spatial Reference */}
          <div className="lg:col-span-5 space-y-6">
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

              {countryShapeD && (
                <LocatorMap
                  kind="country"
                  locale={locale}
                  d={countryShapeD}
                  alt={t("locationAlt", {
                    name: headingName(locale, name, COUNTRY_HEADING_CASE.location),
                  })}
                />
              )}

              {/* Spatial Context Details */}
              <div className="pt-3 border-t border-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">{t("labelCapital")}</span>
                  <span className="font-semibold text-foreground">{capital || "—"}</span>
                </div>
                {!(isSpecialGeography && country.neighborCount === 0) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">
                      {t("spatialStatusLabel")}
                    </span>
                    <span className="font-medium text-foreground">
                      {country.neighborCount === 0
                        ? t("spatialIslandBoundaries")
                        : t("spatialLandBorderCount", { count: country.neighborCount })}
                    </span>
                  </div>
                )}
                {isTr && country.unSubregionTr && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">
                      {t("unSubregionLabel")}
                    </span>
                    <span className="font-medium text-foreground">{country.unSubregionTr}</span>
                  </div>
                )}
              </div>

              {/* Quick Continent Exploration Link */}
              <div className="pt-2">
                <Link
                  href={{
                    pathname: "/dunya/kita/[slug]",
                    params: { slug: CONTINENT_KEY_TO_SLUG[country.continent] ?? "afrika" },
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-border/60"
                >
                  <span>{t("continentExploreLink", { continent })}</span>
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: İKLİM & HİDROGRAFYA (EXPANSIVE 2-COLUMN BALANCED GRID) */}
      {(climateNote || hydrographyNote) && (
        <section id="iklim-ve-hidrografya" className="scroll-mt-28 space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20"
              >
                {t("climateHydrographyBadge")}
              </Badge>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground tracking-tight">
              {t("climateHydrographyGroupHeading", { name })}
            </h2>
          </div>

          <div
            className={
              climateNote && hydrographyNote
                ? "grid grid-cols-1 lg:grid-cols-2 gap-8"
                : "grid grid-cols-1 gap-8"
            }
          >
            {climateNote && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CloudSun className="size-5 text-amber-500" />
                    <h3 className="font-heading text-xl font-bold text-foreground">
                      {sectionHeading("climate")}
                    </h3>
                  </div>
                  <Badge variant="secondary" size="sm">
                    {t("climateBeltsBadge")}
                  </Badge>
                </div>
                <V2RichProse
                  text={climateNote}
                  paragraphClassName="text-sm text-muted-foreground leading-relaxed"
                />
              </div>
            )}

            {hydrographyNote && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Waves className="size-5 text-cyan-600" />
                    <h3 className="font-heading text-xl font-bold text-foreground">
                      {sectionHeading("hydrography")}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    size="sm"
                    className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
                  >
                    {t("hydrographyResourcesBadge")}
                  </Badge>
                </div>
                <V2RichProse
                  text={hydrographyNote}
                  paragraphClassName="text-sm text-muted-foreground leading-relaxed"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 3: YÖNETİM, DEMOGRAFİ VE RESMÎ KİMLİK TABLOSU */}
      <section id="yonetim-ve-demografi" className="scroll-mt-28 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              {t("administrativeStructureBadge")}
            </Badge>
          </div>
          <h2 className="font-heading text-2xl font-bold text-foreground tracking-tight">
            {t("administrativeGroupHeading", { name })}
          </h2>
        </div>

        <div
          className={
            hasLeftColumnCards
              ? "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
              : "grid grid-cols-1 gap-8 items-start"
          }
        >
          {/* Left 7 Columns: Notes (Settlement, Economy, Governance, Sovereignty) */}
          {hasLeftColumnCards && (
            <div className="lg:col-span-7 space-y-6">
              {/* Sovereignty Note if applicable */}
              {sovereigntyNote && (
                <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      size="sm"
                      className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    >
                      <ShieldAlert className="size-3 mr-1" />
                      {t("sovereigntyStatusBadge")}
                    </Badge>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {t("sovereigntyHeading")}
                  </h3>
                  <V2RichProse
                    text={sovereigntyNote}
                    paragraphClassName="text-sm text-muted-foreground leading-relaxed"
                  />
                </div>
              )}

              {/* Governance & Political Structure Note */}
              {governanceNote ? (
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" size="sm">
                      {t("governanceStructureBadge")}
                    </Badge>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {t("governanceStructureHeading")}
                  </h3>
                  <V2RichProse
                    text={governanceNote}
                    paragraphClassName="text-sm text-muted-foreground leading-relaxed"
                  />
                </div>
              ) : showsGovernanceFallback ? (
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" size="sm">
                      {t("politicalLegalStatusBadge")}
                    </Badge>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {t("politicalLegalStatusHeading")}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {governmentFormForLocale
                      ? t.rich("governanceFallback", {
                          name,
                          governmentForm: governmentFormForLocale,
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })
                      : null}
                    {localizedStatusLabel
                      ? ` ${t("officialStatusLabel", { status: localizedStatusLabel })}`
                      : ""}
                    {officialLanguages && officialLanguages.length > 0
                      ? ` ${t("officialLanguagesLabel", { languages: officialLanguages.join(", ") })}`
                      : ""}
                  </p>
                </div>
              ) : null}

              {/* Settlement / Demographic distribution Note if available */}
              {settlementNote && (
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" size="sm">
                      {t("settlementBadge")}
                    </Badge>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {t("settlementHeading")}
                  </h3>
                  <V2RichProse
                    text={settlementNote}
                    paragraphClassName="text-sm text-muted-foreground leading-relaxed"
                  />
                </div>
              )}

              {/* Economy Note if available */}
              {economyNote && (
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      size="sm"
                      className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    >
                      {t("economyBadge")}
                    </Badge>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {t("economyHeading")}
                  </h3>
                  <V2RichProse
                    text={economyNote}
                    paragraphClassName="text-sm text-muted-foreground leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}

          {/* Right 5 Columns: Official Atlas Identity Card / Data Sheet */}
          <div
            className={hasLeftColumnCards ? "lg:col-span-5 space-y-6" : "lg:col-span-12 space-y-6"}
          >
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <span>{t("identityCardTitle")}</span>
                </h3>
                <Badge variant="outline" className="font-mono text-xs">
                  {country.isoCode}
                </Badge>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowNameTr")}
                  </span>
                  <span className="font-semibold text-foreground text-right">{country.nameTr}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowNameEn")}
                  </span>
                  <span className="font-semibold text-foreground text-right">{country.nameEn}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">{t("labelCapital")}</span>
                  <span className="font-semibold text-foreground text-right">{capital || "—"}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowPopulation")}
                  </span>
                  <span className="font-semibold text-foreground text-right">
                    {country.population ? format.number(country.population) : "—"}
                    {country.populationYear ? ` (${country.populationYear})` : ""}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">{t("identityRowArea")}</span>
                  <span className="font-semibold text-foreground text-right">
                    {country.areaKm2
                      ? `${country.areaIsApproximate ? "≈ " : ""}${format.number(country.areaKm2)} km²`
                      : "—"}
                  </span>
                </div>
                {governmentFormForLocale && (
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-muted-foreground font-medium">
                      {t("identityRowGovernmentForm")}
                    </span>
                    <span className="font-semibold text-foreground text-right">
                      {governmentFormForLocale}
                    </span>
                  </div>
                )}
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowCurrency")}
                  </span>
                  <span className="font-semibold text-foreground text-right">
                    {currencyNameForLocale || country.currencyCode || "—"}
                    {country.currencyCode && currencyNameForLocale
                      ? ` (${country.currencyCode})`
                      : ""}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowOfficialLanguages")}
                  </span>
                  <span className="font-semibold text-foreground text-right">
                    {officialLanguages && officialLanguages.length > 0
                      ? officialLanguages.join(", ")
                      : "—"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowContinentSubregion")}
                  </span>
                  <span className="font-semibold text-foreground text-right">
                    {continent} {isTr && country.unSubregionTr ? `· ${country.unSubregionTr}` : ""}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowIsoCodes")}
                  </span>
                  <span className="font-mono font-semibold text-foreground text-right">
                    {country.isoCode} {country.isoCodeAlpha3 ? `/ ${country.isoCodeAlpha3}` : ""}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">
                    {t("identityRowNeighbourCount")}
                  </span>
                  <span className="font-semibold text-foreground text-right">
                    {country.neighborCount === 0
                      ? isSpecialGeography
                        ? "0"
                        : t("identityIslandNeighbourValue")
                      : t("identityLandNeighbours", { count: country.neighborCount })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: KARA SINIRLARI VE KOMŞU ÜLKELER (EXPANSIVE FULL-WIDTH GRID) */}
      {showsNeighbourSection && (
        <section id="komsular" className="scroll-mt-28 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  {t("bordersRegionalBadge")}
                </Badge>
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <Globe className="size-6 text-primary shrink-0" />
                <span>
                  {sectionHeading("neighbors")}
                  {neighbors.length > 0 ? ` (${neighbors.length})` : ""}
                </span>
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {country.neighborCount === 0
                ? t("neighboursHelperIsland")
                : t("neighboursHelperWithNeighbours")}
            </span>
          </div>

          {country.neighborCount === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-border bg-card/60 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Waves className="size-6" />
              </div>
              <h3 className="font-heading font-bold text-lg text-foreground">
                {t("islandCountryHeading")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
                {t("islandCountryBody", { name })}
              </p>
              <div className="pt-2">
                <Link href="/dunya">
                  <Button variant="outline" size="sm" leftIcon={<Globe className="size-4" />}>
                    {t("islandCountryCta", { continent })}
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {neighbors.map((nb) => {
                const nbIsSpecialStatus = SPECIAL_STATUS_ISO_CODES.has(nb.iso.toUpperCase());
                // Same decision module as the subject country's own flag above — not a
                // second copy of the rule that happens to agree. Membership comes from the
                // ISO set because neighbours are resolved from the list endpoint, which
                // carries no `sovereigntyNoteTr`.
                const showsNeighbourFlag =
                  hasFlag(nb.iso) && showsCountryFlagForStatus(locale, nbIsSpecialStatus);
                return nb.kind === "link" ? (
                  <Link
                    key={nb.iso}
                    href={{ pathname: "/dunya/[slug]", params: { slug: nb.slug } }}
                    className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/60 hover:border-primary/40 transition-all group flex items-start justify-between gap-3 shadow-xs hover:shadow-md cursor-pointer"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {showsNeighbourFlag && (
                          /* eslint-disable-next-line @next/next/no-img-element -- Flag icon asset */
                          <img
                            src={`/flags/${nb.iso.toUpperCase()}.svg`}
                            alt={t("neighbourFlagAlt", { name: nb.label })}
                            width={22}
                            height={15}
                            className="w-5.5 h-3.5 object-cover rounded-xs border border-border shrink-0"
                          />
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                          #{nb.iso}
                        </span>
                        {nbIsSpecialStatus && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0"
                          >
                            {t("specialStatusBadge")}
                          </Badge>
                        )}
                      </div>
                      <div className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {nb.label}
                      </div>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-1" />
                  </Link>
                ) : (
                  <div
                    key={nb.iso}
                    className="p-4 rounded-2xl border border-border/60 bg-muted/30 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {showsNeighbourFlag && (
                          /* eslint-disable-next-line @next/next/no-img-element -- Flag icon asset */
                          <img
                            src={`/flags/${nb.iso.toUpperCase()}.svg`}
                            alt={t("neighbourFlagAlt", { name: nb.label })}
                            width={22}
                            height={15}
                            className="w-5.5 h-3.5 object-cover rounded-xs border border-border shrink-0"
                          />
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                          #{nb.iso}
                        </span>
                        {nbIsSpecialStatus && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0"
                          >
                            {t("specialStatusBadge")}
                          </Badge>
                        )}
                      </div>
                      <div className="font-heading font-medium text-sm text-muted-foreground truncate">
                        {nb.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* BOTTOM NAVIGATION ACTIONS */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Link href="/dunya">
          <Button variant="outline" size="sm" leftIcon={<Globe className="size-4" />}>
            ← Dünya Atlası&apos;na Dön (Tüm Ülkeler)
          </Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" leftIcon={<Home className="size-4" />}>
            Ana Sayfa
          </Button>
        </Link>
      </div>

      {/* NO SOURCES SECTION, AND THE OWNER'S QUESTION IS ANSWERED.
          This page ran TWO sources systems. The careful one is `sourcesMessage()` from
          `lib/geo/country-sources.ts` — guarded by ~15 assertions including the
          `EN_CONTENT_READY` tripwire, precise enough to drop the population clause entirely for
          the one country whose population is null rather than name a source that did not supply
          it, and rendered BESIDE the number it credits, in the population KPI above. The loose
          one was `V2SourcesSection`'s hand-written `dunya` list under the heading "Bu Sayfada
          Kullanılan Veri Setleri & Bilimsel Künye" — a stronger claim than the careful system
          ever makes, about institutions (the UN, the World Bank, the CIA World Factbook) whose
          data is traceable to nothing in this repo. The narrowing this page already did, by
          omitting `iho-gebco` and `usgs-nasa`, could not fix that.

          The careful one owns the page. The Natural Earth locator map keeps its own credit in
          `LocatorMap`'s `<figcaption>`, which names the layer it covers; the block repeated it
          less precisely. The "Kaynakça" chip is gone from the section nav with the anchor it
          pointed at — a nav entry for a section that does not exist is a broken link, and there
          is no honest replacement target: the credits are now where the numbers are. */}
    </>
  );
}
