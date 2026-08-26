import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "./cookies";
import { handleAuthRequest } from "./transport.server";

// The real transport reads `serverEnv.API_BASE_URL` at call time (not module load), but
// pinning it keeps every test off the ambient environment — the same reasoning
// `client.test.ts` gives for the identical mock.
vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/**
 * `getSiteUrl()` is DELIBERATELY NOT mocked. `lib/env.ts`'s `NEXT_PUBLIC_SITE_URL` defaults
 * to `http://localhost:3000` when unset (`lib/env.ts`), and vitest loads no `.env` file, so
 * the real helper resolves to this value in every test process. Exercising the real
 * `getSiteUrl()` — rather than a stub — is what makes the Origin/cookie-Secure assertions
 * below honest rather than circular.
 */
const SITE_URL = "http://localhost:3000";

const SENTINEL_ACCESS = "SENTINEL-ACCESS-TOKEN-0000";
const SENTINEL_REFRESH = "SENTINEL-REFRESH-TOKEN-0000";

function authResultBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    accessToken: SENTINEL_ACCESS,
    accessTokenExpiresInSeconds: 900,
    refreshToken: SENTINEL_REFRESH,
    refreshTokenExpiresInSeconds: 2_592_000,
    ...overrides,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

interface RequestOptions {
  origin?: string | null;
  body?: string;
  cookie?: string;
  contentLength?: string;
}

function makeRequest(method: string, path: string, opts: RequestOptions = {}): Request {
  const headers = new Headers();
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.contentLength !== undefined) headers.set("content-length", opts.contentLength);
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: opts.body,
  });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function loggedText(): string {
  return warnSpy.mock.calls.map((call) => call.join(" ")).join("\n");
}

// -----------------------------------------------------------------------------------------
// T1 — P1: every success branch. No sentinel in the body or the log; both sentinels in the
// cookie mutations.
// -----------------------------------------------------------------------------------------

describe("T1 — P1: the browser never receives a token (success paths)", () => {
  it("login: body and log carry neither sentinel; cookies carry both", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    const request = makeRequest("POST", "/api/auth/login", {
      origin: SITE_URL,
      body: JSON.stringify({ email: "reader@example.test", password: "correct horse" }),
    });
    const result = await handleAuthRequest(request, ["login"]);

    const bodyText = JSON.stringify(result.body);
    expect(bodyText).not.toContain(SENTINEL_ACCESS);
    expect(bodyText).not.toContain(SENTINEL_REFRESH);
    expect(loggedText()).not.toContain(SENTINEL_ACCESS);
    expect(loggedText()).not.toContain(SENTINEL_REFRESH);

    const values = result.cookies.map((c) => c.value);
    expect(values).toContain(SENTINEL_ACCESS);
    expect(values).toContain(SENTINEL_REFRESH);
  });

  it("verify-email: same guarantee", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    const request = makeRequest("POST", "/api/auth/verify-email", {
      origin: SITE_URL,
      body: JSON.stringify({ email: "reader@example.test", code: "123456" }),
    });
    const result = await handleAuthRequest(request, ["verify-email"]);

    const bodyText = JSON.stringify(result.body);
    expect(bodyText).not.toContain(SENTINEL_ACCESS);
    expect(bodyText).not.toContain(SENTINEL_REFRESH);
    expect(loggedText()).not.toContain(SENTINEL_ACCESS);
    expect(loggedText()).not.toContain(SENTINEL_REFRESH);
    expect(result.cookies.map((c) => c.value)).toEqual(
      expect.arrayContaining([SENTINEL_ACCESS, SENTINEL_REFRESH]),
    );
  });

  it("refresh: same guarantee", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    const request = makeRequest("POST", "/api/auth/refresh", {
      origin: SITE_URL,
      cookie: `${REFRESH_COOKIE_NAME}=old-refresh-value`,
    });
    const result = await handleAuthRequest(request, ["refresh"]);

    const bodyText = JSON.stringify(result.body);
    expect(bodyText).not.toContain(SENTINEL_ACCESS);
    expect(bodyText).not.toContain(SENTINEL_REFRESH);
    expect(loggedText()).not.toContain(SENTINEL_ACCESS);
    expect(loggedText()).not.toContain(SENTINEL_REFRESH);
    expect(result.cookies.map((c) => c.value)).toEqual(
      expect.arrayContaining([SENTINEL_ACCESS, SENTINEL_REFRESH]),
    );
  });
});

