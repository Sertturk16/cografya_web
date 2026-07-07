import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { placeholderProvinces } from "@/lib/geo/placeholder-provinces";
import { getSiteUrl } from "@/lib/seo/site";

/**
 * Root sitemap.
 *
 * SCALING NOTE (CONVENTIONS §6 #7): at MVP scale this is a single flat urlset so
 * `/sitemap.xml` returns a valid, self-contained sitemap. Google's per-file limit
 * is 50k URLs. When any hub (e.g. the 81 provinces × 2 locales, then countries /
 * districts / concepts) approaches that, split THAT hub into its own
 * `app/<hub>/sitemap.ts` using `generateSitemaps()` (Next serves shards at
 * `/<hub>/sitemap/[id].xml`) and reference them from a sitemap index. The per-hub
 * entry builders below are already isolated so that split is mechanical.
 *
 * Every entry carries the full hreflang alternates set (tr/en/x-default) so the
 * language mapping is annotated in the sitemap too, not only in <head>.
 */

type Href = Parameters<typeof getPathname>[0]["href"];

const siteUrl = getSiteUrl();

function abs(path: string): string {
  return `${siteUrl}${path}`;
}

function languagesFor(hrefForLocale: (locale: Locale) => Href): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = abs(getPathname({ locale, href: hrefForLocale(locale) }));
  }
  languages["x-default"] = abs(
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
    url: abs(getPathname({ locale, href: hrefForLocale(locale) })),
    lastModified,
    changeFrequency: "weekly" as const,
    priority,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Hub: static pages.
  const staticEntries: MetadataRoute.Sitemap = [
    ...entriesFor(() => "/", now, 1),
    ...entriesFor(() => "/iller", now, 0.8),
    ...entriesFor(() => "/hakkimizda", now, 0.5),
  ];

  // Hub: provinces (placeholder set today; real lastmod from api `updated_at`).
  const provinceEntries: MetadataRoute.Sitemap = placeholderProvinces.flatMap((province) =>
    entriesFor(
      (locale) => ({
        pathname: "/il/[slug]",
        params: { slug: province.slug[locale] },
      }),
      new Date(province.updatedAt),
      0.7,
    ),
  );

  return [...staticEntries, ...provinceEntries];
}
