import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { getSiteUrl } from "@/lib/seo/site";
import type { AccountRole, AuthResult, Session } from "@/lib/api/types";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAccessCookie,
  clearSessionCookies,
  sessionCookieMutations,
  type CookieDescriptor,
  type SessionTokenAttributes,
} from "./cookies";
import { safeReturnPath } from "./redirect";

/**
 * The whole server half of the auth transport (plan §6 manifest item 5,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-03-plan.md`). `app/api/auth/[...action]/
 * route.ts` is ~40 lines of mechanical `Request` → `NextResponse` conversion with no branch
 * of its own; every decision — the action table, the outbound fetch and its timeout, the
 * refresh single-flight, the api-status → BFF-status/code mapping, the Origin check, and the
 * response builder — lives here, which is what makes this module the one place the tests
 * reach (§13.4).
 *
 * SECURITY PROPERTIES (plan §7) — each is a mechanism, not a list of exceptions to keep in
 * sync; see the functions named below for where each mechanism actually lives:
 *
 *   P1 — the browser never receives a token. Token strings exist in exactly one place in
 *        this app: as fields of the object `callAuthApi()` returns. Its only consumer is
 *        `sessionCookieMutations()` (`./cookies.ts`), which returns nothing but two cookie
 *        descriptors. Every browser-facing body is built by `bffBody()`, whose parameter
 *        type `AuthBffBody` is a closed union with no member that can hold an arbitrary api
 *        string. Gate: T1 (success paths), T4 (error paths).
 *   P2 — auth responses are not cached. `bffHeaders()` is the only way a response's headers
 *        are produced, so no branch can omit `Cache-Control: no-store`. Gate: T2.
 *   P3 — a rotated refresh token is never lost. `refresh` is called ONLY from this module's
 *        own request path; `./session.ts` — the module server components import — contains
 *        no reference to the refresh action at all. Gate: T7 (asserted against that file's
 *        own source, from this test file, per plan §12).
 */

/**
 * Wall-clock budget for ONE outbound api call, mirroring `lib/api/client.ts`'s
 * `API_REQUEST_TIMEOUT_MS` (also 15s) rather than sharing the constant — that module is on
 * the prohibited-import list (plan §14 #8: no import of `lib/api/client.ts` from
 * `lib/auth/**`, because its ISR `revalidate` and internal-token wiring must never reach an
 * auth call). 15s specifically, not lower: the api wraps every mail send in
 * `MAIL_SEND_TIMEOUT_MS = 10_000` (`register` / `verify-email/resend` /
 * `password-reset/request` can block on it — plan §2 M17), so any budget at or below 10s
 * would abort a registration the api is about to complete successfully. Gate: T6.
 */
const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/** Before parsing, a body over this bound is refused without an api call (plan §10). 8 KiB
 *  is far above the largest real payload (a full `RegisterRequestDto` is well under 1 KiB)
 *  and far below anything worth proxying. */
const MAX_REQUEST_BODY_BYTES = 8 * 1024;

// ---------------------------------------------------------------------------------------
// Response guards — the api's 200 body is validated before any cookie is written (plan §17).
// ---------------------------------------------------------------------------------------

const authResultSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresInSeconds: z.number().finite(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresInSeconds: z.number().finite(),
});

type AuthResultShape = z.infer<typeof authResultSchema>;
// Drift gate: the runtime guard and the generated contract must stay identical. A contract
// change this schema misses is a TYPE ERROR in the `Typecheck & Lint` job, not a runtime
// surprise. Do not relax either direction.
const _authResultShapesAgree: [AuthResultShape, AuthResult] = [
  null as unknown as AuthResult,
  null as unknown as AuthResultShape,
];
void _authResultShapesAgree;

const sessionSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  accountRole: z.enum(["STUDENT", "TEACHER"]),
});

type SessionShape = z.infer<typeof sessionSchema>;
// Same drift gate for `SessionDto`.
const _sessionShapesAgree: [SessionShape, Session] = [
  null as unknown as Session,
  null as unknown as SessionShape,
];
void _sessionShapesAgree;

