import styles from "./card-arrow.module.css";

/**
 * The trailing "→" on a card link — drawn as inline SVG, not the character U+2192.
 *
 * ## Why the character had to go (owner ruling, → DEC 2026-08-05e)
 *
 * `lib/fonts.ts` self-hosts Nunito Sans and Fraunces with the `latin` + `latin-ext` subsets,
 * which is exactly the right subset pair for Turkish glyphs and deliberately does NOT include
 * the Arrows block. So every "→" on a province or country card was being rendered by whatever
 * the OS happened to substitute — a different family, a different weight and a different
 * optical size on every platform, inside a design system that controls all three everywhere
 * else. The fix is not a bigger font subset (that would add bytes to every page for one
 * glyph); it is to stop asking the font for a picture.
 *
 * ## What it inherits
 *
 * `currentColor` and `1em`, so it takes the link's colour (including the `:hover` shift to
 * `--color-primary`) and scales with the card's font size — the two behaviours the text glyph
 * had and the reason it was chosen in the first place. Nothing about the cards' layout,
 * spacing or accessible names changes.
 *
 * `aria-hidden` is preserved from the markup it replaces: the arrow is pure decoration. The
 * card's accessible name is its visible text (the entity name, and on the climate cards the
 * °C value, which IS content) — an arrow announced as "right arrow" after every one of them
 * would be noise. `focusable="false"` keeps legacy IE/Edge from putting the SVG in the tab
 * order, the same guard `SearchIcon` and the map icons already carry.
 */
export function CardArrow() {
  return (
    <svg
      className={styles.arrow}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 8h10M8.5 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
