/**
 * The second a plain İzle press starts from (UYELIK-06 plan §5.4). An EXPLICIT target — a
 * question row or timeline tick's own `data-second`, resolved before this function is ever
 * called — always wins outright and never reaches this function at all
 * (`video-bench.tsx`'s `onClick` branches on `raw !== undefined` first). This function
 * answers the remaining case: a bare İzle press, whose only "explicit" target is whatever the
 * fragment-arrival effect already armed (`hashStartSecond.current`, 0 by default). The saved
 * position is a SECOND, LOWER-PRIORITY source that applies only there, and only when it is
 * strictly further along than that target — never overriding a real deep link to an earlier
 * question with an older saved position.
 */
export function resolveIzleStartSecond(
  explicitTarget: number,
  savedPositionSeconds: number | undefined,
): number {
  return savedPositionSeconds !== undefined && savedPositionSeconds > explicitTarget
    ? savedPositionSeconds
    : explicitTarget;
}
