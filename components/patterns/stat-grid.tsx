import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The responsive shell a stat strip sits in — columns, gutter, and nothing else.
 *
 * Every spelling below was MEASURED off the surface rather than designed. Thirteen files write
 * `grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4` character for character, twelve of them with
 * `mt-8` on the end; that is the whole vocabulary this component started with, and a member is
 * added here only when a real grid is migrated onto it.
 *
 * `className` is `never`, for `PageContainer`'s reason: the six vertical rhythms that component
 * replaced grew because every page could write its own. A passthrough would let the same
 * divergence back in through the prop, and the counters in
 * `components/v2/page-composition.test.ts` would stop meaning anything — they read source
 * spellings, and a spelling smuggled through a prop is invisible to them.
 *
 * WHY THE GRID CLASSES STAY LEGIBLE TO THE SCANNER. `statGridsUsingStatTile()` recognises a
 * migrated grid by the `grid` + `grid-cols-*` tokens in the caller's own markup. Wrapping those
 * tokens in a component moves them out of the caller, which would REMOVE the grid from both
 * buckets and lower `STAT_GRIDS_TOTAL` — the signature of a grid refactored out of sight, which
 * is exactly what that invariant exists to catch. So the scanner was taught that a `<StatGrid>`
 * element IS a grid shell, in the same commit that created this file. Neither half works alone.
 */
const COLUMNS = {
  /** The metric strip: two up on a phone, four across from `sm`. 13 files write it. */
  "2-4": "grid-cols-2 sm:grid-cols-4",
  /** The sea-basin strip: two, three, then six. */
  "2-3-6": "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  /** The region hub strip: two up until `lg`. */
  "2-lg-4": "grid-cols-2 lg:grid-cols-4",
  /** The region detail strip: two up until `md`. */
  "2-md-4": "grid-cols-2 md:grid-cols-4",
} as const;

const GAP = {
  /** `gap-3 sm:gap-4` — the strip's spelling. */
  strip: "gap-3 sm:gap-4",
  /** A single step, for grids whose tiles are short enough not to need the `sm` bump. */
  tight: "gap-3",
  /** `gap-4` flat. */
  wide: "gap-4",
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
  /** `pt-2` — a hairline of breathing room where the strip follows body copy, not a hero. */
  body: "pt-2",
  /** `pt-4` — the region detail page's spelling. */
  section: "pt-4",
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
