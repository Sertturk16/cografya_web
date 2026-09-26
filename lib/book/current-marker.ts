/**
 * Which marker the player is inside: the last one whose start is at or before `at`, or -1
 * before the first. `seconds` is ascending (the api orders etiketler by orderNo and startSecond).
 */
export function currentMarkerIndex(seconds: readonly number[], at: number): number {
  let index = -1;
  for (let i = 0; i < seconds.length; i += 1) {
    const start = seconds[i];
    if (start === undefined || start > at) break;
    index = i;
  }
  return index;
}
