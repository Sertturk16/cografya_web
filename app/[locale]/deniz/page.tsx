import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { EnWorkInProgressNotice } from "@/components/en-work-in-progress-notice";
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
import { marineShowsValues } from "@/lib/marine/overview";
import { collectionPageJsonLd, JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
import type { ContentSurface } from "@/lib/seo/indexing";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/**
 * `/deniz` is TR-indexable and `/en/sea` is `noindex, follow` — the existing
 * `"trNarrative"` policy, not a new mechanism. The page's substance is the hand-written
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
 *   marine.straits.lowConfidence         → Marine.straits.lowConfidence         [born, W2b]
 *   marine.series.sourceDiffersNotice    → Marine.series.sourceDiffersNotice    [W2c]
 *
 * A frozen key is born together with the thing it annotates, never before it: a string
 * nothing renders is a dead string someone will later translate, review and maintain for
 * nothing. W2a shipped the value band, so the three value states were born with it; W2b
 * shipped the province section, so the straits caution was born with that. Only the series
 * notice is still unborn — it explains a discrepancy between a CHART and a headline number,
 * and W2c owns the chart. Recorded here so "the frozen key is missing" reads as a schedule,
 * not as an omission.
 *
 * MEANING CORRECTION IN W2a (→ Atlas ruling A1, 2026-08-02). W1a rendered
 * `status.notSupported` as "Sıradaki aşama" in the catalogue's status column, because that
 * was the only place a status word appeared. The contract means something else by it — a
 * PERMANENT product truth, "the provider carries no such field in this sea" — and with real
 * values on the page the same string would have had to mean both "arriving later" and "never
 * arriving" one section apart. The catalogue's wording moved to `Marine.catalogue.nextPhase`,
 * unchanged at the time, and the frozen key is back to its contract meaning. No key was lost.
 *
 * That moved copy was itself replaced later, under DEC 2026-08-17c (PR #67): the catalogue's
 * status column reads "Künye yok" / "No model run" today, with no roadmap promise in it. The
 * key separation A1 established is unaffected.
 */

/** The blocks exist only in the locale that owns the narrative. */
function rendersExplainers(locale: Locale): boolean {
  return locale === routing.defaultLocale;
}

/**
 * WHAT THE HEAD PROMISES WHEN THE BAND IS GONE — a deliberate, recorded decision
 * (PR #36 review, F-C1 / W2A-I1; live-verified 2026-08-02).
 *
 * The value band can disappear for a render (`getMarineOverviewSafe` is fail-soft, and the
 * contract's `dataAvailable: false` gate withholds a payload outright). Two questions follow,
 * and they get DIFFERENT answers on purpose:
 *
 * - **Content promises track the data.** The lede and the value section's `<h2>` both say
 *   what the reader will find, so both fall back through the one `marineShowsValues` signal
 *   when there is nothing to find. Those two sit inches from the missing table; a promise
 *   there is a promise broken in the same screenful.
 * - **Page identity stays stable.** `<title>`, the meta description and the `<h1>` state the
 *   page's SUBJECT — which sea, which quantities, how many points — and that subject is true
 *   in every render: the degraded page still carries the map, the thirty points, the
 *   measurement catalogue for exactly those quantities and the explainers about them.
 *   They are NOT gated, for three reasons. (1) A `<title>` that flips between two strings
 *   across ISR windows is a genuinely worse SEO failure than a transient overpromise — the
 *   SERP would show whichever one the last crawl caught. (2) Gating the title but not the
 *   `<h1>`, or vice versa, would put the head and the page's own heading in disagreement.
 *   (3) The degraded render is a WINDOW (900 s ISR), not the steady state: with M4b on the
 *   api and `MARINE_ENABLED=true`, `/deniz` was verified rendering 150/150 values
 *   server-side (`Owner's Inbox/w2-deniz-degerler/w2a-live-samples/`).
 *
 * GO-LIVE ORDERING NOTE (M5 / ENV op, not a code gate). This page is not crawlable by anyone
 * yet — deploy is the last step of the marine track. Production must not serve the W2a shape
 * with `MARINE_ENABLED=false`: that flag makes the value-less render the PERMANENT state, and
 * a permanently value-less page under this title is the §B12.2.a doorway class, not a
 * transient. The flag and this page go live together or not at all.
 */
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
 *   H2  frequently asked          — the explainers, now H3 beneath it, in a closed-by-default
 *                                    accordion (deniz-notlar.txt madde 8)
 *   H2  sources and use           — attribution, licence, educational-use notice
 *
 * The blocks did not shrink; they moved under the subject they explain. Their headings
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

  // The explainer blocks, resolved through the ONE module that lists their keys
  // (`lib/marine/explainers.ts`) — empty on `/en/sea`, where the narrative does not exist.
  const explainers = rendersExplainers(locale) ? buildMarineExplainers(t) : [];

  // The SAME signal the value section reads, from the same pure function — so the lede and
  // the `<h2>` beneath it can never disagree about whether this page has values today.
  const showValues = marineShowsValues(overview);

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
          // NO `FAQPage` node, deliberately. The blocks are genuinely visible, so the §B5 5.7
          // "markup without content" ban is not what rules here — the reason is that since
          // 2023 Google restricts FAQ rich results to authoritative government and health
          // sites, so the markup buys this page exactly zero SERP surface while adding a
          // second copy of the same text that has to be kept in step forever.
          // The blocks themselves are untouched: they are the page's substance (B11), they
          // are what a reader and an AI crawler actually read, and they stay in the first-
          // response HTML — closed-by-default (`marine-explainers.tsx`'s `<details>`
          // accordion, deniz-notlar.txt madde 8) is a CSS/UA-level collapse, never a removal:
          // Google explicitly crawls and indexes content behind a native disclosure the same
          // as always-visible content, unlike the JSON-LD-only "content" this ban targets.
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
      {/* EN only (→ DEC 2026-08-04i §4). This page is `"trNarrative"` for a different reason
          from the detail pages — its substance is the hand-written Turkish explainer
          blocks, deliberately not machine-translated (SEO-POLICY §B14) — but the reader's
          experience is the same one the notice describes. Renders nothing on Turkish. */}
      <EnWorkInProgressNotice locale={locale} />
      {/* The `<h1>` names the subject and does not move; the lede states what the reader
          will find and therefore does (see the head-promise block above). */}
      <p className="lede">{showValues ? t("lede") : t("ledeNoValues")}</p>

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
