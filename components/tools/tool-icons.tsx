/**
 * The CBS tool hub's icon set — three outline glyphs, drawn inline, one per tool.
 *
 * Same construction and same three reasons as `components/game/game-icons.tsx`
 * (`ENGINEERING.md` §5, the ◭ placeholder that once read as a warning triangle): inline SVG
 * over an emoji (a different picture on every platform, a colour palette this Terra-toned page
 * was never designed for) or an icon font (a network request, a flash of nothing, no
 * `currentColor` inheritance). The 24×24 grid, `stroke="currentColor"`, `strokeWidth={1.7}`,
 * round caps/joins and `aria-hidden`/`focusable="false"` pair are copied from that file's own
 * `Glyph` helper rather than imported from it — this is a sibling domain's icon set, not an
 * extension of the game's.
 *
 * Every icon here is DECORATIVE and every place one appears also names the tool in words next
 * to it (the hub card's own `<h2>`), so nothing here is information carried by a symbol alone
 * (`DESIGN.md` §6.1). The glyphs replace the deleted `Tools.hub.introP2` paragraph's
 * point/line/area distinction — moved from an explanatory sentence into a glance
 * (`Owner's Inbox/araclar-production-ready/SPEC.md` §5.1) — so each one is drawn to read
 * unambiguously on its own: two dots and a line (a measured distance), a pin with a crosshair
 * (a located point), a closed FIVE-sided shape with a dot at each corner (a bounded area,
 * deliberately not a triangle — the same ◭ lesson `game-icons.tsx` already names).
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

/** Two endpoint dots joined by a line — the distance-measuring tool. */
export function DistanceIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 17 18 7" />
      <circle cx="6" cy="17" r="2" />
      <circle cx="18" cy="7" r="2" />
    </Glyph>
  );
}

/** A crosshair over a pin — the coordinate-lookup tool. */
export function CoordinateIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M12 7.4V5.8M12 12.6V14.2M9.4 10H7.8M14.6 10H16.2" />
    </Glyph>
  );
}

/** A closed polygon with a dot at each vertex — the area-calculation tool. Five vertices, not
 *  three, so the shape cannot read as a warning triangle. */
export function AreaIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 15 8 6 17 6 19 15 13 20Z" />
      <circle cx="5" cy="15" r="1.6" />
      <circle cx="8" cy="6" r="1.6" />
      <circle cx="17" cy="6" r="1.6" />
      <circle cx="19" cy="15" r="1.6" />
      <circle cx="13" cy="20" r="1.6" />
    </Glyph>
  );
}
