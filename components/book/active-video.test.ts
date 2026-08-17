import { describe, expect, it } from "vitest";
import { closeVideo, createActiveVideoStore, openVideo } from "./active-video";

/**
 * "One player on the page" and "changing question does not reload" are both properties of this
 * store, so both are asserted here rather than left to a browser check alone. Each case builds
 * its own instance — no shared state, no reset hatch on the shipped surface.
 */
describe("active video store", () => {
  it("starts closed, on the server and on the client", () => {
    const store = createActiveVideoStore();
    expect(store.getSnapshot()).toBeNull();
    // The server snapshot is what makes hydration safe by construction: the first client frame
    // agrees with the server that every block is a facade.
    expect(store.getServerSnapshot()).toBeNull();
  });

  it("holds ONE deneme, so two open players is not a state it can express", () => {
    const store = createActiveVideoStore();
    store.open(1, 0);
    store.open(3, 94);
    const active = store.getSnapshot();
    expect(active?.denemeNo).toBe(3);
  });

  it("freezes the load second when the open block changes", () => {
    const store = createActiveVideoStore();
    store.open(1, 0);
    const first = store.getSnapshot();
    store.open(3, 94);
    const second = store.getSnapshot();
    expect(second?.loadToken).not.toBe(first?.loadToken);
    expect(second?.loadStartSecond).toBe(94);
  });

  it("does NOT move the load token or the load second when seeking inside the open block", () => {
    // This is the assertion behind SPEC §9 criterion 13: the iframe's `src` derives from these
    // two, so leaving them alone is what keeps the player from reloading on every question.
    const store = createActiveVideoStore();
    store.open(12, 0);
    const loaded = store.getSnapshot();
    store.open(12, 141);
    const seeked = store.getSnapshot();
    expect(seeked?.loadToken).toBe(loaded?.loadToken);
    expect(seeked?.loadStartSecond).toBe(0);
    expect(seeked?.seekSecond).toBe(141);
  });

  it("distinguishes two jumps to the SAME second", () => {
    // Without the nonce the second press would produce an identical snapshot and the effect
    // that performs the seek would never run.
    const store = createActiveVideoStore();
    store.open(12, 0);
    store.open(12, 141);
    const first = store.getSnapshot();
    store.open(12, 141);
    const second = store.getSnapshot();
    expect(second?.seekNonce).not.toBe(first?.seekNonce);
  });

  it("closes on the block that HAS the player open", () => {
    // The store is module state on the shipped surface, so it outlives a client-side route
    // change; without this the next arrival at the page would render an autoplaying iframe with
    // no click in between (→ PR #63 review CODE63-I1).
    const store = createActiveVideoStore();
    store.open(12, 94);
    store.close(12);
    expect(store.getSnapshot()).toBeNull();
  });

  it("ignores a close from a block that is not the open one", () => {
    // A route change unmounts all thirty blocks and every one of them calls close. Scoping is
    // what keeps a single block leaving the list from stopping a player in another block.
    const store = createActiveVideoStore();
    store.open(12, 94);
    store.close(3);
    expect(store.getSnapshot()?.denemeNo).toBe(12);
  });

  it("notifies subscribers on close, and only when something actually closed", () => {
    const store = createActiveVideoStore();
    store.open(12, 0);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.close(3);
    expect(calls).toBe(0);
    store.close(12);
    expect(calls).toBe(1);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = createActiveVideoStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.open(1, 0);
    expect(calls).toBe(1);
    unsubscribe();
    store.open(2, 0);
    expect(calls).toBe(1);
  });
});

/**
 * The page does not hold the store object — it imports two detached functions. A refactor that
 * reached for `this` inside either method would keep every case above green (they all call
 * through the instance) while the first İzle press on a real page threw (→ PR #63 review
 * TA63-M3). These two exercise the exported references the way the components do.
 *
 * They run against the module singleton and are therefore order-dependent among themselves;
 * they leave it closed, which is the state every other case in this file assumes of its own
 * fresh instance.
 */
describe("the detached exports the page actually calls", () => {
  it("opens and closes the singleton through the bare references", () => {
    const open = openVideo;
    const close = closeVideo;
    expect(() => open(12, 94)).not.toThrow();
    expect(() => close(12)).not.toThrow();
  });
});
