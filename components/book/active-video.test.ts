import { describe, expect, it } from "vitest";
import {
  closeVideo,
  createActiveVideoStore,
  openVideo,
  resetBench,
  selectVideo,
} from "./active-video";

/**
 * "One player on the page", "changing question does not reload", and "the stage keeps showing a
 * video after its player closes" are all properties of this store, so all three are asserted here
 * rather than left to a browser check alone. Each case builds its own instance — no shared state,
 * no reset hatch on the shipped surface.
 */
describe("bench store", () => {
  it("starts empty, on the server and on the client", () => {
    const store = createActiveVideoStore();
    expect(store.getSnapshot()).toEqual({ selected: null, active: null });
    // The server snapshot is what makes hydration safe by construction: the first client frame
    // agrees with the server that the stage shows the server's default and holds no player.
    expect(store.getServerSnapshot()).toEqual({ selected: null, active: null });
  });

  it("returns the SAME snapshot reference while nothing changes", () => {
    // `useSyncExternalStore` re-renders whenever this reference moves, so a snapshot rebuilt on
    // every call is an infinite render loop — a defect no assertion about VALUES can see.
    const store = createActiveVideoStore();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    store.select(3);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("selects without loading a player", () => {
    // The stage moving and a third-party frame being requested are different events, and only
    // the second one needs a gesture. Arriving on a fragment uses this path.
    const store = createActiveVideoStore();
    store.select(24);
    expect(store.getSnapshot()).toEqual({ selected: 24, active: null });
  });

  it("holds ONE video, so two open players is not a state it can express", () => {
    const store = createActiveVideoStore();
    store.open(1, 0);
    store.open(3, 94);
    expect(store.getSnapshot().active?.denemeNo).toBe(3);
    expect(store.getSnapshot().selected).toBe(3);
  });

  it("tears the player down when the stage moves to another video", () => {
    // The stage holds one player. Selecting a different video has to drop it, or a hidden frame
    // keeps playing with every visible control gone — the accordion's `onToggle` hazard, moved.
    const store = createActiveVideoStore();
    store.open(12, 94);
    store.select(13);
    expect(store.getSnapshot()).toEqual({ selected: 13, active: null });
  });

  it("keeps the player when the selection does not actually move", () => {
    const store = createActiveVideoStore();
    store.open(12, 94);
    const loaded = store.getSnapshot();
    store.select(12);
    expect(store.getSnapshot()).toBe(loaded);
  });

  it("freezes the load second when the open video changes", () => {
    const store = createActiveVideoStore();
    store.open(1, 0);
    const first = store.getSnapshot().active;
    store.open(3, 94);
    const second = store.getSnapshot().active;
    expect(second?.loadToken).not.toBe(first?.loadToken);
    expect(second?.loadStartSecond).toBe(94);
  });

  it("does NOT move the load token or the load second when seeking inside the open video", () => {
    // This is the assertion behind SPEC §9 criterion 13: the iframe's `src` derives from these
    // two, so leaving them alone is what keeps the player from reloading on every question.
    const store = createActiveVideoStore();
    store.open(12, 0);
    const loaded = store.getSnapshot().active;
    store.open(12, 141);
    const seeked = store.getSnapshot().active;
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
    const first = store.getSnapshot().active;
    store.open(12, 141);
    const second = store.getSnapshot().active;
    expect(second?.seekNonce).not.toBe(first?.seekNonce);
  });

  it("closes the player but keeps the video on the stage", () => {
    // The difference between the two axes, stated as a case: closing returns the stage to that
    // video's cover rather than blanking it.
    const store = createActiveVideoStore();
    store.open(12, 94);
    store.close(12);
    expect(store.getSnapshot()).toEqual({ selected: 12, active: null });
  });

  it("ignores a close from a video that is not the open one", () => {
    const store = createActiveVideoStore();
    store.open(12, 94);
    store.close(3);
    expect(store.getSnapshot().active?.denemeNo).toBe(12);
  });

  it("clears BOTH axes on reset", () => {
    // The page is leaving. A surviving `selected` would put another book's video number on the
    // next stage; a surviving `active` would render an autoplaying iframe with no gesture
    // (→ PR #63 review CODE63-I1).
    const store = createActiveVideoStore();
    store.open(12, 94);
    store.reset();
    expect(store.getSnapshot()).toEqual({ selected: null, active: null });
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

  it("notifies nothing on a reset that changes nothing", () => {
    const store = createActiveVideoStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.reset();
    expect(calls).toBe(0);
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
 * The components do not hold the store object — they import detached functions. A refactor that
 * reached for `this` inside any method would keep every case above green (they all call through
 * the instance) while the first İzle press on a real page threw (→ PR #63 review TA63-M3). These
 * exercise the exported references the way the components do.
 *
 * They run against the module singleton and are therefore order-dependent among themselves; they
 * leave it empty, which is the state every other case in this file assumes of its own fresh
 * instance.
 */
describe("the detached exports the components actually call", () => {
  it("selects, opens, closes and resets the singleton through the bare references", () => {
    const select = selectVideo;
    const open = openVideo;
    const close = closeVideo;
    const reset = resetBench;
    expect(() => select(24)).not.toThrow();
    expect(() => open(12, 94)).not.toThrow();
    expect(() => close(12)).not.toThrow();
    expect(() => reset()).not.toThrow();
  });
});
