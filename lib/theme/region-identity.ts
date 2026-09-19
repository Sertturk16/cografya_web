import type { GeographicRegion } from "@/lib/api/types";
import { regionSlug } from "@/lib/game/region-slug";

/**
 * A region wears ONE colour, and this is the only file that spells how.
 *
 * `app/globals.css` decides WHAT colour each of the seven coğrafi bölge is: `--region-*` is the
 * map fill (the Okabe–Ito categorical set), `--region-*-tint` is the 15% wash that fill becomes
 * as a surface, and `--region-*-text` is the label that sits on that wash. This module is the
 * one place that turns those three tokens into the Tailwind classes a component can wear, so a
 * surface that names a region reaches for a member here instead of re-spelling the tokens — or,
 * as four separate tables in this codebase did until T-031c, re-inventing the hue outright:
 *
 *   - `app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx` badged Marmara amber beside a blue fill
 *   - `components/v2/v2-turkey-regions.tsx` headed its Marmara card with a raw amber-700 gradient
 *   - `components/v2/v2-turkey-map-explorer.tsx` PAINTED Marmara with a raw amber-600 fill on `/turkiye`
 *   - `components/v2/v2-game-screen.tsx` painted it a raw amber-500 fill in the region round
 *
 * Six of the seven regions disagreed with their own map fill, and `/turkiye` disagreed with
 * `/turkiye/bolge/marmara` one breadcrumb click away. Four tables agreeing today is not the same
 * property as one table: the four are back the moment anyone edits one of them. Hence one module.
 *
 * ## Why literal strings and not a template
 *
 * Tailwind v4 scans source text for class names; `fill-[var(--region-${slug})]` assembled at
 * runtime produces no CSS at all. Every class below is therefore written out in full, per region,
 * and the seven entries are checked against each other by `components/v2/region-identity.test.ts`
 * rather than by construction.
 *
 * ## Contrast
 *
 * Measured figures for `-text` on `-tint`, with the backdrop each figure is a ratio TO, live in
 * `app/globals.css` beside the token declarations (`HERO` and `BANNER`). Nothing here restates
 * them: a ratio copied away from the value it measures is how the first version of that table
 * came to name a surface the page never painted.
 */

/** The seven region slugs, spelled exactly as the `--region-*` tokens are. */
export type RegionSlug =
  "marmara" | "ege" | "akdeniz" | "ic-anadolu" | "karadeniz" | "dogu-anadolu" | "guneydogu-anadolu";

export interface RegionIdentity {
  /** The region's slug, i.e. the `--region-*` token's own name. */
  readonly slug: RegionSlug;
  /**
   * The fill as a raw CSS VALUE, for an attribute rather than a class — an SVG `fill`, an
   * inline style, anything Tailwind never sees. Carries the hue a second time as a literal
   * fallback, which is the one place in this module where a colour is spelled twice; the
   * fallback is checked against `REGION_TINTS` (and so against `app/globals.css`) by
   * `components/v2/region-identity.test.ts`, because a stale fallback would paint a region the
   * wrong colour on exactly the browsers that needed the fallback.
   */
  readonly fillValue: string;
  /**
   * The map fill, at full strength. Resting states that want the shape to recede compose this
   * with an `opacity-*` utility rather than a second, lighter hue — the region has one colour.
   */
  readonly fill: string;
  /** The map fill at 80%, lifting to full strength on hover. The game map's resting region tint. */
  readonly fillSoft: string;
  /** The 15% wash of the fill, as a surface. Translucent, so one value serves both themes. */
  readonly surface: string;
  /** The label that sits on `surface` (or on a bare `--card`). Carries its own dark value. */
  readonly label: string;
  /** The fill as a hairline edge, at the 30% every card and badge in the product uses. */
  readonly edge: string;
  /** The fill as a full-strength rule, for a banner's bottom border. */
  readonly rule: string;
  /** `surface` + `label` + `edge`: the region badge, on any opaque card. */
  readonly badge: string;
  /**
   * The OPAQUE badge: `bg-card` + `label` + `edge`, with no tint of its own.
   *
   * For a badge whose backdrop MOVES. `v2-turkey-map-explorer.tsx`'s province table gives every
   * row `hover:bg-muted/50`, and `badge`'s 15% tint over THAT over `--card` takes Marmara's dark
   * label to 4.41:1 and Güneydoğu Anadolu's to 4.57 — a data label dropping under the floor only
   * while the pointer is over its own row, which is the one state nobody screenshots. This
   * member's backdrop is `--card` whatever the row is doing, and it measures 5.42-7.36 light and
   * 5.50-9.21 dark there.
   *
   * A moving backdrop is not a surface to measure, it is a surface not to composite onto. Found
   * while measuring the same shape on `/dunya`'s country table in T-031c Task 5;
   * `lib/theme/continent-identity.ts` carries the identical member for the identical reason.
   */
  readonly badgeOpaque: string;
  /** `surface` + `label` + a full-strength bottom rule: the region section/card header banner. */
  readonly banner: string;
  /** The tint end of a hero band that fades to `--background`. */
  readonly heroGradient: string;
}

