import { getCountriesResilient } from "@/lib/api/countries";
import { flagIsoCodes } from "@/lib/geo/flag-set";
import { flagParamsForCountries } from "@/lib/geo/flag-route";
import { flagResponseForRequest } from "@/lib/geo/flag-route.server";

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
 * `force-static` + `generateStaticParams` prerenders the build-time corpus. When the API is
 * unavailable at build, or learns a country after the build, this route may render that flag
 * on demand — but only after the runtime API corpus and the atomic asset catalogue both
 * authorize it. No binary is committed.
 */
export const dynamic = "force-static";

/**
 * Origin Full Route Cache policy. The runtime membership fetch uses this same 60-second value
 * for the same `/api/countries` Data Cache key, including when that key was populated before a
 * post-build seed. Response `Cache-Control` only governs downstream caches; it is not a
 * substitute for this explicit route revalidation contract.
 */
// Keep this literal: Next requires route-segment config values to be statically analyzable.
export const revalidate = 60;

/**
 * On-demand rendering is required because the detail route itself supports API-offline builds
 * and post-build seeds. It is safe only because `loadFlagSvgForRequest()` gates the decoded
 * segment by shape, resolved asset and CURRENT API corpus before the sole filesystem read.
 * Unknown, traversal-shaped and package-only params therefore reach neither the reader nor a
 * long-lived false catalogue. Transient runtime API/read faults reject instead of becoming an
 * empty memoised corpus or 404; Next can retain the last good static artifact.
 */
export const dynamicParams = true;

interface RouteParams {
  params: Promise<{ flag: string }>;
}

export async function generateStaticParams() {
  const countries = await getCountriesResilient();
  return flagParamsForCountries(countries, flagIsoCodes());
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const { flag } = await params;
  return flagResponseForRequest(flag);
}