// -----------------------------------------------------------------------------------------
// T2 — P2: every branch carries the three headers.
// -----------------------------------------------------------------------------------------

describe("T2 — P2: every branch carries Cache-Control/Vary/X-Content-Type-Options", () => {
  function expectAuthHeaders(result: Awaited<ReturnType<typeof handleAuthRequest>>) {
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(result.headers.Vary).toBe("Cookie");
    expect(result.headers["X-Content-Type-Options"]).toBe("nosniff");
  }

  it("success", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(200);
    expectAuthHeaders(result);
  });

  // TA84-2 (plan §12 T2 claimed "EACH mapped error" but only ever exercised login's 401) —
  // parametrized over the full MAPPED_ERROR_STATUSES set rather than one representative.
  it.each([400, 401, 403, 429])("a mapped error (status %i)", async (status) => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(status, { statusCode: status, message: "errors.auth.invalidCredentials" }),
    );
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(status);
    expectAuthHeaders(result);
  });

  it("upstream failure", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(502);
    expectAuthHeaders(result);
  });

  it("unknown action", async () => {
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/nope", { origin: SITE_URL }),
      ["nope"],
    );
    expect(result.status).toBe(404);
    expectAuthHeaders(result);
  });

  it("Origin refusal", async () => {
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: "https://evil.example",
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(403);
    expectAuthHeaders(result);
  });

  it("size refusal", async () => {
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        contentLength: String(9 * 1024),
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(413);
    expectAuthHeaders(result);
  });
});

// -----------------------------------------------------------------------------------------
// T-BODY-STREAM — the size bound is enforced WITHOUT buffering the full body first (item 5,
// CODE84-I4). This module's only branch with no test before this round.
// -----------------------------------------------------------------------------------------

interface DuplexRequestInit extends RequestInit {
  duplex: "half";
}

describe("T-BODY-STREAM — a chunked body with no Content-Length is bounded mid-stream", () => {
  it("rejects with 413 after reading only a small, bounded number of chunks — not the whole stream", async () => {
    const CHUNK_BYTES = 1024;
    // A safety valve so a broken guard cannot hang the test instead of failing it: if the
    // bound were NOT enforced mid-stream, this closes the stream after ~10 MiB rather than
    // running forever.
    const SAFETY_VALVE_PULLS = 10_000;
    let pullCount = 0;

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount > SAFETY_VALVE_PULLS) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
    });

    const init: DuplexRequestInit = {
      method: "POST",
      headers: { origin: SITE_URL },
      body: stream,
      duplex: "half",
    };
    const request = new Request("http://localhost:3000/api/auth/register", init);

    const result = await handleAuthRequest(request, ["register"]);

    expect(result.status).toBe(413);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    // MAX_REQUEST_BODY_BYTES is 8 KiB; a bounded reader stops within a handful of chunks
    // past it, never anywhere close to exhausting the (effectively unbounded) stream.
    expect(pullCount).toBeLessThan(64);
  });

  it("a bodyless request to a body-reading action does not throw (request.body is null)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(202));
    const request = makeRequest("POST", "/api/auth/register", { origin: SITE_URL });
    expect(request.body).toBeNull();

    const result = await handleAuthRequest(request, ["register"]);
    expect(result.status).toBe(202);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------------------
// T3 — outbound RequestInit shape.
// -----------------------------------------------------------------------------------------

describe("T3 — outbound RequestInit", () => {
  it("carries cache: no-store, JSON content-type/accept, no internal token, no next key", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit & Record<string, unknown>];
    expect(url).toBe("http://api.test/api/auth/login");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((init.headers as Record<string, string>).Accept).toBe("application/json");
    expect(
      Object.keys(init.headers as Record<string, string>).map((k) => k.toLowerCase()),
    ).not.toContain("x-internal-request-token");
    expect(init).not.toHaveProperty("next");
  });
});

