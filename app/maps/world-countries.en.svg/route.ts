import { baseMapResponse, buildWorldBaseMapSvg } from "@/lib/map/base-map-svg";

/**
 * `/maps/world-countries.en.svg` — the English twin of `/maps/world-countries.svg`.
 * See the Turkish route's docblock.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return baseMapResponse(buildWorldBaseMapSvg("en"));
}
