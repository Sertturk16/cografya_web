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
import type { VideoIdentity } from "@/lib/api/types";

/**
 * The web half of the video-identity BFF proxy (P2 plan §5.3) — the server-side gate itself.
 * NARROW and MODELLED ON `lib/video-progress/transport.server.ts`'s shape — a cookie read,
 * `Cache-Control: no-store` unconditionally, a zod response guard on the api's 200 body —
 * WITHOUT importing it: video identity is a different domain (a stateless, caller-independent
 * content lookup, not per-user playback state) that gets its own module, the same way
 * video-progress and favorites do. `lib/http/bff-helpers.server.ts` (SIMP90-M1/SIMP96-M1) is
 * reused directly — the deliberately-shared, domain-agnostic mechanics.
 *
 * ONE RESOURCE, ONE METHOD — `GET /api/video-identity/{bookVideoId}` only. Read-only by
 * construction, so no Origin check (the roadmap's own boundary names only state-changing
 * handlers, the same reasoning `handleGetVideoProgress` already states for its own `GET`).
 */

/** Mirrors `lib/video-progress/transport.server.ts`'s own request-timeout budget (15s) without
 *  importing it — that module is a sibling domain, not a shared dependency. */
const VIDEO_IDENTITY_REQUEST_TIMEOUT_MS = 15_000;

const BOOK_VIDEO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a route parameter is shaped like `book_videos.id` (a uuid) — a MODULE-LOCAL copy of
 *  `lib/video-progress/transport.server.ts`'s `isBookVideoIdShape`, deliberately not imported
 *  from that sibling module. Mirrors the api's own `VideoIdentityParams` docblock verbatim in
 *  spirit: "a different family from the shared public-route-param file, and each protected
 *  surface owns its own copy rather than reaching across module boundaries for a same-shaped
 *  class." Refusing an unshapely value here is cheaper and safer than spending a request the
 *  api would reject anyway. */
export function isBookVideoIdShape(value: string): boolean {
  return BOOK_VIDEO_ID_PATTERN.test(value);
}

const videoIdentitySchema = z.object({ youtubeVideoId: z.string() });
type VideoIdentityShape = z.infer<typeof videoIdentitySchema>;
// Drift gate, the same idiom every BFF module in this repo uses (`lib/auth/session.ts`,
// `lib/video-progress/transport.server.ts`, `lib/favorites/transport.server.ts`): a contract
// change this schema misses is a TYPE ERROR in the Typecheck & Lint job, not a runtime
// surprise. Do not relax either direction.
const _videoIdentityShapeAgreesWithContract: [VideoIdentityShape, VideoIdentity] = [
  null as unknown as VideoIdentity,
  null as unknown as VideoIdentityShape,
];
void _videoIdentityShapeAgreesWithContract;

export type VideoIdentityBffCode =
  | "errors.auth.unauthenticated"
  | "errors.videoIdentity.notFound"
  | "errors.transport.unavailable"
  | "errors.transport.invalidRequest";

export type VideoIdentityBffBody =
  | { readonly ok: true; readonly youtubeVideoId: string }
  | { readonly ok: false; readonly code: VideoIdentityBffCode };

export interface VideoIdentityBffResult {
  readonly status: number;
  readonly body: VideoIdentityBffBody;
  readonly headers: Record<string, string>;
}

function bffResult(status: number, body: VideoIdentityBffBody): VideoIdentityBffResult {
  return { status, body, headers: bffHeaders() };
}

async function sendApiRequest(bookVideoId: string, accessToken: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_IDENTITY_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(
      `${serverEnv.API_BASE_URL}/api/video-identity/${encodeURIComponent(bookVideoId)}`,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `GET /api/video-identity/{bookVideoId}` — the one field a signed-in reader needs to actually
 * play a video (§5.3). No `cg_access` cookie is a short-circuit (401, no api call), mirroring
 * `handleGetVideoProgress`'s posture: a missing cookie is a normal anonymous answer, not a
 * condition worth spending an outbound request on.
 */
export async function handleGetVideoIdentity(
  request: Request,
  bookVideoId: string,
): Promise<VideoIdentityBffResult> {
  if (!isBookVideoIdShape(bookVideoId)) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  let res: Response;
  try {
    res = await sendApiRequest(bookVideoId, accessToken);
  } catch {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) {
    const rawBody = await safeReadText(res);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    const parsed = videoIdentitySchema.safeParse(json);
    if (!parsed.success) {
      return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    return bffResult(200, { ok: true, youtubeVideoId: parsed.data.youtubeVideoId });
  }
  if (res.status === 401) {
    await drainBody(res);
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (res.status === 404) {
    await drainBody(res);
    return bffResult(404, { ok: false, code: "errors.videoIdentity.notFound" });
  }
  await drainBody(res);
  return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
}
