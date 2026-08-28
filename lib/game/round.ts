import { GAME_CONFIG, type GameModeId } from "./config";

// Re-exported so the end screen has ONE import for everything it needs to draw a result.
export { MAX_STARS, STAR_THRESHOLDS } from "./config";

/**
 * The round engine (SPEC §5; mechanics locked by DEC 2026-07-30f/30h) — pure, DOM-free and
 * presentation-free.
 *
 * The rules live here and nowhere else:
 *
 * - a round shuffles its whole pool, so every target is asked at most once, and there is no
 *   attempt budget, no way to LOSE early and no way to be locked out of a question
 *   (→ DEC 2026-07-30h). A round ends by running out of questions — or, in the 81-question
 *   mode only, because the player asked it to (`finishEarly`, → DEC 2026-08-05g md. 2). DEC
 *   2026-07-30h's "a round always visits every question" is amended exactly that far and no
 *   further: nothing about SCORING changes, only how many questions there were to score;
 * - each question starts at 100 points and HALVES with every wrong click, whatever was
 *   clicked. It never reaches zero by itself: 100 · 50 · 25 · 13 · 6 · 3 · 2 · 1 · 1 …
 *   A player who keeps trying keeps earning something, and the only 0 is a shown answer;
 * - "show the answer" is the stuck player's exit: 0 points for that question, straight on
 *   to the next one. How long to keep searching is always the player's call;
 * - the round's final score is the mean of the per-question points, rounded — so every
 *   mode is scored out of 100 no matter how long it is.
 *
 * The engine knows targets only by `id` and takes its question set and pool size as
 * parameters. It has no idea a target is drawn as a polygon, and no idea whether the map
 * is Türkiye, one bölge, the world or a continent — which is what lets mode 3 and the
 * future world/continent modes sit on it unchanged.
 *
 * NO CLOCK, and no snapshot (→ DEC 2026-07-30m/30n). A round used to carry elapsed time so
 * the HUD could show seconds and so a half-finished round could be frozen into
 * `localStorage`. The owner removed both the seconds display and the persistence, which
 * removed the only two readers this state ever had; carrying it on as "telemetry nobody
 * collects" would be state that can drift with nothing to catch it. A round now begins and
 * ends inside one visit, which is also why the engine takes no `now` argument at all.
 */

/**
 * What a right answer is worth after `wrongs` wrong clicks on the same question.
 *
 * Halving rather than a fixed ladder, and FLOORED at 1 rather than at 0: plain
 * `round(100 / 2 ** wrongs)` reaches 0 on the eighth wrong click, which would quietly
 * contradict the rule that finding a target always earns something. The floor is the rule.
 */
export function pointsForAttempt(wrongs: number): number {
  const { fullQuestionPoints, minQuestionPoints, halvingBase } = GAME_CONFIG;
  if (wrongs <= 0) return fullQuestionPoints;
  return Math.max(minQuestionPoints, Math.round(fullQuestionPoints / halvingBase ** wrongs));
}

export interface QuestionResult {
  readonly targetId: string;
  /** 0 when the answer was shown or the question was never reached; ≥ 1 when found. */
  readonly score: number;
  /** Target ids picked wrongly on this question, in pick order. */
  readonly wrongPicks: readonly string[];
}

/**
 * `asking` — waiting for an answer · `resolved` — the question is settled and its feedback
 * is on screen until `advanceRound` · `finished` — the round is over.
 *
 * `resolved` exists so the engine, not a timer, owns the boundary between "this question
 * is over" and "the next question is showing". Without it the HUD would have to paint
 * feedback for a question the state had already moved past.
 */
export type RoundStatus = "asking" | "resolved" | "finished";

