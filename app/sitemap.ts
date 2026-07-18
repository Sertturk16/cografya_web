import type { MetadataRoute } from "next";
import { getCountryBySlug, getCountriesResilient } from "@/lib/api/countries";
import { getProvinceBySlug, getProvincesResilient, isProductionBuild } from "@/lib/api/provinces";
import type { CountryDetail, ProvinceDetail } from "@/lib/api/types";
import { sitemapEntriesFor } from "@/lib/seo/sitemap-entries";

/**
 * Root sitemap — a single flat urlset served at `/sitemap.xml` (the URL `robots.ts` points
 * at). Composition: static hubs (4 pages × 2 locales = 8) + provinces + countries at ONE
 * entry each (TR only — their EN counterparts are `noindex`, see `sitemapEntriesFor` in
 * `lib/seo/sitemap-entries.ts`) — a valid, self-contained sitemap far under Google's
 * 50k-per-file hard limit.
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
  // Per-hub builders concatenated into one flat urlset. Provinces + countries fetch in
  // parallel (independent hubs); a build-time api outage degrades each to empty per its own
  // resilience, never failing the sitemap.
  const [provinces, countries] = await Promise.all([provinceEntries(), countryEntries()]);
  return [...staticEntries(), ...provinces, ...countries];
}
