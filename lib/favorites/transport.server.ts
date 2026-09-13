import "server-only";
import { z } from "zod";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { serverEnv } from "@/lib/env.server";
import {
  bffHeaders,
  drainBody,
  readCookieValue,
  safeReadText,
} from "@/lib/http/bff-helpers.server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getSiteUrl } from "@/lib/seo/site";
import type { Favorite } from "@/lib/api/types";
import { normalizeFavoriteTarget, type FavoriteTargetParam } from "./client";

/**
 * The web half of the favorites BFF proxy (UYELIK-08 plan §5.1, widened to 4 entity types by UYE-P3).
 * NARROW and MODELLED ON `lib/video-progress/transport.server.ts`'s shape — a cookie read, an Origin check on the
 * state-changing verbs, `Cache-Control: no-store` unconditionally, a zod response guard on
 * the api's 200 body.
 */

/** Mirrors both existing server modules' request-timeout budget (15s). */
const FAVORITES_REQUEST_TIMEOUT_MS = 15_000;

const PLATE_CODE_PATTERN = /^\d{2}$/;
const ISO_CODE_PATTERN = /^[A-Z]{2}$/;
const REGION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTINENT_PATTERN = /^[A-Z][A-Z_]{2,15}$/;

/** Whether a route parameter is shaped like `provinces.plate_code` (2 digits). */
export function isPlateCodeShape(value: string): boolean {
  return PLATE_CODE_PATTERN.test(value);
}

/** Whether a route parameter is shaped like `countries.iso_code` (2 uppercase letters). */
export function isIsoCodeShape(value: string): boolean {
  return ISO_CODE_PATTERN.test(value);
}

/** Whether a route parameter is shaped like `regions.slug` (kebab-case, <= 50 chars). */
export function isRegionSlugShape(value: string): boolean {
  return value.length <= 50 && REGION_SLUG_PATTERN.test(value);
}

/** Whether a route parameter is shaped like a `Continent` enum label (3-16 uppercase/underscore chars). */
export function isContinentShape(value: string): boolean {
  return CONTINENT_PATTERN.test(value);
}

/** `target` is well-shaped for its own `entityType` / `kind`. */
export function isTargetShapeValid(target: FavoriteTargetParam): boolean {
  const norm = normalizeFavoriteTarget(target);
  switch (norm.entityType) {
    case "province":
      return isPlateCodeShape(norm.entityId);
    case "country":
      return isIsoCodeShape(norm.entityId);
    case "region":
      return isRegionSlugShape(norm.entityId);
    case "continent":
      return isContinentShape(norm.entityId);
    default:
      return false;
  }
}

function targetPath(target: FavoriteTargetParam): string {
  const norm = normalizeFavoriteTarget(target);
  return `/api/favorites/${encodeURIComponent(norm.entityType)}/${encodeURIComponent(norm.entityId)}`;
}

function notFoundCode(target: FavoriteTargetParam): FavoritesBffCode {
  const norm = normalizeFavoriteTarget(target);
  switch (norm.entityType) {
    case "province":
      return "errors.favorites.provinceNotFound";
    case "country":
      return "errors.favorites.countryNotFound";
    case "region":
      return "errors.favorites.regionNotFound";
    case "continent":
      return "errors.favorites.continentNotFound";
  }
}

export const favoriteSchema = z.preprocess(
  (val) => {
    if (typeof val !== "object" || val === null) return val;
    const obj = val as Record<string, unknown>;
    const rawType = (obj.entityType ?? obj.type) as string | undefined;
    const entityType =
      rawType === "province" ||
      rawType === "country" ||
      rawType === "region" ||
      rawType === "continent"
        ? rawType
        : undefined;
    const rawId = (obj.entityId ?? (entityType === "province" ? obj.plateCode : obj.isoCode)) as
      string | undefined;
    const entityId = rawId !== undefined ? String(rawId) : undefined;
    const type = entityType === "province" || entityType === "country" ? entityType : undefined;
    const plateCode =
      obj.plateCode !== undefined
        ? (obj.plateCode as string | null)
        : entityType === "province" && entityId
          ? entityId
          : null;
    const isoCode =
      obj.isoCode !== undefined
        ? (obj.isoCode as string | null)
        : entityType === "country" && entityId
          ? entityId
          : null;
    return {
      ...obj,
      entityType,
      entityId,
      type,
      plateCode,
      isoCode,
    };
  },
  z.object({
    type: z.enum(["province", "country"]).optional(),
    plateCode: z.string().nullable().optional(),
    isoCode: z.string().nullable().optional(),
    entityType: z.enum(["province", "country", "region", "continent"]).optional(),
    entityId: z.string().optional(),
    createdAt: z.string(),
  }),
);
export const favoritesListSchema = z.array(favoriteSchema);

export type FavoriteShape = z.infer<typeof favoriteSchema>;
// Drift gate: ensures FavoriteShape stays compatible with Favorite in types.ts.
const _favoriteShapeAgreesWithContract: [FavoriteShape, Favorite] = [
  null as unknown as Favorite,
  null as unknown as FavoriteShape,
];
void _favoriteShapeAgreesWithContract;

export type FavoritesBffCode =
  | "errors.auth.unauthenticated"
  | "errors.favorites.provinceNotFound"
  | "errors.favorites.countryNotFound"
  | "errors.favorites.regionNotFound"
  | "errors.favorites.continentNotFound"
  | "errors.transport.unavailable"
  | "errors.transport.invalidRequest"
  | "errors.transport.forbidden";

