import type { MetadataRoute } from "next";
import { getBooksResilient } from "@/lib/api/books";
import { getCountryBySlug, getCountriesResilient } from "@/lib/api/countries";
import { getProvinceBySlug, getProvincesResilient, isProductionBuild } from "@/lib/api/provinces";
import type { CountryDetail, ProvinceDetail } from "@/lib/api/types";
import { bookSitemapEntries } from "@/lib/seo/book-sitemap";
import { sitemapEntriesFor } from "@/lib/seo/sitemap-entries";

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
    // The map game hub. `"localized"` surface → one entry per locale (/oyun + /en/game),
    // each carrying the full tr/en/x-default alternates set, both resolved through
    // `getPathname` from the single `pathnames` entry in `i18n/routing.ts`.
    ...sitemapEntriesFor(() => "/oyun", now, 0.7),
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
    ...sitemapEntriesFor(() => "/hakkimizda", now, 0.5),
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Per-hub builders concatenated into one flat urlset. Provinces, countries and books fetch
  // in parallel (independent hubs); a build-time api outage degrades each to empty per its
  // own resilience, never failing the sitemap.
  const [provinces, countries, books] = await Promise.all([
    provinceEntries(),
    countryEntries(),
    bookEntries(),
  ]);
  return [...staticEntries(), ...provinces, ...countries, ...books];
}
