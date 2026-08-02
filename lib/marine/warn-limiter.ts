/**
 * WARN AGGREGATION FOR A FAILURE THAT REPEATS ONCE PER ROUTE (the M9 observability decision,
 * closed in W2b).
 *
 * The problem is specific and it arrived with the province surface. `getMarineOverviewSafe`
 * warns once per failed read, which was proportionate when exactly one page read one route.
 * The province conditions read is made by 27 provinces × 2 locales, and a failed fetch is not
 * cached — so a single marine outage during `next build` prints the SAME warning up to 54
 * times, and at runtime once per ISR regeneration forever. A log that repeats itself 54 times
 * is a log nobody reads, which turns a fail-soft path into a silent one.
 *
 * WHAT WAS REJECTED, AND WHY.
 *
 * - **One warn per render pass.** There is no "pass" boundary a library can see in Next: a
 *   build renders routes independently and runtime regenerations are unrelated events.
 *   Implementing it would mean inventing a pass, which is a bigger lie than the noise.
 * - **A time window (warn at most once per N seconds).** It needs a clock, it makes the log
 *   non-deterministic between builds, and — the fatal part — the count of what it suppressed
 *   is only ever reported by the NEXT emitted line. An outage that ends quietly takes its own
 *   tally with it.
 *
 * WHAT THIS DOES INSTEAD: powers of two. Occurrences 1, 2, 4, 8, 16, 32 … are emitted; the
 * rest are counted, and the running total rides on every line that IS emitted. Properties
 * that matter:
 *
 * - a single failure still warns, immediately and in full — nothing is ever swallowed
 *   silently on the way to a threshold;
 * - 54 identical failures produce 6 lines instead of 54, and 10 000 would produce 14;
 * - the emitted line always states which occurrence it is, so the scale of an outage is
 *   readable from any one line — no tally is lost when the outage stops;
 * - it needs no clock, so two builds against the same broken api log the same thing.
 *
 * `reset()` is called on a SUCCESSFUL read: the next outage is a new event and deserves its
 * own first-occurrence warning, rather than inheriting a counter from last week.
 *
 * WHAT IT DOES NOT PROMISE (stated because the docblock above is easy to over-read, → the
 * PR #37 review, M1). The tally is a module-scoped variable, so it aggregates within ONE
 * process and nowhere else:
 *
 * - `next build` may render routes across several workers. Each worker holds its own tally,
 *   so an N-worker build prints up to N sequences of the same schedule, not one. The volume
 *   is still logarithmic in the failure count per worker — which is the property that matters
 *   — but "54 failures → 6 lines" is a single-process figure.
 * - At runtime the same applies per serverless instance / server process: M instances mean M
 *   sequences, and a process that restarts starts counting from one again.
 * - In `next dev`, an HMR reload re-evaluates the module and silently resets the tally.
 *
 * And one sharper limit, in the mechanism itself: `reset()` on success is what makes a PARTIAL
 * outage aggregate badly. If the api answers some provinces and fails others, every success in
 * between zeroes the counter, so each failure is emitted as occurrence 1 and the 54-line
 * problem comes back for exactly the interleaving where it is least informative. The trade is
 * deliberate — the alternative (never resetting) reports a fresh outage next week as
 * "occurrence 4096", which is worse — but a total outage is the case this limiter actually
 * bounds, and it is the case it was built for.
 */

export interface WarnLimiter {
  /**
   * Records one occurrence and returns the line to log, or `null` when this one is folded
   * into the count.
   */
  (message: string): string | null;
  /** Forgets the tally — call it when the underlying operation succeeds again. */
  reset(): void;
}

/** True for 1, 2, 4, 8, … — the occurrences that get a line of their own. */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Creates one limiter. One instance per FAILURE CLASS (one per fetch wrapper), never one per
 * call site: the whole point is to aggregate across the 27 routes that share a failure.
 */
export function createWarnLimiter(): WarnLimiter {
  let occurrences = 0;

  const limiter = ((message: string): string | null => {
    occurrences += 1;
    if (!isPowerOfTwo(occurrences)) return null;

    // The count is part of the line, not a separate summary line, so a single grep hit tells
    // the reader whether this is one province or every province.
    return occurrences === 1 ? message : `${message} (occurrence ${occurrences})`;
  }) as WarnLimiter;

  limiter.reset = () => {
    occurrences = 0;
  };

  return limiter;
}
