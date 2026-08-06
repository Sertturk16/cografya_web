import { describe, expect, it } from "vitest";
import {
  advanceRound,
  answerRound,
  createRound,
  currentQuestionPoints,
  currentTargetId,
  finishEarly,
  MAX_STARS,
  pointsForAttempt,
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

function startRound(pool: readonly string[] = POOL): RoundState {
  return createRound("provinces", pool, noShuffle);
}

function target(state: RoundState): string {
  const id = currentTargetId(state);
  expect(id).not.toBeNull();
  return id as string;
}

/** Click wrong `count` times on the current question. */
function miss(state: RoundState, count: number): RoundState {
  let next = state;
  for (let i = 0; i < count; i += 1) next = answerRound(next, WRONG).state;
  return next;
}

/** Answer the current question after `wrongs` misses, then advance. */
function solve(state: RoundState, wrongs = 0): RoundState {
  const missed = miss(state, wrongs);
  return advanceRound(answerRound(missed, target(missed)).state);
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

  it("opens on the first question at full value", () => {
    const state = startRound(POOL);

    expect(state.status).toBe("asking");
    expect(state.index).toBe(0);
    expect(state.wrongs).toBe(0);
    expect(currentQuestionPoints(state)).toBe(100);
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

    expect(answerRound(state, target(state)).outcome).toMatchObject({
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
    const { state: next, outcome } = answerRound(state, WRONG);

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
      expect(answerRound(state, target(state)).outcome).toMatchObject({
        kind: "correct",
        score,
      });
    }
  });

  it("never closes a question on its own — there is no cap on tries", () => {
    const state = miss(startRound(POOL), 12);

    expect(state.status).toBe("asking");
    expect(state.results).toHaveLength(0);
    expect(answerRound(state, target(state)).outcome.kind).toBe("correct");
  });

  it("ignores a pick that lands during the feedback pause", () => {
    const state = startRound();
    const resolved = answerRound(state, target(state)).state;

    expect(resolved.status).toBe("resolved");
    expect(answerRound(resolved, "anything").outcome.kind).toBe("ignored");
  });

  it("ignores a pick after the round is over", () => {
    let state = startRound();
    for (let i = 0; i < POOL.length; i += 1) state = solve(state);

    expect(state.status).toBe("finished");
    expect(answerRound(state, "anything").outcome.kind).toBe("ignored");
  });
});

describe("showing the answer", () => {
  it("scores the question 0 and resolves it", () => {
    const state = startRound(POOL);
    const expected = target(state);
    const { state: next, outcome } = revealRound(state);

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
      state = advanceRound(revealRound(state).state);
      expect(before.status).toBe("asking"); // every question was actually reached
    }
    const summary = summarizeRound(state);

    expect(state.status).toBe("finished");
    expect(summary.missedTargetIds).toHaveLength(POOL.length);
    expect(summary.score).toBe(0);
  });

  it("keeps the wrong picks already made on that question", () => {
    const next = revealRound(miss(startRound(POOL), 2)).state;

    expect(next.results[0]?.wrongPicks).toEqual([WRONG, WRONG]);
  });

  it("is a no-op once the question is resolved or the round is over", () => {
    const resolved = revealRound(startRound()).state;

    expect(revealRound(resolved).outcome.kind).toBe("ignored");
  });
});

