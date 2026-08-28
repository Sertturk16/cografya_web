"use client";

/**
 * The browser half of the game-rounds transport (UYELIK-10 plan §5.2) — modelled on
 * `lib/video-progress/client.ts`'s SHAPE, not merged into it: game-rounds is a different
 * domain (per-user round history, not playback progress) and gets its own pair of files,
 * the same way video-progress and favorites each got their own.
 */

/** The house standard for a caller-owned read, mirroring `FAVORITES_FETCH_TIMEOUT_MS`'s/
 *  `VIDEO_PROGRESS_FETCH_TIMEOUT_MS`'s reasoning at the same scale. */
export const GAME_ROUNDS_FETCH_TIMEOUT_MS = 8000;

export interface GameRoundRecord {
  readonly mode: string;
  readonly clientRoundId: string;
  readonly score: number;
  readonly found: number;
  readonly firstTry: number;
  readonly total: number;
  readonly poolTotal: number;
  readonly totalWrongs: number;
  readonly endedEarly: boolean;
  readonly completionTimeSeconds: number | null;
  readonly createdAt: string;
}

/**
 * `null` collapses every "nothing to show" condition into one answer — an anonymous/
 * checking reader, a transport failure, or a malformed body — the same collapse every
 * existing `fetch*` in this codebase makes for "anything other than a clean success".
 */
export type FetchGameRoundsResult = readonly GameRoundRecord[] | null;

export interface SubmitGameRoundPayload {
  readonly mode: string;
  readonly clientRoundId: string;
  readonly score: number;
  readonly found: number;
  readonly firstTry: number;
  readonly total: number;
  readonly poolTotal: number;
  readonly totalWrongs: number;
  readonly endedEarly: boolean;
}

export type SubmitGameRoundResult =
  | { readonly ok: true; readonly round: GameRoundRecord }
  | { readonly ok: false; readonly code: "rate-limited" | "failed" };

function buildListUrl(page: number, pageSize: number): string {
  return `/api/game-rounds?page=${page}&pageSize=${pageSize}`;
}

/** Narrows an unknown BFF list body into a {@link GameRoundRecord} array, or `null` on
 *  anything that is not the exact shape `handleListGameRounds` promises — unchecked network
 *  input, the same principle every existing `parse*Body` in this codebase states: a value
 *  that only PASSED THROUGH the BFF unexamined is not safe to trust as typed. */
function parseGameRoundsListBody(value: unknown): readonly GameRoundRecord[] | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;

  const records: GameRoundRecord[] = [];
  for (const entry of items) {
    const record = parseGameRoundEntry(entry);
    if (record === null) return null;
    records.push(record);
  }
  return records;
}

function parseGameRoundEntry(entry: unknown): GameRoundRecord | null {
  if (typeof entry !== "object" || entry === null) return null;
  const e = entry as Record<string, unknown>;
  if (
    typeof e.mode !== "string" ||
    typeof e.clientRoundId !== "string" ||
    typeof e.score !== "number" ||
    typeof e.found !== "number" ||
    typeof e.firstTry !== "number" ||
    typeof e.total !== "number" ||
    typeof e.poolTotal !== "number" ||
    typeof e.totalWrongs !== "number" ||
    typeof e.endedEarly !== "boolean" ||
    typeof e.createdAt !== "string" ||
    // OPTIONAL and nullable, matching the contract exactly (`GameRoundDto`'s own
    // `completionTimeSeconds?: number | null` — absent, explicit null, and a real number
    // are all valid; anything else is not).
    (e.completionTimeSeconds !== undefined &&
      e.completionTimeSeconds !== null &&
      typeof e.completionTimeSeconds !== "number")
  ) {
    return null;
  }
  return {
    mode: e.mode,
    clientRoundId: e.clientRoundId,
    score: e.score,
    found: e.found,
    firstTry: e.firstTry,
    total: e.total,
    poolTotal: e.poolTotal,
    totalWrongs: e.totalWrongs,
    endedEarly: e.endedEarly,
    completionTimeSeconds:
      typeof e.completionTimeSeconds === "number" ? e.completionTimeSeconds : null,
    createdAt: e.createdAt,
  };
}

/**
 * `GET` — the caller's own round history, one bounded fetch per call, only ever called once
 * per mount (`GameHistoryPanel`'s own effect owns the abort budget, the same split every
 * existing `fetch*` draws: the timeout lives in exactly one place per call site).
 */
export async function fetchGameRounds(
  page: number,
  pageSize: number,
  signal: AbortSignal,
): Promise<FetchGameRoundsResult> {
  try {
    const res = await fetch(buildListUrl(page, pageSize), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (res.status !== 200) return null;
    const parsed: unknown = await res.json();
    return parseGameRoundsListBody(parsed);
  } catch {
    return null;
  }
}

/**
 * `POST` — idempotent submit (§5.2/§5.6). DELIBERATE DIVERGENCE from the two precedents this
 * repo already shipped (plan §2.4's tracked `SIMP90-M1`/`CODE91-M1` gap, closed here for THIS
 * new file only, not retrofitted onto the existing writes — plan "Product judgment calls"
 * item 3): this call DOES carry its own `AbortController` + `GAME_ROUNDS_FETCH_TIMEOUT_MS`
 * budget, applied to a WRITE for the first time in this codebase. No `keepalive` — a single
 * discrete "Kaydet" click, not a tab-hide/teardown save; nothing here needs to survive page
 * unload.
 */
export async function submitGameRound(
  payload: SubmitGameRoundPayload,
): Promise<SubmitGameRoundResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GAME_ROUNDS_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/game-rounds", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.status === 429) return { ok: false, code: "rate-limited" };
    if (res.status !== 200) return { ok: false, code: "failed" };
    const parsed: unknown = await res.json();
    const record = parseSubmitBody(parsed);
    if (record === null) return { ok: false, code: "failed" };
    return { ok: true, round: record };
  } catch {
    return { ok: false, code: "failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function parseSubmitBody(value: unknown): GameRoundRecord | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  return parseGameRoundEntry((value as { round?: unknown }).round);
}
