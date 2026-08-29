import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthSessionStore } from "./use-session.client";

/**
 * `createAuthSessionStore()` unit tests (uyelik-auth-redesign plan §11.2), the
 * `active-video.test.ts` pattern: each case builds its own instance — no shared state, no
 * reset hatch on the shipped surface. `useAuthSession` itself cannot be rendered in this
 * repo's `node`-only vitest environment (no jsdom, `FU-WEB-JSDOM`); the store is the unit that
 * can be exercised directly.
 */

function statusOnlyResponse(status: number): Response {
  return new Response(null, { status });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createAuthSessionStore", () => {
  it("starts at checking, on the server and on the client", () => {
    const store = createAuthSessionStore();
    expect(store.getSnapshot()).toBe("checking");
    expect(store.getServerSnapshot()).toBe("checking");
  });

  it("getServerSnapshot is ALWAYS checking, even after the client store has moved (K2)", () => {
    const store = createAuthSessionStore();
    store.set("authenticated");
    expect(store.getSnapshot()).toBe("authenticated");
    expect(store.getServerSnapshot()).toBe("checking");
  });

  it("returns the SAME snapshot value while nothing changes — a stable string primitive under useSyncExternalStore", () => {
    const store = createAuthSessionStore();
    const first = store.getSnapshot();
    const second = store.getSnapshot();
    expect(first).toBe(second);
    store.set("anonymous");
    expect(store.getSnapshot()).toBe("anonymous");
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("N subscribers calling ensureFetched produce exactly ONE fetch (K1)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(statusOnlyResponse(200)));
    vi.stubGlobal("fetch", fetchMock);

    const store = createAuthSessionStore();
    store.ensureFetched();
    store.ensureFetched();
    store.ensureFetched();
    await vi.waitFor(() => expect(store.getSnapshot()).toBe("authenticated"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a second ensureFetched call after the first fetch has settled starts a NEW request (not permanently latched)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(statusOnlyResponse(200)));
    vi.stubGlobal("fetch", fetchMock);

    const store = createAuthSessionStore();
    store.ensureFetched();
    await vi.waitFor(() => expect(store.getSnapshot()).toBe("authenticated"));
    store.ensureFetched();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("set() notifies every subscriber", () => {
    const store = createAuthSessionStore();
    let calls = 0;
    const unsubscribeA = store.subscribe(() => {
      calls += 1;
    });
    const unsubscribeB = store.subscribe(() => {
      calls += 1;
    });
    store.set("authenticated");
    expect(calls).toBe(2);
    unsubscribeA();
    unsubscribeB();
  });

  it("set() notifies nothing when the value does not actually change", () => {
    const store = createAuthSessionStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.set("checking"); // already the starting value
    expect(calls).toBe(0);
    store.set("authenticated");
    expect(calls).toBe(1);
    store.set("authenticated"); // no-op, same value
    expect(calls).toBe(1);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = createAuthSessionStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.set("authenticated");
    expect(calls).toBe(1);
    unsubscribe();
    store.set("anonymous");
    expect(calls).toBe(1);
  });

  it("invalidate() drops to checking and starts a fresh fetch", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(statusOnlyResponse(200)));
    vi.stubGlobal("fetch", fetchMock);

    const store = createAuthSessionStore();
    store.set("authenticated");
    let sawChecking = false;
    store.subscribe(() => {
      if (store.getSnapshot() === "checking") sawChecking = true;
    });
    store.invalidate();
    expect(sawChecking).toBe(true);
    expect(store.getSnapshot()).toBe("checking");
    await vi.waitFor(() => expect(store.getSnapshot()).toBe("authenticated"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a network failure resolves to anonymous, mirroring fetchAuthSessionState's own contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    const store = createAuthSessionStore();
    store.ensureFetched();
    await vi.waitFor(() => expect(store.getSnapshot()).toBe("anonymous"));
  });
});
