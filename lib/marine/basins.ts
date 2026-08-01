import type { MarinePointListItem } from "@/lib/api/types";

/**
 * Grouping the 30 marine reference points by the sea they sit in (SPEC-ADDENDUM §7.12 —
 * the `/deniz` hub lists them under four sea headings, not as one flat list of 30).
 *
 * Pure and data-driven on purpose: this module holds NO list of basins, no coastal-order
 * table and no basin display names. All three already exist in the contract and inventing
 * a second copy on the web side would be a geography fact living outside the api
 * (`CONVENTIONS.md` §4 / `ENGINEERING.md` §1):
 *
 * - **Order** comes from `displayOrder`, which the api documents as "a coastal traverse
 *   (Black Sea west→east, then Marmara, Aegean, Mediterranean), not alphabetical". Group
 *   order is therefore the group's SMALLEST `displayOrder` — the traverse decides, we do
 *   not restate it.
 * - **Headings** come from each point's own `coastLabelTr` / `coastLabelEn`
 *   ("Karadeniz açıkları" / "Black Sea offshore"), read off the group's first point.
 * - **The basin set** is whatever the payload contains. A basin the web has never heard of
 *   still produces a group with a real, data-supplied heading instead of throwing on a
 *   missing i18n key or being silently dropped.
 */

/** The contract's closed basin enum (`MarinePointListItemDto.seaBasin`). */
export type SeaBasin = MarinePointListItem["seaBasin"];

export interface MarineBasinGroup {
  /** The basin key, used only as a stable React key / test handle. */
  basin: SeaBasin;
  /** The group's points, ascending by `displayOrder`. Never empty. */
  points: MarinePointListItem[];
}

/**
 * Groups points by `seaBasin` and orders both the groups and their members by the api's
 * coastal traverse.
 *
 * Invariants (pinned by `basins.test.ts`): every input point appears in EXACTLY one output
 * group, no group is empty, groups ascend by their smallest `displayOrder`, and members
 * ascend by `displayOrder`. Nothing is filtered out — a point the web cannot label is a
 * defect worth seeing, not one worth hiding.
 */
export function groupPointsByBasin(points: readonly MarinePointListItem[]): MarineBasinGroup[] {
  const byBasin = new Map<SeaBasin, MarinePointListItem[]>();

  for (const point of points) {
    const existing = byBasin.get(point.seaBasin);
    if (existing === undefined) {
      byBasin.set(point.seaBasin, [point]);
    } else {
      existing.push(point);
    }
  }

  const groups: MarineBasinGroup[] = [];
  for (const [basin, members] of byBasin) {
    groups.push({
      basin,
      points: [...members].sort((a, b) => a.displayOrder - b.displayOrder),
    });
  }

  // `points[0]` is safe by construction (a group is only created WITH a member), but
  // `noUncheckedIndexedAccess` cannot know that — hence the explicit fallbacks, which are
  // unreachable rather than defensive.
  return groups.sort((a, b) => (a.points[0]?.displayOrder ?? 0) - (b.points[0]?.displayOrder ?? 0));
}

/**
 * The heading a basin group is shown under, taken from the group's own data
 * ("Karadeniz açıkları" / "Black Sea offshore"). Returns `null` for an empty group so a
 * caller can never render a heading with nothing under it.
 */
export function basinLabel(group: MarineBasinGroup, locale: string): string | null {
  const first = group.points[0];
  if (first === undefined) return null;
  return locale === "en" ? first.coastLabelEn : first.coastLabelTr;
}
