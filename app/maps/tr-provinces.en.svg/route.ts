import { baseMapResponse, buildTrBaseMapSvg } from "@/lib/map/base-map-svg";

/**
 * `/maps/tr-provinces.en.svg` — the English twin of `/maps/tr-provinces.svg`.
 *
 * The ONLY difference is which message key the drawn ODbL credit is read from
 * (`© OpenStreetMap contributors, ODbL` rather than `© OpenStreetMap katkıcıları, ODbL`).
 * Rationale and the four-route decision: see the Turkish route's docblock.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return baseMapResponse(buildTrBaseMapSvg("en"));
}
