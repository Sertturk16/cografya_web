import { GAME_CONFIG, GAME_MODE_IDS, isGameModeId, type GameModeId } from "./config";
import type { QuestionResult, RoundState, RoundStatus } from "./round";

/**
 * Progress persistence (SPEC §5.5) — versioned `localStorage`, nothing else.
 *
 * What is stored: the best score per mode (0–100), and a snapshot of a half-finished round
 * so an 81-question run survives an accidental tab close. What is NOT stored, ever: any
 * personal data, any identifier, any cookie, anything sent to a server. There is no
 * account (auth is Faz-3), so this file is the whole persistence story.
 *
 * Key naming: the game's BRAND lives in exactly one place, the `Game.brandName` message
 * (SPEC §1 — the name is reversible until deploy). SPEC §5.5 sketched the key as
 * `cografya:kasif:v1`, which would have put the brand into code and made a rename a data
 * migration; the neutral `cografya:game:v1` follows the same rule the SPEC applies to the
 * `lib/game` / `components/game` folders. Deviation recorded in the closing summary.
 *
 * The `:v1` suffix is the schema gate: a future shape change opens a NEW key rather than
 * trying to read old data, so a stale snapshot can never be half-parsed into a live round.
 */

export const GAME_STORAGE_KEY = "cografya:game:v1";

export interface GameProgress {
  /** Best round score per mode, out of 100 (→ DEC 2026-07-30d). */
  readonly best: Readonly<Partial<Record<GameModeId, number>>>;
  /** A round in progress, or `null`. */
  readonly round: RoundState | null;
}

export const EMPTY_PROGRESS: GameProgress = { best: {}, round: null };

const ROUND_STATUSES: readonly string[] = ["asking", "resolved", "finished"];

function isRoundStatus(value: unknown): value is RoundStatus {
  return typeof value === "string" && ROUND_STATUSES.includes(value);
}

function isQuestionScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= GAME_CONFIG.fullQuestionPoints
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseResult(value: unknown): QuestionResult | null {
  if (!isRecord(value)) return null;
  const { targetId, score, wrongPicks } = value;
  if (typeof targetId !== "string") return null;
  if (!isQuestionScore(score)) return null;
  if (!isStringArray(wrongPicks)) return null;
  return { targetId, score, wrongPicks };
}

/**
 * Rebuild a `RoundState` from untrusted storage.
 *
 * Everything here is a total function over `unknown`: browser storage is shared with the
 * user, other tabs and older builds of this page, so a malformed snapshot must degrade to
 * "no saved round" rather than crash the island or resume a nonsensical round. The
 * invariants checked are the ones the engine relies on (index inside the pool, counts that
 * are counts, results no longer than the pool) — not a full re-derivation.
 */
export function parseRoundState(value: unknown): RoundState | null {
  if (!isRecord(value)) return null;
  const { modeId, order, index, wrongs, currentWrongPicks, results, status, baseElapsedMs } = value;

  if (!isGameModeId(modeId)) return null;
  if (!isStringArray(order) || order.length === 0) return null;
  if (new Set(order).size !== order.length) return null;
  if (!isFiniteNumber(index) || index < 0 || index > order.length) return null;
  // There is no cap on wrong clicks per question and no attempt budget (DEC 2026-07-30h) —
  // only "it must be a count".
  if (!isFiniteNumber(wrongs) || wrongs < 0 || !Number.isInteger(wrongs)) return null;
  if (!isStringArray(currentWrongPicks)) return null;
  if (!isRoundStatus(status)) return null;
  if (!isFiniteNumber(baseElapsedMs) || baseElapsedMs < 0) return null;
  if (!Array.isArray(results) || results.length > order.length) return null;

  const parsedResults: QuestionResult[] = [];
  for (const item of results) {
    const result = parseResult(item);
    if (!result) return null;
    parsedResults.push(result);
  }

  return {
    modeId,
    order,
    index,
    wrongs,
    currentWrongPicks,
    results: parsedResults,
    status,
    baseElapsedMs,
    // A snapshot is always written with the clock STOPPED (`pauseRound`), so any stored
    // segment start is stale by definition — drop it rather than trust a timestamp from
    // another session, which would silently add the offline hours to the round's time.
    segmentStartedAt: null,
  };
}

