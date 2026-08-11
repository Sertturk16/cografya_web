import { getCountriesResilient } from "@/lib/api/countries";
import { FLAG_URL_SUFFIX, flagIsoCodes, flagParamToIso, readFlagSvg } from "@/lib/geo/flag-set";

/**
 * `/flags/{ISO}.svg` — one static flag asset per country, emitted at build.
 *
 * ## Why a per-country asset and not inline SVG or a sprite (plan §7.3, measured)
 *
 * The set's size distribution is brutally skewed. Re-measured on the installed package
 * (`flag-icons@7.5.0`, 271 files in `flags/4x3`, 2026-08-08): median 804 B, but `rs`
 * 181,634 B, `bo` 102,880 B, `mx` 84,753 B, `es` 80,958 B. Inlining would put ~363 KB of
 * Serbian coat-of-arms into that page's HTML once Next's RSC double-serialisation is counted;
 * a shared sprite would ship ~1 MB to EVERY country page. A per-country asset keeps the page's
 * own HTML at ~60 B and charges the heavy file once, to the one page that shows it, cached
 * thereafter. LCP is never at risk: the flag renders at ~32 × 24 CSS px.
 *
 * ## Why the parameter carries the extension
 *
 * The plan specified `app/flags/[iso].svg/route.ts`. **Next 16 does not support that**: a
 * folder named `[iso].svg` is a LITERAL segment, `params` types as `{}`, and the build fails
 * type-checking (verified, 2026-08-08). The dot cannot be dropped either — `proxy.ts`'s
 * matcher excludes any path CONTAINING a dot, and that exclusion is what keeps next-intl from
 * rewriting this URL into a locale. So the extension moves into the parameter VALUE: the
 * segment is `[flag]` and the value is `TR.svg`. The public URL is unchanged.
 *
 * `force-static` + `generateStaticParams` prerenders every seeded country's flag at build, so
 * the package is read at BUILD time only and no binary is committed.
 */
export const dynamic = "force-static";

/**
 * No on-demand rendering: a param outside `generateStaticParams` is a 404, decided by the
 * router before this module runs.
 *
 * This is the second half of the traversal fix, and it is not redundant with the validation in
 * `flagParamToIso`. `force-static` alone does NOT close the runtime path — the prerender
 * manifest records `"fallback": null` for this route, and Next's app-route template only throws
 * `NoFallbackError` when `fallback === false`, so with the default `dynamicParams = true` an
 * unlisted param still reached the handler and was rendered on demand. Belt and braces on a
 * boundary that serves files from disk: one guard makes the wrong request unreachable, the
 * other makes it harmless if it ever becomes reachable again.
 */
export const dynamicParams = false;

interface RouteParams {
  params: Promise<{ flag: string }>;
}

export async function generateStaticParams() {
  const countries = await getCountriesResilient();
  const available = flagIsoCodes();
  // Only the seeded rows that actually HAVE an asset. Emitting the package's other ~80 files
  // would ship flags for entities with no page, and emitting a seeded row with no asset would
  // produce a 404 the fail-soft card is already designed never to reach.
  return countries
    .map((country) => country.isoCode)
    .filter((iso) => available.has(iso))
    .map((iso) => ({ flag: `${iso}${FLAG_URL_SUFFIX}` }));
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const { flag } = await params;
  // Validate BEFORE touching the filesystem. `flagParamToIso` is the allow-list gate and it
  // lives in `lib/` so CI can actually test it; see its docblock for why an unvalidated param
  // here was a path-traversal read primitive rather than a formatting bug.
  const iso = flagParamToIso(flag);
  const svg = iso === null ? null : readFlagSvg(iso);
  // Unknown/absent ISO → a real 404, never an empty 200 body (the soft-404 rule, applied to an
  // asset route). The country page's own gate means a reader never follows such a URL.
  if (svg === null) {
    return new Response("Not found", {
      status: 404,
      // RFC 9111 lets an intermediary apply heuristic freshness to an uncached 404, so a
      // transient one could outlive its cause at the edge. A short explicit window bounds that
      // without disabling caching. Verified against a running server: with
      // `dynamicParams = false` the ROUTER now answers most bad URLs before this handler runs
      // (and sends its own no-store), so what is left for this branch is the narrow case of a
      // prerendered param whose file has gone missing at runtime — which is exactly the
      // transient the window is for.
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // SVG is an active-content format served from our own origin, so it carries the two
      // containment headers the app sets nowhere else yet: `nosniff` stops a
      // content-type-confusion path, and the sandboxing CSP means that even if a hostile SVG
      // ever reached this route it could not run script in this origin. Cheap, and it is the
      // layer that would have capped the impact of the traversal defect this range fixes.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      // Same 7-day window as the base maps (→ DEC 2026-08-08a md.2): plain `max-age`, no
      // content hash, because a hash would need a dynamic filename segment and the upstream
      // set is pinned to an exact version in `package.json` (a caret range would have made
      // this sentence false — a lockfile refresh could change the bytes behind an unchanged
      // URL for up to a week).
      "Cache-Control": "public, max-age=604800",
    },
  });
}