// -----------------------------------------------------------------------------------------
// T-COOKIE-DECODE — a malformed percent-encoding is an ABSENT cookie, not a 500 (item 3,
// CODE84-I2/SEC84-M1).
// -----------------------------------------------------------------------------------------

describe("T-COOKIE-DECODE — a malformed percent-encoding never throws", () => {
  it.each(["%", "%zz", "abc%zz", "%E0%A4%A"])(
    "cg_refresh=%s on refresh is treated as no cookie: 401 sessionExpired, no 500",
    async (malformed) => {
      const mock = fetchMock();
      const result = await handleAuthRequest(
        makeRequest("POST", "/api/auth/refresh", {
          origin: SITE_URL,
          cookie: `${REFRESH_COOKIE_NAME}=${malformed}`,
        }),
        ["refresh"],
      );
      expect(result.status).toBe(401);
      expect(result.body).toEqual({ ok: false, code: "errors.auth.sessionExpired" });
      expect(mock).not.toHaveBeenCalled();
    },
  );

  it("cg_access=% on session is treated as no cookie: 401 unauthenticated, no 500", async () => {
    const mock = fetchMock();
    const result = await handleAuthRequest(
      makeRequest("GET", "/api/auth/session", { cookie: `${ACCESS_COOKIE_NAME}=%` }),
      ["session"],
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(mock).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------------------
// T4 — the full status/code map, and a safe log message under attacker-shaped content.
// -----------------------------------------------------------------------------------------

describe("T4 — status/code map and log safety", () => {
  it("login 401 -> invalidCredentials", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(401, { statusCode: 401, message: "errors.auth.invalidCredentials" }),
    );
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.invalidCredentials" });
  });

  it("login 403 -> the api's key, passed through", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(403, { statusCode: 403, message: "errors.auth.emailNotVerified" }),
    );
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.emailNotVerified" });
  });

  it("a mapped 4xx with an unrecognised message -> same status, invalidRequest", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(400, { statusCode: 400, message: "totally unrecognised" }));
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/register", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x", locale: "tr" }),
      }),
      ["register"],
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
  });

  it("refresh 401 (any cause) -> sessionExpired, clear both", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(401, { statusCode: 401, message: "errors.auth.sessionExpired" }),
    );
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/refresh", {
        origin: SITE_URL,
        cookie: `${REFRESH_COOKIE_NAME}=stale`,
      }),
      ["refresh"],
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.sessionExpired" });
    expect(result.cookies).toHaveLength(2);
    expect(result.cookies.map((c) => c.value)).toEqual(["", ""]);
  });

  it("session 401 -> unauthenticated, clear cg_access ONLY", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(401, { statusCode: 401, message: "errors.auth.unauthenticated" }),
    );
    const result = await handleAuthRequest(
      makeRequest("GET", "/api/auth/session", { cookie: `${ACCESS_COOKIE_NAME}=stale` }),
      ["session"],
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(result.cookies).toHaveLength(1);
    expect(result.cookies[0]?.name).toBe(ACCESS_COOKIE_NAME);
  });

  // Renamed from "429 from any action" (TA84-2/CODE84-M5): the case below exercises exactly
  // one action (login); the universal claim now lives only in the describe block that
  // actually tests it universally, immediately below.
  it("login 429 -> the api's key, passed through", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(429, { statusCode: 429, message: "errors.auth.rateLimited" }),
    );
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(429);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.rateLimited" });
  });

  it("the log message built under an e-mail-and-token-shaped upstream message contains neither", async () => {
    const plantedEmail = "attacker@example.test";
    const plantedToken = "PLANTED-TOKEN-VALUE";
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(400, {
        statusCode: 400,
        message: `unexpected for ${plantedEmail} token=${plantedToken}`,
      }),
    );

    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: plantedEmail, password: "x" }),
      }),
      ["login"],
    );

    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    expect(loggedText()).not.toContain(plantedEmail);
    expect(loggedText()).not.toContain(plantedToken);
  });
});

