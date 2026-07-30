/**
 * Every tunable the game has, in ONE object (→ DEC 2026-07-30f/30h).
 *
 * The point is not tidiness: the world and continent modes on the roadmap will sit on the
 * same engine, and re-balancing them must be a change to this file, not a grep across the
 * engine, the island and the end screen. Nothing below is a geographic fact — these are
 * product settings, and the scoring shape of the game is entirely described by them.
 *
 * There is deliberately no attempt budget here: a round always visits every question, and
 * the only thing a wrong click costs is that question's own value (→ DEC 2026-07-30h).
 */

/** The modes the engine can run. Mode 3 (provinces of one region) lands in PR-3. */
export const GAME_MODE_IDS = ["regions", "provinces"] as const;
export type GameModeId = (typeof GAME_MODE_IDS)[number];

export function isGameModeId(value: unknown): value is GameModeId {
  return typeof value === "string" && (GAME_MODE_IDS as readonly string[]).includes(value);
}

export interface GameConfig {
  /** What a question is worth before any wrong click. */
  readonly fullQuestionPoints: number;
  /**
   * The floor for a question that is eventually FOUND. It is 1, not 0: a player who keeps
   * searching should keep earning something, and only "show the answer" scores a real
   * zero. Without the floor the halving hits 0 on the eighth wrong click and quietly
   * contradicts the rule.
   */
  readonly minQuestionPoints: number;
  /** Divisor applied per wrong click — the question halves. */
  readonly halvingBase: number;
  /** Final-score thresholds for 3 / 2 / 1 stars, descending. */
  readonly starThresholds: readonly number[];
  /**
   * Wrong clicks past which a FOUND question still belongs on the "look again" list. Two,
   * because one miss is a slip and two is a gap.
   */
  readonly reviewWrongThreshold: number;
}

export const GAME_CONFIG: GameConfig = {
  fullQuestionPoints: 100,
  minQuestionPoints: 1,
  halvingBase: 2,
  starThresholds: [85, 60, 40],
  reviewWrongThreshold: 2,
};

/** The most stars the end screen can award — derived, never a second literal. */
export const MAX_STARS = GAME_CONFIG.starThresholds.length;
