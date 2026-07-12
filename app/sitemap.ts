import type { MetadataRoute } from "next";
import { getProvinceBySlug, getProvincesResilient, isProductionBuild } from "@/lib/api/provinces";
import type { ProvinceDetail } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Root sitemap.
 *
 * SCALING NOTE (CONVENTIONS §6 #7): at MVP scale this is a single flat urlset so
 * `/sitemap.xml` returns a valid, self-contained sitemap. Google's per-file limit
 * is 50k URLs. EXPLICIT SPLIT TRIGGER — move to a sitemap index (per-hub
 * `app/<hub>/sitemap.ts` via `generateSitemaps()`, shards at `/<hub>/sitemap/[id].xml`)
 * at the FIRST of:
 *   (a) province × locale entries exceed ~150 (i.e. real 81 provinces × 2 = 162),
 *   (b) a SECOND real content hub is added (countries / districts / landforms /
 *       concepts), or
 *   (c) total urlset entries approach ~10k (well under Google's 50k, keeps files fast).
 * The per-hub entry builders below are already isolated so that split is mechanical.
 *
 * Every entry carries the full hreflang alternates set (tr/en/x-default) so the
 * language mapping is annotated in the sitemap too, not only in <head>.
 */

type Href = Parameters<typeof getPathname>[0]["href"];

// Sitemap URLs are built through the same absoluteUrl() helper as canonicals so the
// two can never drift (both must reference the identical origin + path form).
function languagesFor(hrefForLocale: (locale: Locale) => Href): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteUrl(getPathname({ locale, href: hrefForLocale(locale) }));
  }
  languages["x-default"] = absoluteUrl(
    getPathname({
      locale: routing.defaultLocale,
      href: hrefForLocale(routing.defaultLocale),
    }),
  );
  return languages;
}

/** One <url> per locale for a logical page, each carrying the full alternates set. */
function entriesFor(
  hrefForLocale: (locale: Locale) => Href,
  lastModified: Date,
  priority: number,
): MetadataRoute.Sitemap {
  const languages = languagesFor(hrefForLocale);
  return routing.locales.map((locale) => ({
    url: absoluteUrl(getPathname({ locale, href: hrefForLocale(locale) })),
    lastModified,
    changeFrequency: "weekly" as const,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Hub: static pages.
  const staticEntries: MetadataRoute.Sitemap = [
    ...entriesFor(() => "/", now, 1),
    ...entriesFor(() => "/turkiye", now, 0.8),
    ...entriesFor(() => "/hakkimizda", now, 0.5),
  ];

  // Hub: provinces. Real `lastmod` comes from each province's api `updated_at`,
  // so we resolve the (lean) list to full detail records. NOTE(follow-up): the
  // list DTO has no `updated_at`, hence the per-province detail fetch — adding
  // `updatedAt` to `ProvinceListItemDto` (an additive contract change, via Atlas)
  // would drop this to a single list call.
  //
  // Resilience matches the rest of this PR (see getProvincesResilient): a genuine
  // 404 omits that province (won't happen for a listed slug, but harmless), while a
  // TRANSIENT failure is tolerated at BUILD (omit + warn) but RE-THROWN at runtime —
  // so an api blip during ISR keeps the last good sitemap instead of silently
  // dropping a province from the index.
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

  const provinceEntries: MetadataRoute.Sitemap = details.flatMap((detail) =>
    entriesFor(
      (locale) => ({
        pathname: "/turkiye/[slug]",
        params: { slug: locale === "en" ? detail.slugEn : detail.slugTr },
      }),
      new Date(detail.updatedAt),
      0.7,
    ),
  );

  return [...staticEntries, ...provinceEntries];
}