export interface RoundState {
  readonly modeId: GameModeId;
  /** Shuffled target ids: the full pool, each id exactly once (SPEC §5.1). */
  readonly order: readonly string[];
  /** Index into `order` of the question being asked (or just resolved). */
  readonly index: number;
  /** Wrong clicks spent on the current question — the halving exponent. */
  readonly wrongs: number;
  /** Wrong picks on the current question, in pick order. */
  readonly currentWrongPicks: readonly string[];
  readonly results: readonly QuestionResult[];
  readonly status: RoundStatus;
  /**
   * The round was ENDED BY THE PLAYER rather than by running out of questions
   * (→ DEC 2026-08-05g md. 2). It is what makes the end screen honest: the score is averaged
   * over the questions that were actually SEEN, and the screen says so in words.
   *
   * A flag rather than a truncated `order`, deliberately: `order.length` is still the size of
   * the pool the player took on ("Soru 20/81", "Yarım tur 20/81"), and cutting the array
   * would destroy the one number that makes a half round readable as a half round.
   */
  readonly endedEarly: boolean;
  /**
   * Opaque, client-generated per-round id — the idempotency key `POST /api/game-rounds`
   * dedupes on (UYELIK-10 plan §5.4). Generated ONCE, at {@link createRound}, and never
   * regenerated by `answerRound`/`advanceRound`/`revealRound`/`finishEarly`: that is the
   * entire mechanism behind "a retried save never duplicates" — a genuine double-click or
   * network retry resubmits the SAME finished round, carrying the SAME id, which the api
   * deduplicates server-side; "Baştan başlat"/"Tekrar oyna" calls `createRound` again and
   * correctly gets a NEW id, because a replay is a new round to save, not an edit of the old
   * one.
   *
   * NOT the class of state DEC 2026-07-30m/30n's guard test (below) exists to keep out: it
   * carries no elapsed time, is held only in memory for the lifetime of one round, and is
   * never itself persisted client-side — only sent to the server on an explicit save click.
   */
  readonly clientRoundId: string;
}

export type AnswerOutcome =
  /** Right answer; `score` is what the halved question was still worth. */
  | { readonly kind: "correct"; readonly targetId: string; readonly score: number }
  /** A wrong click. The question stays open, worth half as much. */
  | { readonly kind: "retry"; readonly targetId: string; readonly pickedId: string }
  /** The player asked for the answer: 0 points, on to the next question. */
  | { readonly kind: "revealed"; readonly targetId: string }
  /** Not an answer at all: the round is over, or the question is already resolved. */
  | { readonly kind: "ignored" };

export interface AnswerTransition {
  readonly state: RoundState;
  readonly outcome: AnswerOutcome;
}

/** Fisher-Yates, with the randomness injected so a round can be reproduced in a test. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    // `noUncheckedIndexedAccess`: both reads are in range by construction, and this guard
    // is what proves it to the compiler without a non-null assertion.
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/**
 * Start a round over the full target pool.
 *
 * The pool is SHUFFLED IN FULL rather than sampled: every target is asked exactly once, so
 * a completed round guarantees complete coverage (SPEC §5.1). A round with no questions is
 * born `finished`, so no caller has to special-case it.
 */
export function createRound(
  modeId: GameModeId,
  targetIds: readonly string[],
  random: () => number = Math.random,
  /** Injectable for the same reason `random` already is — deterministic round ids in tests.
   *  `crypto.randomUUID()` is available with no polyfill on both this repo's runtime targets
   *  (Node 24, `.nvmrc`) and every browser this product supports. */
  generateId: () => string = () => crypto.randomUUID(),
): RoundState {
  const order = shuffle(targetIds, random);
  return {
    modeId,
    order,
    index: 0,
    wrongs: 0,
    currentWrongPicks: [],
    results: [],
    status: order.length > 0 ? "asking" : "finished",
    endedEarly: false,
    clientRoundId: generateId(),
  };
}

/**
 * "Turu bitir" — end the round HERE and score what was played (→ DEC 2026-08-05g md. 2).
 *
 * The 81-question mode is roughly twenty minutes long, and before this the only ways out were
 * to play all of it or to leave the page and lose everything. A player who has learned twenty
 * provinces should be able to see what they learned.
 *
 * A NO-OP on a round that is already finished, and on one with no scored question yet: an
 * "end" that produces an empty result screen is not a result, it is a dead end. The caller
 * (`game-island.tsx`) hides the button in exactly the same two cases, so this guard is the
 * engine's own restatement of the rule rather than the only place it lives.
 *
 * `currentWrongPicks` is CLEARED rather than carried into the summary. The question on screen
 * was abandoned, not answered — it never becomes a `QuestionResult`, it is not in
 * `missedTargetIds`, and the clicks spent on it are not part of a round it was never part of.
 */
