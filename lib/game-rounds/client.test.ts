import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGameRounds, submitGameRound } from "./client";

const ROUND = {
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
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchGameRounds", () => {
  it("a well-formed 200 resolves the round list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            page: 1,
            pageSize: 5,
            total: 1,
            hasMore: false,
            items: [ROUND],
          }),
        ),
      ),
    );
    await expect(fetchGameRounds(1, 5, new AbortController().signal)).resolves.toEqual([ROUND]);
  });

  it("an empty list resolves an empty array, not null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            page: 1,
            pageSize: 5,
            total: 0,
            hasMore: false,
            items: [],
          }),
        ),
      ),
    );
    await expect(fetchGameRounds(1, 5, new AbortController().signal)).resolves.toEqual([]);
  });

  it("a 401 (anonymous/session gone) resolves null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(fetchGameRounds(1, 5, new AbortController().signal)).resolves.toBeNull();
  });

  it("a network failure resolves null, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(fetchGameRounds(1, 5, new AbortController().signal)).resolves.toBeNull();
  });

  it("a malformed 200 body (unchecked network input) resolves null rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(fetchGameRounds(1, 5, new AbortController().signal)).resolves.toBeNull();
  });

  it("a malformed item inside an otherwise well-formed list resolves null for the whole list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            page: 1,
            pageSize: 5,
            total: 1,
            hasMore: false,
            items: [{ mode: "provinces" /* missing every other field */ }],
          }),
        ),
      ),
    );
    await expect(fetchGameRounds(1, 5, new AbortController().signal)).resolves.toBeNull();
  });

  it("sends the same-origin/no-store contract with the requested page/pageSize", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, { ok: true, page: 1, pageSize: 5, total: 0, hasMore: false, items: [] }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchGameRounds(1, 5, new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game-rounds?page=1&pageSize=5",
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
    );
  });
});

describe("submitGameRound", () => {
  const payload = {
    mode: "provinces",
    clientRoundId: ROUND.clientRoundId,
    score: 87,
    found: 70,
    firstTry: 60,
    total: 81,
    poolTotal: 81,
    totalWrongs: 12,
    endedEarly: false,
  };

  it("POSTs the payload and resolves the saved round on a 200", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, round: ROUND })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitGameRound(payload)).resolves.toEqual({ ok: true, round: ROUND });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game-rounds",
      expect.objectContaining({ method: "POST", credentials: "same-origin", cache: "no-store" }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("maps a 429 to the rate-limited code, distinct from a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 429 }))),
    );
    await expect(submitGameRound(payload)).resolves.toEqual({ ok: false, code: "rate-limited" });
  });

  it("maps any other non-200 to a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 400 }))),
    );
    await expect(submitGameRound(payload)).resolves.toEqual({ ok: false, code: "failed" });
  });

  it("maps a network failure to a generic failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(submitGameRound(payload)).resolves.toEqual({ ok: false, code: "failed" });
  });

  it("maps a malformed 200 body to a generic failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(submitGameRound(payload)).resolves.toEqual({ ok: false, code: "failed" });
  });

  it("carries its own AbortController — the deliberate divergence from the two existing write precedents (plan §2.4/Product judgment call 3)", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, round: ROUND })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await submitGameRound(payload);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("carries no keepalive — a discrete click, not a teardown/tab-hide save", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, round: ROUND })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await submitGameRound(payload);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBeUndefined();
  });
});
