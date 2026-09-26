/**
 * Per-row watch status for the book page's list (T-128 spec §4.6). Signed-out readers and
 * unstarted videos have no entry: the row shows its reserved, empty icon slot.
 */
export type RowStatus =
  { readonly kind: "done" } | { readonly kind: "part"; readonly fraction: number };

/** A started ring stays visible and never reads as full, whatever the raw ratio says. */
const MIN_FRACTION = 0.05;
const MAX_FRACTION = 0.95;
const UNKNOWN_DURATION_FRACTION = 0.5;

export function rowStatuses(
  rows: readonly {
    readonly bookVideoId: string;
    readonly lastPositionSeconds: number;
    readonly watched: boolean;
  }[],
  durations: ReadonlyMap<string, number | null>,
): Map<string, RowStatus> {
  const result = new Map<string, RowStatus>();
  for (const row of rows) {
    if (row.watched) {
      result.set(row.bookVideoId, { kind: "done" });
      continue;
    }
    const duration = durations.get(row.bookVideoId) ?? null;
    const raw =
      duration === null || duration <= 0
        ? UNKNOWN_DURATION_FRACTION
        : row.lastPositionSeconds / duration;
    const fraction = Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, raw));
    result.set(row.bookVideoId, { kind: "part", fraction });
  }
  return result;
}
