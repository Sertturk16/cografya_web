import { describe, expect, it } from "vitest";
import { advanceRound, answerRound, createRound, pauseRound, type RoundState } from "./round";
import {
  EMPTY_PROGRESS,
  GAME_STORAGE_KEY,
  parseGameProgress,
  parseRoundState,
  serializeGameProgress,
  withBestScore,
  type GameProgress,
} from "./storage";

/**
 * Structural guards for progress persistence.
 *
 * `localStorage` is UNTRUSTED input: it is shared with the user, with other tabs and with
 * older builds of this page. So the contract under test is that every malformed shape
 * degrades to "no saved round" instead of resuming a nonsensical one or throwing inside
 * the island's mount. No DOM is involved — these are the pure parse/merge functions.
 */

function roundFixture(now = 1_000): RoundState {
  const started = createRound("provinces", ["a", "b", "c"], now, () => 0);
  const answered = answerRound(started, started.order[0] as string, now + 500).state;
  return pauseRound(advanceRound(answered), 2_000);
}

function progressFixture(): GameProgress {
  return { best: { provinces: 42 }, round: roundFixture() };
}

describe("GAME_STORAGE_KEY", () => {
  it("is namespaced and versioned, and carries no brand name", () => {
    expect(GAME_STORAGE_KEY).toBe("cografya:game:v1");
    expect(GAME_STORAGE_KEY).toMatch(/^cografya:[a-z-]+:v\d+$/);
  });
});

describe("parseGameProgress", () => {
  it("round-trips a real snapshot", () => {
    const progress = progressFixture();
    const parsed = parseGameProgress(serializeGameProgress(progress));

    expect(parsed.best).toEqual({ provinces: 42 });
    expect(parsed.round).toEqual(progress.round);
  });

  it("returns empty progress for missing storage", () => {
    expect(parseGameProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseGameProgress("")).toEqual(EMPTY_PROGRESS);
  });

  it("survives corrupt JSON instead of throwing", () => {
    expect(parseGameProgress("{not json")).toEqual(EMPTY_PROGRESS);
    expect(parseGameProgress("[1,2,3]")).toEqual(EMPTY_PROGRESS);
    expect(parseGameProgress('"a string"')).toEqual(EMPTY_PROGRESS);
  });

  it("drops an unknown mode from the best-score table", () => {
    const parsed = parseGameProgress(
      JSON.stringify({ best: { provinces: 7, "region-provinces": 9, nonsense: 3 }, round: null }),
    );

    expect(parsed.best).toEqual({ provinces: 7 });
  });

  it("drops a best score that is not a number in 0…100", () => {
    const parsed = parseGameProgress(
      JSON.stringify({ best: { provinces: "many", regions: -1 }, round: null }),
    );

    expect(parsed.best).toEqual({});
    expect(parseGameProgress(JSON.stringify({ best: { regions: 101 } })).best).toEqual({});
  });

  it("floors a fractional best score (the score is a whole number out of 100)", () => {
    const parsed = parseGameProgress(JSON.stringify({ best: { regions: 68.9 }, round: null }));

    expect(parsed.best).toEqual({ regions: 68 });
  });

  it("does not offer a FINISHED round for resuming", () => {
    const finished: RoundState = { ...roundFixture(), status: "finished" };
    const parsed = parseGameProgress(serializeGameProgress({ best: {}, round: finished }));

    expect(parsed.round).toBeNull();
  });
});

describe("parseRoundState", () => {
  it("rejects anything that is not an object", () => {
    for (const value of [null, undefined, 7, "x", [], true]) {
      expect(parseRoundState(value)).toBeNull();
    }
  });

  it("rejects an unknown mode id", () => {
    expect(parseRoundState({ ...roundFixture(), modeId: "region-provinces" })).toBeNull();
  });

  it("rejects an empty or duplicated question order", () => {
    expect(parseRoundState({ ...roundFixture(), order: [] })).toBeNull();
    expect(parseRoundState({ ...roundFixture(), order: ["a", "a", "b"] })).toBeNull();
  });

  it("rejects an index outside the pool", () => {
    expect(parseRoundState({ ...roundFixture(), index: -1 })).toBeNull();
    expect(parseRoundState({ ...roundFixture(), index: 99 })).toBeNull();
  });

  it("rejects a wrong-click count that is not a whole non-negative number", () => {
    // There is no cap on tries and no attempt budget (DEC 2026-07-30h) — only "a count".
    expect(parseRoundState({ ...roundFixture(), wrongs: -1 })).toBeNull();
    expect(parseRoundState({ ...roundFixture(), wrongs: 1.5 })).toBeNull();
    expect(parseRoundState({ ...roundFixture(), wrongs: 99 })).not.toBeNull();
  });

  it("rejects an unknown status", () => {
    expect(parseRoundState({ ...roundFixture(), status: "revealing" })).toBeNull();
  });

  it("rejects more results than the pool has questions", () => {
    const round = roundFixture();
    const tooMany = [...round.results, ...round.results, ...round.results, ...round.results];

    expect(parseRoundState({ ...round, results: tooMany })).toBeNull();
  });

  it("rejects a malformed result row", () => {
    const round = roundFixture();
    const rows: unknown[] = [
      { targetId: "a", score: 101, wrongPicks: [] }, // above the per-question maximum
      { targetId: "a", score: -1, wrongPicks: [] },
      { targetId: "a", score: 12.5, wrongPicks: [] }, // scores are whole numbers
      { targetId: 1, score: 100, wrongPicks: [] },
      { targetId: "a", score: 100 },
    ];

    for (const row of rows) {
      expect(parseRoundState({ ...round, results: [row] })).toBeNull();
    }
  });

  it("rejects a negative or non-finite accumulated time", () => {
    expect(parseRoundState({ ...roundFixture(), baseElapsedMs: -5 })).toBeNull();
    expect(parseRoundState({ ...roundFixture(), baseElapsedMs: Number.NaN })).toBeNull();
  });

  it("always restores with a STOPPED clock, whatever the snapshot claims", () => {
    const parsed = parseRoundState({ ...roundFixture(), segmentStartedAt: 1 });

    expect(parsed?.segmentStartedAt).toBeNull();
  });
});

describe("withBestScore", () => {
  it("records a first score", () => {
    expect(withBestScore(EMPTY_PROGRESS, "regions", 57).best).toEqual({ regions: 57 });
  });

  it("replaces a lower score", () => {
    const progress = withBestScore(EMPTY_PROGRESS, "provinces", 40);

    expect(withBestScore(progress, "provinces", 64).best).toEqual({ provinces: 64 });
  });

  it("keeps a higher score and returns the same object (no needless write)", () => {
    const progress = withBestScore(EMPTY_PROGRESS, "provinces", 64);

    expect(withBestScore(progress, "provinces", 40)).toBe(progress);
    expect(withBestScore(progress, "provinces", 64)).toBe(progress);
  });

  it("keeps modes independent", () => {
    let progress = withBestScore(EMPTY_PROGRESS, "regions", 71);
    progress = withBestScore(progress, "provinces", 12);

    expect(progress.best).toEqual({ regions: 71, provinces: 12 });
  });
});
