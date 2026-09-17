import type { MetadataRoute } from "next";
import { getBooksResilient } from "@/lib/api/books";
import { getCountryBySlug, getCountriesResilient } from "@/lib/api/countries";
import { getProvinceBySlug, getProvincesResilient, isProductionBuild } from "@/lib/api/provinces";
import { getRegionsResilient } from "@/lib/api/regions";
import type { CountryDetail, ProvinceDetail } from "@/lib/api/types";
import { bookSitemapEntries } from "@/lib/seo/book-sitemap";
import { sitemapEntriesFor } from "@/lib/seo/sitemap-entries";
import { getAllContinents } from "@/lib/geo/continents";

/**
 * Root sitemap — a single flat urlset served at `/sitemap.xml` (the URL `robots.ts` points
 * at). Composition: static hubs (`/turkiye`, `/dunya`, `/oyun`, `/deniz`, `/kitaplar`,
 * `/araclar`) + provinces, countries and books at ONE entry each (TR only
 * — their EN counterparts are `noindex`, see `sitemapEntriesFor` in
 * `lib/seo/sitemap-entries.ts`) — a valid, self-contained sitemap far under Google's
 * 50k-per-file hard limit. The book tier adds one hub and one URL per book, and the CBS tool
 * tier a hub plus one URL per published tool — which leaves the
 * 50k arithmetic untouched but is NOT "no change to the trigger" (→ PR #62 review
 * `FENER62-M4`, extended by PR #73 `FENER73-M2`): `/kitaplar` and `/araclar` are further
 * content hubs, and the convention's hub condition was
 * already crossed by `/dunya`. Crossed once or several times, the standing exception below is
 * what governs, and it is unchanged.
 *
 * SPLIT TRIGGER STATUS (CONVENTIONS §6 #7). The convention's proactive split-to-a-sitemap-
 * index trigger (a second content hub; province×locale > ~150) is now crossed by adding the
 * `/dunya` country hub. It is NOT implemented here yet on purpose: Next 16 App Router's
 * `generateSitemaps()` (the idiomatic split) serves shards at `/sitemap/{id}.xml` but does
 * NOT expose an index at `/sitemap.xml` in this version — so splitting that way would 404
 * the very entrypoint `robots.ts` advertises, which is strictly worse SEO than this valid
 * flat file. The builders below are kept per-hub and isolated so the split is mechanical
 * once a Next-16-verified index mechanism is in place (tracked follow-up — hand to Atlas).
 *
 * Each entry carries the hreflang alternates for the locales in which that page is
 * INDEXABLE, plus `x-default` — so the language mapping is annotated in the sitemap too,
 * not only in <head>. For a `"localized"` surface that is the full tr/en/x-default set;
 * for a `"trNarrative"` surface the de-indexed locale is absent from both the urlset and
 * the alternates, exactly mirroring what `buildAlternates` emits in the document head
 * (see `lib/seo/sitemap-entries.ts` for the rationale). `lastmod` is the entity's real
 * api `updated_at`.
 *
 * The entry-building rules themselves live in `lib/seo/sitemap-entries.ts` so they can be
 * unit-tested without the api fetching below; this file owns data + resilience only.
 */

