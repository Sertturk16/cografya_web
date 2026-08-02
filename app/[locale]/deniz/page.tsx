import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { LayerCatalogue } from "@/components/marine/layer-catalogue";
import { MarineExplainers } from "@/components/marine/marine-explainers";
import { ReferencePoints } from "@/components/marine/reference-points";
import { getMarineLayersResilient, getMarinePointsResilient } from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { ecmwfAttributionYear } from "@/lib/marine/attribution";
import { buildMarineExplainers } from "@/lib/marine/explainers";
import { collectionPageJsonLd, JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
import type { ContentSurface } from "@/lib/seo/indexing";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./deniz.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/**
 * `/deniz` is TR-indexable and `/en/sea` is `noindex, follow` — the existing
 * `"trNarrative"` policy, not a new mechanism. The page's substance is seven hand-written
 * Turkish explainer blocks that are NOT machine-translated (`SEO-POLICY.md` §B14), so the
 * English rendering is chrome plus data labels: the same thin-EN shape the province and
 * country detail pages already carry. Declared once here and passed to both
 * `buildMetadata` and the JSON-LD gate below so the head, the markup and the sitemap can
 * never disagree.
 */
const MARINE_SURFACE: ContentSurface = "trNarrative";

/**
 * SPEC §7.14 FROZEN i18n KEYS → REPO NAMESPACE MAPPING (owner answer S4, recorded verbatim).
 *
 * The SPEC freezes eight lowercase `marine.*` keys; this repo's namespaces are PascalCase
 * (`Turkiye`, `Game`, `ProvinceDetail`), so each maps to `Marine.*` with the rest of the
 * path unchanged. What the SPEC froze is that these eight STRINGS exist and stay stable,
 * not their capitalisation:
 *
 *   marine.disclaimer.educationalOnly    → Marine.disclaimer.educationalOnly    [born, W1a]
 *   marine.status.notSupported           → Marine.status.notSupported           [born, W1a]
 *   marine.point.referencePointHint      → Marine.point.referencePointHint      [born, W1a]
 *   marine.status.noData                 → Marine.status.noData                 [W1b/W2]
 *   marine.status.unavailable            → Marine.status.unavailable            [W1b/W2]
 *   marine.freshness.stale               → Marine.freshness.stale               [W1b/W2]
 *   marine.series.sourceDiffersNotice    → Marine.series.sourceDiffersNotice    [W1b/W2]
 *   marine.straits.lowConfidence         → Marine.straits.lowConfidence         [W1b/W2]
 *
 * Only the three keys W1a actually renders are born now. The other five belong to the VALUE
 * band — there is no value on this page for them to describe, and a string nothing renders
 * is a dead string someone will later translate, review and maintain for nothing. They are
 * born together with the values they annotate. Recorded here so "the frozen key is missing"
 * reads as a schedule, not as an omission.
 */

/** The blocks exist only in the locale that owns the narrative. */
function rendersExplainers(locale: Locale): boolean {
  return locale === routing.defaultLocale;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Deniz" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/deniz",
    title: t("metaTitle"),
    description: t("metaDescription"),
    surface: MARINE_SURFACE,
  });
}

/**
 * `/deniz` ↔ `/en/sea` — the marine hub (SPEC-ADDENDUM §7.12).
 *
 * WHAT THIS PAGE IS TODAY. Explanatory content, the 30 offshore reference points, and the
 * measurement catalogue. It publishes **no wind, wave or sea-temperature VALUE**: the
 * value/series/conditions endpoints are frozen in the OpenAPI contract but deliberately not
 * mounted on the api controller until M4, so there is nothing to read — and an estimate, a
 * rounding or a "≈" would be precisely the dishonesty this whole surface is designed
 * against. The value band lands additively on this same route once M4 ships (W1b/W2); no
 * URL, no heading and no JSON-LD node has to change for it.
 *
 * That is also what the SPEC asks for rather than a compromise: §7.12's acceptance rule is
 * "the /deniz hub does not ship on numbers alone". This is the other half, shipped whole.
 *
 * RENDERING. SSG + ISR, full HTML in the first response (`ENGINEERING.md` §3/§4 #1). There
 * is no client island at all — the points list, the catalogue table and the explainers are
 * server-rendered markup. The ISR window is set per FETCH (`lib/api/marine.ts`), mirroring
 * the api's own `s-maxage` for each route, so the page's künye can never be staler than the
 * CDN in front of it.
 *
 * RESILIENCE. Each api read is a build-safe wrapper: an outage during `next build` (web CI
 * has no api service) degrades that section to nothing and defers to on-demand ISR, while a
 * runtime failure re-throws so Next keeps serving the last good page. A section with no
 * data is not rendered at all — an empty heading is worse than an absent one, and the
 * substance of this page lives in `messages/tr.json`, not in the api.
 */
