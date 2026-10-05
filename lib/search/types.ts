/**
 * The site search's wire contract — the shape `/api/search-index/{locale}` serves and both
 * search boxes (header and homepage hero) consume. Kept in its own module so the route
 * handler, the index builder and the matcher all agree on one definition.
 */

/**
 * Which surface an entry belongs to. Single letters because this ships on every record:
 * `p` province, `c` country, `r` region, `k` continent (kıta), `s` sea, `t` tool, `g` page.
 */
export const SEARCH_ENTITY_KINDS = ["p", "c", "r", "k", "s", "t", "g"] as const;
export type SearchEntityKind = (typeof SEARCH_ENTITY_KINDS)[number];

function isSearchEntityKind(value: unknown): value is SearchEntityKind {
  return (SEARCH_ENTITY_KINDS as readonly unknown[]).includes(value);
}

/**
 * One entry, as a positional tuple rather than an object: at ~300 entries the key names
 * would be the majority of the payload.
 *
 * The path is the FINAL localized path (`/turkiye/istanbul`, `/en/dunya/germany`), resolved
 * server-side through `getPathname`. Shipping it costs +102 B gzipped over shipping the bare
 * slug and buys the client never having to know the routing table — the one rule this repo
 * cares about most for URLs (`SEO-POLICY.md` §B4.5: paths are generated, never hand-built).
 */
export type SearchIndexRecord =
  | readonly [name: string, path: string, kind: SearchEntityKind]
  /**
   * Tools and section pages carry a fourth field: extra words a reader may type for them
   * ("afad" for the earthquake page). The matcher ranks a keyword hit below any name hit.
   */
  | readonly [name: string, path: string, kind: SearchEntityKind, keywords: string];

/** The served document. */
export interface SearchIndexPayload {
  readonly entries: readonly SearchIndexRecord[];
  /**
   * `true` when an api source (provinces or countries) failed and its kind is missing. The
   * island then refetches on the next open and never claims "no results" for a query the
   * missing kind might have answered.
   */
  readonly incomplete?: boolean;
}

/**
 * Runtime shape check for the fetched document.
 *
 * The island receives this over the network, so its shape is CHECKED rather than asserted
 * with a cast: a truncated or malformed body should become the same honest "could not load"
 * as a 500, not an array of `undefined`s that only fails later inside the matcher
 * (PR #45 review M14).
 */
export function isSearchIndexPayload(value: unknown): value is SearchIndexPayload {
  if (typeof value !== "object" || value === null) return false;
  const entries: unknown = (value as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return false;
  const incomplete: unknown = (value as { incomplete?: unknown }).incomplete;
  if (incomplete !== undefined && typeof incomplete !== "boolean") return false;
  return entries.every(
    (entry) =>
      Array.isArray(entry) &&
      (entry.length === 3 || (entry.length === 4 && typeof entry[3] === "string")) &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string" &&
      isSearchEntityKind(entry[2]),
  );
}