/** Static hub pages. */
function staticEntries(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...sitemapEntriesFor(() => "/", now, 1),
    ...sitemapEntriesFor(() => "/turkiye", now, 0.8),
    ...sitemapEntriesFor(() => "/dunya", now, 0.8),
    // The map game hub. `"trOnly"` → ONE entry (`/oyun`). It was `"localized"`, which published
    // `/en/game` as the English version of a page that makes zero `getTranslations` calls and
    // has no `locale` branch: seventeen lines of Turkish under an English `lang`. The surface
    // now states what the page is; see its `generateMetadata` for the route back to `localized`.
    ...sitemapEntriesFor(() => "/oyun", now, 0.7, "trOnly"),
    // The marine hub. `"trNarrative"` surface → ONE entry (`/deniz`), because `/en/sea` is
    // `noindex` while the seven explainer blocks exist only in Turkish. The alternates set
    // on that single entry is therefore `tr` + `x-default`, mirroring exactly what
    // `buildAlternates` puts in the page head.
    ...sitemapEntriesFor(() => "/deniz", now, 0.7, "trNarrative"),
    // The CBS tool tier. `"trNarrative"` for the same reason as `/deniz` (→ DEC 2026-08-19a
    // md.6): the tool is locale-independent but its doorway defence is Turkish prose, so
    // `/en/tools*` is `noindex` and must NOT appear here — a `noindex` URL in a sitemap is a
    // §B6 6.8 BLOCKER, and the surface argument is what keeps it out.
    //
    // FOUR ENTRIES: the hub and Faz-1's three tools, complete as of PR-D. Each row landed in
    // the PR that built its page, because a sitemap URL that 404s is the §B6 6.8 BLOCKER
    // pointing the other way (→ `Owner's Inbox/cbs-p2/pr-b/TASK-CONTEXT.md` md.7).
    // `lib/tools/tool-sitemap.test.ts` compares this list against the register in both
    // directions, so neither half can move alone.
    ...sitemapEntriesFor(() => "/araclar", now, 0.7, "trNarrative"),
    ...sitemapEntriesFor(() => "/araclar/mesafe-olcme", now, 0.6, "trNarrative"),
    ...sitemapEntriesFor(() => "/araclar/koordinat-bulma", now, 0.6, "trNarrative"),
    ...sitemapEntriesFor(() => "/araclar/alan-hesaplama", now, 0.6, "trNarrative"),
    // The earthquake hub (PR-A, `deprem-sayfalari` plan §5.14). `"trOnly"` → ONE entry.
    //
    // This row used to argue the opposite: that the page's substance is data (events,
    // coordinates, magnitudes, timestamps) rather than Turkish narrative, "so both locales are
    // indexable from day one". The reasoning is sound and the page does not implement it — it
    // has zero `getTranslations` calls and forty-three lines of Turkish, headings and meta
    // title included. `/en/earthquakes` was advertised as an English page and served a Turkish
    // one. When the page is wired to `messages/en.json`'s `Earthquake` namespace the original
    // argument applies again and this goes back to the default.
    ...sitemapEntriesFor(() => "/deprem", now, 0.7, "trOnly"),
    ...sitemapEntriesFor(() => "/dunya/kita", now, 0.8, "trOnly"),
    ...sitemapEntriesFor(() => "/hakkimizda", now, 0.5),
    // NINE ROUTES THAT WERE INDEXABLE AND UNADVERTISED.
    //
    // Each declares `"trOnly"` in its own `generateMetadata` — so each was crawlable, in the
    // hreflang set, and reachable from two to four internal links — while this file did not list
    // it. The asymmetry was invisible because `sitemap-surface-symmetry.test.ts` only walked
    // sitemap-row → page, never page → sitemap; that direction is now covered there.
    //
    // The contradiction that makes the omission plainly unintentional rather than a ruling: the
    // `/dunya/kita` hub and its seven children are the SAME shape — a `trOnly` hub over `trOnly`
    // detail pages — and both tiers were published, immediately above.
    ...sitemapEntriesFor(() => "/turkiye/bolge", now, 0.8, "trOnly"),
    ...sitemapEntriesFor(() => "/deniz/marmara", now, 0.6, "trOnly"),
    ...sitemapEntriesFor(() => "/deniz/ege", now, 0.6, "trOnly"),
    ...sitemapEntriesFor(() => "/deniz/akdeniz", now, 0.6, "trOnly"),
    ...sitemapEntriesFor(() => "/deniz/karadeniz", now, 0.6, "trOnly"),
    ...sitemapEntriesFor(() => "/deniz/kiyi-tipleri", now, 0.6, "trOnly"),
    ...sitemapEntriesFor(() => "/deprem/fay-hatlari", now, 0.6, "trOnly"),
    ...sitemapEntriesFor(() => "/deprem/hazirlik", now, 0.6, "trOnly"),
  ];
}

/**
 * Provinces hub. Real `lastmod` comes from each province's api `updated_at`, so we resolve
 * the (lean) list to full detail records. Resilience: a genuine 404 omits that province,
 * while a TRANSIENT failure is tolerated at BUILD (omit + warn) but RE-THROWN at runtime —
 * an api blip during ISR keeps the last good sitemap rather than dropping entries.
 */
async function provinceEntries(): Promise<MetadataRoute.Sitemap> {
  const provinces = await getProvincesResilient();
  const details = (
    await Promise.all(
      provinces.map(async (province) => {
        try {
          return await getProvinceBySlug(province.slugTr); // null ⇒ genuine 404
        } catch (error) {
          if (isProductionBuild()) {
            console.warn(
              `[sitemap] build-time detail fetch failed for ${province.slugTr}; omitting. ${String(error)}`,
            );
            return null;
          }
          throw error;
        }
      }),
    )
  ).filter((detail): detail is ProvinceDetail => detail !== null);

  return details.flatMap((detail) =>
    sitemapEntriesFor(
      (locale) => ({
        pathname: "/turkiye/[slug]",
        params: { slug: locale === "en" ? detail.slugEn : detail.slugTr },
      }),
      new Date(detail.updatedAt),
      0.7,
      "trNarrative",
    ),
  );
}

