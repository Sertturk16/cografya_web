import "server-only";
import { z } from "zod";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { serverEnv } from "@/lib/env.server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getSiteUrl } from "@/lib/seo/site";
import type { GameRound, GameRoundList, SubmitGameRoundRequest } from "@/lib/api/types";

/**
 * The web half of the game-rounds BFF proxy (UYELIK-10 plan §5.2) — a FOURTH small
 * domain-scoped pair, not a merge into `lib/favorites/` or `lib/video-progress/`: a
 * per-user game-round record is a third, different domain from playback state and from
 * saved entities, the same reasoning both existing pairs already state for their own
 * independence from each other. Modelled on `lib/video-progress/transport.server.ts`'s
 * shape (the closer precedent — it has a real request body, unlike favorites' bodyless
 * `PUT`/`DELETE`) WITHOUT importing it: a cookie read, an Origin check on the
 * state-changing verb, `Cache-Control: no-store` unconditionally, a zod response guard
 * against the api's 200 body, its own timeout constant.
 *
 * TWO METHODS, ONE RESOURCE: `GET /api/game-rounds` (list, read-only, no Origin check) and
 * `POST /api/game-rounds` (idempotent submit, state-changing, Origin required).
 */

/** The house standard (matches both existing server modules), restated locally per the
 *  established no-shared-import convention. */
const GAME_ROUNDS_REQUEST_TIMEOUT_MS = 15_000;

/** A submit body here is 9 short fields, well under 1 KiB even with generous JSON
 *  whitespace — the same house bound `lib/video-progress/transport.server.ts`'s
 *  `MAX_REQUEST_BODY_BYTES` uses for a comparably small payload. */
const MAX_REQUEST_BODY_BYTES = 4 * 1024;

/** The list endpoint's own bounds (`GameRoundsController_listMine`'s query schema, plan
 *  §2.2) — an out-of-range value from the caller is CLAMPED, not rejected: this is a caller
 *  simply asking for a differently-sized page, not sending a malformed one, mirroring
 *  `isBookVideoIdShape`'s "refusing an unshapely value here is cheaper than spending a
 *  request the api would reject" applied to a shape that is legal, just out of range. */
const PAGE_MIN = 1;
const PAGE_MAX = 10_000;
const PAGE_DEFAULT = 1;
const PAGE_SIZE_MIN = 1;
const PAGE_SIZE_MAX = 100;
const PAGE_SIZE_DEFAULT = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Parses a query-string integer, falling back to `fallback` for anything that does not
 *  parse as a finite integer (an absent param, or a caller's malformed one — both answer
 *  the same as "not specified", never a 400: this is a read endpoint's own query string). */
function parseIntParam(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

const gameRoundSchema = z.object({
  mode: z.string(),
  clientRoundId: z.string(),
  score: z.number(),
  found: z.number(),
  firstTry: z.number(),
  total: z.number(),
  poolTotal: z.number(),
  totalWrongs: z.number(),
  endedEarly: z.boolean(),
  // OPTIONAL and nullable, matching the generated contract type exactly (`GameRoundDto`'s
  // own `completionTimeSeconds?: number | null` — not in the DTO's `required` list): the
  // field may be entirely absent from a stored row, never merely `null`-vs-absent-collapsed
  // here, or the drift-gate tuple below would fail to compile against `GameRound`.
  completionTimeSeconds: z.number().nullable().optional(),
  createdAt: z.string(),
});
const gameRoundListSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
  items: z.array(gameRoundSchema),
});

type GameRoundShape = z.infer<typeof gameRoundSchema>;
type GameRoundListShape = z.infer<typeof gameRoundListSchema>;
// Drift gates, the same idiom `lib/favorites/transport.server.ts`/
// `lib/video-progress/transport.server.ts` already use: a contract change either schema
// misses is a TYPE ERROR in the Typecheck & Lint job, not a runtime surprise. Do not relax
// either direction.
const _gameRoundShapeAgreesWithContract: [GameRoundShape, GameRound] = [
  null as unknown as GameRound,
  null as unknown as GameRoundShape,
];
void _gameRoundShapeAgreesWithContract;
const _gameRoundListShapeAgreesWithContract: [GameRoundListShape, GameRoundList] = [
  null as unknown as GameRoundList,
  null as unknown as GameRoundListShape,
];
void _gameRoundListShapeAgreesWithContract;

