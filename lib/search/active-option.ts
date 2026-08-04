/**
 * Active-option movement for the search combobox's arrow keys.
 *
 * Extracted from the island for the same reason the ranking and folding were: it is a pure
 * decision with real edge cases (both wrap points, and the "nothing selected yet" start), and
 * the node-only test config cannot reach it while it lives inside a keydown handler
 * (PR #45 review TA45-M1).
 */

/**
 * The next active index after one arrow keypress.
 *
 * `current` is `-1` when nothing is selected, which is why the wrap is expressed against the
 * bounds rather than with a modulo: from "nothing selected", ArrowDown must land on the FIRST
 * option and ArrowUp on the LAST, and `-1 % n` would give neither.
 */
export function nextActiveIndex(current: number, count: number, delta: 1 | -1): number {
  if (count <= 0) return -1;
  const next = current + delta;
  if (next < 0) return count - 1;
  if (next >= count) return 0;
  return next;
}