export function finishEarly(state: RoundState): RoundState {
  if (state.status === "finished" || state.results.length === 0) return state;
  return { ...state, currentWrongPicks: [], status: "finished", endedEarly: true };
}

/** The target id being asked or just resolved; `null` once the round is over. */
export function currentTargetId(state: RoundState): string | null {
  return state.status === "finished" ? null : (state.order[state.index] ?? null);
}

/** What the current question is worth right now — never SHOWN, only scored (DEC 30m). */
export function currentQuestionPoints(state: RoundState): number {
  return pointsForAttempt(state.wrongs);
}

/**
 * Apply one pick.
 *
 * A pick is accepted only while a question is open. A click that lands during the feedback
 * pause, or after the round ends, is `ignored` rather than silently halving the next
 * question — the pause is reading time, not play time.
 */
export function answerRound(state: RoundState, pickedId: string): AnswerTransition {
  const targetId = currentTargetId(state);
  if (state.status !== "asking" || targetId === null) {
    return { state, outcome: { kind: "ignored" } };
  }

  if (pickedId === targetId) {
    const score = pointsForAttempt(state.wrongs);
    return {
      state: resolveQuestion(state, { targetId, score, wrongPicks: state.currentWrongPicks }),
      outcome: { kind: "correct", targetId, score },
    };
  }

  return {
    state: {
      ...state,
      wrongs: state.wrongs + 1,
      currentWrongPicks: [...state.currentWrongPicks, pickedId],
    },
    outcome: { kind: "retry", targetId, pickedId },
  };
}

/**
 * "Show me the answer" — the stuck player's exit (DEC 2026-07-30f/30h).
 *
 * It scores the question 0 and moves on. Nothing else in the round is affected — the round
 * still visits every remaining question — so asking for an answer is never a penalty beyond
 * the question it is asked about. It is also the only reason a question can score 0.
 */
export function revealRound(state: RoundState): AnswerTransition {
  const targetId = currentTargetId(state);
  if (state.status !== "asking" || targetId === null) {
    return { state, outcome: { kind: "ignored" } };
  }
  return {
    state: resolveQuestion(state, { targetId, score: 0, wrongPicks: state.currentWrongPicks }),
    outcome: { kind: "revealed", targetId },
  };
}

/**
 * Move past a resolved question. The "Devam" button and the timed auto-advance both call
 * this, so the manual control is an exact equivalent of waiting — a timed transition is
 * never the only way forward (WCAG 2.2.1).
 *
 * A no-op in any other status, so a double click on "Devam" cannot skip a question.
 */
export function advanceRound(state: RoundState): RoundState {
  if (state.status !== "resolved") return state;
  const index = state.index + 1;
  return {
    ...state,
    index,
    wrongs: 0,
    currentWrongPicks: [],
    status: index >= state.order.length ? "finished" : "asking",
  };
}

