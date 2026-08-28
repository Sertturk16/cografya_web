import { afterEach, describe, expect, it, vi } from "vitest";
import { FAVORITES_FETCH_TIMEOUT_MS, fetchFavorites, removeFavorite, saveFavorite } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A `fetch` that connects and never answers, exposing the signal it was handed — the same
 *  shape `lib/auth/submit.client.test.ts`'s own `stubHangingFetch` uses for `submitAuth`'s
 *  identical request budget (`CODE91-M1`). */
function stubHangingFetch(): { signal: () => AbortSignal | undefined } {
  let captured: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      captured = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }),
  );
  return { signal: () => captured };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchFavorites", () => {
  it("a well-formed 200 resolves the favorites array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            favorites: [
              {
                type: "province",
                plateCode: "34",
                isoCode: null,
                createdAt: "2026-08-27T10:00:00.000Z",
              },
              {
                type: "country",
                plateCode: null,
                isoCode: "TR",
                createdAt: "2026-08-27T09:00:00.000Z",
              },
            ],
          }),
        ),
      ),
    );
    await expect(fetchFavorites(new AbortController().signal)).resolves.toEqual([
      { type: "province", plateCode: "34", isoCode: null },
      { type: "country", plateCode: null, isoCode: "TR" },
    ]);
  });

  it("an empty list resolves an empty array, not null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true, favorites: [] }))),
    );
    await expect(fetchFavorites(new AbortController().signal)).resolves.toEqual([]);
  });

  it("a 401 (session gone) resolves null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(fetchFavorites(new AbortController().signal)).resolves.toBeNull();
  });

  it("a network failure resolves null, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(fetchFavorites(new AbortController().signal)).resolves.toBeNull();
  });

  it("a malformed 200 body (unchecked network input) resolves null rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(fetchFavorites(new AbortController().signal)).resolves.toBeNull();
  });

  it("a 200 body carrying one malformed row resolves null for the whole list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            favorites: [
              { type: "province", plateCode: "34", isoCode: null },
              { not: "a favorite" },
            ],
          }),
        ),
      ),
    );
    await expect(fetchFavorites(new AbortController().signal)).resolves.toBeNull();
  });

  it("sends the same-origin/no-store contract", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true, favorites: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchFavorites(new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/favorites",
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
    );
  });
});

describe("saveFavorite", () => {
  it("PUTs to the province path and reports ok on a 200, with no request body", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, favorite: {} })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(saveFavorite({ kind: "province", plateCode: "34" })).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/favorites/provinces/34",
      expect.objectContaining({ method: "PUT", credentials: "same-origin", cache: "no-store" }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it("PUTs to the country path", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, favorite: {} })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveFavorite({ kind: "country", isoCode: "TR" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/favorites/countries/TR",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("reports not-ok on a non-200, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(saveFavorite({ kind: "province", plateCode: "34" })).resolves.toEqual({
      ok: false,
    });
  });

  it("reports not-ok on a network failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(saveFavorite({ kind: "province", plateCode: "34" })).resolves.toEqual({
      ok: false,
    });
  });

  it("never sends a keepalive flag — a discrete click, not a teardown save", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(200, { ok: true, favorite: {} })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveFavorite({ kind: "province", plateCode: "34" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBeUndefined();
  });

  describe("request budget (CODE91-M1 — the write previously carried no timeout at all)", () => {
    it("hands fetch an abort signal that is still open when the request starts", async () => {
      vi.useFakeTimers();
      const stub = stubHangingFetch();
      const pending = saveFavorite({ kind: "province", plateCode: "34" });

      await vi.advanceTimersByTimeAsync(FAVORITES_FETCH_TIMEOUT_MS - 1);
      expect(stub.signal()?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(2);
      await pending;
    });

    it("aborts a request that never answers and resolves ok:false rather than hanging forever", async () => {
      vi.useFakeTimers();
      stubHangingFetch();

      const settled = expect(saveFavorite({ kind: "province", plateCode: "34" })).resolves.toEqual({
        ok: false,
      });

      await vi.advanceTimersByTimeAsync(FAVORITES_FETCH_TIMEOUT_MS);
      await settled;
    });

    it.each([
      ["a 200 success", () => Promise.resolve(jsonResponse(200, { ok: true, favorite: {} }))],
      ["a non-200", () => Promise.resolve(new Response(null, { status: 401 }))],
      ["a network failure", () => Promise.reject(new TypeError("network down"))],
    ] as const)(
      "leaves no pending timer after resolving — %s (finally-scoped clearTimeout, every path)",
      async (_label, respond) => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn(respond));
        await saveFavorite({ kind: "province", plateCode: "34" });
        expect(vi.getTimerCount()).toBe(0);
      },
    );

    it("uses an independent AbortController per call — no shared/module-level state, so concurrent calls cannot race each other's abort", async () => {
      const signals: (AbortSignal | undefined)[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init: RequestInit) => {
          signals.push(init.signal ?? undefined);
          return Promise.resolve(jsonResponse(200, { ok: true, favorite: {} }));
        }),
      );
      await Promise.all([
        saveFavorite({ kind: "province", plateCode: "34" }),
        saveFavorite({ kind: "country", isoCode: "TR" }),
      ]);
      expect(signals).toHaveLength(2);
      expect(signals[0]).toBeInstanceOf(AbortSignal);
      expect(signals[1]).toBeInstanceOf(AbortSignal);
      expect(signals[0]).not.toBe(signals[1]);
    });
  });
});

