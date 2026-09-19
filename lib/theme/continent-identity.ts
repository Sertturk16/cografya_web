import type { Continent } from "@/lib/api/types";
import { CONTINENT_KEY_TO_SLUG, type ContinentSlugName } from "@/lib/geo/continents";

/**
 * A continent wears ONE colour, and this is the only file that spells how.
 *
 * `app/globals.css` decides WHAT colour each of the seven kıta is: `--continent-*` is the map
 * fill (the Okabe-Ito categorical set, the same one `--region-*` uses and for the same reason —
 * the ruling on sharing, and the fact that the two never render on one screen, is written out
 * beside the token block), `--continent-*-tint` is the 15% wash that fill becomes as a surface,
 * and `--continent-*-text` is the label that sits on that wash. This module is the one place
 * that turns those three tokens into the Tailwind classes a component can wear.
 *
 * ## Three spellings, then one
 *
 * `lib/map/continent-theme.ts` already records `DES133-I1` in its own docblock: `/dunya/[slug]`
 * kept a `CONTINENT_THEMES` palette that disagreed with the map on SIX of seven continents, and
 * the fix was to move `CONTINENT_META` into `lib/` and have both consumers read it. That left
 * two spellings, not one:
 *
 *   - `lib/map/continent-theme.ts`'s `CONTINENT_META` — nine colour fields per continent, the
 *     heaviest raw-palette definition in the tree at 112 occurrences
 *   - `components/v2/v2-world-continents.tsx`'s `CONTINENTS_DATA` — the same seven identities in
 *     the same hue FAMILIES at different stops (Avrupa ran indigo-600 to blue-700 here against
 *     `CONTINENT_META`'s indigo-700 to blue-900), 49 more
 *
 * Two tables that agree today is not the same property as one table: the two are back the
 * moment anyone edits one of them, which is exactly how the third spelling came to disagree on
 * six of seven. Hence one module. Both tables now read it, and `CONTINENTS_DATA` no longer
 * carries a colour field at all — it derives its identity from its own `id`, so there is
 * nothing there left to mis-assign.
 *
 * ## Why literal strings and not a template
 *
 * Tailwind v4 scans source text for class names; `fill-[var(--continent-${slug})]` assembled at
 * runtime produces no CSS at all. Every class below is therefore written out in full, per
 * continent, and the seven entries are checked against each other by
 * `components/v2/continent-identity.test.ts` rather than by construction.
 *
 * ## Contrast
 *
 * Measured figures for `-text` on `-tint`, with the backdrop each figure is a ratio TO (HERO,
 * CARD and DECK — the continent deck's card is `bg-card/80`, not `bg-card`, so it is its own
 * surface), live in `app/globals.css` beside the token declarations. Nothing here restates
 * them: a ratio copied away from the value it measures is how the region table came to name a
 * surface the page never painted.
 */

/** The seven continent slugs, spelled exactly as the `--continent-*` tokens are. */
export type ContinentSlug = ContinentSlugName;

export interface ContinentIdentity {
  /** The continent's slug, i.e. the `--continent-*` token's own name. */
  readonly slug: ContinentSlug;
  /**
   * The map fill, at full strength. Resting states that want the shape to recede compose this
   * with an `opacity-*` utility rather than a second, lighter hue — the continent has one colour.
   */
  readonly fill: string;
  /**
   * The map fill at 85%, lifting to full strength on hover: `/dunya`'s world map paints every
   * country in its continent's colour this way. Replaces the old `color` + `hoverColor` pair,
   * whose four `dark:` halves went with them — a data token is redefined per theme in
   * `app/globals.css`, which is where the light/dark decision belongs.
   */
  readonly fillSoft: string;
  /** The country outline on that map, at the 50% the shipped `strokeColor` used. */
  readonly stroke: string;
  /** The 15% wash of the fill, as a surface. Translucent, so one value serves both themes. */
  readonly surface: string;
  /** The label that sits on `surface` (or on a bare `--card`). Carries its own dark value. */
  readonly label: string;
  /** The fill as a hairline edge, at the 30% every card and badge in the product uses. */
  readonly edge: string;
  /** The same edge, revealed on hover — the continent deck's card outline. */
  readonly edgeHover: string;
  /** `surface` + `label` + `edge`: the continent badge, on any card or hero band. */
  readonly badge: string;
  /**
   * The OPAQUE badge: `bg-card` + `label` + `edge`, with no tint of its own.
   *
   * For a badge whose backdrop MOVES — `/dunya`'s country table gives each row
   * `hover:bg-muted/50`, and a 15% tint over that over `--card` takes Avrupa's dark label to
   * 4.41:1, under the floor. An opaque chip is measured against `--card` and nothing else,
   * whatever the row underneath is doing.
   */
  readonly badgeOpaque: string;
  /** `surface` + `label` + a full-strength bottom rule: the continent section header banner. */
  readonly banner: string;
  /**
   * The thin gradient rule at the top of a continent card on `/dunya/kita` — a graphical mark
   * with no text on it, so it is the fill at full strength fading to half, not a second hue.
   */
  readonly headerBar: string;
  /** The tint end of a hero band that fades to `--background`. */
  readonly heroGradient: string;
  /**
   * The hero's decorative glow. Its consumers MUST bound it away from narrow viewports
   * (`hidden md:block`): `size-96` plus `blur-3xl` is wider than a 320px screen, and unbounded
   * it lands on the continent badge and falsifies the `HERO` figures in `app/globals.css`.
   */
  readonly glow: string;
}

