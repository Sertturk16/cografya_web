import "server-only";
import { z } from "zod";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { serverEnv } from "@/lib/env.server";
import {
  bffHeaders,
  contentLengthExceeds,
  drainBody,
  readBoundedBodyAsText,
  readCookieValue,
  safeReadText,
} from "@/lib/http/bff-helpers.server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getSiteUrl } from "@/lib/seo/site";
import type { VideoProgress } from "@/lib/api/types";

/**
 * The web half of the video-progress BFF proxy (UYELIK-06 plan §5.7). NARROW and MODELLED ON
 * `lib/auth/transport.server.ts`'s shape — a cookie read, an Origin check on the
 * state-changing verb, `Cache-Control: no-store` unconditionally, a response guard on the
 * api's 200 body — WITHOUT importing it: `AuthAction` is a closed, hand-typed union of seven
 * auth-only actions (`transport.server.ts`'s own module docblock), and video-progress is a
 * different domain (per-user playback state, not credentials) that has no business joining
 * it. `lib/http/same-origin.ts` and `lib/http/bff-helpers.server.ts` (SIMP90-M1/SIMP96-M1) are
 * the pieces genuinely shared, because they are domain-agnostic HTTP/cookie/body mechanics
 * rather than anything specific to this domain's action shape.
 *
 * ONE RESOURCE, TWO METHODS. Unlike the auth transport's nine-action table keyed by a
 * catch-all path segment, this proxies exactly one api resource
 * (`GET`/`PUT /api/video-progress/{bookVideoId}`), so there is no action table here — the
 * route's own `[bookVideoId]` dynamic segment is the only branch this module needs.
 */

/** Mirrors `lib/auth/transport.server.ts`'s `AUTH_REQUEST_TIMEOUT_MS` (also 15s) without
 *  importing it — that module is server-only and auth-specific by design; repeating the
 *  number here is cheaper than a shared constant that would otherwise invite an import this
 *  domain has no business making. */
const VIDEO_PROGRESS_REQUEST_TIMEOUT_MS = 15_000;

/** A `PUT` body here is `{ lastPositionSeconds: number, watched: boolean }` — well under
 *  200 bytes even with generous whitespace. 4 KiB is far above the largest real payload and
 *  far below anything worth proxying, mirroring the bound `lib/auth/transport.server.ts` sets
 *  for its own (larger) request bodies. */
const MAX_REQUEST_BODY_BYTES = 4 * 1024;

const BOOK_VIDEO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a route parameter is shaped like `book_videos.id` (a uuid) — checked before it is
 *  used to build an outbound api path, mirroring `lib/api/books.ts`'s `isBookSlugShape`
 *  reasoning: encoding is normalisation, not validation, and refusing an unshapely value here
 *  is cheaper and safer than spending a request the api would reject anyway. */
export function isBookVideoIdShape(value: string): boolean {
  return BOOK_VIDEO_ID_PATTERN.test(value);
}

const videoProgressSchema = z.object({
  bookVideoId: z.string(),
  lastPositionSeconds: z.number(),
  watched: z.boolean(),
  watchedAt: z.string().nullable(),
  updatedAt: z.string(),
});

type VideoProgressShape = z.infer<typeof videoProgressSchema>;
// Drift gate, the same idiom `lib/auth/session.ts`/`lib/auth/transport.server.ts` already use:
// a contract change this schema misses is a TYPE ERROR in the Typecheck & Lint job, not a
// runtime surprise. Do not relax either direction.
const _videoProgressShapeAgreesWithContract: [VideoProgressShape, VideoProgress] = [
  null as unknown as VideoProgress,
  null as unknown as VideoProgressShape,
];
void _videoProgressShapeAgreesWithContract;

export type VideoProgressBffCode =
  | "errors.auth.unauthenticated"
  | "errors.videoProgress.notFound"
  | "errors.videoProgress.videoNotFound"
  | "errors.videoProgress.positionExceedsDuration"
  | "errors.transport.unavailable"
  | "errors.transport.invalidRequest"
  | "errors.transport.forbidden";

export type VideoProgressBffBody =
  | { readonly ok: true; readonly progress: VideoProgressShape }
  | { readonly ok: false; readonly code: VideoProgressBffCode };

export interface VideoProgressBffResult {
  readonly status: number;
  readonly body: VideoProgressBffBody;
  readonly headers: Record<string, string>;
}

// `bffHeaders`, `readCookieValue`, `contentLengthExceeds`, `readBoundedBodyAsText`,
// `safeReadText` and `drainBody` are imported from `lib/http/bff-helpers.server.ts`
// (SIMP90-M1/SIMP96-M1) — this module's own private copies until the same mechanics were
// found duplicated across four BFF-proxy modules and extracted. `Cache-Control: no-store` is
// UNCONDITIONAL on every response, the same P2 property every BFF module guarantees
// (UYELIK-05's own round-1 review caught exactly this omission on the *api* side,
// `SEC141-I2`, before it was fixed).

function bffResult(status: number, body: VideoProgressBffBody): VideoProgressBffResult {
  return { status, body, headers: bffHeaders() };
}

