import { baseMapResponse, buildWorldBaseMapSvg } from "@/lib/map/base-map-svg";

/**
 * `/maps/world-countries.svg` — the Turkish shared base silhouette behind every country
 * locator mini-map. Same mechanism as `/maps/tr-provinces.svg`; see that file's docblock.
 *
 * This file carries NO drawn credit: Natural Earth is public domain. It is still
 * locale-specific because its `<title>`/`<desc>` (the accessible name a standalone SVG needs,
 * and the source line) come from `messages/*.json`.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return baseMapResponse(buildWorldBaseMapSvg("tr"));
}
