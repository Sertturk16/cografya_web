import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { CardArrow } from "@/components/card-arrow";
import { ClimateSection } from "@/components/climate/climate-section";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
import { LocatorMap } from "@/components/map/locator-map";
import { RegionDot } from "@/components/province/region-dot";
import { MarineAttribution } from "@/components/marine/marine-attribution";
import { ProvinceMarineSection } from "@/components/marine/province-marine-section";
import { ProseNote } from "@/components/prose-note";
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
import type { HydrographyFeature, ProvinceDetail, ProvinceListItem } from "@/lib/api/types";
import { isCoastalPlate, provinceMarineBlocks, provinceShowsMarine } from "@/lib/marine/coastal";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { climateBlockGates } from "@/lib/climate/climate-block-gates";
import { monthName } from "@/lib/climate/month";
import { selectSimilarClimateProvinces } from "@/lib/climate/similar-climate";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { administrativeAreaJsonLd, type GeoPropertyValue, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  selectProvinceMetaDescription,
  selectProvinceMetaTitle,
} from "@/lib/seo/province-description";
import { headingName, PROVINCE_HEADING_CASE } from "@/lib/text/heading-name";
import styles from "./province-detail.module.css";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

/** Hidrografya feature-group render order (baraj → nehir → göl). */
const HYDROGRAPHY_TYPE_ORDER = ["baraj", "nehir", "gol"] as const;

/**
 * Plaka kodu → the province's own outline, for the locator mini-map.
 *
 * The whole 81-shape artifact is imported here, but ONLY this province's `d` reaches the
 * HTML (≈ 0.7 KB gzip); the base silhouette every page shares is a separate cached file
 * (`/maps/tr-provinces.svg`). Built once at module scope rather than searched per render.
 */