// -----------------------------------------------------------------------------------------
// T-CRITICAL-FIX — items 1/2 (CODE84-C1/SEC84-C1, CODE84-I1/SEC84-I1): a mapped status OTHER
// than the action's own specific row (refresh 401 / session 401) must pass through unchanged
// and must NEVER clear a cookie. This is the regression suite for the round's CRITICAL: a 429
// from the api's site-wide `refresh` rate-limit bucket must never look like a dead session.
// -----------------------------------------------------------------------------------------

describe("T-CRITICAL-FIX — refresh: every mapped status OTHER than 401 passes through, no cookie mutation", () => {
  it.each([400, 403, 429])(
    "refresh %i -> the api's key, passed through, cookies UNCHANGED",
    async (status) => {
      const mock = fetchMock();
      mock.mockResolvedValue(
        jsonResponse(status, { statusCode: status, message: "errors.auth.rateLimited" }),
      );
      const result = await handleAuthRequest(
        makeRequest("POST", "/api/auth/refresh", {
          origin: SITE_URL,
          cookie: `${REFRESH_COOKIE_NAME}=still-valid-server-side`,
        }),
        ["refresh"],
      );
      expect(result.status).toBe(status);
      expect(result.body).toEqual({ ok: false, code: "errors.auth.rateLimited" });
      // The failure mode this round fixes: a transient 429 must not delete a still-valid
      // refresh token. Zero cookie mutations, not "cleared to empty".
      expect(result.cookies).toEqual([]);
    },
  );
});

describe("T-CRITICAL-FIX — session: every mapped status OTHER than 401 passes through, no cookie mutation", () => {
  it.each([400, 403, 429])(
    "session %i -> the api's key, passed through, no cg_access clear",
    async (status) => {
      const mock = fetchMock();
      mock.mockResolvedValue(
        jsonResponse(status, { statusCode: status, message: "errors.auth.rateLimited" }),
      );
      const result = await handleAuthRequest(
        makeRequest("GET", "/api/auth/session", { cookie: `${ACCESS_COOKIE_NAME}=still-valid` }),
        ["session"],
      );
      expect(result.status).toBe(status);
      expect(result.body).toEqual({ ok: false, code: "errors.auth.rateLimited" });
      expect(result.cookies).toEqual([]);
    },
  );
});

// -----------------------------------------------------------------------------------------
// T-BODY-DRAIN — the api response body is drained even when this module never reads it
// (item 13, CODE84-M2). Covers the two sites inside THIS module; the third site
// (lib/auth/session.ts:71) has no gate in this round — see the Phase 2 return to Atlas.
// -----------------------------------------------------------------------------------------

