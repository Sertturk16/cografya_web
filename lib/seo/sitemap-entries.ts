import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { type ContentSurface, indexableLocales } from "@/lib/seo/indexing";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Pure sitemap-entry builders.
 *
 * These live in `lib/seo/` rather than inside `app/sitemap.ts` on purpose: they are the
 * half of the sitemap that encodes SEO POLICY (which locales get a `<url>`, which
 * `xhtml:link` alternates each carries), and policy needs to be unit-testable without
 * dragging in the api fetching + build-time resilience that `app/sitemap.ts` owns. That
 * file keeps the data orchestration; this one keeps the rules.
 *
 * The entry set is derived from the SAME `indexableLocales()` call that
 * `lib/seo/metadata.ts` uses for the in-`<head>` hreflang cluster, so the two surfaces
 * cannot drift — a guarantee `sitemap-entries.test.ts` asserts directly.
 */

/** The `href` shape accepted by next-intl's `getPathname` (string or {pathname, params}). */
export type Href = Parameters<typeof getPathname>[0]["href"];

/** Given a locale, returns the next-intl href for THIS page in that locale. */
export type HrefForLocale = (locale: Locale) => Href;

/**
 * The `xhtml:link` alternates for a logical page: one entry per INDEXABLE locale plus
 * `x-default` pointing at the default locale (which is never de-indexed).
 *
 * URLs go through the same `absoluteUrl()` helper as canonicals so the two can never
 * drift — both must reference the identical origin + path form.
 */
export function alternateLanguagesFor(
  hrefForLocale: HrefForLocale,
  surface: ContentSurface,
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of indexableLocales(surface)) {
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

/**
 * One `<url>` per INDEXABLE locale for a logical page, each carrying the alternates set.
 *
 * A `noindex` URL is deliberately omitted rather than listed: a sitemap entry is a request
 * to index, so listing a page that answers `noindex` sends the crawler two opposite signals
 * for the same URL. It also matters that Search Central calls sitemap `xhtml:link`
 * annotations *equivalent* to the in-`<head>` tags — so leaving the EN alternate in the
 * sitemap would rebuild in XML the very hreflang cluster `buildAlternates` dissolves in the
 * document head, and the two surfaces would contradict each other.
 *
 * (The known exception — John Mueller's advice to KEEP already-indexed URLs in the sitemap
 * with a fresh `lastmod` so Googlebot recrawls and sees the new `noindex` faster — does not
 * apply here: the site has never been deployed (`NEXT_PUBLIC_SITE_URL` is still localhost,
 * there is no deploy job), so none of these URLs are in any index to be evicted. There is
 * nothing to accelerate; this ships before first crawl. NOTE: that premise is a fact about
 * today, not an invariant — it must be re-verified before the first production deploy.)
 */
export function sitemapEntriesFor(
  hrefForLocale: HrefForLocale,
  lastModified: Date,
  priority: number,
  surface: ContentSurface = "localized",
): MetadataRoute.Sitemap {
  const locales = indexableLocales(surface);
  // Computed once and shared by every entry for this logical page: the alternates set is
  // identical across the cluster by definition, and one call site means the URL form can
  // never be built two slightly different ways. (Shared by reference — harmless for
  // serialized output, and the value is never mutated downstream.)
  const languages = alternateLanguagesFor(hrefForLocale, surface);
  return locales.map((locale) => ({
    url: absoluteUrl(getPathname({ locale, href: hrefForLocale(locale) })),
    lastModified,
    changeFrequency: "weekly" as const,
    priority,
    alternates: { languages },
  }));
}