function parseAuthResult(rawBody: string): SessionTokenAttributes | undefined {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return undefined;
  }
  const result = authResultSchema.safeParse(json);
  return result.success ? result.data : undefined;
}

function parseSession(rawBody: string): SessionShape | undefined {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return undefined;
  }
  const result = sessionSchema.safeParse(json);
  return result.success ? result.data : undefined;
}

// ---------------------------------------------------------------------------------------
// The action table (plan §10) — a closed set of nine actions. An action not in it is a 404.
// ---------------------------------------------------------------------------------------

interface AuthAction {
  readonly method: "GET" | "POST";
  readonly apiPath: string;
}

const AUTH_ACTIONS: Readonly<Record<string, AuthAction>> = {
  register: { method: "POST", apiPath: "/api/auth/register" },
  "verify-email": { method: "POST", apiPath: "/api/auth/verify-email" },
  "verify-email/resend": { method: "POST", apiPath: "/api/auth/verify-email/resend" },
  login: { method: "POST", apiPath: "/api/auth/login" },
  refresh: { method: "POST", apiPath: "/api/auth/refresh" },
  logout: { method: "POST", apiPath: "/api/auth/logout" },
  "password-reset/request": { method: "POST", apiPath: "/api/auth/password-reset/request" },
  "password-reset/confirm": { method: "POST", apiPath: "/api/auth/password-reset/confirm" },
  session: { method: "GET", apiPath: "/api/auth/session" },
};

/** The ten error keys the api publishes (plan §3), verbatim in `ApiErrorDto.message`. */
const API_ERROR_CODES = [
  "errors.auth.unauthenticated",
  "errors.auth.invalidCredentials",
  "errors.auth.emailNotVerified",
  "errors.auth.accountDisabled",
  "errors.auth.sessionExpired",
  "errors.auth.tooManyAttempts",
  "errors.auth.rateLimited",
  "errors.register.weakPassword",
  "errors.verify.codeInvalid",
  "errors.password.resetTokenInvalid",
] as const;

/**
 * The closed union of exactly thirteen literals (plan §10): the api's ten error keys plus
 * the three web-owned ones below — conditions purely the transport's, with no api key.
 * Nothing else is ever placed in a `code` field — this is what lets P1's closed-union
 * argument hold.
 */
export type AuthBffCode =
  | (typeof API_ERROR_CODES)[number]
  | "errors.transport.unavailable"
  | "errors.transport.invalidRequest"
  | "errors.transport.forbidden";

function isKnownApiErrorCode(value: unknown): value is (typeof API_ERROR_CODES)[number] {
  return typeof value === "string" && (API_ERROR_CODES as readonly string[]).includes(value);
}

/** Statuses this transport understands from the api (plan §10/§11). Anything else — a 5xx or
 *  an unmapped status — collapses to `errors.transport.unavailable`. */
const MAPPED_ERROR_STATUSES = new Set([400, 401, 403, 429]);

/**
 * Every browser-facing body (plan §7 P1). Closed union, three members, none of which has a
 * field that can hold an arbitrary api string — adding a token requires adding a member
 * here, a change visible in the type rather than in a data flow.
 */
export type AuthBffBody =
  | { ok: true; redirectTo?: string }
  | { ok: true; session: { firstName: string; accountRole: AccountRole } }
  | { ok: false; code: AuthBffCode };

export interface AuthBffResult {
  readonly status: number;
  readonly body: AuthBffBody;
  readonly headers: Record<string, string>;
  readonly cookies: readonly CookieDescriptor[];
}

/** The ONE function every response header set passes through (plan §7 P2) — a response
 *  object cannot be constructed without these, so there is no branch that can forget them.
 *  Gate: T2. */
function bffHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
}

/** The ONE function every response body passes through (plan §7 P1) — its parameter type is
 *  the closed `AuthBffBody` union, so the compiler is what enforces the closed set. */
function bffBody(body: AuthBffBody): AuthBffBody {
  return body;
}

function bffResult(
  status: number,
  body: AuthBffBody,
  cookies: readonly CookieDescriptor[] = [],
): AuthBffResult {
  return { status, body: bffBody(body), headers: bffHeaders(), cookies };
}

