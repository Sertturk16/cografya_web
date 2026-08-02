import { describe, expect, it } from "vitest";
import { createWarnLimiter } from "./warn-limiter";

/**
 * The M9 aggregation decision, as an invariant: a failure that repeats once per route must
 * stay VISIBLE without repeating itself 54 times.
 *
 * Two properties do the work and both are asserted below — the first occurrence is never
 * swallowed, and the emitted count never lies about how many there have been.
 */

describe("createWarnLimiter — powers of two, with the count attached", () => {
  it("emits the very first occurrence, verbatim and immediately", () => {
    // A limiter that waits for a threshold would turn a ONE-province failure into silence.
    const limit = createWarnLimiter();
    expect(limit("boom")).toBe("boom");
  });

  it("emits at 1, 2, 4, 8, 16, 32 and folds the rest into the count", () => {
    const limit = createWarnLimiter();
    const emittedAt: number[] = [];

    for (let occurrence = 1; occurrence <= 54; occurrence += 1) {
      if (limit("boom") !== null) emittedAt.push(occurrence);
    }

    // 54 = the 27 coastal provinces × 2 locales of one build.
    expect(emittedAt).toEqual([1, 2, 4, 8, 16, 32]);
  });

  it("states which occurrence an emitted line is, so no tally is lost when it stops", () => {
    const limit = createWarnLimiter();
    const lines: string[] = [];

    for (let i = 0; i < 8; i += 1) {
      const line = limit("boom");
      if (line !== null) lines.push(line);
    }

    expect(lines).toEqual([
      "boom",
      "boom (occurrence 2)",
      "boom (occurrence 4)",
      "boom (occurrence 8)",
    ]);
  });

  it("grows logarithmically — 10 000 failures produce 14 lines", () => {
    const limit = createWarnLimiter();
    let emitted = 0;
    for (let i = 0; i < 10_000; i += 1) if (limit("boom") !== null) emitted += 1;

    expect(emitted).toBe(14);
  });

  it("starts over after a success, so a new outage warns like a new outage", () => {
    const limit = createWarnLimiter();
    limit("boom");
    limit("boom");
    limit("boom");

    limit.reset();

    expect(limit("boom")).toBe("boom");
  });

  it("keeps two limiters independent", () => {
    // One instance per failure CLASS: the points read's tally must not silence the province
    // conditions read's first failure.
    const a = createWarnLimiter();
    const b = createWarnLimiter();

    a("boom");
    a("boom");

    expect(b("other")).toBe("other");
  });
});
