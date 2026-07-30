import { describe, expect, it } from "vitest";
import {
  advanceRound,
  answerRound,
  createRound,
  currentQuestionPoints,
  currentTargetId,
  elapsedMs,
  MAX_STARS,
  pauseRound,
  pointsForAttempt,
  resumeRound,
  revealRound,
  shuffle,
  starsForScore,
  summarizeRound,
  type RoundState,
} from "./round";

/**
 * Structural guards for the round engine (rules locked by DEC 2026-07-30f).
 *
 * Every id below is synthetic ("t1", "t2", …): what is under test is the RULE SET — full
 * coverage per round, halving question points that never hit zero, a "show the answer"
 * exit that is the only 0, a score out of 100, and an honest clock. It must hold for any
 * pool. Asserting a real province or region here would turn a structure test into a fact
 * test, which `CONVENTIONS.md` §2 bars.
 */

const POOL = ["t1", "t2", "t3", "t4"];
const WRONG = "not-a-target";

/** Deterministic "random": always picks the first candidate, so order is reproducible. */
const noShuffle = () => 0;

function startRound(pool: readonly string[] = POOL, now = 1_000): RoundState {
  return createRound("provinces", pool, now, noShuffle);
}

function target(state: RoundState): string {
  const id = currentTargetId(state);
  expect(id).not.toBeNull();
  return id as string;
}

/** Click wrong `count` times on the current question. */
function miss(state: RoundState, count: number, now = 2_000): RoundState {
  let next = state;
  for (let i = 0; i < count; i += 1) next = answerRound(next, WRONG, now).state;
  return next;
}

/** Answer the current question after `wrongs` misses, then advance. */
function solve(state: RoundState, wrongs = 0, now = 2_000): RoundState {
  const missed = miss(state, wrongs, now);
  return advanceRound(answerRound(missed, target(missed), now).state);
}

describe("shuffle", () => {
  it("returns every input exactly once (a round asks the whole pool, SPEC §5.1)", () => {
    const shuffled = shuffle(POOL, () => 0.42);

    expect(shuffled).toHaveLength(POOL.length);
    expect([...shuffled].sort()).toEqual([...POOL].sort());
  });

  it("does not mutate its input", () => {
    const input = [...POOL];
    shuffle(input, () => 0.7);

    expect(input).toEqual(POOL);
  });

  it("actually reorders for a randomness source that is not the identity", () => {
    expect(shuffle(POOL, () => 0)).not.toEqual(POOL);
  });
});

describe("pointsForAttempt", () => {
  it("halves with every wrong click", () => {
    expect([0, 1, 2, 3, 4, 5].map(pointsForAttempt)).toEqual([100, 50, 25, 13, 6, 3]);
  });

  // PINNED (DEC 2026-07-30f follow-up): a bare round(100 / 2 ** wrongs) reaches 0 on the
  // EIGHTH wrong click, which would contradict "finding it always earns something". The
  // floor is a rule, not a rounding artefact.
  it("floors at 1 from the eighth wrong click on, and never returns 0", () => {
    expect(Math.round(100 / 2 ** 8)).toBe(0); // what the bare formula would give
    expect(pointsForAttempt(8)).toBe(1);
    for (const wrongs of [6, 7, 8, 9, 20, 200]) {
      expect(pointsForAttempt(wrongs)).toBeGreaterThanOrEqual(1);
    }
  });

  it("is monotonically non-increasing", () => {
    for (let wrongs = 1; wrongs < 30; wrongs += 1) {
      expect(pointsForAttempt(wrongs)).toBeLessThanOrEqual(pointsForAttempt(wrongs - 1));
    }
  });
});

describe("starsForScore", () => {
  it("grades 3 / 2 / 1 / 0 at the ruled thresholds", () => {
    expect(starsForScore(100)).toBe(3);
    expect(starsForScore(85)).toBe(3);
    expect(starsForScore(84)).toBe(2);
    expect(starsForScore(60)).toBe(2);
    expect(starsForScore(59)).toBe(1);
    expect(starsForScore(40)).toBe(1);
    expect(starsForScore(39)).toBe(0);
    expect(starsForScore(0)).toBe(0);
  });

  it("never exceeds the star count the UI can draw", () => {
    for (let score = 0; score <= 100; score += 1) {
      expect(starsForScore(score)).toBeLessThanOrEqual(MAX_STARS);
    }
  });
});