// ---------------------------------------------------------------------------------------
// Logging (plan §14 #10) — `[auth-bff] <action> <outcome>` and NOTHING else. `action` is
// always a literal key from `AUTH_ACTIONS` and `outcome` is always a short, closed-vocabulary
// label ("ok", a `AuthBffCode`, or a fixed phrase below) — never the api body, the browser
// body, or a cookie value — so this function structurally cannot be handed a token, a
// password, a code or an e-mail address. Gate: T1 (success path), T4 (error path).
// ---------------------------------------------------------------------------------------

function logAuthOutcome(action: string, outcome: string): void {
  console.warn(`[auth-bff] ${action} ${outcome}`);
}

// ---------------------------------------------------------------------------------------
// Request-side helpers: cookie read, Origin check, size bound.
// ---------------------------------------------------------------------------------------

/** Minimal `Cookie`-header parse. Deliberately NOT `next/headers`' `cookies()`: this module
 *  is handed the raw `Request` by `route.ts`, and parsing the header directly keeps every
 *  branch here testable with a plain `Request`/`Headers` object and no Next request context. */
function readCookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/** Every POST action requires `Origin` exactly equal to `getSiteUrl()` (plan §10, binding).
 *  Absent is refused too: a same-origin browser `fetch` always sends `Origin` on a POST, so
 *  an absent header means a non-browser caller. Gate: T12. */
function isValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === getSiteUrl();
}

function contentLengthExceeds(request: Request): boolean {
  const header = request.headers.get("content-length");
  if (header === null) return false;
  const value = Number(header);
  return Number.isFinite(value) && value > MAX_REQUEST_BODY_BYTES;
}

// ---------------------------------------------------------------------------------------
// Outbound api call — the ONE fetch wrapper, no internal token, no `next` cache key.
// Gate: T3.
// ---------------------------------------------------------------------------------------

