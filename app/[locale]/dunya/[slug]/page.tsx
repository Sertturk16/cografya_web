import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { CardArrow } from "@/components/card-arrow";
import { CountryFlag } from "@/components/country/country-flag";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
import { LocatorMap } from "@/components/map/locator-map";
import { ProseNote } from "@/components/prose-note";
import {
  byIsoCode,
  getCountries,
  getCountryBySlug,
  getCountriesResilient,
} from "@/lib/api/countries";
import type { CountryDetail, CountryListItem } from "@/lib/api/types";
import { sourcesMessage } from "@/lib/geo/country-sources";
import { neighborCountryNameTr } from "@/lib/geo/neighbor-country-names";
import { isSpecialStatusRow, showsCountryFlag, showsSovereigntyNote } from "@/lib/geo/sovereignty";
import { showsSubregionCard } from "@/lib/geo/subregion";
import { COUNTRY_SHAPES } from "@/lib/map/world-countries.generated";
import { getPathname, Link } from "@/i18n/navigation";
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
import styles from "./country-detail.module.css";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

/** The localized slug (slug_tr for tr, slug_en for en) for a country. */
function slugForLocale(country: CountryDetail | CountryListItem, locale: Locale): string {
  return locale === "en" ? country.slugEn : country.slugTr;
}

/** Display name in the active locale (country DTOs carry both nameTr and nameEn). */
function nameForLocale(country: CountryDetail | CountryListItem, locale: Locale): string {
  return locale === "en" ? country.nameEn : country.nameTr;
}

/**
 * ISO 3166-1 alpha-2 → the country's own outline, for the locator mini-map.
 *
 * The artifact carries 240 shapes; 49 of them have no seeded page (Natural Earth backdrop
 * entities). Only the ONE shape this page needs reaches the HTML — the shared world
 * silhouette is a separate cached file (`/maps/world-countries.svg`). Built once at module
 * scope, not searched per render.
 */
const COUNTRY_SHAPE_BY_ISO = new Map(COUNTRY_SHAPES.map((shape) => [shape.iso, shape.d] as const));

/** One resolved neighbour: a seeded country (→ link) or an unseeded one (→ plain text). */
type Neighbor =
  | { kind: "link"; name: string; slug: string; iso: string }
  | { kind: "text"; name: string; iso: string };