const KNOWN_ERROR_MESSAGES = new Set<VideoProgressBffCode>([
  "errors.auth.unauthenticated",
  "errors.videoProgress.notFound",
  "errors.videoProgress.videoNotFound",
  "errors.videoProgress.positionExceedsDuration",
]);

function isKnownErrorMessage(value: unknown): value is VideoProgressBffCode {
  return typeof value === "string" && KNOWN_ERROR_MESSAGES.has(value as VideoProgressBffCode);
}

/** Reads the api's `ApiErrorDto.message` (a string, or one message per failed field) out of a
 *  raw response body and maps it onto this module's own closed code union — falling back to
 *  `fallback` for anything the api sent that this proxy does not recognise by name, rather
 *  than passing an arbitrary upstream string through to the browser. */
function extractErrorCode(rawBody: string, fallback: VideoProgressBffCode): VideoProgressBffCode {
  try {
    const parsed: unknown = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;
    if (parsed !== null && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as { message?: unknown }).message;
      const first = Array.isArray(message) ? message[0] : message;
      if (isKnownErrorMessage(first)) return first;
    }
  } catch {
    // Falls through to the fallback — an unparsable body maps to the caller's own default.
  }
  return fallback;
}

async function sendApiRequest(
  method: "GET" | "PUT",
  bookVideoId: string,
  accessToken: string,
  body: string | undefined,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_PROGRESS_REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    return await fetch(
      `${serverEnv.API_BASE_URL}/api/video-progress/${encodeURIComponent(bookVideoId)}`,
      {
        method,
        cache: "no-store",
        signal: controller.signal,
        headers,
        ...(body !== undefined ? { body } : {}),
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function parseVideoProgressResponse(res: Response): Promise<VideoProgressBffResult> {
  const rawBody = await safeReadText(res);
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  const parsed = videoProgressSchema.safeParse(json);
  if (!parsed.success) {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  return bffResult(200, { ok: true, progress: parsed.data });
}

/**
 * `GET /api/video-progress/{bookVideoId}` — the caller's own saved progress (§5.4). No
 * `cg_access` cookie is a short-circuit (401, no api call), mirroring
 * `lib/auth/transport.server.ts`'s `handleSession` posture: a missing cookie is a normal
 * anonymous answer, not a condition worth spending an outbound request on. `GET` carries no
 * Origin check — read-only, not state-changing (the roadmap's own boundary names only
 * state-changing handlers).
 */
export async function handleGetVideoProgress(
  request: Request,
  bookVideoId: string,
): Promise<VideoProgressBffResult> {
  if (!isBookVideoIdShape(bookVideoId)) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  let res: Response;
  try {
    res = await sendApiRequest("GET", bookVideoId, accessToken, undefined);
  } catch {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) return parseVideoProgressResponse(res);
  if (res.status === 401) {
    await drainBody(res);
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (res.status === 404) {
    await drainBody(res);
    return bffResult(404, { ok: false, code: "errors.videoProgress.notFound" });
  }
  await drainBody(res);
  return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
}

/**
 * `PUT /api/video-progress/{bookVideoId}` — an idempotent full-state replace (§5.6/§5.7).
 * Origin is checked here — and only here — per the roadmap's own standing security boundary
 * ("State-changing web route handler'larında Origin doğrulaması yapılır"), through the
 * SHARED `isSameOrigin` (`lib/http/same-origin.ts`) rather than a second private copy.
 *
 * PASS-THROUGH, NOT RE-VALIDATION, on the request body — the same discipline
 * `lib/auth/transport.server.ts`'s `readClientBody` documents: the body is read, bound-
 * checked and confirmed to be valid JSON, then re-serialized UNCHANGED, so every client field
 * reaches the api untouched and the api's own `ValidationPipe` stays the single validator.
 * This module does not re-implement the api's own `positionExceedsDuration`/shape rules.
 */
export async function handlePutVideoProgress(
  request: Request,
  bookVideoId: string,
): Promise<VideoProgressBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return bffResult(403, { ok: false, code: "errors.transport.forbidden" });
  }
  if (!isBookVideoIdShape(bookVideoId)) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (contentLengthExceeds(request, MAX_REQUEST_BODY_BYTES)) {
    return bffResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const read = await readBoundedBodyAsText(request, MAX_REQUEST_BODY_BYTES);
  if (!read.ok) {
    return bffResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }

  let parsedBody: unknown;
  try {
    parsedBody = read.text.length > 0 ? JSON.parse(read.text) : {};
  } catch {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  let res: Response;
  try {
    res = await sendApiRequest("PUT", bookVideoId, accessToken, JSON.stringify(parsedBody));
  } catch {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) return parseVideoProgressResponse(res);
  if (res.status === 400) {
    const rawBody = await safeReadText(res);
    return bffResult(400, {
      ok: false,
      code: extractErrorCode(rawBody, "errors.transport.invalidRequest"),
    });
  }
  if (res.status === 401) {
    await drainBody(res);
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (res.status === 404) {
    await drainBody(res);
    return bffResult(404, { ok: false, code: "errors.videoProgress.videoNotFound" });
  }
  await drainBody(res);
  return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
}