export type FavoritesListBffBody =
  | { readonly ok: true; readonly favorites: readonly FavoriteShape[] }
  | { readonly ok: false; readonly code: FavoritesBffCode };

export interface FavoritesListBffResult {
  readonly status: number;
  readonly body: FavoritesListBffBody;
  readonly headers: Record<string, string>;
}

export type FavoriteBffBody =
  | { readonly ok: true; readonly favorite: FavoriteShape }
  | { readonly ok: true }
  | { readonly ok: false; readonly code: FavoritesBffCode };

export interface FavoriteBffResult {
  readonly status: number;
  readonly body: FavoriteBffBody;
  readonly headers: Record<string, string>;
}

// `bffHeaders`, `readCookieValue`, `safeReadText` and `drainBody` are imported from
// `lib/http/bff-helpers.server.ts` (SIMP90-M1/SIMP96-M1) — this module's own private copies
// until the same mechanics were found duplicated across four BFF-proxy modules and extracted.
// `Cache-Control: no-store` is UNCONDITIONAL on every response, the same P2 property every BFF
// module guarantees (UYELIK-05's own round-1 review caught exactly this omission on the *api*
// side, `SEC141-I2`, before it was fixed).

function listResult(status: number, body: FavoritesListBffBody): FavoritesListBffResult {
  return { status, body, headers: bffHeaders() };
}

function itemResult(status: number, body: FavoriteBffBody): FavoriteBffResult {
  return { status, body, headers: bffHeaders() };
}

async function sendApiRequest(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  accessToken: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAVORITES_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${serverEnv.API_BASE_URL}${path}`, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseFavoriteResponseBody(rawBody: string): Promise<FavoriteShape | undefined> {
  let json: unknown;
  try {
    json = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;
  } catch {
    return undefined;
  }
  const parsed = favoriteSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

/**
 * `GET /api/favorites` — the caller's own full favorites list (§5.1). No `cg_access` cookie
 * is a short-circuit (401, no api call), mirroring `handleGetVideoProgress`'s posture: a
 * missing cookie is a normal anonymous answer, not a condition worth spending an outbound
 * request on. No Origin check — read-only, not state-changing.
 */
export async function handleListFavorites(request: Request): Promise<FavoritesListBffResult> {
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return listResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  let res: Response;
  try {
    res = await sendApiRequest("GET", "/api/favorites", accessToken);
  } catch {
    return listResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) {
    const rawBody = await safeReadText(res);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return listResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    const parsed = favoritesListSchema.safeParse(json);
    if (!parsed.success) {
      return listResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    return listResult(200, { ok: true, favorites: parsed.data });
  }
  if (res.status === 401) {
    await drainBody(res);
    return listResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  await drainBody(res);
  return listResult(502, { ok: false, code: "errors.transport.unavailable" });
}

/**
 * `PUT /api/favorites/provinces/{plateCode}` or `/countries/{isoCode}` — idempotent add
 * (§5.1). Origin is checked here — and only here (alongside the `DELETE` below) — per
 * `roadmap.md` §4's standing security boundary ("State-changing web route handler'larında
 * Origin doğrulaması yapılır"): a `PUT` with no body is still state-changing. The route
 * param is shape-validated before an api call is spent, mirroring `isBookVideoIdShape`'s
 * "refusing an unshapely value here is cheaper and safer than spending a request the api
 * would reject anyway" reasoning.
 */
export async function handlePutFavorite(
  request: Request,
  target: FavoriteTargetParam,
): Promise<FavoriteBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return itemResult(403, { ok: false, code: "errors.transport.forbidden" });
  }
  if (!isTargetShapeValid(target)) {
    return itemResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  let res: Response;
  try {
    res = await sendApiRequest("PUT", targetPath(target), accessToken);
  } catch {
    return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) {
    const favorite = await parseFavoriteResponseBody(await safeReadText(res));
    if (favorite === undefined) {
      return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    return itemResult(200, { ok: true, favorite });
  }
  if (res.status === 401) {
    await drainBody(res);
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (res.status === 404) {
    await drainBody(res);
    return itemResult(404, { ok: false, code: notFoundCode(target) });
  }
  await drainBody(res);
  return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
}

/**
 * `DELETE /api/favorites/provinces/{plateCode}` or `/countries/{isoCode}` — idempotent
 * remove (§5.1). Same Origin/shape/cookie gates as the `PUT`, in the same order. 204 is the
 * contract's own unconditional success — favorited, never-favorited, or an unreal code all
 * answer identically, so there is no "not found" branch to map here either, matching the api
 * exactly.
 */
export async function handleDeleteFavorite(
  request: Request,
  target: FavoriteTargetParam,
): Promise<FavoriteBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return itemResult(403, { ok: false, code: "errors.transport.forbidden" });
  }
  if (!isTargetShapeValid(target)) {
    return itemResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  let res: Response;
  try {
    res = await sendApiRequest("DELETE", targetPath(target), accessToken);
  } catch {
    return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 204) {
    await drainBody(res);
    return itemResult(204, { ok: true });
  }
  if (res.status === 401) {
    await drainBody(res);
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  await drainBody(res);
  return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
}
