import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  handleGetVideoProgress,
  handlePutVideoProgress,
  isBookVideoIdShape,
} from "./transport.server";

/**
 * T-numbered in the style `lib/auth/transport.server.test.ts` already established for this
 * repo's BFF-proxy layer (UYELIK-06 plan §11): no-cookie → 401 with no outbound call; a
 * non-OK api response passed through; `Cache-Control: no-store` on every branch; Origin
 * required and checked on `PUT` only; the response-guard drift-gate tuple (a compile-time
 * check — `_videoProgressShapeAgreesWithContract` in the module under test — not a runtime
 * case, the same posture `transport.server.ts` itself takes for its own drift gates).
 */

vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/** DELIBERATELY NOT mocked, mirroring `lib/auth/transport.server.test.ts`'s own reasoning:
 *  `lib/env.ts`'s `NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000` when unset, and
 *  vitest loads no `.env`, so the real `getSiteUrl()` resolves to this value in every test
 *  process — exercising it for real is what makes the Origin assertions honest. */
const SITE_URL = "http://localhost:3000";

const VALID_BOOK_VIDEO_ID = "11111111-2222-4333-8444-555555555555";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function progressBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    bookVideoId: VALID_BOOK_VIDEO_ID,
    lastPositionSeconds: 245,
    watched: false,
    watchedAt: null,
    updatedAt: "2026-08-27T10:00:00.000Z",
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

describe("isBookVideoIdShape", () => {
  it("accepts a real uuid", () => {
    expect(isBookVideoIdShape(VALID_BOOK_VIDEO_ID)).toBe(true);
  });
  it("rejects a denemeNo-shaped value, a slug, and an empty string", () => {
    expect(isBookVideoIdShape("12")).toBe(false);
    expect(isBookVideoIdShape("kitap-slug")).toBe(false);
    expect(isBookVideoIdShape("")).toBe(false);
  });
});

describe("T1 — GET: no cookie is a short-circuit (401, zero outbound calls)", () => {
  it("never calls fetch when cg_access is absent", async () => {
    const mock = fetchMock();
    const result = await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T2 — an unshapely bookVideoId is refused before any api call", () => {
  it("GET", async () => {
    const mock = fetchMock();
    const result = await handleGetVideoProgress(
      makeRequest("GET", "/api/video-progress/not-a-uuid", {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      "not-a-uuid",
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("PUT", async () => {
    const mock = fetchMock();
    const result = await handlePutVideoProgress(
      makeRequest("PUT", "/api/video-progress/not-a-uuid", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 10, watched: false }),
      }),
      "not-a-uuid",
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T3 — GET: a 200 is passed through as { ok: true, progress }", () => {
  it("parses and forwards the api's progress row", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, progressBody({ watched: true, lastPositionSeconds: 90 })),
    );
    const result = await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      progress: progressBody({ watched: true, lastPositionSeconds: 90 }),
    });
  });

  it("attaches the Authorization bearer header from the access cookie", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, progressBody()));
    await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=SENTINEL-TOKEN`,
      }),
      VALID_BOOK_VIDEO_ID,
    );
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SENTINEL-TOKEN");
  });
});

describe("T4 — GET: a non-OK api response is passed through, mapped by status", () => {
  it("a genuine api 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a 404 (no video, or no saved progress — one undifferentiated answer) maps to notFound", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(404));
    const result = await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ ok: false, code: "errors.videoProgress.notFound" });
  });

  it("a 5xx (or any unmapped status) collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });

  it("a network failure also collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(502);
  });

  it("a 200 body that fails the response guard also collapses to unavailable, never a cookie-less 200", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, { not: "a progress row" }));
    const result = await handleGetVideoProgress(
      makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });
});

describe("T5 — PUT: Origin is required and checked", () => {
  it("a missing Origin -> 403, zero outbound calls", async () => {
    const mock = fetchMock();
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 10, watched: false }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.forbidden" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("a different Origin -> 403", async () => {
    const mock = fetchMock();
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: "https://evil.example",
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 10, watched: false }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
  });

  it("the matching Origin proceeds", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, progressBody()));
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 10, watched: false }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(200);
  });
});

describe("T6 — PUT: no cookie is a short-circuit (401, zero outbound calls) — checked AFTER Origin", () => {
  it("never calls fetch when cg_access is absent, even with a valid Origin", async () => {
    const mock = fetchMock();
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: SITE_URL,
        body: JSON.stringify({ lastPositionSeconds: 10, watched: false }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T7 — PUT: the client body reaches the api UNCHANGED (pass-through, not re-validation)", () => {
  it("re-serializes the parsed body rather than rewriting it", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, progressBody()));
    await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 245, watched: true }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ lastPositionSeconds: 245, watched: true });
  });

  it("a malformed (non-JSON) body never reaches the api", async () => {
    const mock = fetchMock();
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: "{not json",
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T8 — PUT: a non-OK api response is passed through, mapped by status", () => {
  it("a genuine 400 (positionExceedsDuration) is read from the api's own message", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(400, {
        statusCode: 400,
        message: "errors.videoProgress.positionExceedsDuration",
      }),
    );
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 99_999, watched: false }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      code: "errors.videoProgress.positionExceedsDuration",
    });
  });

  it("a 400 the api sent with an unrecognised message falls back to invalidRequest", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(400, { statusCode: 400, message: "Validation failed" }));
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 10, watched: false }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
  });

  it("a 404 maps to videoNotFound (not the GET side's notFound code)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(404));
    const result = await handlePutVideoProgress(
      makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify({ lastPositionSeconds: 10, watched: false }),
      }),
      VALID_BOOK_VIDEO_ID,
    );
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ ok: false, code: "errors.videoProgress.videoNotFound" });
  });
});

describe("T9 — Cache-Control: no-store on every branch", () => {
  it.each([
    [
      "GET, no cookie",
      () =>
        handleGetVideoProgress(
          makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`),
          VALID_BOOK_VIDEO_ID,
        ),
    ],
    [
      "GET, api 200",
      async () => {
        fetchMock().mockResolvedValue(jsonResponse(200, progressBody()));
        return handleGetVideoProgress(
          makeRequest("GET", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
            cookie: `${ACCESS_COOKIE_NAME}=token`,
          }),
          VALID_BOOK_VIDEO_ID,
        );
      },
    ],
    [
      "PUT, no Origin",
      () =>
        handlePutVideoProgress(
          makeRequest("PUT", `/api/video-progress/${VALID_BOOK_VIDEO_ID}`, {
            body: JSON.stringify({ lastPositionSeconds: 1, watched: false }),
          }),
          VALID_BOOK_VIDEO_ID,
        ),
    ],
  ])("%s", async (_label, run) => {
    const result = await run();
    expect(result.headers["Cache-Control"]).toBe("no-store");
  });
});
