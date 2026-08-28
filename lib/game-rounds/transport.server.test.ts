import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { handleListGameRounds, handleSubmitGameRound } from "./transport.server";

/**
 * T-numbered in the style `lib/video-progress/transport.server.test.ts` already established
 * for this repo's BFF-proxy layer (UYELIK-10 plan §11): no-cookie → 401 with no outbound
 * call; a non-OK api response passed through; `Cache-Control: no-store` on every branch;
 * Origin required and checked on `POST` only; the request-side bound-mirroring schema
 * rejects an out-of-bounds body locally, before any outbound call; the response-guard
 * drift-gate tuples (compile-time checks in the module under test, not a runtime case).
 */

vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/** DELIBERATELY NOT mocked, mirroring the established reasoning: `lib/env.ts`'s
 *  `NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000` when unset, and vitest loads
 *  no `.env`, so the real `getSiteUrl()` resolves to this value in every test process —
 *  exercising it for real is what makes the Origin assertions honest. */
const SITE_URL = "http://localhost:3000";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function emptyResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

function gameRoundBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: "provinces",
    clientRoundId: "018f2f3a-9c3e-7b2a-8b9d-2e6f1a7c9d40",
    score: 87,
    found: 70,
    firstTry: 60,
    total: 81,
    poolTotal: 81,
    totalWrongs: 12,
    endedEarly: false,
    completionTimeSeconds: null,
    createdAt: "2026-08-28T10:00:00.000Z",
    ...overrides,
  };
}

function validSubmitPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: "provinces",
    clientRoundId: "018f2f3a-9c3e-7b2a-8b9d-2e6f1a7c9d40",
    score: 87,
    found: 70,
    firstTry: 60,
    total: 81,
    poolTotal: 81,
    totalWrongs: 12,
    endedEarly: false,
    ...overrides,
  };
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
  return new Request(`${SITE_URL}${path}`, { method, headers, body: opts.body });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("T1 — GET (list): no cookie is a short-circuit (401, zero outbound calls)", () => {
  it("never calls fetch when cg_access is absent", async () => {
    const mock = fetchMock();
    const result = await handleListGameRounds(makeRequest("GET", "/api/game-rounds"), {});
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T2 — GET (list): page/pageSize are clamped, never rejected", () => {
  it("clamps an out-of-range page/pageSize into the api's own bounds rather than 400ing", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, { page: 10_000, pageSize: 100, total: 0, hasMore: false, items: [] }),
    );
    const result = await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
      { page: "999999", pageSize: "500" },
    );
    expect(result.status).toBe(200);
    const [url] = mock.mock.calls[0] as [string];
    expect(url).toContain("page=10000");
    expect(url).toContain("pageSize=100");
  });

  it("falls back to the api's own defaults for a non-numeric or absent param", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, { page: 1, pageSize: 20, total: 0, hasMore: false, items: [] }),
    );
    await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
      { page: "not-a-number" },
    );
    const [url] = mock.mock.calls[0] as [string];
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=20");
  });
});