describe("removeFavorite", () => {
  it("DELETEs to the matching path and reports ok on a 204, with no request body", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(removeFavorite({ kind: "country", isoCode: "TR" })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/favorites/countries/TR",
      expect.objectContaining({ method: "DELETE", credentials: "same-origin", cache: "no-store" }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it("a 200 does NOT count as ok — the contract's own success status is 204, never 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );
    await expect(removeFavorite({ kind: "province", plateCode: "34" })).resolves.toEqual({
      ok: false,
    });
  });

  it("reports not-ok on a non-204, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(removeFavorite({ kind: "province", plateCode: "34" })).resolves.toEqual({
      ok: false,
    });
  });

  it("reports not-ok on a network failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(removeFavorite({ kind: "province", plateCode: "34" })).resolves.toEqual({
      ok: false,
    });
  });

  describe("request budget (CODE91-M1 — the write previously carried no timeout at all)", () => {
    it("hands fetch an abort signal that is still open when the request starts", async () => {
      vi.useFakeTimers();
      const stub = stubHangingFetch();
      const pending = removeFavorite({ kind: "country", isoCode: "TR" });

      await vi.advanceTimersByTimeAsync(FAVORITES_FETCH_TIMEOUT_MS - 1);
      expect(stub.signal()?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(2);
      await pending;
    });

    it("aborts a request that never answers and resolves ok:false rather than hanging forever", async () => {
      vi.useFakeTimers();
      stubHangingFetch();

      const settled = expect(removeFavorite({ kind: "country", isoCode: "TR" })).resolves.toEqual({
        ok: false,
      });

      await vi.advanceTimersByTimeAsync(FAVORITES_FETCH_TIMEOUT_MS);
      await settled;
    });

    it.each([
      ["a 204 success", () => Promise.resolve(new Response(null, { status: 204 }))],
      ["a non-204", () => Promise.resolve(new Response(null, { status: 401 }))],
      ["a network failure", () => Promise.reject(new TypeError("network down"))],
    ] as const)(
      "leaves no pending timer after resolving — %s (finally-scoped clearTimeout, every path)",
      async (_label, respond) => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn(respond));
        await removeFavorite({ kind: "country", isoCode: "TR" });
        expect(vi.getTimerCount()).toBe(0);
      },
    );

    it("uses an independent AbortController per call — no shared/module-level state, so concurrent calls cannot race each other's abort", async () => {
      const signals: (AbortSignal | undefined)[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init: RequestInit) => {
          signals.push(init.signal ?? undefined);
          return Promise.resolve(new Response(null, { status: 204 }));
        }),
      );
      await Promise.all([
        removeFavorite({ kind: "province", plateCode: "34" }),
        removeFavorite({ kind: "country", isoCode: "TR" }),
      ]);
      expect(signals).toHaveLength(2);
      expect(signals[0]).toBeInstanceOf(AbortSignal);
      expect(signals[1]).toBeInstanceOf(AbortSignal);
      expect(signals[0]).not.toBe(signals[1]);
    });
  });
});
