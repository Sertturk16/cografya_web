import { describe, expect, it } from "vitest";
import { createAuthModalStore } from "./auth-modal.client";

/**
 * `createAuthModalStore()` unit tests (uyelik-auth-redesign plan §11.2), the
 * `active-video.test.ts` / `session-store.test.ts` pattern: each case builds its own instance.
 */

describe("createAuthModalStore", () => {
  it("starts closed, in the default register mode, with no request", () => {
    const store = createAuthModalStore();
    expect(store.getSnapshot()).toEqual({
      open: false,
      intent: "generic",
      mode: "register",
      requestId: null,
      resolvedRequestId: null,
    });
    expect(store.getServerSnapshot()).toEqual(store.getSnapshot());
  });

  it("requestAuth opens the dialog in register mode for the given intent and returns a fresh id", () => {
    const store = createAuthModalStore();
    const id = store.requestAuth("favorite");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    const snapshot = store.getSnapshot();
    expect(snapshot.open).toBe(true);
    expect(snapshot.intent).toBe("favorite");
    expect(snapshot.mode).toBe("register");
    expect(snapshot.requestId).toBe(id);
    expect(snapshot.resolvedRequestId).toBeNull();
  });

  it("requestAuth returns DISTINCT ids across separate calls", () => {
    const store = createAuthModalStore();
    const first = store.requestAuth("video");
    const second = store.requestAuth("gameRound");
    expect(first).not.toBe(second);
  });

  it("getServerSnapshot never reflects a client-side request — always the EMPTY snapshot", () => {
    const store = createAuthModalStore();
    store.requestAuth("measurement");
    expect(store.getServerSnapshot()).toEqual({
      open: false,
      intent: "generic",
      mode: "register",
      requestId: null,
      resolvedRequestId: null,
    });
  });

  it("setMode changes only the mode, leaving the rest of the request untouched", () => {
    const store = createAuthModalStore();
    const id = store.requestAuth("favorite");
    store.setMode("login");
    const snapshot = store.getSnapshot();
    expect(snapshot.mode).toBe("login");
    expect(snapshot.requestId).toBe(id);
    expect(snapshot.open).toBe(true);
  });

  it("resolveAuth closes the dialog and records the served request as resolved", () => {
    const store = createAuthModalStore();
    const id = store.requestAuth("gameRound");
    store.resolveAuth();
    const snapshot = store.getSnapshot();
    expect(snapshot.open).toBe(false);
    expect(snapshot.resolvedRequestId).toBe(id);
  });

  it("resolveAuth on an idle store (no active request) is a harmless no-op", () => {
    const store = createAuthModalStore();
    store.resolveAuth();
    expect(store.getSnapshot()).toEqual({
      open: false,
      intent: "generic",
      mode: "register",
      requestId: null,
      resolvedRequestId: null,
    });
  });

  it("consumeResolved is true EXACTLY ONCE for the matching id", () => {
    const store = createAuthModalStore();
    const id = store.requestAuth("favorite");
    store.resolveAuth();
    expect(store.consumeResolved(id)).toBe(true);
    expect(store.consumeResolved(id)).toBe(false);
  });

  it("consumeResolved is false for a foreign id — never consumed", () => {
    const store = createAuthModalStore();
    const id = store.requestAuth("favorite");
    store.resolveAuth();
    expect(store.consumeResolved("some-other-request-id")).toBe(false);
    // The genuine id is still consumable — the foreign lookup did not spend it.
    expect(store.consumeResolved(id)).toBe(true);
  });

  it("dismissAuth does NOT resolve — it closes and clears requestId, leaving resolvedRequestId untouched", () => {
    const store = createAuthModalStore();
    const id = store.requestAuth("video");
    store.dismissAuth();
    const snapshot = store.getSnapshot();
    expect(snapshot.open).toBe(false);
    expect(snapshot.requestId).toBeNull();
    expect(snapshot.resolvedRequestId).toBeNull();
    // The dismissed request can never be "consumed" as resolved.
    expect(store.consumeResolved(id)).toBe(false);
  });

  it("a fresh requestAuth call clears any earlier, unconsumed resolution", () => {
    const store = createAuthModalStore();
    const firstId = store.requestAuth("favorite");
    store.resolveAuth();
    expect(store.getSnapshot().resolvedRequestId).toBe(firstId);
    store.requestAuth("video");
    expect(store.getSnapshot().resolvedRequestId).toBeNull();
    // The stale first id can no longer be consumed.
    expect(store.consumeResolved(firstId)).toBe(false);
  });

  it("notifies subscribers on every state-changing call and stops after unsubscribe", () => {
    const store = createAuthModalStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.requestAuth("favorite");
    expect(calls).toBe(1);
    store.resolveAuth();
    expect(calls).toBe(2);
    unsubscribe();
    store.dismissAuth();
    expect(calls).toBe(2);
  });
});
