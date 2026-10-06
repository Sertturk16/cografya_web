import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthIntent } from "./auth-modal.client";
import { AUTH_FETCH_TIMEOUT_MS } from "./submit.client";
import {
  type AuthSessionState,
  createAuthSessionStore,
  gateOnAuthSession,
  signInAgain,
} from "./use-session.client";

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

  it("anonymous visit with no cg_has_session cookie resolves directly to anonymous with ZERO fetch calls (UYE-P5, İRİS A14)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(statusOnlyResponse(200)));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "" });

    const store = createAuthSessionStore();
    store.ensureFetched();

    expect(store.getSnapshot()).toBe("anonymous");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authenticated visit with cg_has_session=1 calls fetch and resolves to authenticated", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(statusOnlyResponse(200)));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "cg_has_session=1" });

    const store = createAuthSessionStore();
    store.ensureFetched();

    await vi.waitFor(() => expect(store.getSnapshot()).toBe("authenticated"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("store.set updates cookie flag and notifies subscribers", () => {
    const fakeDoc = { cookie: "" };
    vi.stubGlobal("document", fakeDoc);

    const store = createAuthSessionStore();
    store.set("authenticated");
    expect(fakeDoc.cookie).toContain("cg_has_session=1");

    store.set("anonymous");
    expect(fakeDoc.cookie).toContain("max-age=0");
  });
});

/**
 * T-162: the store starts at `"checking"` and three gated controls (the game's "Turu Başlat",
 * the favourite heart, the video İzle) read that as "guest" and opened the auth dialog for a
 * reader who was signed in, so the dialog flipped to "Zaten Giriş Yaptın" and the action was lost.
 * `whenSettled()` and `gateOnAuthSession()` wait for the check instead.
 */
describe("whenSettled", () => {
  it("resolves at once with the settled state", async () => {
    const store = createAuthSessionStore();
    store.set("authenticated");
    await expect(store.whenSettled()).resolves.toBe("authenticated");
  });

  it("while checking, resolves with the next settled commit", async () => {
    vi.stubGlobal("document", { cookie: "cg_has_session=1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const store = createAuthSessionStore();
    store.ensureFetched();
    let settled: string | null = null;
    void store.whenSettled().then((value) => {
      settled = value;
    });
    await Promise.resolve();
    expect(settled).toBeNull();
    store.set("authenticated");
    await vi.waitFor(() => expect(settled).toBe("authenticated"));
  });

  it("starts the session fetch itself when nobody has, so it cannot wait on nothing", async () => {
    vi.stubGlobal("document", { cookie: "cg_has_session=1" });
    const fetchMock = vi.fn(() => Promise.resolve(statusOnlyResponse(200)));
    vi.stubGlobal("fetch", fetchMock);
    const store = createAuthSessionStore();
    await expect(store.whenSettled()).resolves.toBe("authenticated");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a session fetch that never answers ends anonymous at the auth timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { cookie: "cg_has_session=1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("", "AbortError")),
            );
          }),
      ),
    );
    const store = createAuthSessionStore();
    let settled: string | null = null;
    void store.whenSettled().then((value) => {
      settled = value;
    });
    await vi.advanceTimersByTimeAsync(AUTH_FETCH_TIMEOUT_MS - 1);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe("anonymous");
  });

  it("keeps waiting through an invalidate() and resolves on the next settled value", async () => {
    vi.stubGlobal("document", { cookie: "cg_has_session=1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const store = createAuthSessionStore();
    store.ensureFetched();
    let settled: string | null = null;
    void store.whenSettled().then((value) => {
      settled = value;
    });
    store.invalidate();
    await Promise.resolve();
    expect(settled).toBeNull();
    store.set("anonymous");
    await vi.waitFor(() => expect(settled).toBe("anonymous"));
  });
});

describe("gateOnAuthSession", () => {
  function setup(initial: AuthSessionState) {
    vi.stubGlobal("document", { cookie: "cg_has_session=1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const store = createAuthSessionStore();
    if (initial === "checking") store.ensureFetched();
    else store.set(initial);
    const requestAuth = vi.fn((intent: AuthIntent) => `request-${intent}`);
    const onAuthenticated = vi.fn();
    const onAuthRequested = vi.fn();
    const onWaiting = vi.fn();
    return { store, requestAuth, onAuthenticated, onAuthRequested, onWaiting };
  }

  it("while checking it opens no dialog and runs nothing; once authenticated it runs the action exactly once", async () => {
    const { store, requestAuth, onAuthenticated, onAuthRequested, onWaiting } = setup("checking");
    const outcome = gateOnAuthSession(
      { intent: "gameRound", onAuthenticated, onAuthRequested, onWaiting },
      { store, requestAuth },
    );
    await Promise.resolve();
    expect(onWaiting).toHaveBeenCalledTimes(1);
    expect(requestAuth).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();

    store.set("authenticated");
    await expect(outcome).resolves.toBe("ran");
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(requestAuth).not.toHaveBeenCalled();
    expect(onAuthRequested).not.toHaveBeenCalled();
  });

  it("while checking, a session that settles anonymous opens the dialog for the intent", async () => {
    const { store, requestAuth, onAuthenticated, onAuthRequested } = setup("checking");
    const outcome = gateOnAuthSession(
      { intent: "favorite", onAuthenticated, onAuthRequested },
      { store, requestAuth },
    );
    store.set("anonymous");
    await expect(outcome).resolves.toBe("auth-requested");
    expect(requestAuth).toHaveBeenCalledTimes(1);
    expect(requestAuth).toHaveBeenCalledWith("favorite");
    expect(onAuthRequested).toHaveBeenCalledWith("request-favorite");
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("an already authenticated session runs the action synchronously, inside the press", () => {
    const { store, requestAuth, onAuthenticated, onAuthRequested, onWaiting } =
      setup("authenticated");
    void gateOnAuthSession(
      { intent: "video", onAuthenticated, onAuthRequested, onWaiting },
      { store, requestAuth },
    );
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(onWaiting).not.toHaveBeenCalled();
    expect(requestAuth).not.toHaveBeenCalled();
  });

  it("an already anonymous session opens the dialog synchronously", () => {
    const { store, requestAuth, onAuthenticated, onAuthRequested } = setup("anonymous");
    void gateOnAuthSession(
      { intent: "video", onAuthenticated, onAuthRequested },
      { store, requestAuth },
    );
    expect(requestAuth).toHaveBeenCalledWith("video");
    expect(onAuthRequested).toHaveBeenCalledWith("request-video");
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("a press abandoned while waiting (the reader left) runs nothing once the session settles", async () => {
    const { store, requestAuth, onAuthenticated, onAuthRequested } = setup("checking");
    let left = false;
    const outcome = gateOnAuthSession(
      { intent: "gameRound", onAuthenticated, onAuthRequested, isCancelled: () => left },
      { store, requestAuth },
    );
    left = true;
    store.set("anonymous");
    await expect(outcome).resolves.toBe("cancelled");
    expect(requestAuth).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});

describe("signInAgain", () => {
  // T-112: a request sent as a signed-in reader came back 401. The session is gone, so the store
  // must say so BEFORE the dialog opens: the dialog resolves any open request at once while the
  // store still says "authenticated" (its T-162 safety net), which would close it unseen and
  // resume the failed action into another 401.
  it("moves the session to anonymous before it opens the dialog, and returns the request id", () => {
    vi.stubGlobal("document", { cookie: "cg_has_session=1" });
    const store = createAuthSessionStore();
    store.set("authenticated");
    const seenAtOpen: AuthSessionState[] = [];
    const requestAuth = vi.fn((intent: AuthIntent) => {
      seenAtOpen.push(store.getSnapshot());
      return `request-${intent}`;
    });

    const requestId = signInAgain("measurement", { store, requestAuth });

    expect(requestId).toBe("request-measurement");
    expect(requestAuth).toHaveBeenCalledTimes(1);
    expect(requestAuth).toHaveBeenCalledWith("measurement");
    expect(seenAtOpen).toEqual(["anonymous"]);
    expect(store.getSnapshot()).toBe("anonymous");
  });

  it("clears the session flag, so the next page load does not start as a member", () => {
    const doc = { cookie: "cg_has_session=1" };
    vi.stubGlobal("document", doc);
    const store = createAuthSessionStore();
    store.set("authenticated");
    signInAgain("measurement", { store, requestAuth: () => "request" });
    expect(doc.cookie).toMatch(/^cg_has_session=;.*max-age=0/);
  });
});