/**
 * Keyed by slug rather than by `Continent` so the key IS the token name: a reader can see that
 * `kuzey-amerika` wears `--continent-kuzey-amerika-*` without holding a second mapping in their
 * head. `continentIdentityOf` crosses over from the API enum.
 */
export const CONTINENT_IDENTITY: Readonly<Record<ContinentSlug, ContinentIdentity>> = {
  avrupa: {
    slug: "avrupa",
    fill: "fill-[var(--continent-avrupa)]",
    fillSoft: "fill-[var(--continent-avrupa)]/85 hover:fill-[var(--continent-avrupa)]",
    stroke: "stroke-[var(--continent-avrupa)]/50",
    surface: "bg-[var(--continent-avrupa-tint)]",
    label: "text-[var(--continent-avrupa-text)]",
    edge: "border-[var(--continent-avrupa)]/30",
    edgeHover: "hover:border-[var(--continent-avrupa)]/50",
    badge:
      "bg-[var(--continent-avrupa-tint)] text-[var(--continent-avrupa-text)] border-[var(--continent-avrupa)]/30",
    badgeOpaque: "bg-card text-[var(--continent-avrupa-text)] border-[var(--continent-avrupa)]/30",
    banner:
      "bg-[var(--continent-avrupa-tint)] text-[var(--continent-avrupa-text)] border-b-2 border-[var(--continent-avrupa)]",
    headerBar: "from-[var(--continent-avrupa)] to-[var(--continent-avrupa)]/50",
    heroGradient: "from-[var(--continent-avrupa-tint)] via-background to-background",
    glow: "bg-[var(--continent-avrupa)]/10",
  },
  asya: {
    slug: "asya",
    fill: "fill-[var(--continent-asya)]",
    fillSoft: "fill-[var(--continent-asya)]/85 hover:fill-[var(--continent-asya)]",
    stroke: "stroke-[var(--continent-asya)]/50",
    surface: "bg-[var(--continent-asya-tint)]",
    label: "text-[var(--continent-asya-text)]",
    edge: "border-[var(--continent-asya)]/30",
    edgeHover: "hover:border-[var(--continent-asya)]/50",
    badge:
      "bg-[var(--continent-asya-tint)] text-[var(--continent-asya-text)] border-[var(--continent-asya)]/30",
    badgeOpaque: "bg-card text-[var(--continent-asya-text)] border-[var(--continent-asya)]/30",
    banner:
      "bg-[var(--continent-asya-tint)] text-[var(--continent-asya-text)] border-b-2 border-[var(--continent-asya)]",
    headerBar: "from-[var(--continent-asya)] to-[var(--continent-asya)]/50",
    heroGradient: "from-[var(--continent-asya-tint)] via-background to-background",
    glow: "bg-[var(--continent-asya)]/10",
  },
  afrika: {
    slug: "afrika",
    fill: "fill-[var(--continent-afrika)]",
    fillSoft: "fill-[var(--continent-afrika)]/85 hover:fill-[var(--continent-afrika)]",
    stroke: "stroke-[var(--continent-afrika)]/50",
    surface: "bg-[var(--continent-afrika-tint)]",
    label: "text-[var(--continent-afrika-text)]",
    edge: "border-[var(--continent-afrika)]/30",
    edgeHover: "hover:border-[var(--continent-afrika)]/50",
    badge:
      "bg-[var(--continent-afrika-tint)] text-[var(--continent-afrika-text)] border-[var(--continent-afrika)]/30",
    badgeOpaque: "bg-card text-[var(--continent-afrika-text)] border-[var(--continent-afrika)]/30",
    banner:
      "bg-[var(--continent-afrika-tint)] text-[var(--continent-afrika-text)] border-b-2 border-[var(--continent-afrika)]",
    headerBar: "from-[var(--continent-afrika)] to-[var(--continent-afrika)]/50",
    heroGradient: "from-[var(--continent-afrika-tint)] via-background to-background",
    glow: "bg-[var(--continent-afrika)]/10",
  },
  "kuzey-amerika": {
    slug: "kuzey-amerika",
    fill: "fill-[var(--continent-kuzey-amerika)]",
    fillSoft:
      "fill-[var(--continent-kuzey-amerika)]/85 hover:fill-[var(--continent-kuzey-amerika)]",
    stroke: "stroke-[var(--continent-kuzey-amerika)]/50",
    surface: "bg-[var(--continent-kuzey-amerika-tint)]",
    label: "text-[var(--continent-kuzey-amerika-text)]",
    edge: "border-[var(--continent-kuzey-amerika)]/30",
    edgeHover: "hover:border-[var(--continent-kuzey-amerika)]/50",
    badge:
      "bg-[var(--continent-kuzey-amerika-tint)] text-[var(--continent-kuzey-amerika-text)] border-[var(--continent-kuzey-amerika)]/30",
    badgeOpaque:
      "bg-card text-[var(--continent-kuzey-amerika-text)] border-[var(--continent-kuzey-amerika)]/30",
    banner:
      "bg-[var(--continent-kuzey-amerika-tint)] text-[var(--continent-kuzey-amerika-text)] border-b-2 border-[var(--continent-kuzey-amerika)]",
    headerBar: "from-[var(--continent-kuzey-amerika)] to-[var(--continent-kuzey-amerika)]/50",
    heroGradient: "from-[var(--continent-kuzey-amerika-tint)] via-background to-background",
    glow: "bg-[var(--continent-kuzey-amerika)]/10",
  },
  "guney-amerika": {
    slug: "guney-amerika",
    fill: "fill-[var(--continent-guney-amerika)]",
    fillSoft:
      "fill-[var(--continent-guney-amerika)]/85 hover:fill-[var(--continent-guney-amerika)]",
    stroke: "stroke-[var(--continent-guney-amerika)]/50",
    surface: "bg-[var(--continent-guney-amerika-tint)]",
    label: "text-[var(--continent-guney-amerika-text)]",
    edge: "border-[var(--continent-guney-amerika)]/30",
    edgeHover: "hover:border-[var(--continent-guney-amerika)]/50",
    badge:
      "bg-[var(--continent-guney-amerika-tint)] text-[var(--continent-guney-amerika-text)] border-[var(--continent-guney-amerika)]/30",
    badgeOpaque:
      "bg-card text-[var(--continent-guney-amerika-text)] border-[var(--continent-guney-amerika)]/30",
    banner:
      "bg-[var(--continent-guney-amerika-tint)] text-[var(--continent-guney-amerika-text)] border-b-2 border-[var(--continent-guney-amerika)]",
    headerBar: "from-[var(--continent-guney-amerika)] to-[var(--continent-guney-amerika)]/50",
    heroGradient: "from-[var(--continent-guney-amerika-tint)] via-background to-background",
    glow: "bg-[var(--continent-guney-amerika)]/10",
  },
  okyanusya: {
    slug: "okyanusya",
    fill: "fill-[var(--continent-okyanusya)]",
    fillSoft: "fill-[var(--continent-okyanusya)]/85 hover:fill-[var(--continent-okyanusya)]",
    stroke: "stroke-[var(--continent-okyanusya)]/50",
    surface: "bg-[var(--continent-okyanusya-tint)]",
    label: "text-[var(--continent-okyanusya-text)]",
    edge: "border-[var(--continent-okyanusya)]/30",
    edgeHover: "hover:border-[var(--continent-okyanusya)]/50",
    badge:
      "bg-[var(--continent-okyanusya-tint)] text-[var(--continent-okyanusya-text)] border-[var(--continent-okyanusya)]/30",
    badgeOpaque:
      "bg-card text-[var(--continent-okyanusya-text)] border-[var(--continent-okyanusya)]/30",
    banner:
      "bg-[var(--continent-okyanusya-tint)] text-[var(--continent-okyanusya-text)] border-b-2 border-[var(--continent-okyanusya)]",
    headerBar: "from-[var(--continent-okyanusya)] to-[var(--continent-okyanusya)]/50",
    heroGradient: "from-[var(--continent-okyanusya-tint)] via-background to-background",
    glow: "bg-[var(--continent-okyanusya)]/10",
  },
  antarktika: {
    slug: "antarktika",
    fill: "fill-[var(--continent-antarktika)]",
    fillSoft: "fill-[var(--continent-antarktika)]/85 hover:fill-[var(--continent-antarktika)]",
    stroke: "stroke-[var(--continent-antarktika)]/50",
    surface: "bg-[var(--continent-antarktika-tint)]",
    label: "text-[var(--continent-antarktika-text)]",
    edge: "border-[var(--continent-antarktika)]/30",
    edgeHover: "hover:border-[var(--continent-antarktika)]/50",
    badge:
      "bg-[var(--continent-antarktika-tint)] text-[var(--continent-antarktika-text)] border-[var(--continent-antarktika)]/30",
    badgeOpaque:
      "bg-card text-[var(--continent-antarktika-text)] border-[var(--continent-antarktika)]/30",
    banner:
      "bg-[var(--continent-antarktika-tint)] text-[var(--continent-antarktika-text)] border-b-2 border-[var(--continent-antarktika)]",
    headerBar: "from-[var(--continent-antarktika)] to-[var(--continent-antarktika)]/50",
    heroGradient: "from-[var(--continent-antarktika-tint)] via-background to-background",
    glow: "bg-[var(--continent-antarktika)]/10",
  },
};

/**
 * The identity of the continent the API enum names.
 *
 * Goes through `CONTINENT_KEY_TO_SLUG`, the existing routing table, rather than keying a second
 * map on `Continent`: one crossing from the contract enum to a slug, not two that can disagree.
 */
export function continentIdentityOf(continent: Continent): ContinentIdentity {
  return CONTINENT_IDENTITY[CONTINENT_KEY_TO_SLUG[continent]];
}