export interface RoundSummary {
  /**
   * Questions that were SCORED — the denominator of every ratio on the end screen.
   *
   * The whole pool on a completed round, and the questions actually seen on one the player
   * ended early. Keeping it "the scored questions" is what lets "Doğru 12/12" and "12/12 ilk
   * denemede" stay literally true on a half round without either of them being touched.
   */
  readonly total: number;
  /**
   * Size of the pool the round set out to cover — `total` again on a completed round, 81 on a
   * half-played 81 İl round. The ONLY consumer is the "Yarım tur 12/81" line, which is what
   * stops the stars above it from reading as a grade for the whole map.
   */
  readonly poolTotal: number;
  /** The player ended the round themselves — see {@link finishEarly}. */
  readonly endedEarly: boolean;
  /** The round's score out of 100 — the mean of the per-question points, rounded. */
  readonly score: number;
  /** Questions that were FOUND — anything that did not score 0. The end screen's "doğru". */
  readonly found: number;
  /** Questions found on the FIRST click (worth the full 100). */
  readonly firstTry: number;
  /**
   * Target ids that scored 0 — i.e. whose answer had to be SHOWN (SPEC §5.4).
   *
   * Built from `results` alone, which is what keeps it honest on a round ended early: a
   * question that was never asked is not a question the player failed. "Bilemedim" must mean
   * "it was asked and I did not know it", never "I did not get that far".
   */
  readonly missedTargetIds: readonly string[];
  /**
   * Found, but only after `reviewWrongThreshold` wrong clicks or more. Not failures, so
   * they are kept out of "bilemedikleriniz" — but they are exactly what a player should
   * look at again, so the end screen offers them as a second, secondary group.
   */
  readonly reviewTargetIds: readonly string[];
  /** Wrong clicks across the whole round — an honest stat, not a mechanic. */
  readonly totalWrongs: number;
}

export function summarizeRound(state: RoundState): RoundSummary {
  let points = 0;
  let found = 0;
  let firstTry = 0;
  let totalWrongs = state.currentWrongPicks.length;
  const missedTargetIds: string[] = [];
  const reviewTargetIds: string[] = [];
  for (const result of state.results) {
    points += result.score;
    totalWrongs += result.wrongPicks.length;
    if (result.score === GAME_CONFIG.fullQuestionPoints) firstTry += 1;
    if (result.score === 0) missedTargetIds.push(result.targetId);
    else {
      found += 1;
      // Found, but only after real searching: worth a second look, without being a failure.
      if (result.wrongPicks.length >= GAME_CONFIG.reviewWrongThreshold) {
        reviewTargetIds.push(result.targetId);
      }
    }
  }
  // THE DIVISOR, and it is the only thing DEC 2026-08-05g md. 2 changed about scoring.
  //
  // The formula is DEC 2026-07-30h's, untouched: the round's score is the MEAN of the
  // per-question points, rounded, so every mode is scored out of 100 however long it is. What
  // md. 2 settles is what "the questions" means once a round can end early — and it has to be
  // the questions that were SEEN. Dividing a 12-question half round by 81 would report a
  // score of 15 for a player who got twelve out of twelve right, which is not a harsher grade,
  // it is a false one.
  //
  // On a round that ran to the end the two are the same number, so a completed round is scored
  // bit for bit as before.
  const scored = state.endedEarly ? state.results.length : state.order.length;
  return {
    total: scored,
    poolTotal: state.order.length,
    endedEarly: state.endedEarly,
    // Averaged over the scored questions, so a mid-round summary reads as progress towards
    // the final number rather than as a score in its own right.
    score: scored === 0 ? 0 : Math.round(points / scored),
    found,
    firstTry,
    missedTargetIds,
    reviewTargetIds,
    totalWrongs,
  };
}

/*
 * `runningScore()` used to live here — the HUD's live score pill, averaged over the
 * questions answered so far. It is GONE, function and tests, because the owner removed the
 * pill (2026-08-05 live tour): the score is not shown while the round is being played, only
 * at the end. That is the same ruling DEC 2026-07-30m already made about the per-question
 * value, one level up.
 *
 * Deleted rather than kept "in case": it had exactly one caller, an engine export nobody
 * reads is state that can drift with nothing to catch it, and the calculation is three
 * lines if a future HUD ever wants it back.
 */

/** Stars for a final score. A presentation grade, thresholds from the config. */
export function starsForScore(score: number): number {
  return GAME_CONFIG.starThresholds.filter((threshold) => score >= threshold).length;
}

function resolveQuestion(state: RoundState, result: QuestionResult): RoundState {
  return {
    ...state,
    // The picks have just moved INTO `results`, so the open-question list is empty again.
    // Carrying them here as well would make `summarizeRound` count them twice while the
    // question sits in `resolved` — and "Yanlış" is on the end screen.
    currentWrongPicks: [],
    results: [...state.results, result],
    status: "resolved",
  };
}
