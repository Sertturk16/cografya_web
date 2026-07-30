import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Structural guards for storage's BROWSER layer — the half `storage.test.ts` deliberately
 * does not touch (that file tests the pure parse/serialize/merge functions).
 *
 * What is under test is the persistence CONTRACT the SPEC promises (§5.5) and the island
 * depends on: progress survives a reload, the module cache and the subscribers stay in
 * step with it, the "delete the record in this browser" control really empties both, and a
 * blocked or full `localStorage` (private mode, a browser policy, quota) degrades to
 * "the game forgets" instead of throwing inside the island's mount.
 *
 * No jsdom: `storage.ts` only ever reaches for `window.localStorage`, so a Map-backed fake
 * behind `vi.stubGlobal` is the whole environment it needs. The module is re-imported per
 * test because its progress cache is module-level by design — a shared instance would let
 * one test's cache answer the next test's read.
 */

type StorageMode = "ok" | "blocked";

/** Install a fake `window.localStorage` and hand back its backing store. */
function installStorage(mode: StorageMode = "ok"): Map<string, string> {
  const entries = new Map<string, string>();
  const fail = () => {
    // Both shapes a real browser throws: a blocked store (private mode / policy) and a
    // full one (quota). The module may not distinguish them — it may only not throw.
    throw new Error("storage unavailable");
  };
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => (mode === "blocked" ? fail() : (entries.get(key) ?? null)),
      setItem: (key: string, value: string) => {
        if (mode === "blocked") fail();
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        if (mode === "blocked") fail();
        entries.delete(key);
      },
    },
  });
  return entries;
}

/** A fresh module instance, so the module-level progress cache starts empty. */
async function loadStorage() {
  return import("./storage");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("read/write round trip", () => {
  it("writes progress under the versioned key and reads it back", async () => {
    const entries = installStorage();
    const { GAME_STORAGE_KEY, readGameProgress, writeGameProgress } = await loadStorage();

    writeGameProgress({ best: { provinces: 61 }, round: null });

    expect(entries.has(GAME_STORAGE_KEY)).toBe(true);
    expect(readGameProgress()).toEqual({ best: { provinces: 61 }, round: null });
  });

  it("degrades a foreign or corrupt entry to empty progress instead of throwing", async () => {
    const entries = installStorage();
    const { EMPTY_PROGRESS, GAME_STORAGE_KEY, readGameProgress } = await loadStorage();
    entries.set(GAME_STORAGE_KEY, "{not json");

    expect(readGameProgress()).toEqual(EMPTY_PROGRESS);
  });

  it("reads storage once per page load and then serves the cached snapshot", async () => {
    const entries = installStorage();
    const { GAME_STORAGE_KEY, getGameProgress } = await loadStorage();
    entries.set(GAME_STORAGE_KEY, JSON.stringify({ best: { regions: 30 }, round: null }));

    const first = getGameProgress();
    entries.set(GAME_STORAGE_KEY, JSON.stringify({ best: { regions: 99 }, round: null }));

    // Same object identity: `useSyncExternalStore` re-renders on snapshot identity, so a
    // fresh object per call would re-render forever.
    expect(getGameProgress()).toBe(first);
    expect(getGameProgress().best.regions).toBe(30);
  });

  it("has no server snapshot to leak — the island never renders on the server", async () => {
    installStorage();
    const { EMPTY_PROGRESS, getServerGameProgress } = await loadStorage();

    expect(getServerGameProgress()).toBe(EMPTY_PROGRESS);
  });
});

describe("subscribers", () => {
  it("notifies on a write and stops after unsubscribing", async () => {
    installStorage();
    const { setGameProgress, subscribeGameProgress } = await loadStorage();
    let calls = 0;
    const unsubscribe = subscribeGameProgress(() => {
      calls += 1;
    });

    setGameProgress({ best: { regions: 12 }, round: null });
    expect(calls).toBe(1);

    unsubscribe();
    setGameProgress({ best: { regions: 34 }, round: null });
    expect(calls).toBe(1);
  });

  it("keeps the cache, the store and the subscribers in step on every write", async () => {
    const entries = installStorage();
    const { GAME_STORAGE_KEY, getGameProgress, setGameProgress, subscribeGameProgress } =
      await loadStorage();
    let seen = 0;
    subscribeGameProgress(() => {
      seen += 1;
    });

    const next = { best: { provinces: 77 }, round: null };
    setGameProgress(next);

    expect(seen).toBe(1);
    expect(getGameProgress()).toBe(next);
    expect(JSON.parse(entries.get(GAME_STORAGE_KEY) ?? "null")).toEqual({
      best: { provinces: 77 },
      round: null,
    });
  });
});

describe('"delete the record in this browser"', () => {
  it("empties the store AND the cache, so nothing stale survives the click", async () => {
    const entries = installStorage();
    const {
      clearGameProgress,
      EMPTY_PROGRESS,
      GAME_STORAGE_KEY,
      getGameProgress,
      setGameProgress,
    } = await loadStorage();
    setGameProgress({ best: { provinces: 88 }, round: null });

    clearGameProgress();

    expect(entries.has(GAME_STORAGE_KEY)).toBe(false);
    // The cache reset is the load-bearing half: without it the island would keep reporting
    // the deleted best score until a full reload, while storage was genuinely empty.
    expect(getGameProgress()).toBe(EMPTY_PROGRESS);
  });

  it("tells the subscribers, so the open island repaints", async () => {
    installStorage();
    const { clearGameProgress, subscribeGameProgress } = await loadStorage();
    let calls = 0;
    subscribeGameProgress(() => {
      calls += 1;
    });

    clearGameProgress();

    expect(calls).toBe(1);
  });
});

describe("blocked or full storage", () => {
  it("reads as empty progress rather than throwing on mount", async () => {
    installStorage("blocked");
    const { EMPTY_PROGRESS, readGameProgress } = await loadStorage();

    expect(readGameProgress()).toEqual(EMPTY_PROGRESS);
  });

  it("swallows a failed write — persistence is a convenience, never a precondition", async () => {
    installStorage("blocked");
    const { writeGameProgress } = await loadStorage();

    expect(() => {
      writeGameProgress({ best: { regions: 55 }, round: null });
    }).not.toThrow();
  });

  it("still plays: a full round of writes and reads never throws", async () => {
    installStorage("blocked");
    const { getGameProgress, setGameProgress } = await loadStorage();

    const next = { best: { provinces: 5 }, round: null };
    expect(() => {
      setGameProgress(next);
    }).not.toThrow();
    // The in-memory half keeps working, so the round itself is unaffected by the failure.
    expect(getGameProgress()).toBe(next);
  });

  it("still clears the cache when the delete cannot reach storage", async () => {
    installStorage("blocked");
    const { clearGameProgress, EMPTY_PROGRESS, getGameProgress, setGameProgress } =
      await loadStorage();
    setGameProgress({ best: { provinces: 9 }, round: null });

    expect(() => {
      clearGameProgress();
    }).not.toThrow();
    expect(getGameProgress()).toBe(EMPTY_PROGRESS);
  });
});
