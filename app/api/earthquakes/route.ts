import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getEarthquakeList } from "@/lib/api/earthquakes";
import { parseEarthquakeFilterParams } from "@/lib/earthquake/query";

/**
 * `/api/earthquakes` — the `/deprem` hub's client filter/pagination island (§5.5,
 * `deprem-sayfalari` plan).
 *
 * `apiGet` (`lib/api/client.ts`) is `server-only` and attaches `INTERNAL_REQUEST_TOKEN`, so a
 * browser can never call the api directly. This repo's established answer for a client-safe
 * read is a thin Route Handler proxy on our OWN origin — `app/api/reference/departments/
 * route.ts`, `app/api/reference/universities/route.ts` and `app/api/search-index/[locale]/
 * route.ts` all exist today for exactly this shape.
 *
 * Only the five documented `EarthquakeListQueryDto` parameters are forwarded
 * (`parseEarthquakeFilterParams`), never a blind passthrough of the incoming query string —
 * the api's own global pipe rejects an unrecognised parameter (400), and this keeps that
 * behaviour explicit rather than accidental.
 *
 * DELIBERATELY NOT a build-time-resilient wrapper (`getEarthquakeListResilient`). Reading
 * `request.url`'s search params makes this handler genuinely dynamic — Next never attempts to
 * evaluate it during `next build` the way it does the zero-argument `departments`/
 * `universities` routes, so the "web CI has no api service" case this repo's `…Resilient`
 * split exists for cannot arise here; every invocation is a real runtime request, where a
 * reachable api is the same assumption every other runtime-only proxy in this repo already
 * makes.
 *
 * Cache window mirrors `EARTHQUAKE_LIST_REVALIDATE_SECONDS` (120 s, `lib/api/earthquakes.ts`),
 * itself a mirror of the api's own `s-maxage=120` — the same reasoning §5.2 states for the
 * page's own ISR window, applied to this proxy's shared-cache header.
 */
const EARTHQUAKE_PROXY_CACHE_CONTROL =
  "public, max-age=30, s-maxage=120, stale-while-revalidate=600";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = parseEarthquakeFilterParams(url.searchParams);

  try {
    const list = await getEarthquakeList(filter);
    return NextResponse.json(list, {
      headers: { "Cache-Control": EARTHQUAKE_PROXY_CACHE_CONTROL },
    });
  } catch (error) {
    // A 400 from the api (an out-of-range/malformed value the parser above could not already
    // catch, e.g. fromUtc later than toUtc) is passed through as the same status — the
    // client island's own validation stays honest about what the api actually rejected,
    // rather than reporting every failure as a generic outage.
    if (error instanceof ApiError && error.status === 400) {
      return NextResponse.json({ error: "invalid_query" }, { status: 400 });
    }
    console.error(`[earthquakes] proxy fetch failed: ${String(error)}`);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
