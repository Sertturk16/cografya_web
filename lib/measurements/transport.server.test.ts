import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  handleCreateMeasurement,
  handleDeleteMeasurement,
  handleListMeasurements,
  isMeasurementIdShape,
} from "./transport.server";

/**
 * T-numbered in the style `lib/game-rounds/transport.server.test.ts` already established
 * for this repo's BFF-proxy layer (UYELIK-12 plan §11): no-cookie -> 401 with no outbound
 * call; a non-OK api response passed through; `Cache-Control: no-store` on every branch;
 * Origin required and checked on the state-changing verbs only; the request-side
 * bound-mirroring schema rejects an out-of-bounds body locally, before any outbound
 * call; the response-guard drift-gate tuples (compile-time checks in the module under
 * test, not a runtime case); the unconditional-204 delete contract (no `notFound`
 * branch, matching the api exactly).
 */

vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/** DELIBERATELY NOT mocked, mirroring the established reasoning: `lib/env.ts`'s
 *  `NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000` when unset, and vitest loads
 *  no `.env`, so the real `getSiteUrl()` resolves to this value in every test process —
 *  exercising it for real is what makes the Origin assertions honest. */
const SITE_URL = "http://localhost:3000";

const MEASUREMENT_ID = "018f2f3a-9c3e-7b2a-8b9d-2e6f1a7c9d40";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function measurementBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: MEASUREMENT_ID,
    type: "distance",
    points: [
      { lon: 32.85, lat: 39.92 },
      { lon: 29.0, lat: 41.0 },
    ],
    title: "İstanbul - Ankara mesafesi",
    clientMeasurementId: "018f2f3a-0000-0000-0000-000000000000",
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
    ...overrides,
  };
}

function validCreatePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "distance",
    points: [
      { lon: 32.85, lat: 39.92 },
      { lon: 29.0, lat: 41.0 },
    ],
    clientMeasurementId: "018f2f3a-0000-0000-0000-000000000000",
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

describe("isMeasurementIdShape", () => {
  it("accepts a well-formed UUID, any case", () => {
    expect(isMeasurementIdShape(MEASUREMENT_ID)).toBe(true);
    expect(isMeasurementIdShape(MEASUREMENT_ID.toUpperCase())).toBe(true);
  });

  it("rejects an unshapely value", () => {
    expect(isMeasurementIdShape("not-a-uuid")).toBe(false);
    expect(isMeasurementIdShape("")).toBe(false);
    expect(isMeasurementIdShape("018f2f3a-9c3e-7b2a-8b9d")).toBe(false);
  });
});