describe("advanceRound", () => {
  it("moves to the next question only from a resolved one", () => {
    const state = startRound();
    const next = advanceRound(answerRound(state, target(state)).state);

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
    const once = advanceRound(answerRound(state, target(state)).state);

    expect(advanceRound(once)).toBe(once);
  });

  it("finishes the round after the last question", () => {
    const state = answerRound(startRound(["only"]), "only").state;

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
    state = advanceRound(revealRound(state).state); // 0
    const summary = summarizeRound(state);

    expect(summary.total).toBe(4);
    expect(summary.score).toBe(44); // (100+50+25+0)/4 = 43.75
    expect(summary.firstTry).toBe(1);
  });

  // "Doğru" on the end screen. Found means "did not score 0", which — because a shown
  // answer is the only zero — is exactly the complement of the missed list.
  it("counts every non-zero question as found, and found + missed is the whole pool", () => {
    let state = startRound(POOL);
    state = solve(state, 0);
    state = solve(state, 4);
    state = advanceRound(revealRound(state).state);
    state = solve(state, 1);
    const summary = summarizeRound(state);

    expect(summary.found).toBe(3);
    expect(summary.found + summary.missedTargetIds.length).toBe(summary.total);
  });

  it("counts as first-try only the questions worth the full 100", () => {
    let state = startRound(POOL);
    state = solve(state, 0);
    state = solve(state, 0);
    state = solve(state, 1);
    state = solve(state, 2);

    expect(summarizeRound(state).firstTry).toBe(2);
  });

  it("lists exactly the zero-scoring targets, in the order they were asked", () => {
    let state = startRound(POOL);
    const asked = [...state.order];
    state = solve(state, 0); // 100
    state = advanceRound(revealRound(state).state); // shown → 0
    state = advanceRound(revealRound(miss(state, 3)).state); // searched, then shown → 0
    state = solve(state, 1); // 50

    expect(summarizeRound(state).missedTargetIds).toEqual([asked[1], asked[2]]);
  });

  it("never scores a found question as missed, however many tries it took", () => {
    const state = solve(startRound(POOL), 20);

    expect(summarizeRound(state).missedTargetIds).toEqual([]);
  });

  // The threshold is ONE wrong click (`GAME_CONFIG.reviewWrongThreshold`, lowered
  // 2026-08-05): "found, but not on the first try" is exactly what a learning list is for,
  // and at two, a target missed once was reported nowhere at all — the end screen said
  // "Hepsini bildin." to a player who had just missed one (UX tour B9 / Ö5).
  it("lists every target that was NOT found on the first click as a REVIEW item", () => {
    let state = startRound(POOL);
    const asked = [...state.order];
    state = solve(state, 0); // clean — first click
    state = solve(state, 1); // one slip — review
    state = solve(state, 2); // two misses — review
    state = solve(state, 5); // five misses — review
    const summary = summarizeRound(state);

    expect(summary.reviewTargetIds).toEqual([asked[1], asked[2], asked[3]]);
    expect(summary.missedTargetIds).toEqual([]);
  });

  it("keeps a first-click answer out of the review list", () => {
    let state = startRound(POOL);
    state = solve(state, 0);
    state = solve(state, 0);

    expect(summarizeRound(state).reviewTargetIds).toEqual([]);
  });

  it("never puts a target in both the missed and the review list", () => {
    let state = startRound(POOL);
    state = solve(state, 3);
    state = advanceRound(revealRound(miss(state, 3)).state);
    const summary = summarizeRound(state);
    const overlap = summary.reviewTargetIds.filter((id) => summary.missedTargetIds.includes(id));

    expect(overlap).toEqual([]);
  });

  it("reports the round's total wrong clicks, including the open question", () => {
    let state = startRound();
    state = solve(state, 2); // two wrong clicks, then found
    state = miss(state, 3); // three more on the question still open

    expect(summarizeRound(state).totalWrongs).toBe(5);
  });

  // The boundary the "including the open question" test above cannot see: between the
  // answer and "Devam" the question is `resolved`, so its picks live in `results` — and
  // used to ALSO be left on the open-question list, double-counting them for as long as
  // that feedback was on screen.
  it("counts a resolved question's wrong clicks exactly once, before it is advanced", () => {
    const searched = miss(startRound(), 2);
    const resolved = answerRound(searched, target(searched)).state;

    expect(resolved.status).toBe("resolved");
    expect(summarizeRound(resolved).totalWrongs).toBe(2);
  });

  it("counts the wrong clicks of a question whose answer was shown exactly once", () => {
    const revealed = revealRound(miss(startRound(), 3)).state;

    expect(revealed.status).toBe("resolved");
    expect(summarizeRound(revealed).totalWrongs).toBe(3);
  });

  it("reports zero wrong clicks for a clean round", () => {
    let state = startRound();
    for (let q = 0; q < POOL.length; q += 1) state = solve(state);

    expect(summarizeRound(state).totalWrongs).toBe(0);
    expect(summarizeRound(state).score).toBe(100);
  });
});

/**
 * "Turu bitir" — ending a round early (→ DEC 2026-08-05g md. 2).
 *
 * The ruling amends exactly one sentence of DEC 2026-07-30h ("a round always visits every
 * question") and nothing else. So the assertions below are as much about what did NOT change
 * as about what did: the halving formula, the star ladder and the shape of the end-of-round
 * package are all untouched, and a round that runs to the end must be scored bit for bit as
 * it was before this function existed.
 */
