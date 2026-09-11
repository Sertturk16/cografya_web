"use client";

/**
 * The browser half of the video-identity transport (P2 plan §5.3) — modelled on
 * `lib/video-progress/client.ts`'s SHAPE, not merged into it: video identity is a different
 * domain (a stateless, caller-independent content lookup, gated on authentication alone) from
 * per-user playback progress, and gets its own pair of files the same way video-progress and
 * favorites do.
 */

/** Browser→BFF round-trip budget, mirroring `lib/video-progress/client.ts`'s
 *  `VIDEO_PROGRESS_FETCH_TIMEOUT_MS` at the same scale — this domain's own constant rather
 *  than a shared import, for the same reason the video-progress module repeats its own
 *  timeout instead of importing another domain's. */
export const VIDEO_IDENTITY_FETCH_TIMEOUT_MS = 8000;

function buildVideoIdentityUrl(bookVideoId: string): string {
  return `/api/video-identity/${encodeURIComponent(bookVideoId)}`;
}

/** Narrows an unknown BFF body into the one field this domain publishes, or `null` on anything
 *  that is not the exact shape `handleGetVideoIdentity` promises — unchecked network input,
 *  the same principle `lib/video-progress/client.ts`'s `parseProgressBody` docblock states: a
 *  value that only PASSED THROUGH the BFF unexamined is not safe to trust as typed. */
function parseIdentityBody(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  const videoId = (value as { youtubeVideoId?: unknown }).youtubeVideoId;
  return typeof videoId === "string" ? videoId : null;
}

/**
 * `GET` — one bounded fetch, called only once a login-gated reader actually presses İzle (or
 * the external "watch on YouTube" control) for a video whose identity the stage does not
 * already know (§5.3: the server-side gate this whole package exists to build — the anonymous
 * payload never carries this value at all any more). `null` collapses every "nothing to give
 * the caller" condition into one answer — unauthenticated, not found, a transport failure, or
 * a malformed body — the same collapse `fetchVideoProgress` already makes; the caller (this
 * repo's click handlers) decides what a `null` means at its own call site (a stuck load that
 * clears itself, in every case here). The caller owns the abort budget and passes its `signal`
 * in, the same split `fetchVideoProgress` draws.
 */
export async function fetchVideoIdentity(
  bookVideoId: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(buildVideoIdentityUrl(bookVideoId), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (res.status !== 200) return null;
    const parsed: unknown = await res.json();
    return parseIdentityBody(parsed);
  } catch {
    return null;
  }
}
