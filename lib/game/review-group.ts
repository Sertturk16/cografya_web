/**
 * Does the end screen's "look again" group open itself, or arrive folded?
 *
 * WHY THIS IS A FUNCTION AND NOT A TERNARY IN THE JSX. It is the same reasoning
 * `shape-state.ts` records: the repo's vitest environment is `node` with no jsdom, so a
 * decision left inside a client component can only ever be checked by scanning source for
 * the shape of an expression. Pulled out, the boundary is a real assertion — which matters
 * here because the group is the round's learning list and the two failure modes sit on
 * either side of one number (→ PR #48 review TA48-I2):
 *
 *   · folded when it is short — the player finishes a 7-question round, misses one, and has
 *     to find and open a disclosure to see which one. The list is the point of the screen;
 *   · open when it is long — an 81-question round can produce 80 chips, which pushes the
 *     score, the stars and both action buttons off a phone screen.
 *
 * Twelve is where those meet: it is above anything the 7-question bölge mode can produce
 * (its whole pool is 7) and above a good bölge-bölge-il round, but well under the point
 * where the list stops being a list and becomes a wall.
 */
export const REVIEW_OPEN_MAX = 12;

/**
 * `count` is the number of targets in the group. Non-positive counts answer `false` — the
 * caller does not render the group at all in that case, and "open an empty disclosure" is
 * not a state worth having a `true` for.
 */
export function shouldOpenReviewGroup(count: number): boolean {
  return count > 0 && count <= REVIEW_OPEN_MAX;
}
