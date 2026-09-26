/**
 * The mobile two-step's URL contract (T-128 spec §4.3). The hash IS the step: a video or marker
 * fragment of a video on this page means "watch that video"; anything else means "pick".
 * Selecting a video pushes an entry marked with {@link BENCH_HISTORY_MARK} so the back gesture
 * returns to the list, and the back button knows whether stepping back stays on this page.
 */
export type BenchStep = "pick" | "watch";

export const BENCH_HISTORY_MARK = "t128-bench";

/** `#video-12`, `#video-12-etiket-3`, `#video-12-tahillar` — never `#video-120` for 12. */
const VIDEO_FRAGMENT = /^#video-(\d+)(?:-|$)/;

export function stepForHash(
  hash: string,
  orderNos: readonly number[],
): { step: BenchStep; orderNo: number | null } {
  const digits = VIDEO_FRAGMENT.exec(hash)?.[1];
  const orderNo = digits === undefined ? Number.NaN : Number.parseInt(digits, 10);
  return orderNos.includes(orderNo) ? { step: "watch", orderNo } : { step: "pick", orderNo: null };
}

export function isBenchEntry(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as Record<string, unknown>)[BENCH_HISTORY_MARK] === true
  );
}
