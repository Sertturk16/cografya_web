import { foldForSearch } from "@/lib/search/normalize";

/**
 * A sea basin wears ONE colour, and this is the only file that spells how.
 *
 * `app/globals.css` decides WHAT colour each of the four deniz havzası is: `--basin-*` is the
 * fill (a measured categorical set), `--basin-*-tint` is the 15% wash that fill becomes as a
 * surface, and `--basin-*-text` is the label that sits on it. This module is the one place that
 * turns those three tokens into the Tailwind classes a component can wear, so a surface that
 * names a basin reaches for a member here instead of re-spelling the tokens — or, as four
 * separate tables in this codebase did until T-031c, re-declaring the hue outright:
 *
 *   - `lib/marine/sea-basins-detail.ts` held `themeColor` / `gradientClass` / `borderAccent`
 *   - `components/v2/v2-marine-basin-cards.tsx` held `badgeClass` / `borderClass`
 *   - `components/v2/v2-marine-map-explorer.tsx` held `color` / `badgeClass`
 *   - `app/[locale]/(site)/deniz/kiyi-tipleri/page.tsx` wrote all four out inline
 *
 * Unlike the region and continent sets, these four AGREED with each other, so this is a
 * consolidation rather than a correction. Four tables agreeing today is not the same property
 * as one table: the four are back the moment anyone edits one of them. Hence one module.
 *
 * ## Why literal strings and not a template
 *
 * Tailwind v4 scans source text for class names; `bg-[var(--basin-${slug})]` assembled at
 * runtime produces no CSS at all. Every class below is therefore written out in full, per
 * basin, and the four entries are checked against each other by
 * `components/v2/basin-identity.test.ts` rather than by construction.
 *
 * ## Contrast
 *
 * Measured figures for `-text` on each surface, with the backdrop each figure is a ratio TO,
 * live in `app/globals.css` beside the token declarations (GROUP, DECK, PANEL, LINK and the
 * bare card). Nothing here restates them: a ratio copied away from the value it measures is how
 * a table of correct figures comes to name a surface the page never painted.
 *
 * ## No `badgeOpaque`, and that is a measurement
 *
 * `lib/theme/region-identity.ts` and `lib/theme/continent-identity.ts` both carry an opaque
 * badge member, because each has a chip sitting in a table row that hovers to `bg-muted/50` and
 * each measured 4.41:1 there. Every basin surface was checked for that shape and none of them
 * moves: the explorer's group header is a static `bg-muted/50`, the basin Card changes only its
 * border and shadow on hover, `bolge/[slug]`'s chips sit on a static panel, and the
 * `kiyi-tipleri` link cards change only their border. A member with nothing to protect would be
 * a member nobody could ever make fail.
 */

/** The four basin slugs, spelled exactly as the `--basin-*` tokens are. */
export type BasinSlug = "karadeniz" | "marmara" | "ege" | "akdeniz";

/**
 * The basin key the marine contract uses. `MarinePointData.seaBasin` and
 * `SeaBasinInfo.id` are both this union, so the crossing to a slug happens once, here.
 */
export type SeaBasinKey = "black_sea" | "marmara" | "aegean" | "mediterranean";

export interface BasinIdentity {
  /** The basin's slug, i.e. the `--basin-*` token's own name. Also its route segment. */
  readonly slug: BasinSlug;
  /** The 15% wash of the fill, as a surface. Translucent, so one value serves both themes. */
  readonly surface: string;
  /** The label that sits on any of this module's surfaces. Carries its own dark value. */
  readonly label: string;
  /** The fill as a hairline edge, at the 30% every card and badge in the product uses. */
  readonly edge: string;
  /** The fill as a hover edge, at 50%. The basin card's only hover colour. */
  readonly edgeHover: string;
  /** `surface` + `label` + `edge`: the basin badge, on a card or a group header. */
  readonly badge: string;
  /**
   * The quieter chip: a 10% wash, `label`, and a 25% edge.
   *
   * Its own member rather than `badge` because it is a different weight on purpose —
   * `turkiye/bolge/[slug]` lists a region's `coastalSeas` beside neutral `bg-muted` chips for
   * neighbours and countries, and a full-strength basin badge there would outrank the region
   * identity the page is actually about.
   */
  readonly chipSoft: string;
  /**
   * The whole link card: a 5% wash, a 30% edge, and the edge going full strength on hover.
   * `deniz/kiyi-tipleri`'s cross-navigation to the four basin pages.
   */
  readonly linkCard: string;
  /** The tint end of a hero band that fades to `--background`. */
  readonly heroGradient: string;
}

/**
 * Keyed by slug rather than by `SeaBasinKey` so the key IS the token name: a reader can see
 * that `ege` wears `--basin-ege-*` without holding a second mapping in their head.
 * `basinIdentityOf` crosses over from the contract's key.
 */
