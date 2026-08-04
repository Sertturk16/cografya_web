/**
 * The header search's wire contract — the shape `/api/search-index/{locale}` serves and the
 * client island consumes. Kept in its own module so the route handler, the index builder and
 * the matcher all agree on one definition.
 */

/** Which surface an entry belongs to. Single letters because this ships on every record. */
export type SearchEntityKind = "p" | "c";

/**
 * One entry, as a positional tuple rather than an object: at 277 entries the key names
 * would be the majority of the payload.
 *
 * The path is the FINAL localized path (`/turkiye/istanbul`, `/en/dunya/germany`), resolved
 * server-side through `getPathname`. Shipping it costs +102 B gzipped over shipping the bare
 * slug and buys the client never having to know the routing table — the one rule this repo
 * cares about most for URLs (`SEO-POLICY.md` §B4.5: paths are generated, never hand-built).
 */
export type SearchIndexRecord = readonly [name: string, path: string, kind: SearchEntityKind];

/** The served document. */
export interface SearchIndexPayload {
  readonly entries: readonly SearchIndexRecord[];
}