/**
 * Keyed by slug rather than by `GeographicRegion` so the key IS the token name: a reader can see
 * that `ic-anadolu` wears `--region-ic-anadolu-*` without holding a second mapping in their head.
 * `regionOf` crosses over from the API enum.
 */
export const REGION_IDENTITY: Readonly<Record<RegionSlug, RegionIdentity>> = {
  marmara: {
    slug: "marmara",
    fillValue: "var(--region-marmara, #0072b2)",
    fill: "fill-[var(--region-marmara)]",
    fillSoft: "fill-[var(--region-marmara)]/80 hover:fill-[var(--region-marmara)]",
    surface: "bg-[var(--region-marmara-tint)]",
    label: "text-[var(--region-marmara-text)]",
    edge: "border-[var(--region-marmara)]/30",
    rule: "border-[var(--region-marmara)]",
    badge:
      "bg-[var(--region-marmara-tint)] text-[var(--region-marmara-text)] border-[var(--region-marmara)]/30",
    badgeOpaque: "bg-card text-[var(--region-marmara-text)] border-[var(--region-marmara)]/30",
    banner:
      "bg-[var(--region-marmara-tint)] text-[var(--region-marmara-text)] border-b-2 border-[var(--region-marmara)]",
    heroGradient: "from-[var(--region-marmara-tint)] via-background to-background",
  },
  ege: {
    slug: "ege",
    fillValue: "var(--region-ege, #e69f00)",
    fill: "fill-[var(--region-ege)]",
    fillSoft: "fill-[var(--region-ege)]/80 hover:fill-[var(--region-ege)]",
    surface: "bg-[var(--region-ege-tint)]",
    label: "text-[var(--region-ege-text)]",
    edge: "border-[var(--region-ege)]/30",
    rule: "border-[var(--region-ege)]",
    badge:
      "bg-[var(--region-ege-tint)] text-[var(--region-ege-text)] border-[var(--region-ege)]/30",
    badgeOpaque: "bg-card text-[var(--region-ege-text)] border-[var(--region-ege)]/30",
    banner:
      "bg-[var(--region-ege-tint)] text-[var(--region-ege-text)] border-b-2 border-[var(--region-ege)]",
    heroGradient: "from-[var(--region-ege-tint)] via-background to-background",
  },
  akdeniz: {
    slug: "akdeniz",
    fillValue: "var(--region-akdeniz, #56b4e9)",
    fill: "fill-[var(--region-akdeniz)]",
    fillSoft: "fill-[var(--region-akdeniz)]/80 hover:fill-[var(--region-akdeniz)]",
    surface: "bg-[var(--region-akdeniz-tint)]",
    label: "text-[var(--region-akdeniz-text)]",
    edge: "border-[var(--region-akdeniz)]/30",
    rule: "border-[var(--region-akdeniz)]",
    badge:
      "bg-[var(--region-akdeniz-tint)] text-[var(--region-akdeniz-text)] border-[var(--region-akdeniz)]/30",
    badgeOpaque: "bg-card text-[var(--region-akdeniz-text)] border-[var(--region-akdeniz)]/30",
    banner:
      "bg-[var(--region-akdeniz-tint)] text-[var(--region-akdeniz-text)] border-b-2 border-[var(--region-akdeniz)]",
    heroGradient: "from-[var(--region-akdeniz-tint)] via-background to-background",
  },
  "ic-anadolu": {
    slug: "ic-anadolu",
    fillValue: "var(--region-ic-anadolu, #f0e442)",
    fill: "fill-[var(--region-ic-anadolu)]",
    fillSoft: "fill-[var(--region-ic-anadolu)]/80 hover:fill-[var(--region-ic-anadolu)]",
    surface: "bg-[var(--region-ic-anadolu-tint)]",
    label: "text-[var(--region-ic-anadolu-text)]",
    edge: "border-[var(--region-ic-anadolu)]/30",
    rule: "border-[var(--region-ic-anadolu)]",
    badge:
      "bg-[var(--region-ic-anadolu-tint)] text-[var(--region-ic-anadolu-text)] border-[var(--region-ic-anadolu)]/30",
    badgeOpaque:
      "bg-card text-[var(--region-ic-anadolu-text)] border-[var(--region-ic-anadolu)]/30",
    banner:
      "bg-[var(--region-ic-anadolu-tint)] text-[var(--region-ic-anadolu-text)] border-b-2 border-[var(--region-ic-anadolu)]",
    heroGradient: "from-[var(--region-ic-anadolu-tint)] via-background to-background",
  },
  karadeniz: {
    slug: "karadeniz",
    fillValue: "var(--region-karadeniz, #cc79a7)",
    fill: "fill-[var(--region-karadeniz)]",
    fillSoft: "fill-[var(--region-karadeniz)]/80 hover:fill-[var(--region-karadeniz)]",
    surface: "bg-[var(--region-karadeniz-tint)]",
    label: "text-[var(--region-karadeniz-text)]",
    edge: "border-[var(--region-karadeniz)]/30",
    rule: "border-[var(--region-karadeniz)]",
    badge:
      "bg-[var(--region-karadeniz-tint)] text-[var(--region-karadeniz-text)] border-[var(--region-karadeniz)]/30",
    badgeOpaque: "bg-card text-[var(--region-karadeniz-text)] border-[var(--region-karadeniz)]/30",
    banner:
      "bg-[var(--region-karadeniz-tint)] text-[var(--region-karadeniz-text)] border-b-2 border-[var(--region-karadeniz)]",
    heroGradient: "from-[var(--region-karadeniz-tint)] via-background to-background",
  },
  "dogu-anadolu": {
    slug: "dogu-anadolu",
    fillValue: "var(--region-dogu-anadolu, #009e73)",
    fill: "fill-[var(--region-dogu-anadolu)]",
    fillSoft: "fill-[var(--region-dogu-anadolu)]/80 hover:fill-[var(--region-dogu-anadolu)]",
    surface: "bg-[var(--region-dogu-anadolu-tint)]",
    label: "text-[var(--region-dogu-anadolu-text)]",
    edge: "border-[var(--region-dogu-anadolu)]/30",
    rule: "border-[var(--region-dogu-anadolu)]",
    badge:
      "bg-[var(--region-dogu-anadolu-tint)] text-[var(--region-dogu-anadolu-text)] border-[var(--region-dogu-anadolu)]/30",
    badgeOpaque:
      "bg-card text-[var(--region-dogu-anadolu-text)] border-[var(--region-dogu-anadolu)]/30",
    banner:
      "bg-[var(--region-dogu-anadolu-tint)] text-[var(--region-dogu-anadolu-text)] border-b-2 border-[var(--region-dogu-anadolu)]",
    heroGradient: "from-[var(--region-dogu-anadolu-tint)] via-background to-background",
  },
  "guneydogu-anadolu": {
    slug: "guneydogu-anadolu",
    fillValue: "var(--region-guneydogu-anadolu, #d55e00)",
    fill: "fill-[var(--region-guneydogu-anadolu)]",
    fillSoft:
      "fill-[var(--region-guneydogu-anadolu)]/80 hover:fill-[var(--region-guneydogu-anadolu)]",
    surface: "bg-[var(--region-guneydogu-anadolu-tint)]",
    label: "text-[var(--region-guneydogu-anadolu-text)]",
    edge: "border-[var(--region-guneydogu-anadolu)]/30",
    rule: "border-[var(--region-guneydogu-anadolu)]",
    badge:
      "bg-[var(--region-guneydogu-anadolu-tint)] text-[var(--region-guneydogu-anadolu-text)] border-[var(--region-guneydogu-anadolu)]/30",
    badgeOpaque:
      "bg-card text-[var(--region-guneydogu-anadolu-text)] border-[var(--region-guneydogu-anadolu)]/30",
    banner:
      "bg-[var(--region-guneydogu-anadolu-tint)] text-[var(--region-guneydogu-anadolu-text)] border-b-2 border-[var(--region-guneydogu-anadolu)]",
    heroGradient: "from-[var(--region-guneydogu-anadolu-tint)] via-background to-background",
  },
};

/**
 * The identity of the region the API enum names.
 *
 * Goes through `regionSlug`, the existing routing table, rather than keying a second map on
 * `GeographicRegion`: one crossing from the contract enum to a slug, not two that can disagree.
 */
export function regionIdentityOf(region: GeographicRegion): RegionIdentity {
  return REGION_IDENTITY[regionSlug(region)];
}