describe("T-BODY-DRAIN — an unconsumed api response body is still cancelled", () => {
  it("classifyResponse's unmapped-status branch cancels the body instead of leaving it unread", async () => {
    const response = new Response("upstream failure body", { status: 500 });
    const body = response.body;
    expect(body).not.toBeNull();
    const cancelSpy = vi.spyOn(body as ReadableStream<Uint8Array>, "cancel");

    const mock = fetchMock();
    mock.mockResolvedValue(response);
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );

    expect(result.status).toBe(502);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it("handleLogout drains the body on a failed revoke instead of leaving it unread", async () => {
    const response = new Response("revoke failed body", { status: 500 });
    const body = response.body;
    expect(body).not.toBeNull();
    const cancelSpy = vi.spyOn(body as ReadableStream<Uint8Array>, "cancel");

    const mock = fetchMock();
    mock.mockResolvedValue(response);
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/logout", {
        origin: SITE_URL,
        cookie: `${REFRESH_COOKIE_NAME}=abc`,
      }),
      ["logout"],
    );

    expect(result.status).toBe(200);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------------------
// T5 — anti-enumeration.
// -----------------------------------------------------------------------------------------

describe("T5 — anti-enumeration", () => {
  it("register, verify-email/resend and password-reset/request produce byte-identical (status, body)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(202));

    const register = await handleAuthRequest(
      makeRequest("POST", "/api/auth/register", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x", locale: "tr" }),
      }),
      ["register"],
    );
    const resend = await handleAuthRequest(
      makeRequest("POST", "/api/auth/verify-email/resend", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test" }),
      }),
      ["verify-email", "resend"],
    );
    const resetRequest = await handleAuthRequest(
      makeRequest("POST", "/api/auth/password-reset/request", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test" }),
      }),
      ["password-reset", "request"],
    );

    expect(register.status).toBe(202);
    expect(JSON.stringify(register.body)).toBe(JSON.stringify(resend.body));
    expect(JSON.stringify(resend.body)).toBe(JSON.stringify(resetRequest.body));
    expect(register.status).toBe(resend.status);
    expect(resend.status).toBe(resetRequest.status);
  });
});

// -----------------------------------------------------------------------------------------
// T6 — upstream failure collapses to one condition.
// -----------------------------------------------------------------------------------------

describe("T6 — upstream failure", () => {
  const loginRequest = () =>
    makeRequest("POST", "/api/auth/login", {
      origin: SITE_URL,
      body: JSON.stringify({ email: "a@b.test", password: "x" }),
    });

  it("fetch rejects -> 502 unavailable, no cookie mutation", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("fetch failed"));
    const result = await handleAuthRequest(loginRequest(), ["login"]);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
    expect(result.cookies).toEqual([]);
  });

  it("fetch aborts at 15s under fake timers -> 502 unavailable", async () => {
    vi.useFakeTimers();
    const mock = fetchMock();
    mock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const pending = handleAuthRequest(loginRequest(), ["login"]);
    await vi.advanceTimersByTimeAsync(15_000);
    const result = await pending;

    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
    expect(result.cookies).toEqual([]);
  });

  it("api answers 500 -> 502 unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(new Response("upstream failure", { status: 500 }));
    const result = await handleAuthRequest(loginRequest(), ["login"]);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
    expect(result.cookies).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------
// T7 — P3: session.ts contains no reference to the refresh action.
// -----------------------------------------------------------------------------------------

describe("T7 — P3: lib/auth/session.ts never calls refresh", () => {
  const SESSION_SOURCE = readFileSync(new URL("./session.ts", import.meta.url), "utf8");

  it("the module source references neither the refresh api path nor the refresh cookie", () => {
    // A blunt "no mention of the WORD refresh" check would also reject this file's own
    // prose explaining why it never refreshes, so the assertion targets the two concrete
    // identifiers a refresh call would actually need: the api path and the cookie that
    // carries the refresh token. Revert-to-red: add a refresh call to `session.ts` — it
    // cannot be written without at least one of these two strings appearing in the source.
    expect(SESSION_SOURCE).not.toContain("/api/auth/refresh");
    expect(SESSION_SOURCE).not.toContain("REFRESH_COOKIE_NAME");
  });

  // TA84-1 (validated, downgraded to MINOR — REVIEW-POLICY.md §9 rule 3: a guard's
  // incompleteness is debt, not a blocker, when no production input yields a wrong output
  // today). Five mutants each reintroduced the P3 defect and kept the check above green: a
  // wrapper function, a sibling module, a local constant table, and a hardcoded cookie name.
  // The two checks below close what an import allowlist alone cannot (plan §16
  // "Recommended Actions" #1: "the allowlist misses two of the four demonstrated evasions").
  // This is item 7's owed strengthening — it does NOT claim to close the class outright, only
  // the four demonstrated evasions; an overclaiming comment here is exactly the failure mode
  // this round exists to fix (see the false "cannot be written without…" sentence this test
  // used to carry, corrected above).

  it("imports only from an allowed source list — closes the wrapper-function / sibling-module evasion", () => {
    const ALLOWED_IMPORT_SOURCES = new Set([
      "server-only",
      "react",
      "next/headers",
      "zod",
      "@/lib/env.server",
      "@/lib/api/types",
      "./cookies",
    ]);
    const importLines = SESSION_SOURCE.split("\n").filter((line) =>
      line.trimStart().startsWith("import "),
    );
    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) {
      const match = /["']([^"']+)["']/.exec(line);
      expect(match).not.toBeNull();
      expect(ALLOWED_IMPORT_SOURCES.has(match?.[1] ?? "")).toBe(true);
    }
  });

  it("the module's only /api/auth/** literal is the session endpoint — closes the hardcoded-path evasion", () => {
    // The local-constant-table and hardcoded-literal mutants add no import at all, so the
    // check above cannot see them either. This asserts the api path surface directly: every
    // literal fragment matching /api/auth/** must be exactly the session endpoint.
    const apiPathLiterals = SESSION_SOURCE.match(/\/api\/auth\/[a-zA-Z0-9/-]*/g) ?? [];
    expect(apiPathLiterals.length).toBeGreaterThan(0);
    for (const literal of apiPathLiterals) {
      expect(literal).toBe("/api/auth/session");
    }
  });

  it("no cg_* cookie-name literal other than the access cookie appears in the module", () => {
    const cookieLiterals = SESSION_SOURCE.match(/cg_[a-z]+/g) ?? [];
    for (const literal of cookieLiterals) {
      expect(literal).toBe("cg_access");
    }
  });
});

