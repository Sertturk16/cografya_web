import type { MarinePointListItem } from "@/lib/api/types";

/**
 * The `/deniz` value band's in-page anchors — the ids the hub EMITS and the province
 * sections LINK TO, written down once so the two surfaces cannot drift apart.
 *
 * W2a already gave every value row an `id`; nothing on the hub itself needed it, and it was
 * kept for precisely this: a province page that shows two of thirty points should be able to
 * hand the reader the rest of the picture at the exact row their point sits in, not at the
 * top of a page they then have to search.
 *
 * WHY A MODULE AND NOT A TEMPLATE LITERAL IN EACH FILE. An anchor is a contract between two
 * components in two different routes, and a broken one FAILS SILENTLY: the browser lands at
 * the top of `/deniz` and nobody notices for months. There is no test that can catch a
 * mismatch between two independently-written template strings, and there is a trivial one
 * that catches it between two callers of the same function (`anchors.test.ts`).
 *
 * The slug is used verbatim as the id's tail. Marine slugs are api-issued, ASCII, kebab-case
 * routing keys (`istanbul-marmara-aciklari`), so they are already valid id and fragment
 * material; nothing is re-encoded, because re-encoding here and not there is how the two
 * sides drift.
 */

/** The value section's own heading id — the hub-level fallback target. */
export const MARINE_POINTS_SECTION_ID = "deniz-reference-points";

/** One sea's sub-heading id, and the stem every row id in that basin is built on. */
export function marineBasinAnchorId(basin: MarinePointListItem["seaBasin"]): string {
  return `${MARINE_POINTS_SECTION_ID}-${basin}`;
}

/**
 * One reference point's row id on `/deniz`.
 *
 * Keyed on `slugTr` in BOTH locales on purpose: this is a DOM id, not a URL, and a row that
 * changed its id per locale would need the linking side to know which locale rendered the
 * target. The TR slug is the api's stable routing key for the point either way.
 */
export function marinePointAnchorId(point: {
  seaBasin: MarinePointListItem["seaBasin"];
  slugTr: string;
}): string {
  return `${marineBasinAnchorId(point.seaBasin)}-${point.slugTr}`;
}
