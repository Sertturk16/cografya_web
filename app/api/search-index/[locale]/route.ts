import { NextResponse } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { CONTENT_REVALIDATE_SECONDS } from "@/lib/api/client";
import { getCountriesResilient } from "@/lib/api/countries";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildSearchIndex } from "@/lib/search/index-source";
import type { SearchIndexPayload } from "@/lib/search/types";

/**
 * `/api/search-index/{locale}` — the header search's data source.
 *
 * ## Why an endpoint and not an embed
 *
 * The header renders on EVERY page, so embedding the index would serialize ~2.8 KB gzipped
 * into both the HTML and the RSC flight payload of every route — measured at roughly 5.5 KB
 * per page, on the LCP path, for a control most visits never touch. Served here instead it
 * is fetched once, lazily, on the reader's first interaction with the box, and then cached.
 * The standing page cost is zero bytes.
 *
 * ## Why not a build-time module
 *
 * A generated TS module would be frozen at build time, so a newly seeded country would stay
 * unfindable until the next deploy — inconsistent with the ISR hubs that would already be
 * listing it. `revalidate` matches `CONTENT_REVALIDATE_SECONDS`, the same window every hub
 * uses, so the index is exactly as fresh as the pages it points at.
 *
 * ## Indexing posture
 *
 * `robots.ts` disallows `/api/`, which is correct and not a de-indexing trick
 * (`CONVENTIONS.md` §6 #8): this is a data file, not a page, and it is NOT required to
 * render anything — the header's fallback link is in the server HTML with or without it, so
 * blocking it cannot hide content from a crawler. It is also unlinked, so nothing discovers
 * it in the first place.
 */
/**
 * Next requires a route segment config export to be a statically analyzable literal, so
 * this cannot BE `CONTENT_REVALIDATE_SECONDS` (importing it fails the build with "Invalid
 * segment configuration export"). The annotation is the guard instead: it is the shared
 * constant's literal type, so changing the constant without changing this number is a
 * type error rather than silent drift.
 */
export const revalidate: typeof CONTENT_REVALIDATE_SECONDS = 3600;

/** Pre-render both locales at build time; ISR refreshes them on the window above. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(_request: Request, ctx: { params: Promise<{ locale: string }> }) {
  const { locale } = await ctx.params;
  // An unknown locale is a real 404, never an empty 200 — the same rule the pages follow
  // (CONVENTIONS §6 #6). It also keeps the route from becoming an open generator of empty
  // documents for arbitrary path segments.
  if (!hasLocale(routing.locales, locale)) {
    return new NextResponse(null, { status: 404 });
  }

  // Build-time resilient, runtime strict — the honest contract (review M2): the resilient
  // helpers return `[]` only during `next build`, and RE-THROW at runtime, so an api outage
  // during ISR regeneration surfaces as a 500 from this handler rather than an empty 200.
  // Either way the island's `!response.ok` branch degrades to the fallback link, and a failed
  // attempt no longer latches search off for the session.
  const [provinces, countries] = await Promise.all([
    getProvincesResilient(),
    getCountriesResilient(),
  ]);

  const payload: SearchIndexPayload = {
    entries: buildSearchIndex({
      provinces,
      countries,
      locale,
      // Paths resolved through the routing table here, on the server, so the client never
      // needs to know how a province or country URL is spelled in either locale.
      provincePath: (slug) =>
        getPathname({ locale, href: { pathname: "/turkiye/[slug]", params: { slug } } }),
      countryPath: (slug) =>
        getPathname({ locale, href: { pathname: "/dunya/[slug]", params: { slug } } }),
    }),
  };

  return NextResponse.json(payload, {
    headers: {
      // A short BROWSER lifetime so a reader who searches, navigates and searches again does
      // not re-download the index. (An earlier version of this comment justified it with
      // "every navigation is a full page load", which is wrong — the header uses next-intl
      // `Link`, i.e. client-side RSC navigation, and the island does not even remount. The
      // cache window is still worth having for full loads and cross-tab visits; review M3.)
      // `s-maxage` keeps shared caches on the same 1 h window as the content itself.
      // The browser window is deliberately much shorter than the content window: this file
      // may lag a freshly seeded entity by minutes, never by an hour.
      "Cache-Control": `public, max-age=300, s-maxage=${CONTENT_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
