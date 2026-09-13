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

import {
  type FavoriteEntityType,
  type FavoriteTargetParam,
  type FavoriteRecord,
  normalizeFavoriteTarget,
  isFavoriteMatch,
} from "./target";

export {
  type FavoriteEntityType,
  type FavoriteTargetParam,
  type FavoriteRecord,
  normalizeFavoriteTarget,
  isFavoriteMatch,
};

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
  const norm = normalizeFavoriteTarget(target);
  if (norm.entityType === "province") {
    return `/api/favorites/provinces/${encodeURIComponent(norm.entityId)}`;
  }
  if (norm.entityType === "country") {
    return `/api/favorites/countries/${encodeURIComponent(norm.entityId)}`;
  }
  return `/api/favorites/${encodeURIComponent(norm.entityType)}/${encodeURIComponent(norm.entityId)}`;
}

/** Narrows an unknown BFF body into a {@link FavoriteRecord} array, or `null` on anything
 *  that is not the exact shape `handleListFavorites` promises. */
function parseFavoritesListBody(value: unknown): readonly FavoriteRecord[] | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  const favorites = (value as { favorites?: unknown }).favorites;
  if (!Array.isArray(favorites)) return null;

  const records: FavoriteRecord[] = [];
  for (const entry of favorites) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;
    const rawType = e.entityType ?? e.type;
    if (
      rawType !== "province" &&
      rawType !== "country" &&
      rawType !== "region" &&
      rawType !== "continent"
    ) {
      return null;
    }
    const entityType = rawType as FavoriteEntityType;
    const rawId = e.entityId ?? (entityType === "province" ? e.plateCode : e.isoCode);
    if (typeof rawId !== "string" || !rawId) {
      return null;
    }
    const entityId = rawId;
    const plateCode =
      typeof e.plateCode === "string" ? e.plateCode : entityType === "province" ? entityId : null;
    const isoCode =
      typeof e.isoCode === "string" ? e.isoCode : entityType === "country" ? entityId : null;

    records.push({
      type: entityType,
      entityType,
      entityId,
      plateCode,
      isoCode,
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
 *
 * Carries its own `AbortController` bounded by `FAVORITES_FETCH_TIMEOUT_MS` — the same
 * shape `submitGameRound` (`lib/game-rounds/client.ts`) uses for its write, and the same
 * timeout VALUE this file's own `fetchFavorites` already uses for its read (`CODE91-M1`:
 * this write previously carried no timeout at all, unlike the read in this same file). A
 * fresh `controller`/`timeout` per call — no shared/module-level state, so concurrent calls
 * never race each other's abort. `clearTimeout` runs unconditionally in `finally`, covering
 * success, non-2xx, network error and abort alike — no leaked timer on any path.
 */
export async function saveFavorite(target: FavoriteTargetParam): Promise<SaveFavoriteResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAVORITES_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(buildFavoriteUrl(target), {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    return { ok: res.status === 200 };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

/** `DELETE` — idempotent remove, no request body. The BFF answers 204 on every genuine
 *  success (plan §5.1's unconditional-204 design), never 200.
 *
 *  Same `AbortController` + `FAVORITES_FETCH_TIMEOUT_MS` treatment as `saveFavorite` above
 *  (`CODE91-M1`) — a fresh controller per call, `clearTimeout` unconditional in `finally`. */
export async function removeFavorite(target: FavoriteTargetParam): Promise<SaveFavoriteResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAVORITES_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(buildFavoriteUrl(target), {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    return { ok: res.status === 204 };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
