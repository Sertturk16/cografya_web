/**
 * The shared decorative "sign-in required" padlock glyph — one definition standing in for
 * what used to be two independent SVG definitions of the same visual concept (SIMP96-M2,
 * `Owner's Inbox/pr-review-archive/cografya_web-96.md`): `components/game/game-icons.tsx`'s
 * `LockIcon` (a stroke-only outline on the shared `Glyph` wrapper's 24×24 grid) and
 * `components/favorites/favorite-button.tsx`'s own private, unexported `LockIcon` (a smaller
 * filled-body silhouette on a 16×16 grid). The finding names them "the same simple lock
 * silhouette" existing as two independent definitions, not a request to make them look alike —
 * each call site's own historical rendered output is preserved EXACTLY (see
 * `components/lock-icon.test.tsx`'s byte-identity regression proof against each site's
 * pre-consolidation markup), so this merge is a maintenance-ownership move only, never a
 * visual change.
 *
 * Lives at the top level of `components/`, the `card-arrow.tsx`/`prose-note.tsx` convention
 * this repo already uses for a small, cross-domain, decoration-only shared component — not a
 * new `components/icons/` directory invented for one glyph.
 *
 * Both variants are DECORATIVE (`aria-hidden`, `focusable="false"`): every call site states
 * the same "sign-in required" fact in words beside the icon, so nothing here is information
 * carried by a symbol alone (`DESIGN.md` §6.1 rule 3, the same posture `CardArrow`/the game
 * icon set already take).
 */

interface LockIconProps {
  /** `"outline"` — the 24×24 stroke-only silhouette `game-icons.tsx`'s `Glyph` wrapper used to
   *  render for the round-save control's sign-in cue. `"compact"` — the smaller 16×16
   *  filled-body variant `favorite-button.tsx`'s guest branch used to render next to its own
   *  label. */
  readonly variant: "outline" | "compact";
  /** Rendered size in px. Outline defaults to 24 (the `Glyph` wrapper's own default); compact
   *  defaults to 14 (favorite-button.tsx's own hardcoded size — that call site never varied
   *  it). */
  readonly size?: number;
  /** Passed straight through to the rendered `<svg>`'s `className`. Only the compact variant's
   *  one call site has ever used this (`favorite-button.module.css`'s `.lockIcon` positioning
   *  class); the outline variant's `Glyph` wrapper never accepted one. */
  readonly className?: string;
}

export function LockIcon({ variant, size, className }: LockIconProps) {
  if (variant === "compact") {
    const dimension = size ?? 14;
    return (
      <svg
        viewBox="0 0 16 16"
        width={dimension}
        height={dimension}
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        <path
          d="M5 7V5a3 3 0 0 1 6 0v2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <rect x="3.5" y="7" width="9" height="6" rx="1.2" fill="currentColor" />
      </svg>
    );
  }

  const dimension = size ?? 24;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M6 10.5V7.5a6 6 0 1 1 12 0v3" />
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    </svg>
  );
}