export const BASIN_IDENTITY: Readonly<Record<BasinSlug, BasinIdentity>> = {
  karadeniz: {
    slug: "karadeniz",
    surface: "bg-[var(--basin-karadeniz-tint)]",
    label: "text-[var(--basin-karadeniz-text)]",
    edge: "border-[var(--basin-karadeniz)]/30",
    edgeHover: "hover:border-[var(--basin-karadeniz)]/50",
    badge:
      "bg-[var(--basin-karadeniz-tint)] text-[var(--basin-karadeniz-text)] border-[var(--basin-karadeniz)]/30",
    chipSoft:
      "bg-[var(--basin-karadeniz)]/10 text-[var(--basin-karadeniz-text)] border-[var(--basin-karadeniz)]/25",
    linkCard:
      "border-[var(--basin-karadeniz)]/30 bg-[var(--basin-karadeniz)]/5 hover:border-[var(--basin-karadeniz)]",
    heroGradient: "from-[var(--basin-karadeniz)]/10 via-background to-background",
  },
  marmara: {
    slug: "marmara",
    surface: "bg-[var(--basin-marmara-tint)]",
    label: "text-[var(--basin-marmara-text)]",
    edge: "border-[var(--basin-marmara)]/30",
    edgeHover: "hover:border-[var(--basin-marmara)]/50",
    badge:
      "bg-[var(--basin-marmara-tint)] text-[var(--basin-marmara-text)] border-[var(--basin-marmara)]/30",
    chipSoft:
      "bg-[var(--basin-marmara)]/10 text-[var(--basin-marmara-text)] border-[var(--basin-marmara)]/25",
    linkCard:
      "border-[var(--basin-marmara)]/30 bg-[var(--basin-marmara)]/5 hover:border-[var(--basin-marmara)]",
    heroGradient: "from-[var(--basin-marmara)]/10 via-background to-background",
  },
  ege: {
    slug: "ege",
    surface: "bg-[var(--basin-ege-tint)]",
    label: "text-[var(--basin-ege-text)]",
    edge: "border-[var(--basin-ege)]/30",
    edgeHover: "hover:border-[var(--basin-ege)]/50",
    badge: "bg-[var(--basin-ege-tint)] text-[var(--basin-ege-text)] border-[var(--basin-ege)]/30",
    chipSoft: "bg-[var(--basin-ege)]/10 text-[var(--basin-ege-text)] border-[var(--basin-ege)]/25",
    linkCard:
      "border-[var(--basin-ege)]/30 bg-[var(--basin-ege)]/5 hover:border-[var(--basin-ege)]",
    heroGradient: "from-[var(--basin-ege)]/10 via-background to-background",
  },
  akdeniz: {
    slug: "akdeniz",
    surface: "bg-[var(--basin-akdeniz-tint)]",
    label: "text-[var(--basin-akdeniz-text)]",
    edge: "border-[var(--basin-akdeniz)]/30",
    edgeHover: "hover:border-[var(--basin-akdeniz)]/50",
    badge:
      "bg-[var(--basin-akdeniz-tint)] text-[var(--basin-akdeniz-text)] border-[var(--basin-akdeniz)]/30",
    chipSoft:
      "bg-[var(--basin-akdeniz)]/10 text-[var(--basin-akdeniz-text)] border-[var(--basin-akdeniz)]/25",
    linkCard:
      "border-[var(--basin-akdeniz)]/30 bg-[var(--basin-akdeniz)]/5 hover:border-[var(--basin-akdeniz)]",
    heroGradient: "from-[var(--basin-akdeniz)]/10 via-background to-background",
  },
};

/**
 * The contract's basin key, crossed to a slug once.
 *
 * `as const satisfies` rather than a plain `Record`, mirroring `lib/game/region-slug.ts` and
 * `lib/geo/continents.ts`: this module keys on those literals, so a slug renamed here stops the
 * build instead of handing a component `undefined` for a basin's colour.
 */
export const BASIN_KEY_TO_SLUG = {
  black_sea: "karadeniz",
  marmara: "marmara",
  aegean: "ege",
  mediterranean: "akdeniz",
} as const satisfies Record<SeaBasinKey, BasinSlug>;

/** The identity of the basin the marine contract names. */
export function basinIdentityOf(key: SeaBasinKey): BasinIdentity {
  return BASIN_IDENTITY[BASIN_KEY_TO_SLUG[key]];
}

/**
 * The four sea names as the regions contract spells them, folded for matching.
 *
 * `GeographicRegionDto.coastalSeas` is a free `string[]` — the contract carries display names
 * ("Karadeniz", "Marmara Denizi", "Ege Denizi", "Akdeniz"), not basin keys, so this is the one
 * place that crosses prose to an identity. Matched on a folded SUBSTRING rather than on
 * equality, because the contract is free text and "Ege Denizi" and "Ege" must land on the same
 * basin; folded through the same `foldForSearch` the marine search box uses, so Turkish casing
 * is handled once for the whole product.
 *
 * The four keywords are mutually exclusive as substrings, which
 * `components/v2/basin-identity.test.ts` asserts rather than assumes — "Karadeniz" and
 * "Akdeniz" both end in "deniz", and a keyword list that let one swallow the other would paint
 * every sea one colour and still render.
 */
const SEA_NAME_KEYWORDS: readonly (readonly [string, BasinSlug])[] = [
  ["karadeniz", "karadeniz"],
  ["marmara", "marmara"],
  ["ege", "ege"],
  ["akdeniz", "akdeniz"],
];

/**
 * The identity of the sea a contract display name refers to, or `null` when nothing matches.
 *
 * `null` rather than a default basin: a sea this product has no identity for must render as a
 * neutral chip, not as an arbitrary one of the four. A wrong colour on a data chip is worse
 * than no colour.
 */
export function basinIdentityOfSeaName(name: string): BasinIdentity | null {
  const folded = foldForSearch(name);
  for (const [keyword, slug] of SEA_NAME_KEYWORDS) {
    if (folded.includes(keyword)) return BASIN_IDENTITY[slug];
  }
  return null;
}