// -----------------------------------------------------------------------------------------
// T8 — the response guard.
// -----------------------------------------------------------------------------------------

describe("T8 — response guard rejects a malformed 200 body", () => {
  const loginRequest = () =>
    makeRequest("POST", "/api/auth/login", {
      origin: SITE_URL,
      body: JSON.stringify({ email: "a@b.test", password: "x" }),
    });

  it("a 200 body missing refreshToken -> 502, no cookie mutation", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, {
        accessToken: "tok",
        accessTokenExpiresInSeconds: 900,
        refreshTokenExpiresInSeconds: 2_592_000,
      }),
    );
    const result = await handleAuthRequest(loginRequest(), ["login"]);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
    expect(result.cookies).toEqual([]);
  });

  it("accessTokenExpiresInSeconds as a string -> 502, no cookie mutation", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, JSON.parse(authResultBody({ accessTokenExpiresInSeconds: "900" }))),
    );
    const result = await handleAuthRequest(loginRequest(), ["login"]);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
    expect(result.cookies).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------
// T9 — logout.
// -----------------------------------------------------------------------------------------

describe("T9 — logout clears first, always", () => {
  it("clears both and answers 200 even when the api call rejects", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/logout", {
        origin: SITE_URL,
        cookie: `${REFRESH_COOKIE_NAME}=abc`,
      }),
      ["logout"],
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.cookies).toHaveLength(2);
    expect(result.cookies.every((c) => c.value === "")).toBe(true);
    expect(loggedText()).toContain("logout revoke failed");
  });

  it("makes ZERO fetch calls when there is no cg_refresh cookie", async () => {
    const mock = fetchMock();
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/logout", { origin: SITE_URL }),
      ["logout"],
    );
    expect(mock).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.cookies).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------------------
