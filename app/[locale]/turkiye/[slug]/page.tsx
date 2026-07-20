import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { ClimateSection } from "@/components/climate/climate-section";
import { ProseNote } from "@/components/prose-note";
import {
  byPlateCode,
  getProvinceBySlug,
  getProvinces,
  getProvincesResilient,
} from "@/lib/api/provinces";
import type { HydrographyFeature, ProvinceDetail, ProvinceListItem } from "@/lib/api/types";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { monthName } from "@/lib/climate/month";
import { administrativeAreaJsonLd, type GeoPropertyValue, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  CLIMATE_DESCRIPTION_KEY,
  provinceDescriptionVariant,
} from "@/lib/seo/province-description";
import styles from "./province-detail.module.css";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

/** Hidrografya feature-group render order (baraj → nehir → göl). */
const HYDROGRAPHY_TYPE_ORDER = ["baraj", "nehir", "gol"] as const;

/** The localized slug (slug_tr for tr, slug_en for en) for a province. */
function slugForLocale(province: ProvinceDetail | ProvinceListItem, locale: Locale): string {
  return locale === "en" ? province.slugEn : province.slugTr;
}

// SSG the real provinces; unknown slugs fall through to notFound() (never a
// soft-200), per CONVENTIONS §6 #6. Build-safe: if the api is unreachable during
// `next build` the list is empty and pages render on-demand via ISR at runtime.
export async function generateStaticParams() {
  const provinces = await getProvincesResilient();
  return routing.locales.flatMap((locale) =>
    provinces.map((province) => ({ locale, slug: slugForLocale(province, locale) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const province = await getProvinceBySlug(slug);
  // Unknown slug → the page component throws notFound() (real 404, CONVENTIONS §6 #6).
  // Returning nothing bespoke here is deliberate: once notFound() fires Next resolves
  // the document title from the not-found boundary, so any title returned here is
  // discarded (see not-found.tsx for the full rationale).
  if (!province) return {};

  const t = await getTranslations({ locale, namespace: "ProvinceDetail" });
  const tRegions = await getTranslations({ locale, namespace: "Regions" });
  const name = province.nameTr;
  const region = tRegions(province.region);

  // Meta description — three skeleton-distinct variants rotated deterministically by
  // plate code (PLAN §2 / SEO-POLICY §B10), with a graceful fallback chain:
  // climate fact → population/area fact → the existing region-only generic. The
  // climate tier is TR-gated (mirrors the TR-gated visible climate section: EN detail
  // pages are noindex and show no climate, so their description never claims one).
  const climateForMeta = locale === "tr" ? province.climate : null;
  let description: string;
  if (climateForMeta !== null) {
    const variant = provinceDescriptionVariant(province.plateCode);
    const derived = climateForMeta.derived;
    description = t(CLIMATE_DESCRIPTION_KEY[variant], {
      name,
      region,
      temp: derived.annualMeanTempC,
      // Integer mm reads cleaner in a snippet than a raw 1-decimal figure; the exact
      // value stays on the page (chart + table). ICU formats it per locale.
      precip: Math.round(derived.annualPrecipitationMm),
    });
  } else if (province.population !== null) {
    description = t("metaDescriptionPopulation", { name, region, population: province.population });
  } else if (province.areaKm2 !== null) {
    description = t("metaDescriptionArea", { name, region, area: province.areaKm2 });
  } else {
    description = t("metaDescription", { name, region });
  }

  return buildMetadata({
    locale,
    // localized-slug alternates: slug_tr for tr, slug_en for en.
    hrefForLocale: (l) => ({
      pathname: "/turkiye/[slug]",
      params: { slug: slugForLocale(province, l) },
    }),
    title: t("metaTitle", { name }),
    description,
    openGraphType: "article",
    // Same TR-gating as the country page (intro/landform/climate/hydrography/settlement/
    // economy are all `isTr`), so the EN province page is chrome-only. See
    // `lib/seo/indexing.ts` for the policy and the single revert switch.
    surface: "trNarrative",
  });
}

export default async function ProvinceDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const province = await getProvinceBySlug(slug);
  if (!province) {
    notFound();
  }

  const t = await getTranslations("ProvinceDetail");
  const tb = await getTranslations("Breadcrumb");
  const tRegions = await getTranslations("Regions");
  const tClimate = await getTranslations("Climate");
  const format = await getFormatter();

  // `nameTr` serves both locales: province names are proper nouns and the contract
  // has no `nameEn` yet (Faz-3). Region + all chrome/labels ARE localized (i18n).
  const name = province.nameTr;
  const region = tRegions(province.region);
  const selfHref = {
    pathname: "/turkiye/[slug]",
    params: { slug: slugForLocale(province, locale) },
  } as const;
  const path = getPathname({ locale, href: selfHref });

  // Neighbour cross-links (hub-and-spoke, CONVENTIONS §6 #10). Resolve each
  // neighbour plaka code to a province that actually has a page; codes without a
  // published page are omitted (never rendered as a dead link). Best-effort: the
  // block is progressive enhancement, so a list-fetch failure just hides it
  // rather than breaking the (already-loaded) detail page.
  // The same list also feeds the "benzer iklimli iller" block below, so it is fetched
  // ONCE and reused — no second request (zero build-time-request hard constraint, PLAN
  // §5 risk 6). climateKoppen was added to the list DTO in A2 exactly for this.
  let neighbors: ProvinceListItem[] = [];
  let similarClimate: ProvinceListItem[] = [];
  try {
    const all = await getProvinces();
    const byCode = byPlateCode(all);
    neighbors = province.neighborPlateCodes
      .map((code) => byCode.get(code))
      .filter((p): p is ProvinceListItem => p !== undefined);
    // Benzer iklimli iller (PLAN §2): same Köppen code, published (= present in the
    // list, i.e. has a page), self excluded, plate-code order, capped at 5. "Same
    // Köppen code" is a symmetric relation, so each target links back here → the
    // hub-and-spoke reciprocity (SEO-POLICY A4/#2) holds structurally, for free.
    // NOTE: anchor text is province-name only. The plan's "+ annual mean °C" needs a
    // field the list DTO does not carry yet (annual mean is detail-only); adding a
    // second fetch would break the zero-request rule, so the °C is deferred to a
    // list-DTO contract addition (surfaced in the closing summary).
    if (province.climateKoppen !== null) {
      const koppen = province.climateKoppen;
      similarClimate = all
        .filter((p) => p.climateKoppen === koppen && p.plateCode !== province.plateCode)
        .sort((a, b) => Number(a.plateCode) - Number(b.plateCode))
        .slice(0, 5);
    }
  } catch (error) {
    console.warn(`[province:${slug}] province-list cross-links skipped: ${String(error)}`);
  }

  // schema.org PropertyValue facts — only the values the api actually has (null
  // fields are skipped, never invented). Labels come from i18n so JSON-LD and the
  // visible fact sheet stay in step.
  const additionalProperty: GeoPropertyValue[] = [];
  if (province.population !== null) {
    additionalProperty.push({
      name: province.populationYear
        ? t("populationWithYear", { year: province.populationYear })
        : t("population"),
      value: province.population,
    });
  }
  if (province.areaKm2 !== null) {
    additionalProperty.push({
      name: t("area"),
      value: province.areaKm2,
      unitText: t("areaUnit"),
      unitCode: "KMK",
    });
  }
  if (province.districtCount !== null) {
    additionalProperty.push({ name: t("districtCount"), value: province.districtCount });
  }
  // Nüfus yoğunluğu — server-computed (round(nüfus/yüzölçümü)); consumed as-is so
  // the rounding/null rule stays single-sourced in the api. Kept in step with the
  // visible fact-sheet row below (both derive from the same DTO field + i18n label).
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

  // Precompute nullable-field bundles so TS narrows cleanly (no non-null asserts).
  const geo =
    province.latitude !== null && province.longitude !== null
      ? { latitude: province.latitude, longitude: province.longitude }
      : null;
  const climate =
    province.climateClassTr !== null && province.climateKoppen !== null
      ? { className: province.climateClassTr, koppen: province.climateKoppen }
      : null;

  // Giriş (intro) — SPEC §3.3. Layer 1: the hand-written `introTr` (genuine
  // per-province prose) when present. It is Turkish and there is no `introEn` yet
  // (Faz-3), so — like the climate block — the EN page never shows it and always
  // uses the composed fallback (English chrome + the province's own locked numbers).
  // Layer 2 (fallback, used everywhere today since `introTr` is null): a data-
  // composed sentence that breaks the old pure-copula template ("X, Y Bölgesi'nde
  // yer alan bir ildir") by carrying at least one differentiating LOCKED number.
  // It states only the province's OWN figures (population, then area) and NEVER a
  // cross-province national rank/superlative: a national rank cannot be verified
  // from a partial seed without inventing a data source the api does not provide
  // (CONVENTIONS §4/§6 — the api is the single source of truth; nothing invented
  // client-side). A verified superlative like "en kalabalık il" belongs in a
  // written `introTr` (Layer 1), not here. Region-only is the honest last resort
  // for a province with no numeric facts at all (none today — all 14 have pop.).
  const introText =
    locale === "tr" && province.introTr !== null
      ? province.introTr
      : province.population !== null
        ? province.populationYear !== null
          ? t("introFallbackPopulationYear", {
              name,
              region,
              population: province.population,
              year: province.populationYear,
            })
          : t("introFallbackPopulation", { name, region, population: province.population })
        : province.areaKm2 !== null
          ? t("introFallbackArea", { name, region, area: province.areaKm2 })
          : t("introFallbackRegion", { name, region });

  // New prose/structured sections carry raw Turkish content (…Tr fields, Turkish
  // labels) with no EN counterpart yet, so — mirroring the climate block — they are
  // TR-gated until Faz-3 EN content lands. All these fields are null for every
  // province today, so nothing new renders yet; the mechanism is ready for content.
  const isTr = locale === "tr";
  // The landform note IS the whole section, so hoist the TR-gated, narrowed value
  // once: it both gates the section and feeds <ProseNote> as a plain `string`
  // (aliased null-check narrowing). Hydrography/settlement narrow at their own inner
  // note guards instead, because those sections can also render for non-note reasons.
  const landformNote = isTr ? province.landformNoteTr : null;
  const showLandform = landformNote !== null;
  const hydrographyFeatures = province.hydrographyFeatures;
  const showHydrography =
    isTr && (province.hydrographyNoteTr !== null || hydrographyFeatures !== null);
  const showSettlement =
    isTr &&
    (province.settlementNoteTr !== null ||
      province.urbanizationRate !== null ||
      province.netMigrationRate !== null);
  const economyIndicator = province.economyIndicator;
  const showEconomy = isTr && economyIndicator !== null;
  // İklim grafiği/tablosu (W1) — the full MGM k=A series. TR-gated (EN detail pages are
  // noindex and have no climate caveat text, SEO-POLICY §6). `climate === null` on the DTO
  // means "no publishable series" → the whole chart/table/source line is absent, and its
  // MGM source is NOT added to the page's Kaynaklar line (no source for absent content).
  // The NOVA narrative slot ships wired but empty (climateNarrativeTr is null for all 81).
  const climateSeries = isTr ? province.climate : null;
  const climateNarrative = isTr ? province.climateNarrativeTr : null;
  // Benzer iklimli iller — TR-gated like the rest of the climate content (the block's
  // labels/intro are Turkish and it belongs inside the TR-only İklim section).
  const showSimilarClimate = isTr && similarClimate.length > 0;
  // The İklim <h2> renders when the Köppen class line, the series, OR the similar-
  // climate cross-links are present (so the block always has a heading to live under).
  const showClimateSection =
    isTr && (climate !== null || climateSeries !== null || showSimilarClimate);

  // JSON-LD climate facts — appended to the SAME additionalProperty array (PLAN §2: no
  // new schema type). Gated on the TR-gated series so structured data never describes a
  // climate section that is not on the page (mirrors the visible gating). Values stay
  // RAW numbers (machine-readable); month names come from the shared formatter helper.
  if (climateSeries !== null) {
    const d = climateSeries.derived;
    additionalProperty.push(
      {
        name: tClimate("annualMeanTemp"),
        value: d.annualMeanTempC,
        unitText: tClimate("axisTempUnit"),
        unitCode: "CEL",
      },
      {
        name: tClimate("annualPrecip"),
        value: d.annualPrecipitationMm,
        unitText: tClimate("axisPrecipUnit"),
        unitCode: "MMT",
      },
      { name: tClimate("hottestMonth"), value: monthName(format, d.hottestMonth, "long") },
      { name: tClimate("coldestMonth"), value: monthName(format, d.coldestMonth, "long") },
    );
  }

  const hydrographyTypeLabels: Record<HydrographyFeature["type"], string> = {
    baraj: t("hydrographyTypeBaraj"),
    nehir: t("hydrographyTypeNehir"),
    gol: t("hydrographyTypeGol"),
  };

  // Kaynaklar (E-E-A-T provenance) is expanded with the per-section authorities
  // ONLY for sections that actually rendered — so a source is never cited for
  // content that is not on the page. Empty today (no new section renders) → the
  // base sources line is shown unchanged.
  const extraSources: string[] = [];
  if (showLandform) extraSources.push(t("sourcesLandform"));
  // Climate normals source joins the Kaynaklar line ONLY when the chart actually renders
  // (PLAN §2 — never cite a source for content that is not on the page).
  if (climateSeries !== null) extraSources.push(t("sourcesClimate"));
  if (showHydrography) extraSources.push(t("sourcesHydrography"));
  if (showEconomy) extraSources.push(t("sourcesEconomy"));

  return (
    <div className="container page">
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
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("turkiye"), href: "/turkiye" },
          { label: name, href: selfHref },
        ]}
      />
      <h1>{t("heading", { name })}</h1>
      <p className="lede">{introText}</p>

      <section className="section">
        <h2>{t("keyFactsHeading")}</h2>
        <dl className={styles.factSheet}>
          <div className={styles.fact}>
            <dt>{t("region")}</dt>
            <dd>{region}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{t("plateCode")}</dt>
            <dd>{province.plateCode}</dd>
          </div>
          {province.population !== null && (
            <div className={styles.fact}>
              <dt>
                {province.populationYear
                  ? t("populationWithYear", { year: province.populationYear })
                  : t("population")}
              </dt>
              <dd>{format.number(province.population)}</dd>
            </div>
          )}
          {province.areaKm2 !== null && (
            <div className={styles.fact}>
              <dt>{t("area")}</dt>
              <dd>
                {format.number(province.areaKm2)} {t("areaUnit")}
              </dd>
            </div>
          )}
          {province.districtCount !== null && (
            <div className={styles.fact}>
              <dt>{t("districtCount")}</dt>
              <dd>{format.number(province.districtCount)}</dd>
            </div>
          )}
          {province.elevationM !== null && (
            <div className={styles.fact}>
              <dt>{t("elevation")}</dt>
              <dd>
                {format.number(province.elevationM)} {t("elevationUnit")}
              </dd>
            </div>
          )}
          {geo && (
            <div className={styles.fact}>
              <dt>{t("coordinates")}</dt>
              <dd>
                {geo.latitude}, {geo.longitude}
              </dd>
            </div>
          )}
          {/* Nüfus yoğunluğu — derived, renders today (server-computed from the two
              locked values); "≈" flags the rounding. (SPEC §3.1 #3 / §4.2.) */}
          {province.populationDensity !== null && (
            <div className={styles.fact}>
              <dt>{t("populationDensity")}</dt>
              <dd>
                ≈ {format.number(province.populationDensity)} {t("populationDensityUnit")}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Yeryüzü Şekilleri — TR-gated prose; absent until landformNoteTr is filled. */}
      {showLandform && (
        <section className="section">
          <h2>{t("landformHeading")}</h2>
          <ProseNote text={landformNote} className={styles.prose} />
        </section>
      )}

      {/* Climate is TR-only until Faz-3 (mirrors the EN-content comment in
          app/sitemap.ts). The class name (climateClassTr) and the MANDATORY MGM
          methodological caveat (climateNoteTr) are untranslated Turkish, and §6
          forbids shipping a bare Köppen code without that caveat (esp. Van/Ankara,
          where a lone "Csa" misinforms). So the whole climate block defers to Faz-3
          on EN — with no English caveat available, a caveat-less code is not shown.
          Full EN (climateEn contract + values) is a tracked Faz-3 prerequisite. */}
      {showClimateSection && (
        <section className="section">
          <h2>{t("climateHeading")}</h2>
          {climate && (
            <>
              <p className={styles.climateValue}>
                {province.climateNoteTr !== null
                  ? t("climateValue", { className: climate.className, koppen: climate.koppen })
                  : /* Defense-in-depth (§6 "no bare Csa"): if the mandatory caveat is
                       absent (a contract violation the api already guards), show the
                       class name only — never a caveat-less Köppen code. */
                    t("climateClassOnly", { className: climate.className })}
              </p>
              {/* The caveat stays MANDATORY and its text is never trimmed, but per the
                  owner's UX ruling it renders collapsed (progressive disclosure) so it
                  is present in full + crawlable without being the page's narrative wall
                  (see province-detail.module.css .climateNote). It stays FIRST — do not
                  touch (2026-07-11 owner UX ruling). */}
              {province.climateNoteTr !== null && (
                <details className={styles.climateNote}>
                  <summary className={styles.climateNoteSummary}>{t("climateNoteLabel")}</summary>
                  <p className={styles.climateNoteBody}>{province.climateNoteTr}</p>
                </details>
              )}
            </>
          )}
          {/* NOVA's per-province climate interpretation (PLAN §2 — the reader arrives at
              the prose, the chart is the evidence). Slot ships wired but empty:
              climateNarrativeTr is null for all 81 today, so nothing renders yet. */}
          {climateNarrative !== null && (
            <ProseNote text={climateNarrative} className={styles.prose} />
          )}
          {/* Sıcaklık ve Yağış Grafiği — new <h3> INSIDE this <h2> (no new sibling <h2>).
              Only when a publishable series exists. */}
          {climateSeries !== null && (
            <ClimateSection
              climate={climateSeries}
              provinceName={name}
              plateCode={province.plateCode}
              locale={locale}
            />
          )}
          {/* Benzer İklime Sahip İller — new <h3> INSIDE this <h2> (no new sibling <h2>).
              Same Köppen code, published, plate-code order, max 5. Hub-and-spoke same-
              climate cross-links (CONVENTIONS §6 #10). Uses the shared province-grid
              card (same as Komşu İller). */}
          {showSimilarClimate && (
            <div className={styles.similarClimate}>
              <h3 className={styles.similarClimateHeading}>{t("similarClimateHeading")}</h3>
              {province.climateKoppen !== null && (
                <p className={styles.similarClimateIntro}>
                  {t("similarClimateIntro", { koppen: province.climateKoppen })}
                </p>
              )}
              <ul className="province-grid">
                {similarClimate.map((similar) => (
                  <li key={similar.plateCode}>
                    <Link
                      className="province-card"
                      href={{
                        pathname: "/turkiye/[slug]",
                        params: { slug: slugForLocale(similar, locale) },
                      }}
                    >
                      <span>{similar.nameTr}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Hidrografya — TR-gated; prose note and/or a structured feature list. An
          empty (non-null) feature list is a deliberate "no significant water" fact
          (api: null = not researched, [] = none), shown as such. Null today. */}
      {showHydrography && (
        <section className="section">
          <h2>{t("hydrographyHeading")}</h2>
          {province.hydrographyNoteTr !== null && (
            <ProseNote text={province.hydrographyNoteTr} className={styles.prose} />
          )}
          {hydrographyFeatures !== null &&
            (hydrographyFeatures.length > 0 ? (
              HYDROGRAPHY_TYPE_ORDER.map((type) => {
                const items = hydrographyFeatures.filter((feature) => feature.type === type);
                if (items.length === 0) return null;
                return (
                  <div key={type} className={styles.hydroGroup}>
                    <h3 className={styles.hydroGroupHeading}>{hydrographyTypeLabels[type]}</h3>
                    <ul className={styles.hydroList}>
                      {items.map((feature) => (
                        <li key={feature.name}>{feature.name}</li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : (
              <p className={styles.prose}>{t("hydrographyNone")}</p>
            ))}
        </section>
      )}

      {/* Nüfus ve Yerleşme — TR-gated. Quick-facts stat cards first (şehirleşme /
          net göç), then the settlement-note narrative that puts them in context —
          one clean scan-then-read flow, no prose stranded above the cards. The
          derived density is deliberately NOT repeated here as a standalone lead-in
          sentence: it already shows as a Temel Bilgiler card and is referenced with
          fuller context inside settlementNoteTr itself. Gated on the narrative
          fields (density alone already shows in Temel Bilgiler), so the section
          stays absent until real settlement content lands. */}
      {showSettlement && (
        <section className="section">
          <h2>{t("settlementHeading")}</h2>
          {(province.urbanizationRate !== null || province.netMigrationRate !== null) && (
            <dl className={styles.factSheet}>
              {province.urbanizationRate !== null && (
                <div className={styles.fact}>
                  <dt>{t("urbanizationRate")}</dt>
                  <dd>{t("urbanizationRateValue", { value: province.urbanizationRate })}</dd>
                </div>
              )}
              {province.netMigrationRate !== null && (
                <div className={styles.fact}>
                  <dt>{t("netMigrationRate")}</dt>
                  <dd>{t("netMigrationRateValue", { value: province.netMigrationRate })}</dd>
                </div>
              )}
            </dl>
          )}
          {province.settlementNoteTr !== null && (
            <ProseNote text={province.settlementNoteTr} className={styles.prose} />
          )}
        </section>
      )}

      {/* Ekonomik Coğrafya — TR-gated; exactly ONE TÜİK-anchored structured stat
          (never free marketing prose). Absent until economyIndicator is filled.
          `showEconomy` (= isTr && economyIndicator !== null) narrows the field to
          non-null here via aliased-condition narrowing, so it stays the single
          source of truth for "does economy render" (also drives extraSources). */}
      {showEconomy && (
        <section className="section">
          <h2>{t("economyHeading")}</h2>
          <dl className={styles.economyStat}>
            <dt className={styles.economyLabel}>{economyIndicator.label}</dt>
            <dd className={styles.economyValue}>{economyIndicator.value}</dd>
            <dd className={styles.economyMeta}>
              {economyIndicator.source} · {economyIndicator.year}
            </dd>
          </dl>
        </section>
      )}

      {neighbors.length > 0 && (
        <section className="section">
          <h2>{t("neighborsHeading")}</h2>
          <ul className="province-grid">
            {neighbors.map((neighbor) => (
              <li key={neighbor.plateCode}>
                <Link
                  className="province-card"
                  href={{
                    pathname: "/turkiye/[slug]",
                    params: { slug: slugForLocale(neighbor, locale) },
                  }}
                >
                  <span>{neighbor.nameTr}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.sources}>
        <span className={styles.sourcesLabel}>{t("sourcesLabel")}:</span> {t("sources")}
        {extraSources.length > 0 && <> {t("sourcesExtra", { list: extraSources.join("; ") })}</>}
      </p>

      <p className="section">
        <Link href="/turkiye">← {t("backToMap")}</Link>
      </p>
    </div>
  );
}