const PROVINCE_SHAPE_BY_PLATE = new Map(
  PROVINCE_SHAPES.map((shape) => [shape.plateCode, shape.d] as const),
);

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
  // climate fact → population fact → area fact → region-only generic. The selection
  // (incl. the TR-gate on the climate tier) is a PURE function, unit-tested in
  // lib/seo/province-description. The climate tier is TR-only (mirrors the TR-gated
  // visible climate section: EN detail pages are noindex and show no climate); the
  // fallback tiers are deliberately climate-free strings, so no description — TR or EN
  // — claims climate content the page does not render (SEO-POLICY §B2.6).
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

  // Meta-title (W3, PLAN §2): climate-gated, TR-only expansion that targets the
  // "{il} iklim grafiği" query when the page actually renders a climate chart, and
  // falls back to the plain "Geography of {name}" title otherwise. Deterministic
  // (no rotation) and honest (EN/no-climate never claims chart content it lacks) —
  // the TR-gate is the pure, unit-tested `selectProvinceMetaTitle`.
  const { key: titleKey, params: titleParams } = selectProvinceMetaTitle({
    locale,
    climate: province.climate,
    name,
  });

  return buildMetadata({
    locale,
    // localized-slug alternates: slug_tr for tr, slug_en for en.
    hrefForLocale: (l) => ({
      pathname: "/turkiye/[slug]",
      params: { slug: slugForLocale(province, l) },
    }),
    title: t(titleKey, titleParams),
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

  // The marine point list is a GATE, not content: it answers "does this province have a
  // coast" (`lib/marine/coastal.ts`), and no part of the page above it depends on the answer.
  // Started HERE and awaited below so it overlaps the province-list read instead of queueing
  // behind it — one fewer serial round trip on all 81 pages, coastal or not. Floating the
  // promise is safe for exactly one reason: `getMarinePointsSafe` never rejects, in either
  // phase, so there is no unhandled rejection to leak whichever path the render then takes.
  // It is started AFTER the province resolves, so an unknown slug still costs no marine call.
  const marinePointsPromise = getMarinePointsSafe();

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
    // Benzer iklimli iller (PLAN §2; selection rule → DEC 2026-07-20b): among the
    // published provinces (present in the list = has a page) that share this province's
    // Köppen class and are not itself, the 5 NEAREST by annual mean temperature (plate
    // order as tie-break). This replaced the earlier plate-order-first-5 rule, which
    // degenerated on Türkiye's real class sizes (Csa ≈ 44 → ~40 identical blocks + a
    // skewed link graph). Own annual mean comes from the already-loaded DETAIL climate;
    // each sibling's from the list DTO's `climateAnnualMeanTempC` (same derived value,
    // added to the list contract in api PR #68) — so NO second/build-time request (zero-
    // request rule, PLAN §5 risk 6). Siblings with a null annual mean are excluded (can't
    // be ranked, can't render the °C anchor); if THIS province has a Köppen class but no
    // annual mean the selector falls back to plate order (both handled in the pure
    // filter/rank/slice, unit-tested in lib/climate/similar-climate). NOT reciprocal: a
    // nearest-5 relation is not symmetric — a rendered link is not guaranteed to link back.
    const ownAnnualMeanTempC = province.climate?.derived.annualMeanTempC ?? null;
    similarClimate = selectSimilarClimateProvinces(all, province, ownAnnualMeanTempC);
  } catch (error) {
    console.warn(`[province:${slug}] province-list cross-links skipped: ${String(error)}`);
  }

  // ── Deniz Durumu (W2b) ─────────────────────────────────────────────────────────────────
  // THE COASTAL GATE COMES FIRST, and it is derived from the api's own reference-point set
  // (`lib/marine/coastal.ts`) — the list of which 27 provinces have a coast does not live in
  // this repo. An inland province therefore makes no `/conditions` call at all, which is also
  // how this page stays clear of the one corner of the contract nobody has written down: what
  // that route answers for a province with no coast.
  //
  // EVERY MARINE READ HERE IS FAIL-SOFT, in both build and runtime, and that is a different
  // contract from the same routes' behaviour on `/deniz` (see `lib/api/marine.ts`). There the
  // points and the catalogue ARE the page. Here the whole marine section is an enhancement on
  // a page about a province, and a chain of external providers we do not operate may remove
  // the section — never the page, never its 200, never its facts or its links.
  // THE GATE IS ALSO AN ISR GATE, and the ordering below is load-bearing. Next takes a
  // route's revalidate window from the SHORTEST fetch in the render, so reading the layer
  // catalogue (1800 s) unconditionally would drag all 54 INLAND province pages from a 1 h
  // window down to 30 min — for a payload they never use. Only the point list (86 400 s,
  // longer than the province window and therefore invisible to it) is read before the gate;
  // the catalogue and the values are read only where a section will actually render, which
  // is where the 900 s window is the intended cost. Verified in the build output: coastal
  // provinces revalidate at 15 m, inland ones stay at 1 h.
  const marinePoints = await marinePointsPromise;
  const [marineLayers, marineConditions] = isCoastalPlate(marinePoints, province.plateCode)
    ? await Promise.all([
        getMarineLayersSafe(),
        getMarineProvinceConditionsSafe(province.plateCode),
      ])
    : [[], null];
  // ONE signal, read by the section AND by the licence block that has to travel with it: the
  // attribution may not go missing where a derived value appears (a licence obligation,
  // → DEC 2026-08-02c) and may not appear where none does (this page's own "no source for
  // absent content" rule). Two independently-computed booleans would eventually break one of
  // those halves — the O1 finding from the PR #36 review, fixed here before it can happen.
  const marineBlocks = provinceMarineBlocks(marineConditions);
  const showMarine = provinceShowsMarine(marineConditions);

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
  // `curriculumName` rides alongside the MGM `className`/`koppen` pair (WEB-KOPPEN,
  // DEC 2026-08-05c): the value line's primary content moved to the müfredat name, but the
  // underlying `climateClassTr`/`climateKoppen` pair is untouched and still gates the whole
  // `climate` object AND the defense-in-depth "no bare Csa" fallback (both unchanged fields).
  // `curriculumName` itself does NOT gate `climate` — it is a separate, independently-nullable
  // field consulted only inside the value-line branch below (plan §3 V-1).
  const climate =
    province.climateClassTr !== null && province.climateKoppen !== null
      ? {
          className: province.climateClassTr,
          koppen: province.climateKoppen,
          curriculumName: province.climateCurriculumNameTr,
        }
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
  // §19 section-heading entity name: each of the six content <h2>s carries the province
  // name so 81 pages don't share one bare-generic skeleton, and the pattern is VARIED
  // across the page (not mechanically "X'in Y'si"): genitive drives the "X'in Y'si"
  // headings (landform/hydrography/neighbors), locative the "X'te Y" ones (climate/
  // settlement/economy) — two of §19's variants, 3+3. The locale gate and the per-section
  // case split both live in the pure, unit-tested `lib/text/heading-name` (EN suppression
  // = the PR #16 regression class; case-per-section = PROVINCE_HEADING_CASE) — `sectionHeading`
  // just reads that single source of truth here. For EN the helper returns the bare name,
  // which feeds the "… of {name}" English messages (no Turkish suffix on an English heading).
  const sectionHeading = (slot: keyof typeof PROVINCE_HEADING_CASE): string =>
    headingName(locale, name, PROVINCE_HEADING_CASE[slot]);
  // Ö1-A locator mini-map: this province's own outline from the committed artifact.
  const provinceShapeD = PROVINCE_SHAPE_BY_PLATE.get(province.plateCode);
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
  // İklim grafiği/tablosu (W1) — the ERA5-Land (C3S/Copernicus) core-pair series. TR-gated
  // (EN detail pages are noindex and have no climate caveat text, SEO-POLICY §6).
  // `climate === null` on the DTO means "no publishable series" → the whole
  // chart/table/source line is absent, and `sourcesClimate` is NOT added to the page's
  // Kaynaklar line (no source for absent content).
  // The NOVA narrative slot ships wired but empty (climateNarrativeTr is null for all 81).
  const climateSeries = isTr ? province.climate : null;
  const climateNarrative = isTr ? province.climateNarrativeTr : null;
  // Müfredat notu (WEB-KOPPEN, plan §2/§3/V-2) — 15/81 provinces only; the other 66 render
  // nothing (never an "eksik veri" placeholder). TR-gated like every other narrative field on
  // this page; EN has no counterpart yet (Faz-3).
  const curriculumNote = isTr ? province.climateCurriculumNoteTr : null;
  // Benzer iklimli iller — TR-gated like the rest of the climate content (the block's
  // labels/intro are Turkish and it belongs inside the TR-only İklim section).
  const showSimilarClimate = isTr && similarClimate.length > 0;
  // The climate gates are ONE pure decision (`lib/climate/climate-block-gates.ts`,
  // → PR #47 review TA47-M1; `citeCurriculumSource` → WEB-KOPPEN plan §5): the section
  // heading, the MGM classification line, whether the Kaynaklar line cites that
  // classification, and whether it cites the new MEB curriculum attribution. The citation
  // booleans are derived from the render booleans by construction, which is what keeps the
  // UX-tour B5 defect — a source cited for a section the locale gate never renders — from
  // coming back through a later edit.
  // `showClass` is deliberately NOT destructured: the JSX gates the class line on `climate`
  // itself because it needs the null-narrowing to read `.className`/`.koppen`, and a parallel
  // boolean beside it would be a second way to ask the same question. The gate object still
  // computes and tests it — that is what `citeClassSource`/`citeCurriculumSource` are defined
  // against.
  const {
    showSection: showClimateSection,
    citeClassSource: citeClimateClassSource,
    citeCurriculumSource: citeClimateCurriculumSource,
    showCurriculumNote,
  } = climateBlockGates({
    isTr,
    hasClimateClass: climate !== null,
    hasClimateSeries: climateSeries !== null,
    hasSimilarClimate: showSimilarClimate,
    hasCurriculumName: climate !== null && climate.curriculumName !== null,
    // PR #51 review I4: the defense-in-depth fallback (`climateNoteTr === null` →
    // `climateClassOnly`) suppresses the curriculum name from the value line even when
    // `curriculumName` itself is non-null — the citation gate must see that too.
    hasClimateNote: province.climateNoteTr !== null,
    hasCurriculumNoteText: curriculumNote !== null,
  });

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
  // MGM's Köppen CLASSIFICATION moved out of the base `sources` string and into this
  // conditional (UX tour B5). It used to be welded to the elevation/coordinates clause, which
  // meant every EN province page claimed "…and the climate classification from MGM" while the
  // whole climate block sits behind the `isTr` gate and never renders there — a source cited
  // for content that is not on the page, which is exactly what the rule two lines down
  // forbids. The flag comes from the same pure function that gates the line itself, so the two
  // cannot disagree. The elevation and coordinate half stays in the base string: those DO
  // render in both locales.
  if (citeClimateClassSource) extraSources.push(t("sourcesClimateClass"));
  // MEB curriculum-name attribution (WEB-KOPPEN plan §5) — its OWN entry, not merged into the
  // MGM classification string above: the two are distinct source families per DEC 2026-08-05c
  // item 1, and the gate (`citeCurriculumSource`) excludes BOTH fallbacks that can suppress the
  // name from the rendered value line — the null-name/code-only branch AND the null-note
  // `climateClassOnly` branch (PR #51 review I4 — the first version of this comment named only
  // the first branch, which is exactly how the citation used to be able to name content that
  // was not on the page) — so this can never cite a name that is not on the page.
  if (citeClimateCurriculumSource) extraSources.push(t("sourcesClimateCurriculum"));
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
      {/* EN only, and only because this page's substance is TR-gated below (→ DEC
          2026-08-04i §4). Renders nothing on Turkish. */}
      <EnWorkInProgressNotice locale={locale} />
      <p className="lede">{introText}</p>

      <section className="section">
        <h2>{t("keyFactsHeading")}</h2>
        <dl className={styles.factSheet}>
          <div className={styles.fact}>
            <dt>{t("region")}</dt>
            {/* G3 — the coğrafi bölge tint beside its name. `aria-hidden`, because the name
                right next to it already carries the fact; see components/province/region-dot. */}
            <dd>
              <RegionDot region={province.region} />
              {region}
            </dd>
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

      {/* Ö1-A — "Van nerede?", the question that follows "Van nedir?". Temel Bilgiler has just
          given the region and the coordinates as TEXT; this is the same answer as a picture,
          so it sits directly after it and before Deniz Durumu.

          Absent (never a placeholder) if the plate code has no artifact shape. That is a
          defence line, not a known gap: all 81 plate codes resolve today. */}
      {provinceShapeD !== undefined && (
        <section className="section">
          <h2>{t("locationHeading", { name: sectionHeading("location") })}</h2>
          <LocatorMap
            kind="province"
            locale={locale}
            d={provinceShapeD}
            alt={t("locationAlt", { name })}
          />
        </section>
      )}

      {/* Deniz Durumu (W2b) — directly under Temel Bilgiler, above the prose. A reader who
          arrived asking "Sinop'ta deniz kaç derece" answers that question without scrolling;
          that is this page's half of the user-first inversion `/deniz` took in W2a.

          NOT TR-gated, unlike every prose section below it. Those are gated because they are
          hand-written Turkish with no English counterpart; this section is DATA plus the
          symmetric `Marine.*` vocabulary, and a wave height is not a translation. Same
          reasoning as the value band on `/en/sea`.

          The section is absent for an inland province, absent when the conditions read fails,
          and PRESENT — with honest per-field states — whenever the api answered, including
          when every value in it is `unavailable`. A section that blinks out of existence
          between two ISR passes is a worse answer than "şu an alınamıyor". */}
      {showMarine && (
        <ProvinceMarineSection
          locale={locale}
          provinceName={name}
          blocks={marineBlocks}
          layers={marineLayers}
          headingId="province-marine"
        />
      )}

      {/* Yeryüzü Şekilleri — TR-gated prose; absent until landformNoteTr is filled. */}
      {showLandform && (
        <section className="section">
          <h2>{t("landformHeading", { name: sectionHeading("landform") })}</h2>
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
          <h2>{t("climateHeading", { name: sectionHeading("climate") })}</h2>
          {climate && (
            <>
              {/* Value line (WEB-KOPPEN, DEC 2026-08-05c): the müfredat (MEB curriculum)
                  climate name replaces the MGM class name as the PRIMARY name here, paired
                  with the untouched MGM Köppen code via a middot ("<ad> · Köppen: <kod>",
                  cumle-taslaklari.md §6.3 — this is the value line, never the H2, which still
                  carries the province name unchanged). `climateKoppen`/`climateClassTr`
                  themselves are MGM's own, unedited (K1 / DEC 2026-08-04a) — only the primary
                  NAME source and its separator are a presentation change.

                  Two independent nullable fields, two independent fallbacks, checked in this
                  order:
                  1. `climateNoteTr === null` — defense-in-depth (§6 "no bare Csa"): the
                     mandatory caveat itself is absent (a contract violation the api already
                     guards against), so the code is suppressed entirely and only the MGM
                     class name prints — this branch is untouched by WEB-KOPPEN, still keys
                     off `climateClassTr`, not the curriculum name (a different field).
                  2. Otherwise, `climateCurriculumNameTr === null` (contract-legal, not
                     observed in the 81-province seed today, plan §3 V-1) — the curriculum
                     name segment is dropped and only the Köppen code prints
                     ("Köppen: <kod>"), never a name-less blank or an invented name.

                  A11y (PR #51 review — the middot moved from a parenthetical grouping to a
                  bare "·"): VERIFIED, not fixed. U+00B7 MIDDLE DOT is ordinary running-text
                  punctuation (Unicode category Po), and this exact unguarded construction is
                  already the repo's own established pattern in a STRICTER context — the
                  `similarClimateAnchor`/`chipMarine` message keys below use it as part of an
                  interactive LINK's accessible name, a higher a11y bar than a static <p>. No
                  wrapping/labelling change made; `climate-messages.test.ts`'s CR51-M3 test
                  guards the separator format so a future edit cannot silently drop it. */}
              <p className={styles.climateValue}>
                {province.climateNoteTr === null
                  ? t("climateClassOnly", { className: climate.className })
                  : climate.curriculumName !== null
                    ? t("climateValue", { name: climate.curriculumName, koppen: climate.koppen })
                    : t("climateValueKoppenOnly", { koppen: climate.koppen })}
              </p>
              {/* THE VISIBLE PLAIN SENTENCE (→ DEC 2026-08-04i §3; re-worded for WEB-KOPPEN's
                  V-5 — adopts NOVA's cumle-taslaklari.md §3.1 text, ruled by Atlas). A
                  PRESENTATION change only: the class names and the Köppen codes are MGM's and
                  are untouched (K1 / DEC 2026-08-04a), and the technical caveat now renders
                  OPEN by default (DEC 2026-08-05c, below) rather than collapsed.

                  Why it still earns a permanent line on 81 pages: the value line above now
                  shows TWO names — a MEB curriculum name and an MGM Köppen code — and they do
                  not always agree (48 provinces carry the MGM class "Akdeniz iklimi", 33 of
                  those outside the Akdeniz/Ege regions, Ankara and Van among them, UX tour
                  B6). This sentence is what tells a reader which name is which BEFORE they
                  read the caveat's own full text.

                  It is deliberately class-INDEPENDENT: one sentence for all 81, not a
                  per-Köppen-class table — a presentation decision, not a data decision.

                  Gated on the SAME condition the two-name value line above uses (PR #51 review
                  I5), not on the caveat alone: where the caveat is absent (`climateNoteTr ===
                  null`) the value line falls back to the bare MGM class name, AND where the
                  caveat is present but the curriculum name itself is null the value line falls
                  back to the code-only branch — in EITHER case there is no second name/code
                  pairing on the page for this sentence to explain. (Latent today: `curriculum
                  Name` is non-null for all 81 seeded provinces, so this only changes behaviour
                  the day the contract-legal null-name fallback is actually observed.) */}
              {province.climateNoteTr !== null && climate.curriculumName !== null && (
                <p className={styles.climatePlainNote}>{t("climatePlainNote")}</p>
              )}
              {/* Müfredat notu (WEB-KOPPEN plan §2/§3/A-1) — 15/81 provinces. Plain prose,
                  same treatment as the landform/hydrography notes (`.prose`, `ProseNote`):
                  it is substantive per-province content the reader should see by default, not
                  a caveat, so it gets no `<details>` wrapper and no label heading (unlike the
                  MGM box below it). Sits directly under the plain sentence.

                  GATED ON `showCurriculumNote` (climate-block-gates.ts), not a bare `!== null`
                  check on `curriculumNote` alone (PR #51 review CR51-M2 / curriculum-note-
                  asymmetry-untested): the block lives inside this `{climate && …}` fragment
                  because it is presented as part of the climate section's primary read, not
                  because it is logically a function of `climate`'s own fields — the api's
                  `climateCurriculumNoteTr` is independently nullable from `climateClassTr`/
                  `climateKoppen`. That coupling is accepted rather than decoupled: a province
                  with a note but no MGM class/Köppen pair is not a real api shape today (the
                  note is authored FOR a curriculum-name row), and decoupling would only move
                  the block outside a section it has no other home in. `curriculumNote !== null`
                  stays alongside `showCurriculumNote` for TS narrowing only — the two can never
                  disagree, since `showCurriculumNote` is defined in terms of the same field. The
                  other 66 provinces render nothing here, never an "eksik veri" placeholder
                  (V-2). */}
              {showCurriculumNote && curriculumNote !== null && (
                <ProseNote text={curriculumNote} className={styles.prose} />
              )}
              {/* The caveat stays MANDATORY and its text is never trimmed. It used to render
                  collapsed (progressive disclosure); DEC 2026-08-05c flips it to OPEN by
                  default now that the value line carries two names that can disagree — the
                  methodological explanation is no longer a secondary aside one click away, it
                  is part of the primary read (see province-detail.module.css .climateNote).
                  It stays FIRST among the trailing detail content — do not touch ordering
                  (2026-07-11 owner UX ruling, unaffected by the open/closed change). */}
              {province.climateNoteTr !== null && (
                <details className={styles.climateNote} open>
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
              Same Köppen class, the 5 NEAREST by annual mean temperature (→ DEC
              2026-07-20b). Hub-and-spoke same-climate cross-links (CONVENTIONS §6 #10).
              Uses the shared province-grid card (same as Komşu İller). Anchor = "il adı
              · N,N °C": the °C is CONTENT (part of the link's accessible name), only the
              arrow is aria-hidden (`components/card-arrow.tsx` — inline SVG, because
              U+2192 is outside the font subsets this site ships). Temp is 1-decimal as
              delivered by the api (no
              re-rounding), locale-formatted. The fallback path (own annual mean null) may
              yield a null-temp sibling → then the card is name-only. */}
          {showSimilarClimate && (
            <div className={styles.similarClimate}>
              <h3 className={styles.similarClimateHeading}>{t("similarClimateHeading")}</h3>
              {province.climateKoppen !== null && (
                <p className={styles.similarClimateIntro}>
                  {t("similarClimateIntro", { koppen: province.climateKoppen })}
                </p>
              )}
              <ul role="list" className="province-grid">
                {similarClimate.map((similar) => (
                  <li key={similar.plateCode}>
                    <Link
                      className="province-card"
                      href={{
                        pathname: "/turkiye/[slug]",
                        params: { slug: slugForLocale(similar, locale) },
                      }}
                    >
                      <span>
                        {similar.climateAnnualMeanTempC !== null
                          ? t("similarClimateAnchor", {
                              name: similar.nameTr,
                              temp: format.number(similar.climateAnnualMeanTempC, {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              }),
                            })
                          : similar.nameTr}
                      </span>
                      <CardArrow />
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
          <h2>{t("hydrographyHeading", { name: sectionHeading("hydrography") })}</h2>
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
          <h2>{t("settlementHeading", { name: sectionHeading("settlement") })}</h2>
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
          <h2>{t("economyHeading", { name: sectionHeading("economy") })}</h2>
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
          <h2>{t("neighborsHeading", { name: sectionHeading("neighbors") })}</h2>
          <ul role="list" className="province-grid">
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
                  <CardArrow />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ECMWF + Copernicus Marine attribution, licence and educational-use notice — the SAME
          component and the SAME verbatim strings `/deniz` renders, never a second copy
          (`components/marine/marine-attribution.tsx`). It travels with the derived values
          because CC BY 4.0 and ECMWF's "shall be attached" wording require it to
          (→ DEC 2026-08-02c), and it is gated on the same `showMarine` signal as the values
          themselves, so the two cannot come apart in either direction.

          It carries its OWN heading rather than "Kaynaklar ve kullanım": the Kaynaklar line
          below belongs to the province's own facts (TÜİK, HGM, MGM), and two identically
          titled sources surfaces on one page would leave the reader guessing which licence
          covers what. Bottom of the page, like the hub's — visible without a click, which is
          the conservative reading of the licence's "prominently". */}
      {showMarine && (
        <MarineAttribution
          layers={marineLayers}
          headingId="province-marine-sources"
          heading={t("marineSourcesHeading")}
        />
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