// T10 — single-flight refresh.
// -----------------------------------------------------------------------------------------

describe("T10 — single-flight refresh", () => {
  it("two concurrent refreshes with the SAME token -> exactly one fetch, both get the same pair", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    const reqA = makeRequest("POST", "/api/auth/refresh", {
      origin: SITE_URL,
      cookie: `${REFRESH_COOKIE_NAME}=same-token`,
    });
    const reqB = makeRequest("POST", "/api/auth/refresh", {
      origin: SITE_URL,
      cookie: `${REFRESH_COOKIE_NAME}=same-token`,
    });

    const [resultA, resultB] = await Promise.all([
      handleAuthRequest(reqA, ["refresh"]),
      handleAuthRequest(reqB, ["refresh"]),
    ]);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(resultA.cookies.map((c) => c.value)).toEqual(resultB.cookies.map((c) => c.value));
  });

  it("two concurrent refreshes with DIFFERENT tokens -> two fetch calls (negative control)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    const reqA = makeRequest("POST", "/api/auth/refresh", {
      origin: SITE_URL,
      cookie: `${REFRESH_COOKIE_NAME}=token-a`,
    });
    const reqB = makeRequest("POST", "/api/auth/refresh", {
      origin: SITE_URL,
      cookie: `${REFRESH_COOKIE_NAME}=token-b`,
    });

    await Promise.all([handleAuthRequest(reqA, ["refresh"]), handleAuthRequest(reqB, ["refresh"])]);

    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("a third call after the first settles issues a NEW fetch (the map entry was released)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    const req = () =>
      makeRequest("POST", "/api/auth/refresh", {
        origin: SITE_URL,
        cookie: `${REFRESH_COOKIE_NAME}=same-token`,
      });

    await Promise.all([
      handleAuthRequest(req(), ["refresh"]),
      handleAuthRequest(req(), ["refresh"]),
    ]);
    expect(mock).toHaveBeenCalledTimes(1);

    await handleAuthRequest(req(), ["refresh"]);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

// -----------------------------------------------------------------------------------------
// T11 — unknown action / wrong method.
// -----------------------------------------------------------------------------------------

describe("T11 — unknown action and method mismatch", () => {
  it("an unknown action -> 404, zero fetch calls, zero cookie mutations", async () => {
    const mock = fetchMock();
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/nope", { origin: SITE_URL }),
      ["nope"],
    );
    expect(result.status).toBe(404);
    expect(mock).not.toHaveBeenCalled();
    expect(result.cookies).toEqual([]);
  });

  it("GET /api/auth/login (login is POST-only) -> 405 with Allow: POST", async () => {
    const mock = fetchMock();
    const result = await handleAuthRequest(
      makeRequest("GET", "/api/auth/login", { origin: SITE_URL }),
      ["login"],
    );
    expect(result.status).toBe(405);
    expect(mock).not.toHaveBeenCalled();
    expect(result.cookies).toEqual([]);
    // RFC 9110 §15.5.6 requires a 405 to carry Allow (CODE84-M8).
    expect(result.headers.Allow).toBe("POST");
  });

  it("POST /api/auth/session (session is GET-only) -> 405 with Allow: GET", async () => {
    const mock = fetchMock();
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/session", { origin: SITE_URL }),
      ["session"],
    );
    expect(result.status).toBe(405);
    expect(mock).not.toHaveBeenCalled();
    expect(result.cookies).toEqual([]);
    expect(result.headers.Allow).toBe("GET");
  });
});

// -----------------------------------------------------------------------------------------
// T14 — action lookup: no Object.prototype match, no percent-encoding alias (item 9,
// CODE84-M1/SEC84-M2, VAL84B-M1).
// -----------------------------------------------------------------------------------------

