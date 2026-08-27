import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWatchedTogglePayload, fetchVideoProgress, saveVideoProgress } from "./client";

const BOOK_VIDEO_ID = "11111111-2222-4333-8444-555555555555";

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

describe("fetchVideoProgress", () => {
  it("a well-formed 200 resolves the progress value", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            progress: {
              bookVideoId: BOOK_VIDEO_ID,
              lastPositionSeconds: 204,
              watched: false,
              watchedAt: null,
              updatedAt: "2026-08-27T10:00:00.000Z",
            },
          }),
        ),
      ),
    );
    await expect(fetchVideoProgress(BOOK_VIDEO_ID, new AbortController().signal)).resolves.toEqual({
      lastPositionSeconds: 204,
      watched: false,
      watchedAt: null,
    });
  });

  it("a 404 (no saved progress yet) resolves null, not an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );
    await expect(
      fetchVideoProgress(BOOK_VIDEO_ID, new AbortController().signal),
    ).resolves.toBeNull();
  });

  it("a 401 (session gone) resolves null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(
      fetchVideoProgress(BOOK_VIDEO_ID, new AbortController().signal),
    ).resolves.toBeNull();
  });

  it("a network failure resolves null, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(
      fetchVideoProgress(BOOK_VIDEO_ID, new AbortController().signal),
    ).resolves.toBeNull();
  });

  it("a malformed 200 body (unchecked network input) resolves null rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(
      fetchVideoProgress(BOOK_VIDEO_ID, new AbortController().signal),
    ).resolves.toBeNull();
  });

  it("sends the same-origin/no-store contract", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          ok: true,
          progress: {
            bookVideoId: BOOK_VIDEO_ID,
            lastPositionSeconds: 0,
            watched: false,
            watchedAt: null,
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchVideoProgress(BOOK_VIDEO_ID, new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/video-progress/${BOOK_VIDEO_ID}`,
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
    );
  });
});

describe("saveVideoProgress", () => {
  it("PUTs the payload and reports ok on a 200", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        jsonResponse(200, {
          ok: true,
          progress: {
            bookVideoId: BOOK_VIDEO_ID,
            lastPositionSeconds: 30,
            watched: true,
            watchedAt: "2026-08-27T10:00:00.000Z",
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      saveVideoProgress(BOOK_VIDEO_ID, { lastPositionSeconds: 30, watched: true }),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/video-progress/${BOOK_VIDEO_ID}`,
      expect.objectContaining({ method: "PUT", credentials: "same-origin", cache: "no-store" }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ lastPositionSeconds: 30, watched: true });
  });

  it("reports not-ok on a non-200, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
    await expect(
      saveVideoProgress(BOOK_VIDEO_ID, { lastPositionSeconds: 30, watched: true }),
    ).resolves.toEqual({ ok: false });
  });

  it("reports not-ok on a network failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(
      saveVideoProgress(BOOK_VIDEO_ID, { lastPositionSeconds: 30, watched: true }),
    ).resolves.toEqual({ ok: false });
  });

  it("passes keepalive through for the tab-hide save trigger", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveVideoProgress(
      BOOK_VIDEO_ID,
      { lastPositionSeconds: 5, watched: false },
      { keepalive: true },
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
  });

  it("defaults keepalive to false for the periodic/pause saves", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await saveVideoProgress(BOOK_VIDEO_ID, { lastPositionSeconds: 5, watched: false });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(false);
  });
});

describe("buildWatchedTogglePayload — the full-state-replace hazard (§5.6)", () => {
  it("carries the current position forward when toggling watched ON", () => {
    expect(buildWatchedTogglePayload({ lastPositionSeconds: 245 }, true)).toEqual({
      lastPositionSeconds: 245,
      watched: true,
    });
  });

  it("carries the current position forward when toggling watched OFF", () => {
    expect(buildWatchedTogglePayload({ lastPositionSeconds: 245 }, false)).toEqual({
      lastPositionSeconds: 245,
      watched: false,
    });
  });

  it("defaults to 0 only when no progress row has ever been fetched", () => {
    expect(buildWatchedTogglePayload(null, true)).toEqual({
      lastPositionSeconds: 0,
      watched: true,
    });
  });

  it("never omits either field, for any input", () => {
    for (const current of [null, { lastPositionSeconds: 0 }, { lastPositionSeconds: 900 }]) {
      for (const nextWatched of [true, false]) {
        const result = buildWatchedTogglePayload(current, nextWatched);
        expect(Object.keys(result).sort()).toEqual(["lastPositionSeconds", "watched"]);
      }
    }
  });

  it(
    "never sends a bare { watched } — the naive partial-update shape the hazard names, " +
      "which would implicitly zero a real saved position",
    () => {
      const result: Record<string, unknown> = buildWatchedTogglePayload(
        { lastPositionSeconds: 500 },
        true,
      );
      expect(result).not.toEqual({ watched: true });
      expect(result.lastPositionSeconds).toBe(500);
    },
  );
});
