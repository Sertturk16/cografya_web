import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The responsive shell a stat strip sits in — columns, gutter, and nothing else.
 *
 * Every spelling below was MEASURED off the surface rather than designed, and **a member is added
 * here only when a real grid is migrated onto it.** That sentence was in this docblock from the
 * first commit while six members contradicted it; review called it and the six are gone. What the
 * surface writes today, and what each would become, is recorded below as PROSE — the knowledge is
 * free, the API surface is not:
 *
 *   - `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` — `v2-sea-basin-detail-view`'s 6-across strip;
 *   - `grid-cols-2 lg:grid-cols-4` — `turkiye/bolge`'s fourteenth strip;
 *   - `grid-cols-2 md:grid-cols-4` — `turkiye/bolge/[slug]`;
 *   - `gap-3` flat, `gap-4` flat, `pt-2`, `pt-4` — the gaps and gutters those three carry.
 *
 * Each is one line to add when its grid actually arrives; `columns: "2"` proves the path, having
 * been added in this very task because `kitaplar` needed it. An unused member is never exercised
 * by a real render, so it cannot be known to fit the geometry it was measured from — which is
 * exactly what `components/orphan.test.ts` and T-036 refuse.
 *
 * `className` is `never`, for `PageContainer`'s reason: the six vertical rhythms that component
 * replaced grew because every page could write its own. A passthrough would let the same
 * divergence back in through the prop, and the counters in
 * `components/v2/page-composition-cards.test.ts` would stop meaning anything — they read source
 * spellings, and a spelling smuggled through a prop is invisible to them.
 *
 * WHY THE GRID CLASSES STAY LEGIBLE TO THE SCANNER. `statGridsUsingStatTile()` recognises a
 * migrated grid by the `grid` + `grid-cols-*` tokens in the caller's own markup. Wrapping those
 * tokens in a component moves them out of the caller, which would REMOVE the grid from both
 * buckets and lower `STAT_GRIDS_TOTAL` — the signature of a grid refactored out of sight, which
 * is exactly what that invariant exists to catch. So the scanner was taught that a `<StatGrid>`
 * element IS a grid shell, in the same commit that created this file. Neither half works alone.
 *
 * That teaching is what makes this component's RENDERED OUTPUT load-bearing, not merely its
 * source. `components/patterns/patterns-contract.test.ts` renders it and asserts the exact class
 * string per `columns` member, because review demonstrated that the source-substring pin it
 * replaced was satisfied by a dead `cn("grid", …)` reference behind a `void` while the element
 * itself rendered `flex flex-col` — thirteen strips collapsed to one column, whole suite green.
 */
const COLUMNS = {
  /**
   * The metric strip: two up on a phone, four across from `sm`. **11 product files render it**
   * (the 12 that render `<StatGrid>`, less `kitaplar` which takes `"2"`), and **7 more still
   * hand-write the spelling** — `deprem/fay-hatlari` and `kitaplar/[slug]`, both deliberately out
   * of the migration, plus five grids outside this family. An earlier version of this line said
   * "13 files write it", which was wrong under either reading.
   */
  "2-4": "grid-cols-2 sm:grid-cols-4",
  /**
   * Two tracks at every width. `kitaplar` reached this shape by writing the 2-4 strip and then
   * `sm:col-span-2` on each of its two surviving tiles, which renders identically and needs a
   * per-tile escape hatch to say so.
   */
  "2": "grid-cols-2",
} as const;

const GAP = {
  /** `gap-3 sm:gap-4` — the strip's spelling, and the only one on the surface. */
  strip: "gap-3 sm:gap-4",
} as const;

/**
 * Space above the grid. Not a margin escape hatch: the strip sits directly under a `PageHero`
 * inside the hero `Card`, and 12 of the 13 sites separate it with exactly `mt-8`. The
 * thirteenth (`kitaplar/[slug]`) writes none, which is why this is a union and not a constant.
 */
const GUTTER = {
  none: "",
  /** `mt-8` — clear of the hero above. */
  hero: "mt-8",
} as const;

export interface StatGridProps {
  children: ReactNode;
  columns?: keyof typeof COLUMNS;
  gap?: keyof typeof GAP;
  gutter?: keyof typeof GUTTER;
  /** No escape hatch. See the note above. */
  className?: never;
}

export function StatGrid({
  children,
  columns = "2-4",
  gap = "strip",
  gutter = "none",
}: StatGridProps) {
  return <div className={cn("grid", COLUMNS[columns], GAP[gap], GUTTER[gutter])}>{children}</div>;
}