describe("T14 — action lookup closes the prototype-chain and percent-encoding evasions", () => {
  it.each(["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"])(
    "an inherited Object.prototype name (%s) -> 404, not 405, zero fetch calls",
    async (name) => {
      const mock = fetchMock();
      const result = await handleAuthRequest(
        makeRequest("POST", `/api/auth/${name}`, { origin: SITE_URL }),
        [name],
      );
      expect(result.status).toBe(404);
      expect(mock).not.toHaveBeenCalled();
      expect(result.cookies).toEqual([]);
    },
  );

  it("a percent-encoded alias of a real action (logi%6E, decodes to login) -> 404, zero fetch calls", async () => {
    const mock = fetchMock();
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/logi%6E", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(404);
    expect(mock).not.toHaveBeenCalled();
  });

  it("an encoded-slash-compressed alias (verify-email%2Fresend, one raw segment) -> 404, zero fetch calls", async () => {
    const mock = fetchMock();
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/verify-email%2Fresend", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test" }),
      }),
      // Next decodes %2F within a single catch-all segment WITHOUT re-splitting on it, so
      // this arrives as ONE array element containing an embedded "/" (measured against a
      // live Next 16.2.10 server) — not two segments.
      ["verify-email/resend"],
    );
    expect(result.status).toBe(404);
    expect(mock).not.toHaveBeenCalled();
  });

  it("the canonical unencoded two-segment path still succeeds (negative control)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(202));
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/verify-email/resend", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test" }),
      }),
      ["verify-email", "resend"],
    );
    expect(result.status).toBe(202);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("the caller-controlled path segment is never logged for a prototype-name request", async () => {
    fetchMock();
    await handleAuthRequest(makeRequest("POST", "/api/auth/constructor", { origin: SITE_URL }), [
      "constructor",
    ]);
    expect(loggedText()).not.toContain("constructor");
    expect(loggedText()).toContain("(unknown)");
  });
});

// -----------------------------------------------------------------------------------------
// T12 — Origin validation.
// -----------------------------------------------------------------------------------------

describe("T12 — Origin validation", () => {
  it("a missing Origin on a POST action -> 403", async () => {
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(403);
  });

  it("a different Origin -> 403", async () => {
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: "https://evil.example",
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).toBe(403);
  });

  it("the exact getSiteUrl() origin -> proceeds", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));
    const result = await handleAuthRequest(
      makeRequest("POST", "/api/auth/login", {
        origin: SITE_URL,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      }),
      ["login"],
    );
    expect(result.status).not.toBe(403);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("GET session proceeds with NO Origin header at all", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, { id: "u1", firstName: "Ayşe", accountRole: "STUDENT" }),
    );
    const result = await handleAuthRequest(
      makeRequest("GET", "/api/auth/session", { cookie: `${ACCESS_COOKIE_NAME}=tok` }),
      ["session"],
    );
    expect(result.status).not.toBe(403);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------------------
// T13 — body pass-through and the refresh-cookie override.
// -----------------------------------------------------------------------------------------

describe("T13 — body pass-through", () => {
  it("a client-sourced action forwards the parsed body UNCHANGED, including locale", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(202));

    const payload = { email: "a@b.test", password: "correct horse battery staple", locale: "tr" };
    await handleAuthRequest(
      makeRequest("POST", "/api/auth/register", {
        origin: SITE_URL,
        body: JSON.stringify(payload),
      }),
      ["register"],
    );

    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("a refresh-cookie action ignores a browser-supplied refreshToken entirely", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, JSON.parse(authResultBody())));

    // The browser's own body carries a DIFFERENT refresh token than the cookie — it must
    // never reach the api.
    const request = makeRequest("POST", "/api/auth/refresh", {
      origin: SITE_URL,
      cookie: `${REFRESH_COOKIE_NAME}=cookie-supplied-token`,
      body: JSON.stringify({ refreshToken: "browser-supplied-token" }),
    });
    await handleAuthRequest(request, ["refresh"]);

    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: "cookie-supplied-token" });
  });
});
