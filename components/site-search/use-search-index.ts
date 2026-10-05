"use client";

import { useCallback, useRef, useState } from "react";
import { prepareSearchIndex, type PreparedEntry } from "@/lib/search/match";
import { isSearchIndexPayload } from "@/lib/search/types";

/** Give up on the index rather than leaving a panel silently empty forever. */
const FETCH_TIMEOUT_MS = 8000;

export interface SearchIndexState {
  /** The prepared index, or `null` until the first successful load. */
  readonly entries: PreparedEntry[] | null;
  /** The last load attempt failed (network, non-2xx, malformed body or timeout). */
  readonly loadFailed: boolean;
  /**
   * The server answered without one of its api sources (provinces or countries). The entries
   * are usable, but "no results" cannot be claimed, and the next `ensureIndex` refetches.
   */
  readonly incomplete: boolean;
  /** Starts a load unless one is running or a complete, non-empty index is already here. */
  readonly ensureIndex: () => Promise<void>;
}

/**
 * The one loader both search boxes (header and homepage hero) use for
 * `/api/search-index/{locale}`. Fetched lazily, on the reader's first interaction, never on
 * mount: most visits never search.
 *
 * Fetches at most once per usable load. A failed, empty or incomplete result clears the guard
 * so the next interaction retries: a guard set before the await and never reset would let one
 * connectivity blip latch search dead for as long as the island stays mounted — and the header
 * island stays mounted across client-side navigations (review I2). An empty index counts as
 * "not loaded" for the same reason.
 */
export function useSearchIndex(indexUrl: string): SearchIndexState {
  const [entries, setEntries] = useState<PreparedEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const inFlight = useRef(false);

  const indexReady = entries !== null && entries.length > 0 && !incomplete;

  const ensureIndex = useCallback(async () => {
    if (inFlight.current || indexReady) return;
    inFlight.current = true;
    setLoadFailed(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(indexUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`search index responded ${response.status}`);
      const payload: unknown = await response.json();
      // Network input, so the shape is CHECKED rather than asserted; a malformed body becomes
      // the same honest "could not load" as a 500 (review M14).
      if (!isSearchIndexPayload(payload)) throw new Error("search index payload malformed");
      setEntries(prepareSearchIndex(payload.entries));
      setIncomplete(payload.incomplete === true);
    } catch {
      // No console noise for the reader: each box shows its own "could not load" line, and a
      // partial index already on screen stays usable.
      setLoadFailed(true);
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
    }
  }, [indexUrl, indexReady]);

  return { entries, loadFailed, incomplete, ensureIndex };
}