describe("createRound", () => {
  it("asks every target exactly once", () => {
    const state = startRound();

    expect(state.order).toHaveLength(POOL.length);
    expect(new Set(state.order).size).toBe(POOL.length);
  });

  it("opens on the first question at full value with a running clock", () => {
    const state = startRound(POOL, 5_000);

    expect(state.status).toBe("asking");
    expect(state.index).toBe(0);
    expect(state.wrongs).toBe(0);
    expect(currentQuestionPoints(state)).toBe(100);
    expect(state.segmentStartedAt).toBe(5_000);
  });

  it("is born finished for an empty pool of questions", () => {
    const state = startRound([]);

    expect(state.status).toBe("finished");
    expect(currentTargetId(state)).toBeNull();
  });
});

describe("answering", () => {
  it("pays the full 100 for a first-click hit", () => {
    const state = startRound();

    expect(answerRound(state, target(state), 2_000).outcome).toMatchObject({
      kind: "correct",
      score: 100,
    });
  });

  it("counts every wrong click against the current question, whatever was clicked", () => {
    const after = miss(startRound(), 3);

    expect(after.wrongs).toBe(3);
    expect(after.status).toBe("asking");
  });

  it("keeps the question open after a wrong click, worth half as much", () => {
    const state = startRound();
    const expected = target(state);
    const { state: next, outcome } = answerRound(state, WRONG, 2_000);

    expect(outcome).toEqual({ kind: "retry", targetId: expected, pickedId: WRONG });
    expect(next.status).toBe("asking");
    expect(currentTargetId(next)).toBe(expected);
    expect(currentQuestionPoints(next)).toBe(50);
    expect(next.results).toHaveLength(0);
  });

  it("pays what the halved question is still worth", () => {
    for (const [wrongs, score] of [
      [1, 50],
      [2, 25],
      [3, 13],
      [6, 2],
    ] as const) {
      const state = miss(startRound(POOL), wrongs);
      expect(answerRound(state, target(state), 2_000).outcome).toMatchObject({
        kind: "correct",
        score,
      });
    }
  });

  it("never closes a question on its own — there is no cap on tries", () => {
    const state = miss(startRound(POOL), 12);

    expect(state.status).toBe("asking");
    expect(state.results).toHaveLength(0);
    expect(answerRound(state, target(state), 3_000).outcome.kind).toBe("correct");
  });

  it("ignores a pick that lands during the feedback pause", () => {
    const state = startRound();
    const resolved = answerRound(state, target(state), 2_000).state;

    expect(resolved.status).toBe("resolved");
    expect(answerRound(resolved, "anything", 2_050).outcome.kind).toBe("ignored");
  });

  it("ignores a pick after the round is over", () => {
    let state = startRound();
    for (let i = 0; i < POOL.length; i += 1) state = solve(state);

    expect(state.status).toBe("finished");
    expect(answerRound(state, "anything", 9_000).outcome.kind).toBe("ignored");
  });
});

describe("showing the answer", () => {
  it("scores the question 0 and resolves it", () => {
    const state = startRound(POOL);
    const expected = target(state);
    const { state: next, outcome } = revealRound(state, 2_000);

    expect(outcome).toEqual({ kind: "revealed", targetId: expected });
    expect(next.status).toBe("resolved");
    expect(next.results).toEqual([{ targetId: expected, score: 0, wrongPicks: [] }]);
  });

  // PINNED (DEC 2026-07-30h): showing an answer is the ONLY way a question scores 0, and
  // it costs the round nothing else — it is an exit, not a third way to lose.
  it("is the only zero, and never ends the round early", () => {
    let state = startRound();
    for (let q = 0; q < POOL.length; q += 1) {
      const before = state;
      state = advanceRound(revealRound(state, 2_000).state);
      expect(before.status).toBe("asking"); // every question was actually reached
    }
    const summary = summarizeRound(state, 3_000);

    expect(state.status).toBe("finished");
    expect(summary.missedTargetIds).toHaveLength(POOL.length);
    expect(summary.score).toBe(0);
  });

  it("keeps the wrong picks already made on that question", () => {
    const next = revealRound(miss(startRound(POOL), 2), 2_000).state;

    expect(next.results[0]?.wrongPicks).toEqual([WRONG, WRONG]);
  });

  it("is a no-op once the question is resolved or the round is over", () => {
    const resolved = revealRound(startRound(), 2_000).state;

    expect(revealRound(resolved, 2_100).outcome.kind).toBe("ignored");
  });
});

describe("advanceRound", () => {
  it("moves to the next question only from a resolved one", () => {
    const state = startRound();
    const next = advanceRound(answerRound(state, target(state), 2_000).state);

    expect(next.index).toBe(1);
    expect(next.status).toBe("asking");
    expect(next.wrongs).toBe(0);
    expect(next.currentWrongPicks).toEqual([]);
    expect(currentQuestionPoints(next)).toBe(100);
  });

  it("is a no-op while a question is still open, so it cannot skip a question", () => {
    const state = startRound();

    expect(advanceRound(state)).toBe(state);
  });

  it("is a no-op when called twice (a double click cannot skip a question)", () => {
    const state = startRound();
    const once = advanceRound(answerRound(state, target(state), 2_000).state);

    expect(advanceRound(once)).toBe(once);
  });

  it("finishes the round after the last question", () => {
    const state = answerRound(startRound(["only"]), "only", 2_000).state;

    expect(state.status).toBe("resolved");
    expect(advanceRound(state).status).toBe("finished");
  });
});