/** Rebuild the whole progress record from untrusted storage; never throws. */
export function parseGameProgress(raw: string | null): GameProgress {
  if (!raw) return EMPTY_PROGRESS;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (!isRecord(value)) return EMPTY_PROGRESS;

  const best: Partial<Record<GameModeId, number>> = {};
  if (isRecord(value.best)) {
    for (const modeId of GAME_MODE_IDS) {
      const score = value.best[modeId];
      // Scores are whole numbers out of 100; anything else is a foreign write.
      if (isFiniteNumber(score) && score >= 0 && score <= GAME_CONFIG.fullQuestionPoints) {
        best[modeId] = Math.floor(score);
      }
    }
  }

  // A FINISHED round is not "in progress": treat it as nothing to resume, so a snapshot
  // written at the end screen cannot re-open a completed round on the next visit.
  const round = parseRoundState(value.round);
  return { best, round: round && round.status !== "finished" ? round : null };
}

export function serializeGameProgress(progress: GameProgress): string {
  return JSON.stringify({ best: progress.best, round: progress.round });
}

/** Best-of merge — a new personal best only ever replaces a lower one. */
export function withBestScore(
  progress: GameProgress,
  modeId: GameModeId,
  score: number,
): GameProgress {
  const previous = progress.best[modeId];
  if (previous !== undefined && previous >= score) return progress;
  return { ...progress, best: { ...progress.best, [modeId]: score } };
}

/**
 * Read progress. A blocked or full `localStorage` (private mode, quota, a browser policy)
 * degrades to "no progress" — the game itself stays fully playable, it just forgets
 * (SPEC §5.5).
 */
export function readGameProgress(): GameProgress {
  try {
    return parseGameProgress(window.localStorage.getItem(GAME_STORAGE_KEY));
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Write progress; silently a no-op when storage is unavailable. */
export function writeGameProgress(progress: GameProgress): void {
  try {
    window.localStorage.setItem(GAME_STORAGE_KEY, serializeGameProgress(progress));
  } catch {
    // Storage blocked or full: persistence is a convenience, never a precondition.
  }
}

/** Wipe every trace of the game from this browser ("kaydı sıfırla", SPEC §5.4). */
export function clearGameProgress(): void {
  try {
    window.localStorage.removeItem(GAME_STORAGE_KEY);
  } catch {
    // Nothing to do — there is no server-side copy to fall back on.
  }
  cachedProgress = EMPTY_PROGRESS;
  notify();
}

// --- progress as an EXTERNAL STORE -------------------------------------------------------
//
// `localStorage` is a browser API, not React state, so the island subscribes to it through
// `useSyncExternalStore` — the same shape `map-zoom-pan.tsx` already uses for its one-time
// hint. That is what keeps the island free of a "read storage into state on mount" effect,
// and it gives the round loop ONE place that owns the current progress, so a handler can
// read the live value without a ref or a stale closure.
//
// The cache is module-level and holds a STABLE reference: `useSyncExternalStore` re-renders
// whenever the snapshot's identity changes, so returning a fresh object per call would
// re-render forever.

let cachedProgress: GameProgress | null = null;
const progressListeners = new Set<() => void>();

function notify(): void {
  for (const listener of progressListeners) listener();
}

export function subscribeGameProgress(onChange: () => void): () => void {
  progressListeners.add(onChange);
  return () => {
    progressListeners.delete(onChange);
  };
}

/** Current progress, read from storage exactly once per page load. */
export function getGameProgress(): GameProgress {
  cachedProgress ??= readGameProgress();
  return cachedProgress;
}

/** Server snapshot: there is none, and the island never renders on the server anyway. */
export function getServerGameProgress(): GameProgress {
  return EMPTY_PROGRESS;
}

/** Replace progress: cache, persist, and tell every subscriber. */
export function setGameProgress(next: GameProgress): void {
  cachedProgress = next;
  writeGameProgress(next);
  notify();
}
