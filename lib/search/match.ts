import { foldForSearch } from "./normalize";
import type { SearchEntityKind, SearchIndexRecord } from "./types";

/**
 * Query matching and ranking for the header search. Pure and DOM-free, so every ranking
 * invariant is unit-testable without mounting the island.
 *
 * ## Two phases, on purpose
 *
 * {@link prepareSearchIndex} folds all 277 names ONCE when the index arrives;
 * {@link searchPrepared} runs per keystroke over the prepared forms. Folding inside the
 * per-keystroke path would repeat ~277 Unicode normalizations on every character typed —
 * still fast, but it is free to not do it, and INP is a budgeted metric here
 * (CONVENTIONS §6 #9).
 */

/** An index entry with its comparable forms precomputed. */
export interface PreparedEntry {
  readonly name: string;
  readonly path: string;
  readonly kind: SearchEntityKind;
  /** Folded display name — `"Çin Cumhuriyeti (Tayvan)"` → `"cin cumhuriyeti tayvan"`. */
  readonly foldedName: string;
  /**
   * Folded slug, taken from the path's final segment with hyphens as spaces.
   *
   * The slug is the last segment BY CONSTRUCTION of the `/turkiye/[slug]` and
   * `/dunya/[slug]` routes, so this is a definition rather than a guess. It is a second
   * match key rather than the only one: for almost every entity it folds to the same string
   * as the name, and the one entity whose slug genuinely differs (`tayvan`) is already
   * reachable through its folded NAME, since the slug word also appears there.
   */
  readonly foldedSlug: string;
}

/** A match, in the order it should be shown. */
export interface SearchHit {
  readonly name: string;
  readonly path: string;
  readonly kind: SearchEntityKind;
}

export interface SearchOptions {
  /** Maximum hits returned. The caller shows a "see the full list" row beneath them. */
  readonly limit: number;
  /** Collation locale for the tie-break inside one rank tier. */
  readonly collationLocale: string;
}

/** How well an entry matched — lower is better. Not exported: it is an internal ordering. */
const RANK_EXACT = 0;
const RANK_PREFIX = 1;
const RANK_WORD_PREFIX = 2;
const RANK_SUBSTRING = 3;
const RANK_NONE = 4;

export function prepareSearchIndex(records: readonly SearchIndexRecord[]): PreparedEntry[] {
  return records.map(([name, path, kind]) => ({
    name,
    path,
    kind,
    foldedName: foldForSearch(name),
    foldedSlug: foldForSearch(path.slice(path.lastIndexOf("/") + 1)),
  }));
}

/** The best (lowest) rank this entry achieves for `query`, across both match keys. */
function rankOf(entry: PreparedEntry, query: string): number {
  let best = RANK_NONE;
  for (const haystack of [entry.foldedName, entry.foldedSlug]) {
    if (haystack === query) return RANK_EXACT;
    if (haystack.startsWith(query)) {
      best = Math.min(best, RANK_PREFIX);
      continue;
    }
    // A word-boundary hit: "kore" finds "Güney Kore", "urfa" finds "Şanlıurfa" only at the
    // weaker substring tier below. Folding has already collapsed every separator to a
    // single space, so splitting on space is exact.
    if (haystack.split(" ").some((word) => word.startsWith(query))) {
      best = Math.min(best, RANK_WORD_PREFIX);
      continue;
    }
    if (haystack.includes(query)) best = Math.min(best, RANK_SUBSTRING);
  }
  return best;
}

/**
 * Ranked hits for `query`, capped at `limit`.
 *
 * Order is (rank tier, then collation of the display name) — fully deterministic, so the
 * same query always produces the same list in the same order. An empty or whitespace-only
 * query returns nothing rather than the whole corpus: an unfiltered 277-row listbox is not
 * a useful answer to "the user has not typed yet".
 */
export function searchPrepared(
  entries: readonly PreparedEntry[],
  query: string,
  options: SearchOptions,
): SearchHit[] {
  const folded = foldForSearch(query);
  if (folded.length === 0) return [];

  const collator = new Intl.Collator(options.collationLocale);
  const ranked: { entry: PreparedEntry; rank: number }[] = [];
  for (const entry of entries) {
    const rank = rankOf(entry, folded);
    if (rank !== RANK_NONE) ranked.push({ entry, rank });
  }

  ranked.sort((a, b) =>
    a.rank !== b.rank ? a.rank - b.rank : collator.compare(a.entry.name, b.entry.name),
  );

  return ranked.slice(0, Math.max(0, options.limit)).map(({ entry }) => ({
    name: entry.name,
    path: entry.path,
    kind: entry.kind,
  }));
}
