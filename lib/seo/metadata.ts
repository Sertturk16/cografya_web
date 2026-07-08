import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
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
}

/**
 * Builds a self-referencing canonical + symmetric hreflang set (tr / en /
 * x-default) for a route (CONVENTIONS §6 #3, #4). Paths are relative; Next
 * resolves them against `metadataBase` (set once in the locale layout).
 */
export function buildAlternates(
  locale: Locale,
  hrefForLocale: HrefForLocale,
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = getPathname({ locale: l, href: hrefForLocale(l) });
  }
  // x-default points at the default locale (TR).
  languages["x-default"] = getPathname({
    locale: routing.defaultLocale,
    href: hrefForLocale(routing.defaultLocale),
  });

  return {
    canonical: languages[locale],
    languages,
  };
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
  } = args;

  const canonicalPath = getPathname({ locale, href: hrefForLocale(locale) });

  return {
    title: titleAbsolute ? { absolute: title } : title,
    description,
    alternates: buildAlternates(locale, hrefForLocale),
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