describe("T1 — GET (list): no cookie is a short-circuit (401, zero outbound calls)", () => {
  it("never calls fetch when cg_access is absent", async () => {
    const mock = fetchMock();
    const result = await handleListMeasurements(makeRequest("GET", "/api/measurements"));
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T2 — GET (list): a 200 is passed through, flattened into the ok body", () => {
  it("parses and forwards the api's own measurements", async () => {
    const mock = fetchMock();
    const item = measurementBody();
    mock.mockResolvedValue(jsonResponse(200, [item]));
    const result = await handleListMeasurements(
      makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, measurements: [item] });
  });

  it("an empty list is passed through as an empty array", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, []));
    const result = await handleListMeasurements(
      makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, measurements: [] });
  });

  it("attaches the Authorization bearer header from the access cookie", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, []));
    await handleListMeasurements(
      makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=SENTINEL-TOKEN` }),
    );
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SENTINEL-TOKEN");
  });
});

describe("T3 — GET (list): a non-OK api response is passed through, mapped by status", () => {
  it("a genuine api 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleListMeasurements(
      makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a 5xx collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleListMeasurements(
      makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(502);
  });

  it("a network failure also collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleListMeasurements(
      makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(502);
  });

  it("a 200 body that fails the response guard also collapses to unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, { not: "a list" }));
    const result = await handleListMeasurements(
      makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(502);
  });
});

describe("T4 — POST (create): Origin is required and checked", () => {
  it("a missing Origin -> 403, zero outbound calls", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.forbidden" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("a different Origin -> 403", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: "https://evil.example",
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
  });

  it("the matching Origin proceeds", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, measurementBody()));
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(200);
  });
});

describe("T5 — POST (create): no cookie is a short-circuit (401, zero outbound calls) — checked AFTER Origin", () => {
  it("never calls fetch when cg_access is absent, even with a valid Origin", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T6 — POST (create): the request-side schema rejects a bad body BEFORE any api call", () => {
  it("a malformed (non-JSON) body never reaches the api", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: "{not json",
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it("an out-of-range point (lat > 90) is rejected locally, never forwarded", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(
          validCreatePayload({
            points: [
              { lon: 0, lat: 91 },
              { lon: 1, lat: 1 },
            ],
          }),
        ),
      }),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("more than 20 points is rejected locally", async () => {
    const mock = fetchMock();
    const points = Array.from({ length: 21 }, (_, i) => ({ lon: i, lat: 0 }));
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload({ points })),
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it("a clientMeasurementId with an illegal character is rejected locally", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload({ clientMeasurementId: "not valid!" })),
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it("a title over 200 chars is rejected locally", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload({ title: "x".repeat(201) })),
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it("title omitted entirely is accepted and forwarded without a title key", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, measurementBody()));
    const payload = validCreatePayload();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(payload),
      }),
    );
    expect(result.status).toBe(200);
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    const forwarded = JSON.parse(init.body as string) as Record<string, unknown>;
    expect("title" in forwarded).toBe(false);
  });

  it("an invalid type enum value is rejected locally", async () => {
    const mock = fetchMock();
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload({ type: "polygon" })),
      }),
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T7 — POST (create): a non-OK api response is passed through, mapped by status", () => {
  it("a genuine 400 maps to errors.measurements.invalidShape", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(400));
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.measurements.invalidShape" });
  });

  it("a genuine 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a genuine 403 maps to errors.measurements.quotaExceeded", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(403));
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, code: "errors.measurements.quotaExceeded" });
  });

  it("a 5xx collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(validCreatePayload()),
      }),
    );
    expect(result.status).toBe(502);
  });

  it("the idempotent-retry contract: resubmitting returns whatever the api answers, unmodified by this proxy", async () => {
    const mock = fetchMock();
    const original = measurementBody({ title: "original" });
    mock.mockResolvedValue(jsonResponse(200, original));
    const payload = validCreatePayload({ title: "a differing resubmit title" });
    const result = await handleCreateMeasurement(
      makeRequest("POST", "/api/measurements", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
        body: JSON.stringify(payload),
      }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, measurement: original });
  });
});

describe("T8 — DELETE: Origin is required and checked", () => {
  it("a missing Origin -> 403, zero outbound calls", async () => {
    const mock = fetchMock();
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`, {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      MEASUREMENT_ID,
    );
    expect(result.status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T9 — DELETE: an unshapely id is rejected locally, before Origin's own downstream cookie check", () => {
  it("a non-UUID id -> 400, zero outbound calls", async () => {
    const mock = fetchMock();
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", "/api/measurements/not-a-uuid", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      "not-a-uuid",
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T10 — DELETE: no cookie is a short-circuit (401, zero outbound calls)", () => {
  it("never calls fetch when cg_access is absent, even with a valid Origin and id", async () => {
    const mock = fetchMock();
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`, { origin: SITE_URL }),
      MEASUREMENT_ID,
    );
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T11 — DELETE: the api's own 204 is unconditional — no notFound branch exists", () => {
  it("a genuine 204 (existed and removed) passes through as ok:true", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(204));
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      MEASUREMENT_ID,
    );
    expect(result.status).toBe(204);
    expect(result.body).toEqual({ ok: true });
  });

  it("the api's own 204 for a never-existed or another caller's id is identical — this proxy never distinguishes them", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(204));
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      MEASUREMENT_ID,
    );
    expect(result.status).toBe(204);
    expect(result.body).toEqual({ ok: true });
  });

  it("a genuine api 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      MEASUREMENT_ID,
    );
    expect(result.status).toBe(401);
  });

  it("a 5xx collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      MEASUREMENT_ID,
    );
    expect(result.status).toBe(502);
  });

  it("a network failure collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleDeleteMeasurement(
      makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`, {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      MEASUREMENT_ID,
    );
    expect(result.status).toBe(502);
  });
});

describe("T12 — Cache-Control: no-store on every branch", () => {
  it.each([
    [
      "GET (list), no cookie",
      () => handleListMeasurements(makeRequest("GET", "/api/measurements")),
    ],
    [
      "GET (list), api 200",
      async () => {
        fetchMock().mockResolvedValue(jsonResponse(200, []));
        return handleListMeasurements(
          makeRequest("GET", "/api/measurements", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
        );
      },
    ],
    [
      "POST (create), no Origin",
      () =>
        handleCreateMeasurement(
          makeRequest("POST", "/api/measurements", { body: JSON.stringify(validCreatePayload()) }),
        ),
    ],
    [
      "DELETE, no Origin",
      () =>
        handleDeleteMeasurement(
          makeRequest("DELETE", `/api/measurements/${MEASUREMENT_ID}`),
          MEASUREMENT_ID,
        ),
    ],
  ])("%s", async (_label, run) => {
    const result = await run();
    expect(result.headers["Cache-Control"]).toBe("no-store");
  });
});
