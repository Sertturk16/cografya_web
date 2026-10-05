import type { CountryListItem, ProvinceListItem } from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";
import { REGION_KEYS, regionSlug } from "@/lib/game/region-slug";
import { getAllContinents } from "@/lib/geo/continents";
import { AREA_TOOL, COORDINATE_TOOL, DISTANCE_TOOL } from "@/lib/tools/tool-registry";
import type { SearchEntityKind, SearchIndexRecord } from "./types";

/**
 * Builds the per-locale search index both search boxes read.
 *
 * Pure by construction: the path builder and the copy lookup are passed IN rather than
 * imported, so this module never reaches for `getPathname` or next-intl and stays testable in
 * the node-only vitest config. The route handler supplies the real ones.
 *
 * Scope: every place or section a reader can land on by name — provinces and countries from
 * the api, plus the seven regions, seven continents, four seas, the tools and the section
 * pages from the repo's own routing tables. A place without a page of its own (a district, a
 * lake, a mountain) is not in the index: a hit must open a page about that thing.
 */

/** A dynamic route the index links into, with the slug it needs. */
type DynamicIndexHref = {
  readonly pathname:
    "/turkiye/[slug]" | "/dunya/[slug]" | "/turkiye/bolge/[slug]" | "/dunya/kita/[slug]";
  readonly params: { readonly slug: string };
};

const SEAS = [
  { id: "karadeniz", pathname: "/deniz/karadeniz" },
  { id: "marmara", pathname: "/deniz/marmara" },
  { id: "ege", pathname: "/deniz/ege" },
  { id: "akdeniz", pathname: "/deniz/akdeniz" },
] as const;

/** In the order the tool hub lists them. */
const TOOLS = [
  { id: "mesafe", pathname: DISTANCE_TOOL.pathname },
  { id: "koordinat", pathname: COORDINATE_TOOL.pathname },
  { id: "alan", pathname: AREA_TOOL.pathname },
] as const;

/** The section hubs a reader can find by name. */
const PAGES = [
  { id: "turkiye", pathname: "/turkiye" },
  { id: "dunya", pathname: "/dunya" },
  { id: "deniz", pathname: "/deniz" },
  { id: "oyun", pathname: "/oyun" },
  { id: "deprem", pathname: "/deprem" },
  { id: "kitaplar", pathname: "/kitaplar" },
] as const;

type StaticIndexHref =
  | (typeof SEAS)[number]["pathname"]
  | (typeof TOOLS)[number]["pathname"]
  | (typeof PAGES)[number]["pathname"];

/** Every href the index resolves; the route hands each one to `getPathname`. */
export type IndexHref = DynamicIndexHref | StaticIndexHref;

/**
 * The `SearchIndex.*` message keys this module reads. Spelled as a type so the route's typed
 * next-intl `t` refuses a key the catalogue does not carry.
 */
export type SearchIndexMessageKey =
  | `regions.${(typeof REGION_KEYS)[number]}`
  | `seas.${(typeof SEAS)[number]["id"]}`
  | `tools.${(typeof TOOLS)[number]["id"]}.${"name" | "keywords"}`
  | `pages.${(typeof PAGES)[number]["id"]}.${"name" | "keywords"}`;

export interface BuildSearchIndexArgs {
  /** `null` when the api source failed: only that kind drops out of the index. */
  readonly provinces: readonly ProvinceListItem[] | null;
  /** `null` when the api source failed: only that kind drops out of the index. */
  readonly countries: readonly CountryListItem[] | null;
  readonly locale: Locale;
  /** The localized path for a route, i.e. `getPathname` bound to this locale. */
  readonly pathOf: (href: IndexHref) => string;
  /** This locale's `SearchIndex.*` copy. */
  readonly text: (key: SearchIndexMessageKey) => string;
}

export function buildSearchIndex(args: BuildSearchIndexArgs): SearchIndexRecord[] {
  const { provinces, countries, locale, pathOf, text } = args;
  const isEnglish = locale === "en";

  const withKeywords = (
    name: string,
    path: string,
    kind: SearchEntityKind,
    keywords: string,
  ): SearchIndexRecord => [name, path, kind, keywords];

  return [
    // Province labels are Turkish in BOTH locales — `ProvinceListItem` carries no `nameEn` —
    // exactly as the hub index renders them. Only the slug is per-locale.
    ...(provinces ?? []).map((province): SearchIndexRecord => [
      province.nameTr,
      pathOf({
        pathname: "/turkiye/[slug]",
        params: { slug: isEnglish ? province.slugEn : province.slugTr },
      }),
      "p",
    ]),
    // Country DTOs carry a name per locale, so the English index searches English names.
    ...(countries ?? []).map((country): SearchIndexRecord => [
      isEnglish ? country.nameEn : country.nameTr,
      pathOf({
        pathname: "/dunya/[slug]",
        params: { slug: isEnglish ? country.slugEn : country.slugTr },
      }),
      "c",
    ]),
    // ONE region slug serves both locales (`lib/game/region-slug.ts`).
    ...REGION_KEYS.map((region): SearchIndexRecord => [
      text(`regions.${region}`),
      pathOf({ pathname: "/turkiye/bolge/[slug]", params: { slug: regionSlug(region) } }),
      "r",
    ]),
    ...getAllContinents().map((continent): SearchIndexRecord => [
      isEnglish ? continent.nameEn : continent.nameTr,
      pathOf({
        pathname: "/dunya/kita/[slug]",
        params: { slug: isEnglish ? continent.slugEn : continent.slugTr },
      }),
      "k",
    ]),
    ...SEAS.map((sea): SearchIndexRecord => [text(`seas.${sea.id}`), pathOf(sea.pathname), "s"]),
    ...TOOLS.map((tool) =>
      withKeywords(
        text(`tools.${tool.id}.name`),
        pathOf(tool.pathname),
        "t",
        text(`tools.${tool.id}.keywords`),
      ),
    ),
    ...PAGES.map((page) =>
      withKeywords(
        text(`pages.${page.id}.name`),
        pathOf(page.pathname),
        "g",
        text(`pages.${page.id}.keywords`),
      ),
    ),
  ];
}
