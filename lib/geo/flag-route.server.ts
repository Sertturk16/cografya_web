import "server-only";
import { getCountriesForFlagAuthorization } from "@/lib/api/countries";
import { flagIsoCodes, readFlagSvg } from "./flag-set";
import { loadFlagSvgForRequest } from "./flag-route";

/**
 * Complete public flag decision: one reader capability, injected only into the collectible
 * shape → asset → current-API gate, and one response body derived from that gate's result.
 */
export async function flagResponseForRequest(param: string): Promise<Response> {
  const svg = await loadFlagSvgForRequest(param, {
    availableIsoCodes: flagIsoCodes,
    getCountryIsoCodes: async () =>
      (await getCountriesForFlagAuthorization()).map((country) => country.isoCode),
    readSvg: readFlagSvg,
    warn: (message, error) => console.warn(message, error),
  });

  // Deliberate negative decisions are a real 404, never an empty 200. The route's 60-second
  // Data + Full Route Cache policy bounds recovery when a valid country is newly seeded.
  // API and admitted-read exceptions never reach this branch; they rethrow so ISR preserves
  // a last-good artifact instead of storing infrastructure failure as absence.
  if (svg === null) {
    return new Response("Not found", {
      status: 404,
      // RFC 9111 permits heuristic freshness for an otherwise uncached 404. Keep downstream
      // caches aligned with the route's explicit origin revalidation window.
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // SVG is active content served from our origin. `nosniff` closes content-type confusion;
      // the bare sandbox keeps this no-link route stricter than linked base-map SVGs.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      // Same seven-day downstream window as base maps. Bytes are pinned by the exact package
      // version or committed local override; origin admission is refreshed separately.
      "Cache-Control": "public, max-age=604800",
    },
  });
}
