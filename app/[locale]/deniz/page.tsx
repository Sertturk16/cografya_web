import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { LayerCatalogue } from "@/components/marine/layer-catalogue";
import { MarineAttribution } from "@/components/marine/marine-attribution";
import { MarineExplainers } from "@/components/marine/marine-explainers";
import { ReferencePoints } from "@/components/marine/reference-points";
import {
  getMarineLayersResilient,
  getMarineOverviewSafe,
  getMarinePointsResilient,
} from "@/lib/api/marine";
import { getProvincesResilient } from "@/lib/api/provinces";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { buildMarineExplainers } from "@/lib/marine/explainers";
import { collectionPageJsonLd, JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
import type { ContentSurface } from "@/lib/seo/indexing";
import { buildMetadata } from "@/lib/seo/metadata";

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
 *   marine.status.noData                 → Marine.status.noData                 [born, W2a]
 *   marine.status.unavailable            → Marine.status.unavailable            [born, W2a]
 *   marine.freshness.stale               → Marine.freshness.stale               [born, W2a]
 *   marine.straits.lowConfidence         → Marine.straits.lowConfidence         [W2b]
 *   marine.series.sourceDiffersNotice    → Marine.series.sourceDiffersNotice    [W2c]
 *
 * A frozen key is born together with the thing it annotates, never before it: a string
 * nothing renders is a dead string someone will later translate, review and maintain for
 * nothing. W2a ships the value band, so the three value states are born with it. The straits
 * caution belongs to the province section and the series notice to the chart it explains.
 * Recorded here so "the frozen key is missing" reads as a schedule, not as an omission.
 *
 * MEANING CORRECTION IN W2a (→ Atlas ruling A1, 2026-08-02). W1a rendered
 * `status.notSupported` as "Sıradaki aşama" in the catalogue's status column, because that
 * was the only place a status word appeared. The contract means something else by it — a
 * PERMANENT product truth, "the provider carries no such field in this sea" — and with real
 * values on the page the same string would have had to mean both "arriving later" and "never
 * arriving" one section apart. The catalogue's wording moved to `Marine.catalogue.nextPhase`
 * (copy unchanged) and the frozen key is back to its contract meaning. No key was lost.
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
 * THE SPINE, INVERTED IN W2a. The page used to open with explanation and keep its data at
 * the bottom, because it had no data worth leading with. It does now, so the order says so:
 *
 *   H1 + one helper line
 *   H2  the sea state right now   — map, four value tables, reading key, künye
 *   H2  which model these come from — the measurement catalogue
 *   H2  frequently asked          — the seven explainers, now H3 beneath it
 *   H2  sources and use           — attribution, licence, educational-use notice
 *
 * The seven blocks did not shrink; they moved under the subject they explain. Their headings
 * were also rewritten from the method to the READER's question ("Dalga yüksekliği 1 metre
 * yazıyorsa deniz nasıl olur?" rather than "Belirgin dalga yüksekliği ne demektir?"), which
 * is the one on-page change here with real SERP exposure — accepted because the page landed
 * on 2026-08-02 and has no accumulated ranking to lose, and because the URL, canonical,
 * hreflang, sitemap entry and every internal link are untouched.
 *
 * RENDERING. SSG + ISR, full HTML in the first response (`ENGINEERING.md` §3/§4 #1). There is
 * no client island at all — the map, the value tables, the catalogue and the explainers are
 * server-rendered markup, and the direction arrows are inline SVG rotated by a server-computed
 * angle. The ISR window is set per FETCH (`lib/api/marine.ts`) to mirror the api's own
 * `s-maxage` for each route, so the page's künye can never be staler than the CDN in front of
 * it; the value read's 900 s is the shortest, and therefore the route's effective period.
 *
 * NO LIVE NUMBER REACHES THE HEAD. Title and description stay structural (which quantities,
 * how many points, how many provinces). A number baked into `<title>` at revalidate time
 * would sit wrong in the SERP for hours, which is a worse failure than not being there.
 *
 * RESILIENCE, IN TWO SHAPES. The points and catalogue reads are build-safe but re-throw at
 * runtime, so a blip leaves the last good static render in place — they ARE this page. The
 * value read is fail-soft in BOTH phases: it is an enhancement on top of an editorial page
 * that depends on external providers, so it may remove the band and may never remove the
 * page (`getMarineOverviewSafe`).
 */
export default async function DenizPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Deniz");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: "/deniz" });

  // Four independent reads, in parallel. `provinces` is what turns each point into a real
  // crawlable link to its province page (and what keeps an unpublished one plain text);
  // `overview` is the value band and is the only one of the four allowed to come back null.
  const [points, layers, provinces, overview] = await Promise.all([
    getMarinePointsResilient(),
    getMarineLayersResilient(),
    getProvincesResilient(),
    getMarineOverviewSafe(),
  ]);

  // The seven blocks, resolved through the ONE module that lists their keys
  // (`lib/marine/explainers.ts`) — empty on `/en/sea`, where the narrative does not exist.
  const explainers = rendersExplainers(locale) ? buildMarineExplainers(t) : [];

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
        <ReferencePoints
          locale={locale}
          points={points}
          provinces={provinces}
          layers={layers}
          overview={overview}
        />
      )}

      {layers.length > 0 && <LayerCatalogue locale={locale} layers={layers} />}

      <MarineExplainers explainers={explainers} heading={t("faqHeading")} headingId="deniz-faq" />

      {/* Attribution, licence and educational-use notice — ONE component since W2a, because
          the same block now has to travel to the 27 province pages that carry the same
          derived values (W2b). See `components/marine/marine-attribution.tsx` for why the
          English wording is the licence itself rather than copy. */}
      <MarineAttribution layers={layers} headingId="deniz-sources" />
    </div>
  );
}
