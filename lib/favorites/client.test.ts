import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFavorites, removeFavorite, saveFavorite } from "./client";

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
});