describe("T3 — GET (list): a 200 is passed through, flattened into the ok body", () => {
  it("parses and forwards the api's page of rounds", async () => {
    const mock = fetchMock();
    const item = gameRoundBody();
    mock.mockResolvedValue(
      jsonResponse(200, { page: 1, pageSize: 20, total: 1, hasMore: false, items: [item] }),
    );
    const result = await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
      {},
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      page: 1,
      pageSize: 20,
      total: 1,
      hasMore: false,
      items: [item],
    });
  });

  it("attaches the Authorization bearer header from the access cookie", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, { page: 1, pageSize: 20, total: 0, hasMore: false, items: [] }),
    );
    await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=SENTINEL-TOKEN` }),
      {},
    );
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SENTINEL-TOKEN");
  });
});

describe("T4 — GET (list): a non-OK api response is passed through, mapped by status", () => {
  it("a genuine api 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
      {},
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a 5xx collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
      {},
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });

  it("a network failure also collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
      {},
    );
    expect(result.status).toBe(502);
  });

  it("a 200 body that fails the response guard also collapses to unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, { not: "a list" }));
    const result = await handleListGameRounds(
      makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
      {},
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });
});

describe("T5 — POST (submit): Origin is required and checked", () => {
  it("a missing Origin -> 403, zero outbound calls", async () => {
    const mock = fetchMock();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.forbidden" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("a different Origin -> 403", async () => {
    const mock = fetchMock();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: "https://evil.example",
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
  });

  it("the matching Origin proceeds", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, gameRoundBody()));
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(200);
  });
});

describe("T6 — POST (submit): no cookie is a short-circuit (401, zero outbound calls) — checked AFTER Origin", () => {
  it("never calls fetch when cg_access is absent, even with a valid Origin", async () => {
    const mock = fetchMock();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T7 — POST (submit): the request-side schema rejects a bad body BEFORE any api call", () => {
  it("a malformed (non-JSON) body never reaches the api", async () => {
    const mock = fetchMock();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: "{not json",
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it("an out-of-bounds score (>100) is rejected locally, never forwarded", async () => {
    const mock = fetchMock();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload({ score: 101 })),
      }),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("a clientRoundId with an illegal character is rejected locally", async () => {
    const mock = fetchMock();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload({ clientRoundId: "not valid!" })),
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it("a mode not matching the api's own pattern is rejected locally", async () => {
    const mock = fetchMock();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload({ mode: "NotLowercase" })),
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it("completionTimeSeconds omitted entirely is accepted (the current engine tracks no clock)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, gameRoundBody()));
    const payload = validSubmitPayload();
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(payload),
      }),
    );
    expect(result.status).toBe(200);
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    const forwarded = JSON.parse(init.body as string) as Record<string, unknown>;
    expect("completionTimeSeconds" in forwarded).toBe(false);
  });

  it("completionTimeSeconds explicit null is also accepted and forwarded", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, gameRoundBody()));
    const payload = validSubmitPayload({ completionTimeSeconds: null });
    await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(payload),
      }),
    );
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    const forwarded = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(forwarded.completionTimeSeconds).toBeNull();
  });
});

describe("T8 — POST (submit): a non-OK api response is passed through, mapped by status", () => {
  it("a genuine 400 maps to errors.gameRounds.invalidSummary", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(400));
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.gameRounds.invalidSummary" });
  });

  it("a genuine 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a 429 maps to errors.gameRounds.tooManySubmissions", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(429));
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(429);
    expect(result.body).toEqual({ ok: false, code: "errors.gameRounds.tooManySubmissions" });
  });

  it("a 429 with a Retry-After header forwards it verbatim (defensive, SEC145R2-M1 forward-compat)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(429, { "retry-after": "30" }));
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(429);
    expect(result.headers["Retry-After"]).toBe("30");
  });

  it("a 429 with no Retry-After header carries none — no invented value", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(429));
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.headers["Retry-After"]).toBeUndefined();
  });

  it("a 5xx collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validSubmitPayload()),
      }),
    );
    expect(result.status).toBe(502);
  });

  it("the idempotent-retry contract: resubmitting the same clientRoundId returns whatever the api answers, unmodified by this proxy", async () => {
    const mock = fetchMock();
    const original = gameRoundBody({ score: 42 });
    mock.mockResolvedValue(jsonResponse(200, original));
    const payload = validSubmitPayload({ score: 99 }); // a differing resubmit body
    const result = await handleSubmitGameRound(
      makeRequest("POST", "/api/game-rounds", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(payload),
      }),
    );
    // The api is the source of the idempotency guarantee; this proxy is a thin pass-through
    // and must not itself alter what comes back.
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, round: original });
  });
});

describe("T9 — Cache-Control: no-store on every branch", () => {
  it.each([
    [
      "GET (list), no cookie",
      () => handleListGameRounds(makeRequest("GET", "/api/game-rounds"), {}),
    ],
    [
      "GET (list), api 200",
      async () => {
        fetchMock().mockResolvedValue(
          jsonResponse(200, { page: 1, pageSize: 20, total: 0, hasMore: false, items: [] }),
        );
        return handleListGameRounds(
          makeRequest("GET", "/api/game-rounds", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
          {},
        );
      },
    ],
    [
      "POST (submit), no Origin",
      () =>
        handleSubmitGameRound(
          makeRequest("POST", "/api/game-rounds", { body: JSON.stringify(validSubmitPayload()) }),
        ),
    ],
  ])("%s", async (_label, run) => {
    const result = await run();
    expect(result.headers["Cache-Control"]).toBe("no-store");
  });
});