/** The request-side mirror of `SubmitGameRoundRequestDto`'s own bounds (plan §2.2's table) —
 *  a malformed/out-of-bounds client body is rejected LOCALLY, before an outbound call is
 *  spent, never forwarded as-is the way `lib/video-progress/transport.server.ts`'s `PUT`
 *  pass-through does (that resource's body has no bounds of its own worth mirroring; this
 *  one does, and mirroring them here is cheap). */
const submitGameRoundRequestSchema = z.object({
  mode: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9-]{0,39}$/),
  clientRoundId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  score: z.number().min(0).max(100),
  found: z.number().min(0).max(1000),
  firstTry: z.number().min(0).max(1000),
  total: z.number().min(0).max(1000),
  poolTotal: z.number().min(0).max(1000),
  totalWrongs: z.number().min(0).max(100_000),
  endedEarly: z.boolean(),
  completionTimeSeconds: z.number().min(0).max(21_600).nullable().optional(),
});

type SubmitGameRoundRequestShape = z.infer<typeof submitGameRoundRequestSchema>;
// SIMP96-M3 (`Owner's Inbox/pr-review-archive/cografya_web-96.md`): the response-side schemas
// above already carry a drift-gate tuple against the generated contract; this request-side
// schema mirrors `SubmitGameRoundRequestDto`'s own bounds but had no equivalent gate, so a
// contract change here produced no compile-time warning — the exact gap the response side
// already closes. Same idiom, same "do not relax either direction" rule.
const _submitGameRoundRequestShapeAgreesWithContract: [
  SubmitGameRoundRequestShape,
  SubmitGameRoundRequest,
] = [null as unknown as SubmitGameRoundRequest, null as unknown as SubmitGameRoundRequestShape];
void _submitGameRoundRequestShapeAgreesWithContract;

export type GameRoundsBffCode =
  | "errors.auth.unauthenticated"
  | "errors.gameRounds.invalidSummary"
  | "errors.gameRounds.tooManySubmissions"
  | "errors.transport.unavailable"
  | "errors.transport.invalidRequest"
  | "errors.transport.forbidden";

export type GameRoundListBffBody =
  | {
      readonly ok: true;
      readonly page: number;
      readonly pageSize: number;
      readonly total: number;
      readonly hasMore: boolean;
      readonly items: readonly GameRoundShape[];
    }
  | { readonly ok: false; readonly code: GameRoundsBffCode };

export interface GameRoundListBffResult {
  readonly status: number;
  readonly body: GameRoundListBffBody;
  readonly headers: Record<string, string>;
}

export type GameRoundBffBody =
  | { readonly ok: true; readonly round: GameRoundShape }
  | { readonly ok: false; readonly code: GameRoundsBffCode };

export interface GameRoundBffResult {
  readonly status: number;
  readonly body: GameRoundBffBody;
  readonly headers: Record<string, string>;
}

/** Every response passes through here — `Cache-Control: no-store` UNCONDITIONALLY, the same
 *  P2 property both existing BFF modules guarantee. */
function bffHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function listResult(
  status: number,
  body: GameRoundListBffBody,
  extraHeaders: Record<string, string> = {},
): GameRoundListBffResult {
  return { status, body, headers: bffHeaders(extraHeaders) };
}

function itemResult(
  status: number,
  body: GameRoundBffBody,
  extraHeaders: Record<string, string> = {},
): GameRoundBffResult {
  return { status, body, headers: bffHeaders(extraHeaders) };
}

/** Minimal `Cookie`-header parse — the same shape every existing server module carries as
 *  its own small copy rather than an import (this module is handed the raw `Request` by
 *  `route.ts`, and neither existing domain module is a dependency this one should acquire
 *  for a five-line helper). */
function readCookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) {
      try {
        return decodeURIComponent(pair.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/** Drains an unread body so undici can return the connection to its pool — the same
 *  `CODE84-M2` reasoning every existing server module documents, with the same try/catch:
 *  `cancel()` on an already-errored stream rejects. */
async function drainBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // Best-effort: a connection broken enough to make cancel() reject has nothing left to
    // return to undici's pool either way.
  }
}

/** Reads the request body one chunk at a time and stops the instant the accumulated byte
 *  count exceeds the bound, mirroring `lib/video-progress/transport.server.ts`'s
 *  `readBoundedBody` reasoning: a chunked body with no `Content-Length` would otherwise
 *  buffer unbounded. */
async function readBoundedBody(
  request: Request,
): Promise<{ ok: true; text: string } | { ok: false }> {
  if (request.body === null) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

function contentLengthExceeds(request: Request): boolean {
  const header = request.headers.get("content-length");
  if (header === null) return false;
  const value = Number(header);
  return Number.isFinite(value) && value > MAX_REQUEST_BODY_BYTES;
}

async function sendApiRequest(
  method: "GET" | "POST",
  path: string,
  accessToken: string,
  body: string | undefined,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GAME_ROUNDS_REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    return await fetch(`${serverEnv.API_BASE_URL}${path}`, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `GET /api/game-rounds` — the caller's own round history, paginated (§5.2). No `cg_access`
 * cookie is a short-circuit (401, no api call), mirroring the established posture: a missing
 * cookie is a normal anonymous answer, not a condition worth spending an outbound request
 * on. No Origin check — read-only, not state-changing.
 */
export async function handleListGameRounds(
  request: Request,
  params: { page?: string; pageSize?: string },
): Promise<GameRoundListBffResult> {
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return listResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  const page = parseIntParam(params.page, PAGE_DEFAULT, PAGE_MIN, PAGE_MAX);
  const pageSize = parseIntParam(params.pageSize, PAGE_SIZE_DEFAULT, PAGE_SIZE_MIN, PAGE_SIZE_MAX);

  let res: Response;
  try {
    res = await sendApiRequest(
      "GET",
      `/api/game-rounds?page=${page}&pageSize=${pageSize}`,
      accessToken,
      undefined,
    );
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
    const parsed = gameRoundListSchema.safeParse(json);
    if (!parsed.success) {
      return listResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    return listResult(200, { ok: true, ...parsed.data });
  }
  if (res.status === 401) {
    await drainBody(res);
    return listResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  await drainBody(res);
  return listResult(502, { ok: false, code: "errors.transport.unavailable" });
}

/**
 * `POST /api/game-rounds` — idempotent submit (§5.2). Origin is checked here — and only
 * here — per the roadmap's own standing security boundary ("State-changing web route
 * handler'larında Origin doğrulaması yapılır"). The request body is parsed against
 * {@link submitGameRoundRequestSchema} BEFORE an outbound call is spent — a malformed/
 * out-of-bounds client body is rejected locally as `errors.transport.invalidRequest`, never
 * forwarded.
 */
export async function handleSubmitGameRound(request: Request): Promise<GameRoundBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return itemResult(403, { ok: false, code: "errors.transport.forbidden" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (contentLengthExceeds(request)) {
    return itemResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const read = await readBoundedBody(request);
  if (!read.ok) {
    return itemResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }

  let parsedJson: unknown;
  try {
    parsedJson = read.text.length > 0 ? JSON.parse(read.text) : {};
  } catch {
    return itemResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const validated = submitGameRoundRequestSchema.safeParse(parsedJson);
  if (!validated.success) {
    return itemResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  let res: Response;
  try {
    res = await sendApiRequest(
      "POST",
      "/api/game-rounds",
      accessToken,
      JSON.stringify(validated.data),
    );
  } catch {
    return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) {
    const rawBody = await safeReadText(res);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    const parsed = gameRoundSchema.safeParse(json);
    if (!parsed.success) {
      return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    return itemResult(200, { ok: true, round: parsed.data });
  }
  if (res.status === 400) {
    await drainBody(res);
    return itemResult(400, { ok: false, code: "errors.gameRounds.invalidSummary" });
  }
  if (res.status === 401) {
    await drainBody(res);
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (res.status === 429) {
    // Defensive, zero-cost, forward-compatible with the in-flight, non-blocking
    // `SEC145R2-M1` fix (plan §2.2/§10 item 5): forwarded verbatim if present, absent
    // otherwise — this proxy does not depend on the header existing today.
    const retryAfter = res.headers.get("retry-after");
    await drainBody(res);
    return itemResult(
      429,
      { ok: false, code: "errors.gameRounds.tooManySubmissions" },
      retryAfter !== null ? { "Retry-After": retryAfter } : {},
    );
  }
  await drainBody(res);
  return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
}