describe("summarizeRound", () => {
  it("reports the mean of the per-question points, rounded, out of 100", () => {
    let state = startRound(POOL);
    state = solve(state, 0); // 100
    state = solve(state, 1); // 50
    state = solve(state, 2); // 25
    state = advanceRound(revealRound(state, 2_000).state); // 0
    const summary = summarizeRound(state, 9_000);

    expect(summary.total).toBe(4);
    expect(summary.score).toBe(44); // (100+50+25+0)/4 = 43.75
    expect(summary.firstTry).toBe(1);
  });

  it("counts as first-try only the questions worth the full 100", () => {
    let state = startRound(POOL);
    state = solve(state, 0);
    state = solve(state, 0);
    state = solve(state, 1);
    state = solve(state, 2);

    expect(summarizeRound(state, 9_000).firstTry).toBe(2);
  });

  it("lists exactly the zero-scoring targets, in the order they were asked", () => {
    let state = startRound(POOL);
    const asked = [...state.order];
    state = solve(state, 0); // 100
    state = advanceRound(revealRound(state, 2_000).state); // shown → 0
    state = advanceRound(revealRound(miss(state, 3), 2_000).state); // searched, then shown → 0
    state = solve(state, 1); // 50

    expect(summarizeRound(state, 9_000).missedTargetIds).toEqual([asked[1], asked[2]]);
  });

  it("never scores a found question as missed, however many tries it took", () => {
    const state = solve(startRound(POOL), 20);

    expect(summarizeRound(state, 9_000).missedTargetIds).toEqual([]);
  });

  it("lists a target found after real searching as a REVIEW item, not a failure", () => {
    let state = startRound(POOL);
    const asked = [...state.order];
    state = solve(state, 0); // clean
    state = solve(state, 1); // one slip — not review-worthy
    state = solve(state, 2); // two misses — review
    state = solve(state, 5); // five misses — review
    const summary = summarizeRound(state, 9_000);

    expect(summary.reviewTargetIds).toEqual([asked[2], asked[3]]);
    expect(summary.missedTargetIds).toEqual([]);
  });

  it("never puts a target in both the missed and the review list", () => {
    let state = startRound(POOL);
    state = solve(state, 3);
    state = advanceRound(revealRound(miss(state, 3), 2_000).state);
    const summary = summarizeRound(state, 9_000);
    const overlap = summary.reviewTargetIds.filter((id) => summary.missedTargetIds.includes(id));

    expect(overlap).toEqual([]);
  });

  it("reports the round's total wrong clicks, including the open question", () => {
    let state = startRound();
    state = solve(state, 2); // two wrong clicks, then found
    state = miss(state, 3); // three more on the question still open

    expect(summarizeRound(state, 5_000).totalWrongs).toBe(5);
  });

  it("reports zero wrong clicks for a clean round", () => {
    let state = startRound();
    for (let q = 0; q < POOL.length; q += 1) state = solve(state);

    expect(summarizeRound(state, 5_000).totalWrongs).toBe(0);
    expect(summarizeRound(state, 5_000).score).toBe(100);
  });
});

describe("the clock", () => {
  it("runs from the round's start while a question is open", () => {
    expect(elapsedMs(startRound(POOL, 1_000), 4_000)).toBe(3_000);
  });

  it("stops when the last question is settled, not when its feedback is dismissed", () => {
    const state = answerRound(
      createRound("provinces", ["only"], 1_000, noShuffle),
      "only",
      4_000,
    ).state;

    expect(elapsedMs(state, 60_000)).toBe(3_000);
    expect(elapsedMs(advanceRound(state), 60_000)).toBe(3_000);
  });

  it("does not count the time a paused round spends in storage", () => {
    const paused = pauseRound(startRound(POOL, 1_000), 4_000);
    // …the tab is closed for an hour…
    const resumed = resumeRound(paused, 3_604_000);

    expect(elapsedMs(paused, 3_604_000)).toBe(3_000);
    expect(elapsedMs(resumed, 3_605_000)).toBe(4_000);
  });

  it("never runs backwards if the system clock jumps", () => {
    expect(elapsedMs(startRound(POOL, 10_000), 5_000)).toBe(0);
  });
});
