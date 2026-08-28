"use client";

/**
 * The browser half of the video-progress transport (UYELIK-06 plan §5.7) — modelled on
 * `lib/auth/submit.client.ts`'s SHAPE, not merged into it: video-progress is a different
 * domain (per-user playback state, not credentials) and gets its own pair of files, the same
 * way its server half does.
 */

/** Browser→BFF round-trip budget, mirroring `lib/auth/submit.client.ts`'s
 *  `AUTH_FETCH_TIMEOUT_MS` reasoning at the same scale — this domain's own constant rather
 *  than a shared import, for the same reason the server half repeats its timeout number
 *  instead of importing the auth transport's. */
export const VIDEO_PROGRESS_FETCH_TIMEOUT_MS = 8000;

export interface VideoProgressValue {
  readonly lastPositionSeconds: number;
  readonly watched: boolean;
  readonly watchedAt: string | null;
}

/**
 * `null` collapses every "nothing to show" condition into one answer — a genuine 404 (no
 * saved progress yet), an anonymous/checking reader, or a transport failure — the same
 * collapse `lib/auth/use-session.client.ts`'s `fetchAuthSessionState` already makes for
 * "anything other than a clean success".
 */
export type FetchVideoProgressResult = VideoProgressValue | null;

function buildVideoProgressUrl(bookVideoId: string): string {
  return `/api/video-progress/${encodeURIComponent(bookVideoId)}`;
}

/** Narrows an unknown BFF body into a {@link VideoProgressValue}, or `null` on anything that
 *  is not the exact shape `handleGetVideoProgress`/`handlePutVideoProgress` promise —
 *  unchecked network input, per the same principle `lib/auth/submit.client.ts`'s
 *  `parseBffBody` docblock states: a value that only PASSED THROUGH the BFF unexamined is not
 *  safe to trust as typed. */
function parseProgressBody(value: unknown): VideoProgressValue | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  const progress = (value as { progress?: unknown }).progress;
  if (
    typeof progress !== "object" ||
    progress === null ||
    typeof (progress as { lastPositionSeconds?: unknown }).lastPositionSeconds !== "number" ||
    typeof (progress as { watched?: unknown }).watched !== "boolean"
  ) {
    return null;
  }
  const watchedAt = (progress as { watchedAt?: unknown }).watchedAt;
  return {
    lastPositionSeconds: (progress as { lastPositionSeconds: number }).lastPositionSeconds,
    watched: (progress as { watched: boolean }).watched,
    watchedAt: typeof watchedAt === "string" ? watchedAt : null,
  };
}

/**
 * `GET` — one bounded fetch, only ever called once per selected video (§5.4: "avoids 30
 * authenticated round trips for a page most readers only ever open 1-3 videos on"). The
 * caller owns the abort budget and passes its `signal` in — the same split
 * `lib/auth/use-session.client.ts`'s `fetchAuthSessionState` draws, so the timeout lives in
 * exactly one place per call site (the effect that owns the request's lifetime) rather than
 * being set twice.
 */
export async function fetchVideoProgress(
  bookVideoId: string,
  signal: AbortSignal,
): Promise<FetchVideoProgressResult> {
  try {
    const res = await fetch(buildVideoProgressUrl(bookVideoId), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (res.status !== 200) return null;
    const parsed: unknown = await res.json();
    return parseProgressBody(parsed);
  } catch {
    return null;
  }
}

export interface SaveVideoProgressResult {
  readonly ok: boolean;
}

export interface SaveVideoProgressOptions {
  /** `true` for the tab-hide save (§5.5 trigger 3) — survives page teardown via `fetch`'s own
   *  `keepalive` flag rather than `navigator.sendBeacon` (rejected in the plan: POST-only,
   *  and this mutation is a PUT-shaped idempotent replace by the api's own design). */
  readonly keepalive?: boolean;
}

/**
 * `PUT` — an idempotent full-state replace. BOTH fields are sent on EVERY call: see
 * {@link buildWatchedTogglePayload} below for the one call site (the watched toggle) where
 * building that payload correctly is the whole of §5.6's named hazard.
 *
 * Carries its own `AbortController` bounded by `VIDEO_PROGRESS_FETCH_TIMEOUT_MS` — the same
 * shape `submitGameRound` (`lib/game-rounds/client.ts`) uses for its write, and the same
 * timeout VALUE this file's own `fetchVideoProgress` already uses for its read (`CODE91-M1`:
 * this write previously carried no timeout at all, unlike the read in this same file). A
 * fresh `controller`/`timeout` per call — every trigger (periodic, pause/ended, tab-hide)
 * calls this one function, so there is no shared/module-level abort state and no race
 * between concurrent calls. `clearTimeout` runs unconditionally in `finally`, covering
 * success, non-2xx, network error and abort alike — no leaked timer on any path. The
 * `keepalive` flag (tab-hide trigger) and the abort `signal` are independent fetch options
 * and combine without conflict — if the tab is torn down before the timeout fires, the
 * keepalive request survives as designed; the timeout otherwise still bounds a request that
 * does not.
 */
export async function saveVideoProgress(
  bookVideoId: string,
  payload: { readonly lastPositionSeconds: number; readonly watched: boolean },
  opts: SaveVideoProgressOptions = {},
): Promise<SaveVideoProgressResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_PROGRESS_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(buildVideoProgressUrl(bookVideoId), {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: opts.keepalive ?? false,
      signal: controller.signal,
    });
    return { ok: res.status === 200 };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Builds the watched-toggle's `PUT` payload (§5.6's full-state-replace hazard, MECHANICALLY
 * enforced here rather than merely documented in prose). The current known position is
 * always carried forward — defaulting to 0 only when no progress row has ever been fetched —
 * never a bare `{ watched }` that would implicitly zero a real saved position under a naive
 * partial update. The api's `UpsertVideoProgressRequestDto` makes both fields required at the
 * type level, so a genuine OMISSION is a compile error; what this function closes is the
 * subtler failure the plan names explicitly: a same-shape call built from STALE or DEFAULT
 * state that would still compile and still be wrong.
 */
export function buildWatchedTogglePayload(
  current: Pick<VideoProgressValue, "lastPositionSeconds"> | null,
  nextWatched: boolean,
): { readonly lastPositionSeconds: number; readonly watched: boolean } {
  return { lastPositionSeconds: current?.lastPositionSeconds ?? 0, watched: nextWatched };
}