async function sendApiRequest(
  apiPath: string,
  method: "GET" | "POST",
  body: string | undefined,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    return await fetch(`${serverEnv.API_BASE_URL}${apiPath}`, {
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

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function extractApiErrorCode(rawBody: string): AuthBffCode | undefined {
  try {
    const parsed: unknown = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as { message?: unknown }).message;
      if (isKnownApiErrorCode(message)) return message;
    }
  } catch {
    // Falls through — an unparsable/unrecognised body maps to invalidRequest below.
  }
  return undefined;
}

type ApiCallOutcome =
  | { kind: "ok"; rawBody: string }
  | { kind: "mapped-error"; status: number; code: AuthBffCode }
  | { kind: "unavailable" };

/** Turns a RESOLVED `Response` into ok/mapped-error/unavailable (plan §11). A 5xx or any
 *  status outside `MAPPED_ERROR_STATUSES` is `unavailable` — the api's own status semantics
 *  are unchanged, this is the BFF's read of them. */
async function classifyResponse(res: Response): Promise<ApiCallOutcome> {
  if (res.ok) {
    return { kind: "ok", rawBody: await safeReadText(res) };
  }
  if (!MAPPED_ERROR_STATUSES.has(res.status)) {
    return { kind: "unavailable" };
  }
  const rawBody = await safeReadText(res);
  const code = extractApiErrorCode(rawBody) ?? "errors.transport.invalidRequest";
  return { kind: "mapped-error", status: res.status, code };
}

/** A network failure, an abort and an api 5xx are ALL `unavailable` (plan §11: "one
 *  condition from the browser's point of view"). Gate: T6. */
async function callAuthApiForStatus(
  apiPath: string,
  body: string,
  method: "GET" | "POST" = "POST",
  extraHeaders?: Record<string, string>,
): Promise<ApiCallOutcome> {
  let res: Response;
  try {
    res = await sendApiRequest(apiPath, method, method === "GET" ? undefined : body, extraHeaders);
  } catch {
    return { kind: "unavailable" };
  }
  return classifyResponse(res);
}

type AuthApiTokenOutcome =
  | { kind: "ok"; tokens: SessionTokenAttributes }
  | { kind: "mapped-error"; status: number; code: AuthBffCode }
  | { kind: "unavailable" };

/**
 * THE function named in plan §7 P1's mechanism: its `ok` case is the ONLY place in this app
 * where the two token strings exist as fields of a returned object. The only caller that
 * ever reads `.tokens` is `sessionCookieMutations()` (`./cookies.ts`) — never the body
 * builder, never the logger. Used by `login`, `verify-email`, and (behind the single-flight
 * below) `refresh`.
 */
async function callAuthApi(apiPath: string, body: string): Promise<AuthApiTokenOutcome> {
  const outcome = await callAuthApiForStatus(apiPath, body);
  if (outcome.kind !== "ok") return outcome;

  const tokens = parseAuthResult(outcome.rawBody);
  // Response guard (plan §17): a 200 whose body fails the schema never reaches a cookie
  // write. Gate: T8.
  if (!tokens) return { kind: "unavailable" };
  return { kind: "ok", tokens };
}

type AuthApiSessionOutcome =
  | { kind: "ok"; session: { firstName: string; accountRole: AccountRole } }
  | { kind: "mapped-error" }
  | { kind: "unavailable" };

async function callAuthApiForSession(accessToken: string): Promise<AuthApiSessionOutcome> {
  const outcome = await callAuthApiForStatus("/api/auth/session", "", "GET", {
    Authorization: `Bearer ${accessToken}`,
  });
  if (outcome.kind === "unavailable") return { kind: "unavailable" };
  if (outcome.kind === "mapped-error") return { kind: "mapped-error" };

  const session = parseSession(outcome.rawBody);
  if (!session) return { kind: "unavailable" };
  // The browser gets LESS than the api publishes, on purpose (plan §10): `id` never leaves
  // this module. Gate: T4.
  return {
    kind: "ok",
    session: { firstName: session.firstName, accountRole: session.accountRole },
  };
}

// ---------------------------------------------------------------------------------------
// The two-tab refresh race (plan §11) — a module-level single-flight keyed by the SHA-256
// hex digest of the presented refresh token, never by the token itself (so the secret is
// never a map key that could reach a debug dump). Entry deleted in `finally`. Gate: T10.
// ---------------------------------------------------------------------------------------

const inFlightRefreshes = new Map<string, Promise<AuthApiTokenOutcome>>();

function refreshWithSingleFlight(refreshToken: string): Promise<AuthApiTokenOutcome> {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const existing = inFlightRefreshes.get(key);
  if (existing) return existing;

  const pending = callAuthApi("/api/auth/refresh", JSON.stringify({ refreshToken })).finally(() => {
    inFlightRefreshes.delete(key);
  });
  inFlightRefreshes.set(key, pending);
  return pending;
}

// ---------------------------------------------------------------------------------------
// Client body handling — read, size-recheck, parse, and (for a `client`-sourced action)
// re-serialize UNCHANGED. Gate: T13.
// ---------------------------------------------------------------------------------------

async function readClientBody(
  actionKey: string,
  request: Request,
): Promise<{ ok: true; body: string } | { ok: false; result: AuthBffResult }> {
  const text = await request.text();

  // Re-check after reading: a chunked request carries no `Content-Length` header, so the
  // pre-parse check in `handleAuthRequest` cannot see it (plan §10).
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BODY_BYTES) {
    logAuthOutcome(actionKey, "invalid-request");
    return {
      ok: false,
      result: bffResult(413, { ok: false, code: "errors.transport.invalidRequest" }),
    };
  }

  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    logAuthOutcome(actionKey, "invalid-request");
    return {
      ok: false,
      result: bffResult(400, { ok: false, code: "errors.transport.invalidRequest" }),
    };
  }

  // Pass-through, not re-validation (plan §5.1/§10): re-serialized UNCHANGED, so every
  // client field (e.g. `locale`) reaches the api untouched and the api's own
  // `ValidationPipe` stays the single validator.
  return { ok: true, body: JSON.stringify(parsed) };
}

// ---------------------------------------------------------------------------------------
// Per-action handlers.
// ---------------------------------------------------------------------------------------

