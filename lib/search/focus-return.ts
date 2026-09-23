/**
 * Where focus goes when the header search dialog closes.
 *
 * Extracted from the island for the same reason `active-option.ts` was: it is a pure decision
 * with real edge cases, and the node-only test config cannot reach it inside a component.
 *
 * The header renders TWO search triggers — a desktop pill hidden below `sm` and a mobile icon
 * hidden above it — and a third way in, the mobile drawer's quick-search button, which clicks
 * the desktop trigger programmatically and then unmounts with the drawer. So "the element that
 * opened the dialog" can be `display: none` or gone from the DOM by the time the dialog closes,
 * and `focus()` on either is a silent no-op that strands a keyboard reader on `<body>`. The
 * first candidate that is still connected AND rendered wins; the caller lists the opener first
 * and the two triggers after it.
 */

/** The two facts the decision reads; `HTMLElement` satisfies it. */
export interface FocusReturnCandidate {
  readonly isConnected: boolean;
  getClientRects(): { readonly length: number };
}

/**
 * The first candidate that can take focus, or `null` when none can.
 *
 * "Rendered" is `getClientRects().length > 0`: an element under `display: none` (or inside
 * one) has no boxes, which is exactly the hidden-trigger case.
 */
export function focusReturnTarget<T extends FocusReturnCandidate>(
  candidates: readonly (T | null | undefined)[],
): T | null {
  for (const candidate of candidates) {
    if (candidate?.isConnected && candidate.getClientRects().length > 0) return candidate;
  }
  return null;
}
