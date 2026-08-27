import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  handleDeleteFavorite,
  handleListFavorites,
  handlePutFavorite,
  isIsoCodeShape,
  isPlateCodeShape,
} from "./transport.server";

/**
 * T-numbered in the style `lib/video-progress/transport.server.test.ts` already established
 * for this repo's BFF-proxy layer (UYELIK-08 plan §11): no-cookie → 401 with no outbound
 * call; a non-OK api response passed through by status; `Cache-Control: no-store` on every
 * branch; Origin required and checked on `PUT`/`DELETE` only, never on the list `GET`; the
 * response-guard drift-gate tuple (a compile-time check — `_favoriteShapeAgreesWithContract`
 * in the module under test — not a runtime case, the same posture the module itself takes
 * for its own drift gate).
 */

vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/** DELIBERATELY NOT mocked, mirroring `lib/video-progress/transport.server.test.ts`'s own
 *  reasoning: `lib/env.ts`'s `NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000` when
 *  unset, and vitest loads no `.env`, so the real `getSiteUrl()` resolves to this value in
 *  every test process — exercising it for real is what makes the Origin assertions honest. */
const SITE_URL = "http://localhost:3000";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function favoriteBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "province",
    plateCode: "34",
    isoCode: null,
    createdAt: "2026-08-27T10:00:00.000Z",
    ...overrides,
  };
}

interface RequestOptions {
  origin?: string | null;
  cookie?: string;
}

function makeRequest(method: string, path: string, opts: RequestOptions = {}): Request {
  const headers = new Headers();
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.cookie) headers.set("cookie", opts.cookie);
  return new Request(`${SITE_URL}${path}`, { method, headers });
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

describe("isPlateCodeShape", () => {
  it("accepts a two-digit plate code", () => {
    expect(isPlateCodeShape("34")).toBe(true);
    expect(isPlateCodeShape("06")).toBe(true);
  });
  it("rejects an isoCode-shaped value, a single digit, and an empty string", () => {
    expect(isPlateCodeShape("TR")).toBe(false);
    expect(isPlateCodeShape("6")).toBe(false);
    expect(isPlateCodeShape("")).toBe(false);
  });
});

describe("isIsoCodeShape", () => {
  it("accepts a two-letter uppercase iso code", () => {
    expect(isIsoCodeShape("TR")).toBe(true);
    expect(isIsoCodeShape("US")).toBe(true);
  });
  it("rejects a plateCode-shaped value, lowercase letters, and an empty string", () => {
    expect(isIsoCodeShape("34")).toBe(false);
    expect(isIsoCodeShape("tr")).toBe(false);
    expect(isIsoCodeShape("")).toBe(false);
  });
});