/** `register`, `verify-email/resend`, `password-reset/request` (plan §10). Anti-enumeration
 *  survives by construction: every `ok` outcome produces this exact, content-free cell —
 *  there is no branch on anything the api returned. Gate: T5. */
async function handleAnonymousAction(
  actionKey: string,
  action: AuthAction,
  request: Request,
): Promise<AuthBffResult> {
  const read = await readClientBody(actionKey, request);
  if (!read.ok) return read.result;

  const outcome = await callAuthApiForStatus(action.apiPath, read.body);

  if (outcome.kind === "unavailable") {
    logAuthOutcome(actionKey, "unavailable");
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  if (outcome.kind === "mapped-error") {
    logAuthOutcome(actionKey, outcome.code);
    return bffResult(outcome.status, { ok: false, code: outcome.code });
  }

  logAuthOutcome(actionKey, "ok");
  return bffResult(202, { ok: true });
}

/** `login`, `verify-email` (plan §10) — both issue a session on success. */
async function handleTokenIssuingAction(
  actionKey: "login" | "verify-email",
  action: AuthAction,
  request: Request,
): Promise<AuthBffResult> {
  const read = await readClientBody(actionKey, request);
  if (!read.ok) return read.result;

  const outcome = await callAuthApi(action.apiPath, read.body);

  if (outcome.kind === "unavailable") {
    logAuthOutcome(actionKey, "unavailable");
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  if (outcome.kind === "mapped-error") {
    logAuthOutcome(actionKey, outcome.code);
    return bffResult(outcome.status, { ok: false, code: outcome.code });
  }

  const siteUrl = getSiteUrl();
  const cookies = sessionCookieMutations(outcome.tokens, siteUrl);
  const url = new URL(request.url);
  const redirectTo = safeReturnPath(url.searchParams.get("returnTo"));

  logAuthOutcome(actionKey, "ok");
  return bffResult(200, { ok: true, redirectTo }, cookies);
}

/** `refresh` (plan §10/§11). No `cg_refresh` cookie is a short-circuit — 401, clear both, no
 *  api call, no quota spent. Every mapped-error outcome collapses to `sessionExpired` +
 *  clear both regardless of the api's specific cause (expired/unknown/reused/inactive): the
 *  api's only documented error status for this action is 401. */
async function handleRefresh(request: Request): Promise<AuthBffResult> {
  const siteUrl = getSiteUrl();
  const refreshToken = readCookieValue(request, REFRESH_COOKIE_NAME);

  if (!refreshToken) {
    logAuthOutcome("refresh", "errors.auth.sessionExpired");
    return bffResult(
      401,
      { ok: false, code: "errors.auth.sessionExpired" },
      clearSessionCookies(siteUrl),
    );
  }

  const outcome = await refreshWithSingleFlight(refreshToken);

  if (outcome.kind === "unavailable") {
    logAuthOutcome("refresh", "unavailable");
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  if (outcome.kind === "mapped-error") {
    logAuthOutcome("refresh", "errors.auth.sessionExpired");
    return bffResult(
      401,
      { ok: false, code: "errors.auth.sessionExpired" },
      clearSessionCookies(siteUrl),
    );
  }

  logAuthOutcome("refresh", "ok");
  return bffResult(200, { ok: true }, sessionCookieMutations(outcome.tokens, siteUrl));
}

/** `logout` (plan §11) — clears first, always. A user who asks to log out ends up logged
 *  out locally whatever the api does; a failed revoke is logged with no identifier and the
 *  browser still gets 200 + both cookies cleared. Gate: T9. */
async function handleLogout(action: AuthAction, request: Request): Promise<AuthBffResult> {
  const siteUrl = getSiteUrl();
  const refreshToken = readCookieValue(request, REFRESH_COOKIE_NAME);

  if (!refreshToken) {
    logAuthOutcome("logout", "ok");
    return bffResult(200, { ok: true }, clearSessionCookies(siteUrl));
  }

  let revokeFailed = false;
  try {
    const res = await sendApiRequest(action.apiPath, "POST", JSON.stringify({ refreshToken }));
    if (!res.ok) revokeFailed = true;
  } catch {
    revokeFailed = true;
  }

  logAuthOutcome("logout", revokeFailed ? "revoke failed" : "ok");
  return bffResult(200, { ok: true }, clearSessionCookies(siteUrl));
}

/** `password-reset/confirm` (plan §10) — the api revokes every live session on a reset
 *  confirm, so a success clears both cookies rather than leaving the browser holding two
 *  dead secrets. */
async function handlePasswordResetConfirm(
  action: AuthAction,
  request: Request,
): Promise<AuthBffResult> {
  const actionKey = "password-reset/confirm";
  const read = await readClientBody(actionKey, request);
  if (!read.ok) return read.result;

  const outcome = await callAuthApiForStatus(action.apiPath, read.body);

  if (outcome.kind === "unavailable") {
    logAuthOutcome(actionKey, "unavailable");
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  if (outcome.kind === "mapped-error") {
    logAuthOutcome(actionKey, outcome.code);
    return bffResult(outcome.status, { ok: false, code: outcome.code });
  }

  logAuthOutcome(actionKey, "ok");
  return bffResult(200, { ok: true }, clearSessionCookies(getSiteUrl()));
}

/** `session` (plan §10) — no `cg_access` cookie is a short-circuit: 401, no api call, no
 *  cookie change. A 401 from the api clears `cg_access` only — it is provably useless,
 *  while `cg_refresh` may still be good. */
async function handleSession(request: Request): Promise<AuthBffResult> {
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);

  if (!accessToken) {
    logAuthOutcome("session", "errors.auth.unauthenticated");
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  const outcome = await callAuthApiForSession(accessToken);

  if (outcome.kind === "unavailable") {
    logAuthOutcome("session", "unavailable");
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  if (outcome.kind === "mapped-error") {
    logAuthOutcome("session", "errors.auth.unauthenticated");
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" }, [
      clearAccessCookie(getSiteUrl()),
    ]);
  }

  logAuthOutcome("session", "ok");
  return bffResult(200, { ok: true, session: outcome.session });
}

// ---------------------------------------------------------------------------------------
// The single entry point `route.ts` calls.
// ---------------------------------------------------------------------------------------

/**
 * The whole browser-facing auth surface's dispatcher. An action not in `AUTH_ACTIONS` is a
 * 404; a method the matched action's row does not declare is a 405 — both with zero api
 * calls and zero cookie mutations (T11). Every POST action requires a matching `Origin`
 * (T12) and stays under the size bound (T2/T13.3) before any api call is attempted.
 */
export async function handleAuthRequest(
  request: Request,
  actionSegments: readonly string[],
): Promise<AuthBffResult> {
  const actionKey = actionSegments.join("/");
  const action = AUTH_ACTIONS[actionKey];

  if (!action) {
    logAuthOutcome(actionKey || "(root)", "not-found");
    return bffResult(404, { ok: false, code: "errors.transport.invalidRequest" });
  }

  if (request.method !== action.method) {
    logAuthOutcome(actionKey, "method-not-allowed");
    return bffResult(405, { ok: false, code: "errors.transport.invalidRequest" });
  }

  if (action.method === "POST") {
    if (!isValidOrigin(request)) {
      logAuthOutcome(actionKey, "forbidden");
      return bffResult(403, { ok: false, code: "errors.transport.forbidden" });
    }
    if (contentLengthExceeds(request)) {
      logAuthOutcome(actionKey, "invalid-request");
      return bffResult(413, { ok: false, code: "errors.transport.invalidRequest" });
    }
  }

  switch (actionKey) {
    case "register":
    case "verify-email/resend":
    case "password-reset/request":
      return handleAnonymousAction(actionKey, action, request);
    case "login":
    case "verify-email":
      return handleTokenIssuingAction(actionKey, action, request);
    case "refresh":
      return handleRefresh(request);
    case "logout":
      return handleLogout(action, request);
    case "password-reset/confirm":
      return handlePasswordResetConfirm(action, request);
    case "session":
      return handleSession(request);
    default:
      // Unreachable: every key in `AUTH_ACTIONS` is handled above, and an unmatched key
      // already returned 404 before this switch is reached.
      return bffResult(404, { ok: false, code: "errors.transport.invalidRequest" });
  }
}
