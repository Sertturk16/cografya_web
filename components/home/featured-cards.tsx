import type { ReactNode } from "react";
import styles from "./home.module.css";

/** One card. Everything is already localized and formatted — this component only prints. */
export interface FeaturedCardItem {
  /** Stable React key (plaka kodu / ISO code). */
  readonly id: string;
  /** Fully-built localized pathname (via `getPathname` at the call site, never assembled here). */
  readonly href: string;
  /** The entity's display name in the render locale. */
  readonly name: string;
  /** One line of context: bölge for a province, kıta for a country. */
  readonly meta: string;
  /**
   * The single fact, pre-formatted, or `undefined`. A card with no fact prints no fact row —
   * never a dash or a placeholder (the map hover card's rule, and the same reason).
   */
  readonly fact?: { readonly label: string; readonly value: string };
}

interface FeaturedCardsProps {
  /** `id` of the `<h2>` this grid is labelled by — unique per page (two grids render). */
  readonly headingId: string;
  readonly heading: string;
  /**
   * The category-level eyebrow label above the heading ("İLLER" / "ÜLKELER" —
   * `Owner's Inbox/anasayfa-yenileme/plan.md` §5.13). One per grid, not per card.
   */
  readonly eyebrow: string;
  /**
   * The eyebrow's decorative badge glyph (plan §5.12). Passed in by the caller, never chosen
   * in here — this component stays entity-agnostic by construction (see the docblock below),
   * so "which icon means province vs. country" is a page-level decision, not this one's.
   */
  readonly icon: ReactNode;
  readonly items: readonly FeaturedCardItem[];
}

/**
 * The homepage's featured entity grid — ONE component for provinces and countries.
 *
 * Entity-agnostic by construction: it receives localized strings and a pathname, so nothing
 * about il-vs-ülke reaches it. The selection, the localization and the number formatting all
 * happen server-side before this is called (`lib/home/featured.ts`), which is also what keeps
 * the logic inside the repo's node-environment test harness.
 *
 * WHY THE CARD NAME IS NOT AN `<h3>`. It is the link's text, and headings are the page's
 * outline, not a type scale (`SEO-POLICY.md` §B3.7). Six card titles promoted to `<h3>` would
 * claim six subsections of "Öne çıkan iller" that do not exist.
 *
 * WHY THE WHOLE CARD IS THE ANCHOR. One target, nothing nested inside a link that is itself
 * interactive, and NO `aria-label`: the accessible name is therefore the anchor's full visible
 * text — name, then meta, then the fact row if it has one ("Rize Karadeniz Nüfus (2024)
 * 336.000"). That is deliberate, not an oversight. An `aria-label` shortening it to
 * "Rize, Karadeniz" would hide the number from a screen-reader user that a sighted user can
 * see, and it would break voice control, where the spoken command has to match visible text.
 * The fixed `min-height` is a CLS measure: a card whose fact row is absent must not be shorter
 * than its neighbours.
 *
 * WHY A PLAIN `<a>` AND NOT next-intl's `<Link>`. `href` arrives ALREADY LOCALIZED — the page
 * resolves it through `getPathname`, which is the only way to reach a localized dynamic slug.
 * `<Link>` localizes its own href, so handing it a resolved path is how you ship `/en/en/…`;
 * feeding it properly would mean threading `{pathname, params}` through this component and
 * making an entity-agnostic renderer entity-aware. Same reasoning, same pattern as
 * `entity-index.tsx` and the map sections.
 *
 * Renders NOTHING when the list is empty — an "Öne çıkan iller" heading over no cards is the
 * empty-section shape `SEO-POLICY.md` §B3.6 bans, and the api being briefly unreachable is
 * exactly when it would appear. The eyebrow/badge above the heading shares that same bail-out
 * (plan §5.12) — a category badge over zero cards would be the identical empty-promise shape.
 *
 * ## The trailing arrow (`.cardArrow`, plan §5.12)
 *
 * A small, decorative, WORDLESS affordance — `aria-hidden`, no accompanying text. It is not a
 * "Keşfet" label: that word is `CONTENT-STYLE.md` §22's own named example of banned marketing
 * filler (the same reason it was removed from the hero, plan §5.1/§5.9). Only the visual cue
 * transfers from the reference sites (plan §5.0), never the banned word.
 */
export function FeaturedCards({ headingId, heading, eyebrow, icon, items }: FeaturedCardsProps) {
  if (items.length === 0) return null;

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className={styles.sectionEyebrow}>
        {icon}
        <span>{eyebrow}</span>
        <span className={styles.sectionEyebrowRule} aria-hidden="true" />
      </div>
      <h2 id={headingId}>{heading}</h2>
      <ul role="list" className={styles.cardGrid}>
        {items.map((item) => (
          <li key={item.id}>
            <a className={styles.card} href={item.href}>
              <span className={styles.cardName}>{item.name}</span>
              <span className={styles.cardMeta}>{item.meta}</span>
              {item.fact !== undefined && (
                <span className={styles.cardFact}>
                  <span>{item.fact.label}</span>{" "}
                  <span className={styles.cardFactValue}>{item.fact.value}</span>
                </span>
              )}
              <span className={styles.cardArrow} aria-hidden="true">
                <ArrowGlyph />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The `.cardArrow` glyph — a small chevron, drawn inline (the repo's established icon idiom,
 *  `components/game/game-icons.tsx`): `stroke="currentColor"` so `.cardArrow`'s own resting/
 *  hover colour (`home.module.css`) is the only place the colour is chosen. */
function ArrowGlyph() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