export default async function DenizPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Deniz");
  const tm = await getTranslations("Marine");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: "/deniz" });

  // Three independent reads, in parallel. `provinces` is what turns each point into a real
  // crawlable link to its province page (and what keeps an unpublished one plain text).
  const [points, layers, provinces] = await Promise.all([
    getMarinePointsResilient(),
    getMarineLayersResilient(),
    getProvincesResilient(),
  ]);

  // The seven blocks, resolved through the ONE module that lists their keys
  // (`lib/marine/explainers.ts`) — empty on `/en/sea`, where the narrative does not exist.
  const explainers = rendersExplainers(locale) ? buildMarineExplainers(t) : [];

  // The year ECMWF's required copyright line states — the ingested cycle's own year, or
  // `null` when nothing has been ingested (see `lib/marine/attribution.ts`).
  const attributionYear = ecmwfAttributionYear(layers);

  return (
    <div className="container page">
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: t("heading"),
            description: t("metaDescription"),
            path,
            locale,
          }),
          // NO `FAQPage` node, deliberately. The seven blocks are genuinely visible, so the
          // §B5 5.7 "markup without content" ban is not what rules here — the reason is that
          // since 2023 Google restricts FAQ rich results to authoritative government and
          // health sites, so the markup buys this page exactly zero SERP surface while
          // adding a second copy of the same text that has to be kept in step forever.
          // The blocks themselves are untouched: they are the page's substance (B11), they
          // are what a reader and an AI crawler actually read, and they stay in the HTML.
          learningResourceJsonLd({
            name: t("heading"),
            description: t("metaDescription"),
            path,
            locale,
            learningResourceType: "Article",
            teaches: t("teaches"),
          }),
        ]}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("deniz"), href: "/deniz" },
        ]}
      />
      <h1>{t("heading")}</h1>
      <p className="lede">{t("lede")}</p>

      {points.length > 0 && (
        <ReferencePoints locale={locale} points={points} provinces={provinces} />
      )}

      {layers.length > 0 && <LayerCatalogue locale={locale} layers={layers} />}

      <MarineExplainers explainers={explainers} />

      {/* Attribution + educational-use notice. UNTOUCHABLE copy class (CONTENT-STYLE §22):
          it stays formal and is rendered in BOTH locales, because the EN page shows the
          same ECMWF-derived künye and CC BY 4.0 requires the attribution wherever that
          derived material appears.

          THE ENGLISH BLOCK IS NOT COPY — IT IS THE LICENCE (→ DEC 2026-08-02c, from NOVA's
          first-hand reading of ECMWF's licence page). ECMWF's terms say the wording "shall
          be attached", quote it, and — unlike the Copernicus framework — offer NO "or any
          similar notice" escape. So it is published verbatim, in English, in both locales,
          and marked `lang="en"` so a screen reader on the Turkish page does not read it in
          Turkish phonetics (WCAG 3.1.2). The Turkish rendering stands ALONGSIDE it, never
          instead of it. Shortening, restyling or translating any of it is a licence breach.

          It is also visible without a click on the page that carries the derived material,
          which is the conservative reading of the licence's "prominently".

          Provider name, licence name and product class come from `data-provenance.md`'s
          ECMWF Open Data entry, not from the payload: `MarineAttributionDto` is frozen in
          the contract but has no endpoint and no seeded rows until M5. When it does, this
          block becomes data-driven in one place. */}
      <section className="section" aria-labelledby="deniz-sources">
        <div className={styles.sources}>
          <h2 id="deniz-sources">{t("sourcesHeading")}</h2>
          <p>{t("sourceEcmwf")}</p>
          <p>{t("sourceEcmwfNoticeIntro")}</p>
          <div className={styles.licenceNotice} lang="en">
            {/* The copyright line is omitted — not faked — when no ECMWF cycle has been
                ingested and there is therefore no data year to state. The mandatory
                "this service is based on…" sentence carries no year and always shows. */}
            {attributionYear !== null && (
              <p>{tm("attribution.ecmwfCopyright", { year: attributionYear })}</p>
            )}
            <p>{tm("attribution.ecmwfNotice")}</p>
            <p>{tm("attribution.ecmwfDisclaimer")}</p>
          </div>
          <p>{t("sourceCmems")}</p>
          <p className={styles.disclaimer}>{tm("disclaimer.educationalOnly")}</p>
        </div>
      </section>
    </div>
  );
}