// SSG the real countries; unknown slugs fall through to notFound() (never a soft-200),
// per CONVENTIONS §6 #6. Build-safe: if the api is unreachable during `next build` the
// list is empty and pages render on-demand via ISR at runtime.
export async function generateStaticParams() {
  const countries = await getCountriesResilient();
  return routing.locales.flatMap((locale) =>
    countries.map((country) => ({ locale, slug: slugForLocale(country, locale) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const country = await getCountryBySlug(slug);
  // Unknown slug → the page component throws notFound() (real 404, CONVENTIONS §6 #6).
  // Returning nothing bespoke here is deliberate: once notFound() fires Next resolves the
  // document title from the not-found boundary, so any title returned here is discarded.
  if (!country) return {};

  const t = await getTranslations({ locale, namespace: "CountryDetail" });
  const tContinents = await getTranslations({ locale, namespace: "Continents" });
  const name = nameForLocale(country, locale);
  const continent = tContinents(country.continent);

  // Meta description — a graceful fallback chain that guarantees at least one CONCRETE fact
  // in every country's snippet (SEO-POLICY §A2/#1, §B2.2): population → area → neighbour
  // count → capital → continent-only generic. The population tier additionally rotates
  // between three skeleton-distinct variants, keyed deterministically on the ISO code, so
  // the ~196-page corpus does not collapse to one masked sentence (§A2/#4, §B10.2). The
  // whole selection (chain order, the zero-neighbour guard, the rotation key) is a PURE
  // function, unit-tested in lib/seo/country-description. Every fact it can use is already
  // in the DTO and already visible in the fact sheet on BOTH locales — no api change, no
  // extra fetch, and no fact-sheet figure promised that the page does not render (§B2.6).
  // Special-status rows (`sovereigntyNoteTr`) short-circuit the rotation onto one fixed,
  // non-copula skeleton — see lib/geo/sovereignty.ts for why.
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
    // localized-slug alternates: slug_tr for tr, slug_en for en.
    hrefForLocale: (l) => ({
      pathname: "/dunya/[slug]",
      params: { slug: slugForLocale(country, l) },
    }),
    title: t("metaTitle", { name }),
    description: t(descriptionKey, descriptionParams),
    openGraphType: "article",
    // The narrative sections below are TR-gated (`isTr`), so the EN rendering is chrome
    // around a fact sheet — thin + near-identical across ~200 countries. `"trNarrative"`
    // makes EN `noindex, follow` and drops it from the hreflang cluster + sitemap until
    // real EN content lands (single switch: `EN_CONTENT_READY`, lib/seo/indexing.ts).
    surface: "trNarrative",
  });
}

export default async function CountryDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const country = await getCountryBySlug(slug);
  if (!country) {
    notFound();
  }

  const t = await getTranslations("CountryDetail");
  const tb = await getTranslations("Breadcrumb");
  const tContinents = await getTranslations("Continents");
  const format = await getFormatter();

  const isTr = locale === "tr";
  const name = nameForLocale(country, locale);
  const continent = tContinents(country.continent);
  const capital = locale === "en" ? country.capitalNameEn : country.capitalNameTr;
  // Population source credit for the Kaynaklar line — DATA-DRIVEN, never a web-side
  // constant (→ DEC 2026-08-05j). The api resolves the value: ordinary rows carry the
  // corpus-wide World Bank credit, the five exception rows (GL/CY/QN/TW/TR) carry the real
  // institution. NEVER add a `?? "Dünya Bankası"` fallback here — the contract names itself
  // the single source of truth, and a client-side default is precisely the mis-credit this
  // field exists to end. Names arrive already correct per locale and are never translated,
  // re-cased, or given an article by the web (the English article is inside the value).
  //
  // `null` arrives if and only if `population` is null (today: Antarktika alone). The line
  // then drops the population clause entirely rather than claiming an unknown source.
  // Which sentence, and with what interpolation — decided by the pure, tested helper in
  // `lib/geo/country-sources.ts` rather than inline, so the branch sits inside vitest's
  // `include` glob (→ PR #54 `TA54-M3`/`CR54-M3`).
  const sources = sourcesMessage(
    locale === "en" ? country.populationSourceNameEn : country.populationSourceNameTr,
  );
  const selfHref = {
    pathname: "/dunya/[slug]",
    params: { slug: slugForLocale(country, locale) },
  } as const;
  const path = getPathname({ locale, href: selfHref });

  // Neighbour cross-links (hub-and-spoke, CONVENTIONS §6 #10). Order + dedupe by the api's
  // `neighborIsoCodes`. A SEEDED neighbour resolves to a live country (→ a real link); an
  // UNSEEDED one is shown as PLAIN TEXT on TR (name from the sourced reference table) and
  // omitted on EN (no EN name available) — never a dead link (the unseeded-il-omit pattern,
  // relaxed to "show as text" for countries per the brief). Best-effort: a list-fetch
  // failure just hides the block rather than breaking the (already-loaded) detail page.
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
          name: nameForLocale(seeded, locale),
          slug: slugForLocale(seeded, locale),
          iso,
        });
      } else if (isTr) {
        const textName = neighborCountryNameTr(iso);
        if (textName) neighbors.push({ kind: "text", name: textName, iso });
      }
    }
  } catch (error) {
    console.warn(`[country:${slug}] neighbour resolution skipped: ${String(error)}`);
  }

  // schema.org PropertyValue facts — only the values the api actually has (null fields are
  // skipped, never invented). Labels come from i18n so JSON-LD and the visible fact sheet
  // stay in step. populationYear is null at world scale (owner ruling), so no year label.
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

  // Capital coordinates → GeoCoordinates (the il-merkez analogue). Precompute so TS narrows
  // cleanly (no non-null asserts).
  const geo =
    country.capitalLatitude !== null && country.capitalLongitude !== null
      ? { latitude: country.capitalLatitude, longitude: country.capitalLongitude }
      : null;

  // Giriş (intro). Layer 1: the hand-written `introTr` (genuine per-country prose) when
  // present, TR only (there is no `introEn` yet). Layer 2 (fallback, used on EN and on any
  // TR country with no `introTr`): a data-composed sentence carrying at least one locked
  // figure (population, then area), never a cross-country rank/superlative (unverifiable
  // from a partial seed). Continent-only is the honest last resort.
  const introText =
    isTr && country.introTr !== null
      ? country.introTr
      : country.population !== null
        ? t("introFallbackPopulation", { name, continent, population: country.population })
        : country.areaKm2 !== null
          ? t("introFallbackArea", { name, continent, area: country.areaKm2 })
          : t("introFallbackContinent", { name, continent });

  // Narrative fields carry raw Turkish content (…Tr fields) with no EN counterpart yet, so
  // — mirroring the province page — they are TR-gated until Faz-3 EN content lands.
  const landformNote = isTr ? country.landformNoteTr : null;
  const climateNote = isTr ? country.climateNoteTr : null;
  const independenceNote = isTr ? country.independenceNoteTr : null;
  const hydrographyNote = isTr ? country.hydrographyNoteTr : null;

  // §19 section-heading entity name: each content <h2> carries the country name so ~196
  // pages don't share one bare-generic heading skeleton (SEO-POLICY §A3/§B3.4). The locale
  // gate (EN gets the BARE name — the PR #16 regression class, never a Turkish suffix on an
  // English heading) and the per-section genitive/locative split both live in the pure,
  // unit-tested `lib/text/heading-name`; this just reads that single source of truth. The
  // "Temel Bilgiler" heading deliberately stays plain (→ DEC 2026-07-20c K1, by analogy with
  // the province page) and is not in the map.
  //
  // EXCEPTION — special-status rows keep the PLAIN heading in every section (one row-level
  // condition, not a per-section list): an entity-named H2 is built to be independently
  // extractable, which on a contested row reads as a standalone possessive assertion over
  // prose that deliberately hedges (e.g. island-wide hydrography, or a neighbour list whose
  // mandated explanatory note is not rendered yet). Rationale + the trade this costs:
  // lib/geo/sovereignty.ts. This also gates the `independence` slot, which would otherwise
  // ship "X'in Bağımsızlığı" as an H2 the moment a content wave fills independenceNoteTr.
  const entityNamedHeadings = !isSpecialStatusRow(country.sovereigntyNoteTr);
  const sectionHeading = (slot: CountryHeadingSlot): string =>
    entityNamedHeadings
      ? t(COUNTRY_HEADING_KEY[slot].named, {
          name: headingName(locale, name, COUNTRY_HEADING_CASE[slot]),
        })
      : t(COUNTRY_HEADING_KEY[slot].plain);

  // Egemenlik ve Tanınma — the api's `sovereigntyNoteTr`, the owner's verbatim framing for a
  // contested row (seed docblock: "transcribed VERBATIM"). The web only renders it: no
  // editing, no shortening, no re-paragraphing. `ProseNote` applies the "\n\n" convention as
  // it stands, so Filistin's three-paragraph note arrives as three <p>.
  //
  // ONE decision, TWO consumers (→ DEC 2026-08-08l B2, path (a)): this same gate also
  // decides whether the flag card renders on a special-status row, so the visual claim and
  // the text that balances it can never appear apart. The reasoning — including why symmetric
  // absence on EN is not the asymmetry DEC 2026-08-08c md.2 condemned — is in
  // lib/geo/sovereignty.ts, the single decision place. Ordinary rows are untouched: 193
  // countries keep their flag in both locales.
  const sovereigntyNote = showsSovereigntyNote(locale, country.sovereigntyNoteTr)
    ? country.sovereigntyNoteTr
    : null;
  const showsFlag = showsCountryFlag(locale, country.sovereigntyNoteTr);

  const officialLanguages = isTr ? country.officialLanguagesTr : null;
  // Ö1-B locator mini-map: this country's own outline from the committed artifact. The map
  // makes NO new political claim — it draws exactly the shape `/dunya` already draws
  // (Natural Earth de-facto, CY and QN separate, → DEC 2026-07-13).
  const countryShapeD = COUNTRY_SHAPE_BY_ISO.get(country.isoCode);

  return (
    <div className="container page">
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
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("dunya"), href: "/dunya" },
          { label: name, href: selfHref },
        ]}
      />
      <h1>{t("heading", { name })}</h1>
      {/* EN only, and only because every narrative section below is TR-gated (→ DEC
          2026-08-04i §4). Renders nothing on Turkish. */}
      <EnWorkInProgressNotice locale={locale} />
      <p className="lede">{introText}</p>

      <section className="section">
        <h2>{t("keyFactsHeading")}</h2>
        <dl className={styles.factSheet}>
          <div className={styles.fact}>
            <dt>{t("continent")}</dt>
            <dd>{continent}</dd>
          </div>
          {/* The UN M49 subregion, suppressed when it would just repeat the continent card
              beside it (UX tour B28). Brezilya printed "Kıta: Güney Amerika" and "Bölge:
              Güney Amerika" side by side, which reads as a rendering fault rather than as
              two facts that happen to coincide — and for a whole continent's worth of
              countries the two levels genuinely do coincide in M49.

              The rule (and why it is exact equality rather than a folded comparison) lives in
              `lib/geo/subregion.ts`; the cross-vocabulary coupling it depends on — catalogue
              value vs api field — is pinned in its test, so a catalogue rename cannot silently
              restore the duplicate card (→ PR #47 review CR-M1).

              Structured data is unaffected: `countryJsonLd` uses `containedInPlace:
              continent` and never reads `unSubregionTr`, so nothing in the JSON-LD describes
              a card this can hide. */}
          {isTr && showsSubregionCard(continent, country.unSubregionTr) && (
            <div className={styles.fact}>
              <dt>{t("subregion")}</dt>
              <dd>{country.unSubregionTr}</dd>
            </div>
          )}
          {capital !== null && (
            <div className={styles.fact}>
              <dt>{t("capital")}</dt>
              <dd>{capital}</dd>
            </div>
          )}
          {country.population !== null && (
            <div className={styles.fact}>
              <dt>{t("population")}</dt>
              <dd>{format.number(country.population)}</dd>
            </div>
          )}
          {country.areaKm2 !== null && (
            <div className={styles.fact}>
              <dt>{t("area")}</dt>
              <dd>
                {format.number(country.areaKm2)} {t("areaUnit")}
              </dd>
            </div>
          )}
          <div className={styles.fact}>
            <dt>{t("neighborCount")}</dt>
            <dd>{format.number(country.neighborCount)}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{t("isoCode")}</dt>
            <dd>
              {country.isoCodeAlpha3 !== null
                ? `${country.isoCode} / ${country.isoCodeAlpha3}`
                : country.isoCode}
            </dd>
          </div>
          {isTr && officialLanguages !== null && officialLanguages.length > 0 && (
            <div className={styles.fact}>
              <dt>{officialLanguages.length > 1 ? t("languagePlural") : t("language")}</dt>
              <dd>{officialLanguages.join(", ")}</dd>
            </div>
          )}
          {isTr && country.currencyNameTr !== null && (
            <div className={styles.fact}>
              <dt>{t("currency")}</dt>
              <dd>
                {country.currencyCode !== null
                  ? t("currencyValue", { name: country.currencyNameTr, code: country.currencyCode })
                  : country.currencyNameTr}
              </dd>
            </div>
          )}
          {isTr && country.governmentFormTr !== null && (
            <div className={styles.fact}>
              <dt>{t("governmentForm")}</dt>
              <dd>{country.governmentFormTr}</dd>
            </div>
          )}
          {/* G2 — the flag, as one more card in the existing auto-fill rhythm. On an ORDINARY
              row it is not TR-gated: a flag is data, not a narrative that needs translating
              (the same reasoning as the marine block). On a SPECIAL-STATUS row it is gated on
              `showsFlag`, which is the sovereignty note's own gate — the visual claim never
              stands without the text that balances it (→ DEC 2026-08-08h / 08-08l B2).
              Renders nothing when the row has no asset — see
              components/country/country-flag.tsx for what that currently means for QN. */}
          {showsFlag && (
            <CountryFlag
              isoCode={country.isoCode}
              label={t("flag")}
              alt={t("flagAlt", { name })}
              className={styles.fact}
            />
          )}
        </dl>
      </section>

      {/* Egemenlik ve Tanınma — between the two visual claims on this page (the flag inside
          Temel Bilgiler, and the locator map's highlight below), which is the only ordering
          that applies DEC 2026-08-08h's wording to the page flow: the reader meets the flag,
          reads what grounds it, and only then meets the second visual. Present on the six
          special-status rows and nowhere else; the section is ADDED, no existing section is
          re-ordered. Plain, entity-free heading by ruling (→ DEC 2026-08-08l B1). */}
      {sovereigntyNote !== null && (
        <section className="section">
          <h2>{t("sovereigntyHeading")}</h2>
          <ProseNote text={sovereigntyNote} className={styles.prose} />
        </section>
      )}

      {/* Ö1-B — the world counterpart of the province locator, in the same slot: right after
          the fact sheet, before the narrative sections. Absent (never a placeholder) if the
          ISO code has no artifact shape; all 191 seeded codes resolve today (measured
          2026-08-08), so this is a defence line rather than a known gap. */}
      {countryShapeD !== undefined && (
        <section className="section">
          <h2>{sectionHeading("location")}</h2>
          <LocatorMap
            kind="country"
            locale={locale}
            d={countryShapeD}
            alt={t("locationAlt", { name })}
          />
        </section>
      )}

      {/* Yeryüzü Şekilleri — TR-gated prose (genuine per-country relief narrative). */}
      {landformNote !== null && (
        <section className="section">
          <h2>{sectionHeading("landform")}</h2>
          <ProseNote text={landformNote} className={styles.prose} />
        </section>
      )}

      {/* İklim — TR-gated NARRATIVE prose (no structured Köppen field at country scale,
          owner ruling → DEC 2026-07-13): regional climate variation described in words. */}
      {climateNote !== null && (
        <section className="section">
          <h2>{sectionHeading("climate")}</h2>
          <ProseNote text={climateNote} className={styles.prose} />
        </section>
      )}

      {/* Hidrografya — TR-gated prose (rivers/lakes/seas narrative). The field is in the
          committed OpenAPI contract, so it is read directly; the section stays conditional
          because a country may legitimately have no note. */}
      {hydrographyNote !== null && (
        <section className="section">
          <h2>{sectionHeading("hydrography")}</h2>
          <ProseNote text={hydrographyNote} className={styles.prose} />
        </section>
      )}

      {/* Bağımsızlık — TR-gated free-text note; null (omitted) for continuous states like
          İran where a colonial-independence date is inapplicable. */}
      {independenceNote !== null && (
        <section className="section">
          <h2>{sectionHeading("independence")}</h2>
          <ProseNote text={independenceNote} className={styles.prose} />
        </section>
      )}

      {neighbors.length > 0 && (
        <section className="section">
          <h2>{sectionHeading("neighbors")}</h2>
          <ul role="list" className="province-grid">
            {neighbors.map((neighbor) =>
              neighbor.kind === "link" ? (
                <li key={neighbor.iso}>
                  <Link
                    className="province-card"
                    href={{ pathname: "/dunya/[slug]", params: { slug: neighbor.slug } }}
                  >
                    <span>{neighbor.name}</span>
                    <CardArrow />
                  </Link>
                </li>
              ) : (
                <li key={neighbor.iso}>
                  {/* Unseeded neighbour: plain text, NOT a link (no page yet). */}
                  <span className={styles.neighborTextCard}>{neighbor.name}</span>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      <p className={styles.sources}>
        <span className={styles.sourcesLabel}>{t("sourcesLabel")}:</span>{" "}
        {sources.key === "sources" ? t("sources", sources.values) : t("sourcesNoPopulation")}
      </p>

      <p className="section">
        <Link href="/dunya">← {t("backToMap")}</Link>
      </p>
    </div>
  );
}
