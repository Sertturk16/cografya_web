import type { GeographicRegion } from "@/lib/api/types";

/**
 * URL identifiers for the seven coğrafi bölge (→ DEC 2026-07-30p, mode 3).
 *
 * This is a ROUTING table, not a geography table: the regions themselves, and which
 * province belongs to which, still come from the api (`CONVENTIONS.md` §4). All this file
 * decides is what each region is called inside a URL.
 *
 * `satisfies Record<GeographicRegion, string>` is the point of the shape. `GeographicRegion`
 * is derived from the api contract type, so if the api ever gains or renames a region this
 * object stops compiling instead of silently 404-ing a live route.
 *
 * ONE slug per region, shared by both locales. `/turkiye/[slug]` localizes its slug because
 * each locale needs its own INDEXABLE url; the region rounds are `noindex` in every locale
 * (`lib/seo/indexing.ts`), so a second slug set would buy nothing and cost a second
 * `notFound()` rule, a second static-params list and a second chance to drift. The values
 * are the enum keys in `SEO-POLICY.md` §B4 4.3 form — lowercase ASCII, hyphen-separated,
 * no diacritics.
 */
const REGION_SLUGS = {
  MARMARA: "marmara",
  EGE: "ege",
  AKDENIZ: "akdeniz",
  IC_ANADOLU: "ic-anadolu",
  KARADENIZ: "karadeniz",
  DOGU_ANADOLU: "dogu-anadolu",
  GUNEYDOGU_ANADOLU: "guneydogu-anadolu",
} as const satisfies Record<GeographicRegion, string>;

/** Every region key, in the order the region picker lists them. */
export const REGION_KEYS = Object.keys(REGION_SLUGS) as readonly GeographicRegion[];

/** The region's URL identifier. */
export function regionSlug(region: GeographicRegion): string {
  return REGION_SLUGS[region];
}

/**
 * The region a URL identifier names, or `null` — which the route turns into `notFound()`.
 * Never a fallback region: an unknown slug is a 404, never a 200 on some other region's
 * round (`ENGINEERING.md` §4 #6).
 */
export function regionFromSlug(slug: string): GeographicRegion | null {
  for (const region of REGION_KEYS) {
    if (REGION_SLUGS[region] === slug) return region;
  }
  return null;
}
