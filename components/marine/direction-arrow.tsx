import styles from "./marine.module.css";

interface DirectionArrowProps {
  /** Degrees to rotate the glyph, already resolved by `arrowRotationDeg`. */
  rotationDeg: number;
}

/**
 * The direction glyph: an arrow drawn pointing NORTH at 0° and rotated to show where the
 * flow is going.
 *
 * IT CARRIES NO INFORMATION. `aria-hidden` is not an oversight — every fact the arrow hints
 * at is already written out beside it in words ("Geldiği yön: kuzeybatı (315°)"), because a
 * rotated glyph is unreadable to a screen reader, invisible to a crawler, and ambiguous to
 * anyone who has not been told which end is the model's convention. The arrow is a
 * reinforcement for sighted scanning and nothing else, which is also why removing it would
 * cost the page no meaning at all.
 *
 * The rotation is computed server-side and baked into the HTML, so there is no client JS, no
 * layout shift and no animation to respect `prefers-reduced-motion` for. Fixed pixel box:
 * the glyph never changes the height of the line it sits on.
 */
export function DirectionArrow({ rotationDeg }: DirectionArrowProps) {
  return (
    <svg
      className={styles.arrow}
      viewBox="0 0 24 24"
      width="13"
      height="13"
      aria-hidden="true"
      focusable="false"
      style={{ transform: `rotate(${rotationDeg}deg)` }}
    >
      {/* Authored pointing up (north) at 0°: tip at the top, notched tail. */}
      <path d="M12 1.5 18.5 21 12 16.6 5.5 21Z" />
    </svg>
  );
}