describe("finishEarly", () => {
  it("is a no-op before the first scored question", () => {
    // An "end" that opens an empty result screen is not a result. Identity, not a copy: the
    // caller may compare by reference to decide whether anything happened.
    const state = startRound(POOL);
    expect(finishEarly(state)).toBe(state);
    // Wrong clicks alone are not a scored question either.
    const onlyMisses = miss(state, 3);
    expect(finishEarly(onlyMisses)).toBe(onlyMisses);
  });

  it("is a no-op on a round that already ended", () => {
    let state = startRound(POOL);
    for (let i = 0; i < POOL.length; i += 1) state = solve(state);
    expect(state.status).toBe("finished");
    expect(finishEarly(state)).toBe(state);
    // …and it does not retro-label a completed round as a half one.
    expect(finishEarly(state).endedEarly).toBe(false);
  });

  it("ends the round and records that the player did it", () => {
    const state = finishEarly(solve(startRound(POOL)));
    expect(state.status).toBe("finished");
    expect(state.endedEarly).toBe(true);
    // The pool is NOT truncated: "Soru 1/4" and "Yarım tur 1/4" both need the original size.
    expect(state.order).toHaveLength(POOL.length);
  });

  it("starts every round as a full one", () => {
    expect(startRound(POOL).endedEarly).toBe(false);
    expect(summarizeRound(startRound(POOL)).endedEarly).toBe(false);
  });

  it("scores a half round over the questions that were SEEN", () => {
    // Two of four, both right on the first click. Averaged over the pool this would report
    // 50 for a player who got everything they were asked; averaged over what was asked it
    // reports the truth. The FORMULA is DEC 2026-07-30h's, untouched — only the divisor is
    // what md. 2 settles.
    let state = startRound(POOL);
    state = solve(state);
    state = solve(state);
    const summary = summarizeRound(finishEarly(state));

    expect(summary.score).toBe(100);
    expect(summary.total).toBe(2);
    expect(summary.poolTotal).toBe(POOL.length);
    expect(summary.found).toBe(2);
    expect(summary.firstTry).toBe(2);
  });

  it("still applies the halving inside a half round", () => {
    // 100 and 50, over two seen questions ⇒ 75. If the divisor ever silently became the pool
    // again this would read 38.
    let state = startRound(POOL);
    state = solve(state);
    state = solve(state, 1);
    expect(summarizeRound(finishEarly(state)).score).toBe(75);
  });

  it("never reports an unasked target as one the player missed", () => {
    // The honesty rule of the whole feature. "Bilemedim" means "it was asked and I did not
    // know it"; a question the round never reached is not a failure and must not appear in
    // the end screen's list — nor be counted as found.
    let state = startRound(POOL);
    // The id is READ from the round, never assumed: `noShuffle` is a deterministic stub, not
    // an identity — Fisher-Yates with `() => 0` swaps each position with the first, so the
    // opening question is not `POOL[0]`. Asserting a position here would test the stub.
    const shown = target(state);
    state = advanceRound(revealRound(state).state); // asked, shown ⇒ genuinely missed
    const answered = target(state);
    state = solve(state);
    const summary = summarizeRound(finishEarly(state));

    expect(summary.missedTargetIds).toEqual([shown]);
    expect(summary.missedTargetIds).not.toContain(answered);
    // The two questions the round never reached are in neither column.
    expect(summary.found).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.poolTotal).toBe(POOL.length);
  });

  it("does not charge the abandoned question's wrong clicks to the round", () => {
    // The player clicked around on a question they then walked away from. That question is
    // not part of the round — it produced no result — so its clicks are not part of the
    // round's "Yanlış tıklama" either.
    let state = startRound(POOL);
    state = solve(state, 2);
    const withOpenMisses = miss(state, 3);
    expect(summarizeRound(withOpenMisses).totalWrongs).toBe(5);
    expect(summarizeRound(finishEarly(withOpenMisses)).totalWrongs).toBe(2);
  });

  it("leaves a completed round scored exactly as before", () => {
    // The regression that matters most: three of the four modes never call `finishEarly` at
    // all, and their end screens must be untouched by its existence.
    let state = startRound(POOL);
    state = solve(state);
    state = solve(state, 1);
    state = solve(state, 2);
    state = advanceRound(revealRound(state).state);
    const summary = summarizeRound(state);

    expect(summary.endedEarly).toBe(false);
    expect(summary.total).toBe(POOL.length);
    expect(summary.poolTotal).toBe(POOL.length);
    // (100 + 50 + 25 + 0) / 4 = 43.75 ⇒ 44.
    expect(summary.score).toBe(44);
    expect(summary.found).toBe(3);
  });
});

// `runningScore` had its own describe block here. Both the function and the HUD pill it
// fed were removed by owner ruling (2026-08-05): the score is not shown while the round is
// played. The tests went with the code they described — there is nothing left to assert.

describe("the removed clock and snapshot (DEC 2026-07-30m/30n)", () => {
  // A guard, not a formality: the seconds display and the localStorage snapshot were both
  // removed by owner ruling, and elapsed time is exactly the kind of state that gets
  // quietly re-added "for later". A round now carries nothing but the round.
  it("keeps no timing field on the round state", () => {
    const state = solve(startRound(POOL), 1);

    expect(Object.keys(state).sort()).toEqual([
      "currentWrongPicks",
      // Added by DEC 2026-08-05g md. 2, and it is NOT the kind of field this guard exists to
      // keep out: it records something the PLAYER did, inside the round, and it has a reader
      // on the end screen. A clock had neither property.
      "endedEarly",
      "index",
      "modeId",
      "order",
      "results",
      "status",
      "wrongs",
    ]);
  });

  it("reports no elapsed time in the summary", () => {
    expect(summarizeRound(startRound(POOL))).not.toHaveProperty("elapsedMs");
  });
});
