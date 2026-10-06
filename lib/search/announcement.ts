import type { SearchPanelState } from "./panel-state";

/**
 * What a search box's polite live region says (WCAG 4.1.3), shared by the header and the hero
 * box (T-168). Silence while the panel is closed, without a query, or while the index is still
 * loading: "no results" then would be false for a query the index may well match (review I3).
 * An unavailable index is announced, not swallowed, so a reader who cannot see the inline
 * notice still learns why their query found nothing.
 */
export type SearchAnnouncement =
  | { readonly key: "resultCount"; readonly count: number }
  | { readonly key: "noResults" }
  | { readonly key: "loadFailed" };

export function searchAnnouncement({
  open,
  hasQuery,
  panelState,
  hitCount,
}: {
  readonly open: boolean;
  readonly hasQuery: boolean;
  readonly panelState: SearchPanelState;
  readonly hitCount: number;
}): SearchAnnouncement | null {
  if (!open || !hasQuery || panelState === "loading" || panelState === "idle") return null;
  if (panelState === "unavailable") return { key: "loadFailed" };
  if (hitCount === 0) return { key: "noResults" };
  return { key: "resultCount", count: hitCount };
}