/**
 * Book hub + book detail pages.
 *
 * DATA ONLY — the composition rule moved to `lib/seo/book-sitemap.ts` (→ PR #62 review
 * `TEST62-I1`). What that file owns is the conditional part: an empty catalogue emits no hub
 * `<url>`, because the hub answers `notFound()` in that state and §B6 6.8 rates a 404 URL in
 * a sitemap a BLOCKER. It sits in `lib/` because that is the only side of this repo vitest
 * collects, and a conditional SEO rule CI cannot see is one a later refactor can drop
 * silently. Everything left here is the fetch and its build-vs-runtime resilience, which is
 * this file's half of the split its own docblock describes.
 */
async function bookEntries(): Promise<MetadataRoute.Sitemap> {
  return bookSitemapEntries(await getBooksResilient());
}

/** Countries hub. Same shape/resilience as the province builder, one hub up. */
async function countryEntries(): Promise<MetadataRoute.Sitemap> {
  const countries = await getCountriesResilient();
  const details = (
    await Promise.all(
      countries.map(async (country) => {
        try {
          return await getCountryBySlug(country.slugTr); // null ⇒ genuine 404
        } catch (error) {
          if (isProductionBuild()) {
            console.warn(
              `[sitemap] build-time detail fetch failed for ${country.slugTr}; omitting. ${String(error)}`,
            );
            return null;
          }
          throw error;
        }
      }),
    )
  ).filter((detail): detail is CountryDetail => detail !== null);

  return details.flatMap((detail) =>
    sitemapEntriesFor(
      (locale) => ({
        pathname: "/dunya/[slug]",
        params: { slug: locale === "en" ? detail.slugEn : detail.slugTr },
      }),
      new Date(detail.updatedAt),
      0.7,
      "trNarrative",
    ),
  );
}

/**
 * Geographic-region detail pages (7 regions).
 *
 * The mirror of {@link continentEntries}, and the ninth of the indexable routes this file was
 * not advertising. `/dunya/kita/[slug]` and `/turkiye/bolge/[slug]` are the same shape — a
 * `trOnly` hub over seven `trOnly` children, both built from a seven-item list — and only one of
 * them was published.
 *
 * Fetched rather than read from `lib/game/region-slug.ts` so the rows track the same source the
 * page's own `generateStaticParams` uses: a slug in the sitemap that `generateStaticParams` did
 * not build is a 404 in the urlset, which is the §B6 6.8 blocker pointing the other way.
 */
async function regionEntries(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const regions = await getRegionsResilient();
  return regions.flatMap((region) =>
    sitemapEntriesFor(
      () => ({ pathname: "/turkiye/bolge/[slug]", params: { slug: region.slug } }),
      now,
      0.7,
      "trOnly",
    ),
  );
}

/** Continents detail pages (7 continents). */
function continentEntries(): MetadataRoute.Sitemap {
  const now = new Date();
  const continents = getAllContinents();
  return continents.flatMap((continent) =>
    sitemapEntriesFor(
      () => ({
        pathname: "/dunya/kita/[slug]",
        params: { slug: continent.slugTr },
      }),
      now,
      0.7,
      "trOnly",
    ),
  );
}

/**
 * FORCE-DYNAMIC, and this route is the clearest case `docs/architecture.md`'s rule describes.
 *
 * Every dynamic tier below reaches the api through a `*Resilient` wrapper, and the production
 * Docker build has no network to the api container — so at build time all five degrade to empty
 * and that empty is what gets baked in. On a `revalidate`-only route it is then served until a
 * request happens to land after the window.
 *
 * Measured on the live deployment minutes after the 2026-09-17 release: **31 URLs instead of
 * 320.** The twenty static rows were all there; every province, country, book, continent and
 * region — 289 URLs — was missing, and would have stayed missing for up to an hour after each
 * deploy. Two hours earlier this file gained nine routes it had never advertised (#176), which
 * is a strange thing to fix on a document that arrives nine-tenths empty.
 *
 * The caching this gives up is worth nothing here: a sitemap is fetched by crawlers, rarely, and
 * one api round-trip per fetch is not a load concern. Correctness is the whole product of this
 * route — a sitemap that omits 90% of the site is worse than a slow one, and an empty-ish urlset
 * is a signal to a crawler, not a neutral absence.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Per-hub builders concatenated into one flat urlset. Provinces, countries and books fetch
  // in parallel (independent hubs); a build-time api outage degrades each to empty per its
  // own resilience, never failing the sitemap.
  const [provinces, countries, books, regions] = await Promise.all([
    provinceEntries(),
    countryEntries(),
    bookEntries(),
    regionEntries(),
  ]);
  return [
    ...staticEntries(),
    ...provinces,
    ...countries,
    ...books,
    ...regions,
    ...continentEntries(),
  ];
}