describe("T1 — GET /api/favorites: no cookie is a short-circuit (401, zero outbound calls)", () => {
  it("never calls fetch when cg_access is absent", async () => {
    const mock = fetchMock();
    const result = await handleListFavorites(makeRequest("GET", "/api/favorites"));
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T2 — GET: a 200 is passed through as { ok: true, favorites }", () => {
  it("parses and forwards the api's favorites array", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, [
        favoriteBody(),
        favoriteBody({ type: "country", plateCode: null, isoCode: "TR" }),
      ]),
    );
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      favorites: [
        favoriteBody(),
        favoriteBody({ type: "country", plateCode: null, isoCode: "TR" }),
      ],
    });
  });

  it("an empty list is a valid 200", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, []));
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, favorites: [] });
  });

  it("attaches the Authorization bearer header from the access cookie", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, []));
    await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=SENTINEL-TOKEN` }),
    );
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SENTINEL-TOKEN");
  });
});

describe("T3 — GET: a non-OK api response is passed through, mapped by status", () => {
  it("a genuine api 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a 5xx (or any unmapped status) collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });

  it("a network failure also collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(502);
  });

  it("a 200 body that fails the response guard also collapses to unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, [{ not: "a favorite row" }]));
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });
});

describe("T4 — GET carries no Origin check (read-only, not state-changing)", () => {
  it("proceeds with no Origin header at all", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, []));
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
    );
    expect(result.status).toBe(200);
    expect(mock).toHaveBeenCalled();
  });
});

describe("T5 — PUT/DELETE: an unshapely route param is refused before any api call", () => {
  it("PUT province: a non-two-digit plateCode -> 400, zero outbound calls", async () => {
    const mock = fetchMock();
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/not-a-code", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "not-a-code" },
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("DELETE country: a lowercase isoCode -> 400, zero outbound calls", async () => {
    const mock = fetchMock();
    const result = await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/countries/tr", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "country", isoCode: "tr" },
    );
    expect(result.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T6 — PUT/DELETE: Origin is required and checked, before shape/cookie", () => {
  // TA91-M1 fix (PR #91 round 2 review): both params below are genuinely UNSHAPELY
  // ("not-a-code" / "tr" lowercase both fail their own shape predicate) — the title's own
  // claim ("even with an unshapely param") previously used a VALID-shaped param ("34"/"TR"),
  // so the ordering these two tests claim to prove (Origin checked BEFORE shape) was never
  // actually exercised; a shape-first implementation would have passed the old assertions
  // too, since a missing Origin alone already forces a 403 regardless of ordering. A
  // deliberately malformed param makes the two orderings observably different: shape-first
  // would 400, not 403.
  it("PUT: a missing Origin -> 403, zero outbound calls (even with an unshapely param)", async () => {
    const mock = fetchMock();
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/not-a-code", {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "not-a-code" },
    );
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.forbidden" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("PUT: a different Origin -> 403", async () => {
    const mock = fetchMock();
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", {
        origin: "https://evil.example",
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
  });

  it("DELETE: a missing Origin -> 403, zero outbound calls (even with an unshapely param)", async () => {
    const mock = fetchMock();
    const result = await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/countries/tr", {
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "country", isoCode: "tr" },
    );
    expect(result.status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
  });

  it("PUT: the matching Origin proceeds", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, favoriteBody()));
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(200);
  });
});

describe("T7 — PUT/DELETE: no cookie is a short-circuit (401, zero outbound calls) — checked AFTER Origin/shape", () => {
  it("PUT: never calls fetch when cg_access is absent, even with a valid Origin and shape", async () => {
    const mock = fetchMock();
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", { origin: SITE_URL }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });

  it("DELETE: never calls fetch when cg_access is absent", async () => {
    const mock = fetchMock();
    const result = await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/countries/TR", { origin: SITE_URL }),
      { kind: "country", isoCode: "TR" },
    );
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("T8 — PUT: outbound path/method, and a non-OK api response mapped by status", () => {
  it("sends a bodyless PUT to the province path", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, favoriteBody()));
    await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/favorites/provinces/34");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeUndefined();
  });

  it("sends a bodyless PUT to the country path", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(
      jsonResponse(200, favoriteBody({ type: "country", plateCode: null, isoCode: "TR" })),
    );
    await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/countries/TR", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "country", isoCode: "TR" },
    );
    const [url] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/favorites/countries/TR");
  });

  it("a 200 body that fails the response guard collapses to unavailable, never a cookie-less 200", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(jsonResponse(200, { not: "a favorite" }));
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });

  it("a genuine api 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a 404 maps to provinceNotFound for a province target", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(404));
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/99", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "99" },
    );
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ ok: false, code: "errors.favorites.provinceNotFound" });
  });

  it("a 404 maps to countryNotFound for a country target (not the province code)", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(404));
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/countries/ZZ", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "country", isoCode: "ZZ" },
    );
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ ok: false, code: "errors.favorites.countryNotFound" });
  });

  it("a 5xx collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(502);
  });
});

describe("T9 — DELETE: 204 unconditionally, never a not-found branch", () => {
  it("a 204 resolves { ok: true }, with no body to parse", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(204));
    const result = await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(204);
    expect(result.body).toEqual({ ok: true });
  });

  it("sends a bodyless DELETE to the matching path", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(204));
    await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/countries/TR", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "country", isoCode: "TR" },
    );
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/favorites/countries/TR");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("a genuine api 401 clears to errors.auth.unauthenticated", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(401));
    const result = await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
  });

  it("a 5xx (or any unmapped status, e.g. a stray 200) collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockResolvedValue(emptyResponse(500));
    const result = await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });

  it("a network failure also collapses to errors.transport.unavailable", async () => {
    const mock = fetchMock();
    mock.mockRejectedValue(new TypeError("network down"));
    const result = await handleDeleteFavorite(
      makeRequest("DELETE", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=token`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(502);
  });
});

describe("T10 — Cache-Control: no-store on every branch", () => {
  it.each([
    ["GET, no cookie", () => handleListFavorites(makeRequest("GET", "/api/favorites"))],
    [
      "GET, api 200",
      async () => {
        fetchMock().mockResolvedValue(jsonResponse(200, []));
        return handleListFavorites(
          makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=token` }),
        );
      },
    ],
    [
      "PUT, no Origin",
      () =>
        handlePutFavorite(makeRequest("PUT", "/api/favorites/provinces/34"), {
          kind: "province",
          plateCode: "34",
        }),
    ],
    [
      "DELETE, no Origin",
      () =>
        handleDeleteFavorite(makeRequest("DELETE", "/api/favorites/countries/TR"), {
          kind: "country",
          isoCode: "TR",
        }),
    ],
  ] as const)("%s", async (_label, run) => {
    const result = await run();
    expect(result.headers["Cache-Control"]).toBe("no-store");
  });
});

describe("T11 — readCookieValue: a malformed percent-encoded cookie value never throws (TA91-M2 fix, PR #91 round 2)", () => {
  it("GET: a malformed cg_access value is treated as absent (401), never an uncaught decode exception", async () => {
    const mock = fetchMock();
    const result = await handleListFavorites(
      makeRequest("GET", "/api/favorites", { cookie: `${ACCESS_COOKIE_NAME}=%` }),
    );
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, code: "errors.auth.unauthenticated" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("PUT: same malformed value, same outcome — 401, zero outbound calls, no throw", async () => {
    const mock = fetchMock();
    const result = await handlePutFavorite(
      makeRequest("PUT", "/api/favorites/provinces/34", {
        origin: SITE_URL,
        cookie: `${ACCESS_COOKIE_NAME}=%`,
      }),
      { kind: "province", plateCode: "34" },
    );
    expect(result.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
});
