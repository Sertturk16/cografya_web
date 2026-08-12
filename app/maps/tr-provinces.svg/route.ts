import { baseMapResponse, buildTrBaseMapSvg } from "@/lib/map/base-map-svg";

/**
 * `/maps/tr-provinces.svg` — the Turkish shared base silhouette behind every province
 * locator mini-map.
 *
 * ONE FILE PER MAP PER LOCALE, and no dynamic segment (→ DEC 2026-08-08g md.2). The drawn
 * ODbL credit is a localized string read from `messages/*.json`, so the file genuinely
 * differs between locales; a `[locale]` segment would have satisfied that too, but it would
 * also have re-opened the cache decision DEC 2026-08-08a md.2 closed. Four hand-written
 * route files, one shared producer, zero dynamic segments.
 *
 * `force-static` + a dotted folder name is the `app/llms.txt/route.ts` pattern: the dot makes
 * `proxy.ts`'s matcher skip locale rewriting (same bypass as `/sitemap.xml`), and the body
 * derives only from build-time constants, so Next emits it at build like `robots.ts`.
 *
 * A reader still makes ONE request regardless of the file count — nobody browses two locales
 * at once.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return baseMapResponse(buildTrBaseMapSvg("tr"));
}
