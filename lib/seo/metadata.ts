import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { type ContentSurface, indexableLocales, isIndexable } from "./indexing";
import { getSiteUrl, siteConfig } from "./site";

/** The `href` shape accepted by next-intl's `getPathname` (string or {pathname, params}). */
type Href = Parameters<typeof getPathname>[0]["href"];

/**
 * Given a locale, returns the next-intl href for THIS page in that locale. For
 * static routes it ignores the locale; for localized-slug routes it supplies the
 * per-locale slug (slug_tr vs slug_en) so alternates point at the right URL.
 */
type HrefForLocale = (locale: Locale) => Href;

interface BuildMetadataArgs {
  locale: Locale;
  hrefForLocale: HrefForLocale;
  title: string;
  description: string;
  /** When true, `title` is used verbatim (bypasses the `%s · brand` template). */
  titleAbsolute?: boolean;
  openGraphType?: "website" | "article";
  /**
   * Content shape of the route — drives the per-locale indexing policy
   * (`lib/seo/indexing.ts`). Defaults to `"localized"` (fully indexable in both locales),
   * so a route only opts INTO de-indexing, never accidentally out of indexing.
   */
  surface?: ContentSurface;
}

/**
 * Builds a self-referencing canonical + symmetric hreflang set for a route
 * (CONVENTIONS §6 #3, #4). Paths are relative; Next resolves them against
 * `metadataBase` (set once in the locale layout).
 *
 * **hreflang membership follows the INDEXING policy, not the locale list.** A `noindex`
 * URL must never sit inside an hreflang cluster: Google's Gary Illyes has stated that
 * hreflang hints "clusters of pages … that might influence each other", so with
 * cross-language duplication a single `noindex` member can drag the whole cluster down —
 * and the TR corpus is the entire value of this site. Rather than risk propagation, a
 * de-indexed locale is *dissolved out* of the cluster:
 *
 * - the de-indexed page (EN) gets a **self-referencing canonical and NO `languages` map** —
 *   it belongs to no cluster at all;
 * - its TR counterpart drops the `en` entry, leaving a valid single-member `tr` +
 *   `x-default` cluster.
 *
 * Symmetry (Search Central: "If two pages don't both point to each other, the tags will be
 * ignored") is therefore preserved — neither side points at the other, so no annotation is
 * ever one-legged. Flipping `EN_CONTENT_READY` restores the full two-locale cluster on both
 * sides simultaneously, which is why the two halves can never drift apart.
 */
export function buildAlternates(
  locale: Locale,
  hrefForLocale: HrefForLocale,
  surface: ContentSurface = "localized",
): NonNullable<Metadata["alternates"]> {
  const canonical = getPathname({ locale, href: hrefForLocale(locale) });

  // A de-indexed locale carries a self-canonical only. Self-referencing (never pointing at
  // the TR page): a cross-locale canonical COMBINED with noindex is the one shape Google
  // warns about, since it asks the indexer to consolidate onto a page it was just told not
  // to index.
  if (!isIndexable(locale, surface)) return { canonical };

  const locales = indexableLocales(surface);
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = getPathname({ locale: l, href: hrefForLocale(l) });
  }
  // x-default points at the default locale (TR), which is always indexable.
  languages["x-default"] = getPathname({
    locale: routing.defaultLocale,
    href: hrefForLocale(routing.defaultLocale),
  });

  return { canonical, languages };
}

/**
 * Central metadata builder (CONVENTIONS §6 #2). Every dynamic route funnels its
 * title/description + alternates through here so the SEO surface stays uniform.
 */
export function buildMetadata(args: BuildMetadataArgs): Metadata {
  const {
    locale,
    hrefForLocale,
    title,
    description,
    titleAbsolute = false,
    openGraphType = "website",
    surface = "localized",
  } = args;

  const canonicalPath = getPathname({ locale, href: hrefForLocale(locale) });

  return {
    title: titleAbsolute ? { absolute: title } : title,
    description,
    alternates: buildAlternates(locale, hrefForLocale, surface),
    // `noindex, follow` for a locale with no genuine content (lib/seo/indexing.ts).
    // `follow` is load-bearing: the page stays a first-class citizen of the crawl graph,
    // so the links it carries (neighbours, hubs, breadcrumbs) keep passing signals. Omitted
    // entirely when indexable, so an indexable page never emits a robots meta at all.
    ...(isIndexable(locale, surface) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: openGraphType,
      locale,
      alternateLocale: routing.locales.filter((l) => l !== locale),
      siteName: siteConfig.name,
      title,
      description,
      url: `${getSiteUrl()}${canonicalPath}`,
    },
    // Central Twitter Card (CONVENTIONS §6 SEO surface). `images` is intentionally
    // omitted: the `app/[locale]/opengraph-image.tsx` file convention injects both
    // `og:image` and `twitter:image` (absolute, via metadataBase) for every page,
    // so the default share image lives in ONE place and is never hand-duplicated here.
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
