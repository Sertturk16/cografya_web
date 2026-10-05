/**
 * What a search panel should say under its input. One decision for both search boxes
 * (header and homepage hero), so neither can claim "no results" when the truth is "the list
 * did not load".
 *
 * The rule the states exist for: "Sonuç bulunamadı." is a statement about the WHOLE index.
 * It is only said when the index arrived complete and non-empty. A failed fetch, an empty
 * index and a partial one (an api source was down, see `SearchIndexPayload.incomplete`) are
 * all "unavailable" instead, because the missing part might have held the answer.
 */
export type SearchPanelState = "idle" | "loading" | "results" | "noResults" | "unavailable";

export interface SearchPanelInput {
  /** Entries in the loaded index, or `null` before the first successful load. */
  readonly entryCount: number | null;
  readonly loadFailed: boolean;
  readonly incomplete: boolean;
  /** The query has a non-whitespace character. */
  readonly hasQuery: boolean;
  readonly hitCount: number;
}

export function searchPanelState(input: SearchPanelInput): SearchPanelState {
  const { entryCount, loadFailed, incomplete, hasQuery, hitCount } = input;
  if (entryCount === null && !loadFailed) return hasQuery ? "loading" : "idle";
  if (hasQuery && hitCount > 0) return "results";
  if (loadFailed || entryCount === 0) return "unavailable";
  if (!hasQuery) return "idle";
  return incomplete ? "unavailable" : "noResults";
}
