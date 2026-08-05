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
   * Wrong clicks past which a FOUND question still belongs on the "look again" list.
   *
   * ONE — lowered from two on 2026-08-05, and the reason is a defect, not a taste change.
   * At two, a target found on the SECOND click fell out of both end-of-round lists:
   * "bilemedikleriniz" only ever holds questions that scored 0 (i.e. answers that were
   * shown), so a province the player genuinely did not know — but eventually hit — was
   * reported nowhere. The end screen then said "Hepsini bildin." to someone who had just
   * missed one, which is the contradiction the UX tour caught (B9) and the exact list the
   * tour asked for (Ö5: "the provinces you did not know on the first try, linked to their
   * pages"). One wrong click is precisely "did not know it on the first try", so it is the
   * honest threshold for a LEARNING list. It is not a penalty: scoring is untouched by this
   * value, and these questions are still counted as found.
   */
  readonly reviewWrongThreshold: number;
}

export const GAME_CONFIG: GameConfig = {
  fullQuestionPoints: 100,
  minQuestionPoints: 1,
  halvingBase: 2,
  starThresholds: [85, 60, 40],
  reviewWrongThreshold: 1,
};

/** The most stars the end screen can award — derived, never a second literal. */
export const MAX_STARS = GAME_CONFIG.starThresholds.length;

/**
 * The star thresholds, for the end screen to STATE them.
 *
 * Published rather than re-typed into a translation string: the sentence that explains the
 * grade ("85 puan ve üzeri 3 yıldız…") is built from these very numbers, so tuning the
 * ladder can never leave the explanation describing the old one.
 */
export const STAR_THRESHOLDS = GAME_CONFIG.starThresholds;
