import { getCountriesResilient } from "@/lib/api/countries";
import { flagIsoCodes, readFlagSvg } from "@/lib/geo/flag-set";

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

interface RouteParams {
  params: Promise<{ flag: string }>;
}

const SVG_SUFFIX = ".svg";

export async function generateStaticParams() {
  const countries = await getCountriesResilient();
  const available = flagIsoCodes();
  // Only the seeded rows that actually HAVE an asset. Emitting the package's other ~80 files
  // would ship flags for entities with no page, and emitting a seeded row with no asset would
  // produce a 404 the fail-soft card is already designed never to reach.
  return countries
    .map((country) => country.isoCode)
    .filter((iso) => available.has(iso))
    .map((iso) => ({ flag: `${iso}${SVG_SUFFIX}` }));
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const { flag } = await params;
  const svg = flag.endsWith(SVG_SUFFIX) ? readFlagSvg(flag.slice(0, -SVG_SUFFIX.length)) : null;
  // Unknown/absent ISO → a real 404, never an empty 200 body (the soft-404 rule, applied to an
  // asset route). The country page's own gate means a reader never follows such a URL.
  if (svg === null) return new Response("Not found", { status: 404 });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Same 7-day window as the base maps (→ DEC 2026-08-08a md.2): plain `max-age`, no
      // content hash, because a hash would need a dynamic filename segment and the upstream
      // set is version-pinned in `package.json`.
      "Cache-Control": "public, max-age=604800",
    },
  });
}
