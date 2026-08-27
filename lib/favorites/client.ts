"use client";

/**
 * The browser half of the favorites transport (UYELIK-08 plan §5.2) — modelled on
 * `lib/video-progress/client.ts`'s SHAPE, not merged into it: favorites is a different
 * domain (per-user saved-entity state, not playback progress) and gets its own pair of
 * files, the same way video-progress got its own pair rather than joining the auth
 * transport.
 *
 * `FavoriteTargetParam` lives HERE (plan §5.1's "either file is fine, pick one and keep it
 * single-sourced") rather than in `transport.server.ts`: both route handlers and this
 * module's own functions key on it, and this file carries no `server-only` guard, so a
 * type-only import of it from the server half never risks crossing a client/server
 * boundary the wrong way.
 */

/** Browser→BFF round-trip budget for the one-shot list fetch, mirroring
 *  `VIDEO_PROGRESS_FETCH_TIMEOUT_MS`'s reasoning at the same scale — this domain's own
 *  constant rather than a shared import, for the same reason the video-progress client
 *  repeats its own number instead of importing the auth transport's. */
export const FAVORITES_FETCH_TIMEOUT_MS = 8000;

/** One favoritable target: a province (keyed by `plateCode`) or a country (keyed by
 *  `isoCode`) — the discriminated shape both the client and server halves key their
 *  outbound path on. */
export type FavoriteTargetParam =
  | { readonly kind: "province"; readonly plateCode: string }
  | { readonly kind: "country"; readonly isoCode: string };

/** The narrowed, parsed shape a caller actually needs — not a re-export of the raw BFF
 *  body, the same split `lib/video-progress/client.ts`'s `VideoProgressValue` draws. */
export interface FavoriteRecord {
  readonly type: "province" | "country";
  readonly plateCode: string | null;
  readonly isoCode: string | null;
}

/**
 * `null` collapses every "nothing to show" condition into one answer — an anonymous/
 * checking reader, a transport failure, or a malformed body — the same collapse
 * `fetchVideoProgress`/`fetchAuthSessionState` already make for "anything other than a
 * clean success".
 */
export type FetchFavoritesResult = readonly FavoriteRecord[] | null;

function buildFavoritesListUrl(): string {
  return "/api/favorites";
}

function buildFavoriteUrl(target: FavoriteTargetParam): string {
  return target.kind === "province"
    ? `/api/favorites/provinces/${encodeURIComponent(target.plateCode)}`
    : `/api/favorites/countries/${encodeURIComponent(target.isoCode)}`;
}

/** Narrows an unknown BFF body into a {@link FavoriteRecord} array, or `null` on anything
 *  that is not the exact shape `handleListFavorites` promises — unchecked network input,
 *  the same principle `lib/video-progress/client.ts`'s `parseProgressBody` docblock states:
 *  a value that only PASSED THROUGH the BFF unexamined is not safe to trust as typed. */
function parseFavoritesListBody(value: unknown): readonly FavoriteRecord[] | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  const favorites = (value as { favorites?: unknown }).favorites;
  if (!Array.isArray(favorites)) return null;

  const records: FavoriteRecord[] = [];
  for (const entry of favorites) {
    const entryType =
      typeof entry === "object" && entry !== null ? (entry as { type?: unknown }).type : undefined;
    if (entryType !== "province" && entryType !== "country") {
      return null;
    }
    const plateCode = (entry as { plateCode?: unknown }).plateCode;
    const isoCode = (entry as { isoCode?: unknown }).isoCode;
    if (
      (plateCode !== null && typeof plateCode !== "string") ||
      (isoCode !== null && typeof isoCode !== "string")
    ) {
      return null;
    }
    records.push({
      type: entryType,
      plateCode: typeof plateCode === "string" ? plateCode : null,
      isoCode: typeof isoCode === "string" ? isoCode : null,
    });
  }
  return records;
}

/**
 * `GET` — one bounded fetch, only ever called once per mount (`FavoriteButton`'s own
 * effect owns the abort budget, the same split `fetchVideoProgress`/`fetchAuthSessionState`
 * draw: the timeout lives in exactly one place per call site).
 */
export async function fetchFavorites(signal: AbortSignal): Promise<FetchFavoritesResult> {
  try {
    const res = await fetch(buildFavoritesListUrl(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (res.status !== 200) return null;
    const parsed: unknown = await res.json();
    return parseFavoritesListBody(parsed);
  } catch {
    return null;
  }
}

export interface SaveFavoriteResult {
  readonly ok: boolean;
}

/**
 * `PUT` — idempotent add, no request body (plan §2/§5.1: the target is entirely the route
 * param). A single discrete click, not a periodic/teardown save — no `keepalive`, unlike
 * `saveVideoProgress`'s tab-hide trigger — nothing here needs to survive page unload.
 */
export async function saveFavorite(target: FavoriteTargetParam): Promise<SaveFavoriteResult> {
  try {
    const res = await fetch(buildFavoriteUrl(target), {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
    });
    return { ok: res.status === 200 };
  } catch {
    return { ok: false };
  }
}

/** `DELETE` — idempotent remove, no request body. The BFF answers 204 on every genuine
 *  success (plan §5.1's unconditional-204 design), never 200. */
export async function removeFavorite(target: FavoriteTargetParam): Promise<SaveFavoriteResult> {
  try {
    const res = await fetch(buildFavoriteUrl(target), {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    });
    return { ok: res.status === 204 };
  } catch {
    return { ok: false };
  }
}
