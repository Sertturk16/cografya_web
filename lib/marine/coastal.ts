import type {
  MarineConditions,
  MarinePointListItem,
  MarineProvinceConditions,
} from "@/lib/api/types";

/**
 * THE COASTAL GATE, and the province surface's publish decision — the two questions
 * `/turkiye/{il}` has to answer before it can show a marine section, both as pure functions.
 *
 * WHY THE 27-PROVINCE LIST DOES NOT LIVE ON THE WEB. "Which provinces have a coast" is a
 * geographic fact, and the api already publishes it: the reference-point set names a plaka
 * for every point it carries. Writing the twenty-seven codes into this repo would create a
 * second source for that fact (`CONVENTIONS.md` §4 / `ENGINEERING.md` §1) — one that would
 * silently disagree the day a point is added, retired or moved to a different province.
 *
 * The gate also does two other jobs for free:
 *
 * - it skips the ~54 `/conditions` calls the inland provinces would otherwise make, and
 * - it steps around the ONE piece of the contract that is not written down: what
 *   `/api/marine/provinces/{plaka}/conditions` answers for a province with no coast (404? a
 *   200 with an empty array?). We never ask, so we never depend on the answer.
 */

/**
 * The plaka codes that have at least one reference point — derived from the point list, in
 * whatever shape the api sends it today.
 *
 * A province with two points (İstanbul, Çanakkale, Balıkesir) appears once: this answers
 * "does this province have a coast", not "how many points does it have".
 */
export function coastalPlateCodes(points: readonly MarinePointListItem[]): Set<string> {
  return new Set(points.map((point) => point.plateCode));
}

/**
 * Whether this province may show a marine section at all.
 *
 * An empty point list answers `false` for every province — which is the correct degraded
 * answer, not a bug: with no point list we do not know which provinces have a coast, and a
 * section built on a guess is worse than no section.
 */
export function isCoastalPlate(points: readonly MarinePointListItem[], plateCode: string): boolean {
  return coastalPlateCodes(points).has(plateCode);
}

/**
 * The province's value blocks, or `[]` when there is nothing publishable this render.
 *
 * `null` is `getMarineProvinceConditionsSafe`'s fail-soft answer (outage, 5xx, a 404 from an
 * api that does not serve the route yet). It collapses to "no blocks", which means "no
 * section this render" — never "this province has no sea".
 *
 * NOTE THE CONTRACT ASYMMETRY, deliberately not papered over: `MarineOverviewDto` carries a
 * `dataAvailable` publish gate and `MarineProvinceConditionsDto` does NOT (surfaced to Atlas
 * in the W2 plan §2.3). So the province surface has one gate where the hub has two, and the
 * cold-cache case reaches it as per-field `unavailable` statuses — which the section renders
 * honestly rather than hiding. If the flag is ever added to this DTO, it belongs here, in the
 * one function both the section and its licence block read.
 */
export function provinceMarineBlocks(
  conditions: MarineProvinceConditions | null,
): MarineConditions[] {
  return conditions === null ? [] : conditions.marinePoints;
}

/**
 * THE ONE SIGNAL that decides whether this province page carries marine material.
 *
 * Three things key on it — the section, the attribution/licence block, and (through the
 * section) the straits caution — and they must not be able to disagree. Splitting one
 * decision across call sites is exactly how `/deniz` shipped a lede promising values over a
 * section that had none (the O1 finding in the PR #36 review); this is the same fix applied
 * before the same bug can happen here.
 *
 * The licence gate is the sharp end of it: the attribution block must appear whenever a
 * derived value appears (a licence obligation, → DEC 2026-08-02c) and must NOT appear when
 * none does (the page's own "no source for absent content" rule). One boolean guarantees
 * both halves at once.
 */
export function provinceShowsMarine(conditions: MarineProvinceConditions | null): boolean {
  return provinceMarineBlocks(conditions).length > 0;
}
