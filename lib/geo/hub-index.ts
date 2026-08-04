/**
 * The hub index sections' same-page anchors (→ DEC 2026-08-04i §2).
 *
 * These are FRAGMENTS, not routes: they carry no SEO surface, appear in no sitemap and
 * resolve through no `pathnames` table. They live here rather than inside each page because
 * more than one surface now points at them — the hub renders them and the header search's
 * no-JS fallback links to them — and a drifted string would silently produce a dead jump.
 */

/** `/turkiye#iller` — the alphabetical province index. */
export const PROVINCE_INDEX_SECTION_ID = "iller";

/** `/dunya#ulkeler` — the alphabetical country index. */
export const COUNTRY_INDEX_SECTION_ID = "ulkeler";
