/**
 * The game surface's icon set — five outline glyphs, drawn inline.
 *
 * Inline SVG rather than an emoji or an icon font, for three reasons the repo has already
 * paid for once (`ENGINEERING.md` §5, the ◭ placeholder that read as a warning triangle):
 * an emoji renders as a different picture on every platform and drags a colour palette
 * into a Terra-toned page it was never designed for; an icon font is a network request and
 * a flash of nothing; and neither can inherit `currentColor`, which is what keeps these
 * glyphs on the right side of the contrast rules wherever they are placed.
 *
 * Every icon is DECORATIVE. Each is `aria-hidden`, and every place one appears also states
 * the same thing in words — so nothing here is information carried by a symbol alone
 * (DESIGN.md §6.1 rule 3).
 */

interface IconProps {
  /** Rendered size in px. The glyphs are drawn on a 24 × 24 grid and scale cleanly. */
  size?: number;
}

function Glyph({ size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Folded map — the region mode. */
export function MapIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
      <path d="M9 4v13M15 6.5v13" />
    </Glyph>
  );
}

/** Location pin — the all-provinces mode. */
export function PinIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </Glyph>
  );
}

/** Stacked layers — the pick-a-region mode. */
export function LayersIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path d="m3 12.5 9 4.5 9-4.5" />
      <path d="m3 17 9 4.5 9-4.5" />
    </Glyph>
  );
}

/** Trophy — the end-of-round badge. */
export function TrophyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.5A2.5 2.5 0 0 0 7 10M17 5.5h2.5A2.5 2.5 0 0 1 17 10" />
      <path d="M12 14v3M9 20h6M10 17h4" />
    </Glyph>
  );
}

/** Circular arrow — "start over". */
export function RestartIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </Glyph>
  );
}

/** Padlock — the anonymous branch of the round-save control's sign-in cue (UYELIK-10 plan
 *  §5.6). This domain's OWN icon module, not a cross-domain import from
 *  `components/favorites/`'s own private `LockIcon` and not a third from-scratch SVG copy —
 *  every glyph on this surface already lives here. */
export function LockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 10.5V7.5a6 6 0 1 1 12 0v3" />
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    </Glyph>
  );
}
