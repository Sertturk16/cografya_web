import type { MetadataRoute } from "next";
import { getCountryBySlug, getCountriesResilient } from "@/lib/api/countries";
import { getProvinceBySlug, getProvincesResilient, isProductionBuild } from "@/lib/api/provinces";
import type { CountryDetail, ProvinceDetail } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Root sitemap — a single flat urlset served at `/sitemap.xml` (the URL `robots.ts` points
 * at). Total at pilot scale: static (4×2=8) + provinces (81×2=162) + countries (8×2=16) ≈
 * 186 URLs — a valid, self-contained sitemap far under Google's 50k-per-file hard limit.
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
 * Every entry carries the full hreflang alternates set (tr/en/x-default) so the language
 * mapping is annotated in the sitemap too, not only in <head>. `lastmod` is the entity's
 * real api `updated_at`.
 */

type Href = Parameters<typeof getPathname>[0]["href"];

// Sitemap URLs are built through the same absoluteUrl() helper as canonicals so the two
// can never drift (both must reference the identical origin + path form).
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

/** Static hub pages. */
function staticEntries(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...entriesFor(() => "/", now, 1),
    ...entriesFor(() => "/turkiye", now, 0.8),
    ...entriesFor(() => "/dunya", now, 0.8),
    ...entriesFor(() => "/hakkimizda", now, 0.5),
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
    entriesFor(
      (locale) => ({
        pathname: "/turkiye/[slug]",
        params: { slug: locale === "en" ? detail.slugEn : detail.slugTr },
      }),
      new Date(detail.updatedAt),
      0.7,
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
    entriesFor(
      (locale) => ({
        pathname: "/dunya/[slug]",
        params: { slug: locale === "en" ? detail.slugEn : detail.slugTr },
      }),
      new Date(detail.updatedAt),
      0.7,
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
