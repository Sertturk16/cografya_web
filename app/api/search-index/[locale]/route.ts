import { NextResponse } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { CONTENT_REVALIDATE_SECONDS } from "@/lib/api/client";
import { getCountries } from "@/lib/api/countries";
import { getProvinces } from "@/lib/api/provinces";
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
 * listing it.
 *
 * ## Indexing posture
 *
 * `robots.ts` disallows `/api/`, which is correct and not a de-indexing trick
 * (`CONVENTIONS.md` §6 #8): this is a data file, not a page, and it is NOT required to
 * render anything — the header's fallback link is in the server HTML with or without it, so
 * blocking it cannot hide content from a crawler. It is also unlinked, so nothing discovers
 * it in the first place.
 *
 * ## `force-dynamic`, not build-time-prerendered
 *
 * This route used to set `revalidate = 3600` and prerender BOTH real locales via
 * `generateStaticParams` — which is the same bug class as T-020 wearing a dynamic-segment
 * disguise: because every possible `[locale]` value was enumerated at build, the handler's
 * body still ran once during `next build`, where `getProvincesResilient`/
 * `getCountriesResilient` degrade to `[]` (the production Docker build has no network access
 * to the api container). That baked an empty search index into BOTH locale variants, served
 * until ISR's background revalidation kicked in. `force-dynamic` runs this handler at
 * request time only; freshness/caching is handled entirely by this handler's own
 * `Cache-Control` header below, which the CDN and browser already respect.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ locale: string }> }) {
  const { locale } = await ctx.params;
  // An unknown locale is a real 404, never an empty 200 — the same rule the pages follow
  // (CONVENTIONS §6 #6). It also keeps the route from becoming an open generator of empty
  // documents for arbitrary path segments.
  if (!hasLocale(routing.locales, locale)) {
    return new NextResponse(null, { status: 404 });
  }

  // `force-dynamic` means this body only ever runs at request time — no build-time
  // resilience wrapper needed (previously used `getProvincesResilient`/
  // `getCountriesResilient`; dropped for the same reason `lib/reference/reference.server.ts`
  // dropped its own, see T-020). A genuine api outage throws and surfaces as a 500 from this
  // handler; the island's `!response.ok` branch degrades to the fallback link, and a failed
  // attempt no longer latches search off for the session.
  const [provinces, countries] = await Promise.all([getProvinces(), getCountries()]);

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
