"use client";

import { useSyncExternalStore } from "react";

/**
 * The bench's state: which video the stage is SHOWING, and whether a player is LOADED in it.
 *
 * ## Two axes, because "selected" and "playing" are different questions
 *
 * The page has ONE stage and thirty index rows. Pressing a question row both moves the stage to
 * that video and loads its player, so on that path the two axes move together — but they are not
 * the same axis, and collapsing them would lose the two states that make the surface work:
 *
 * · **First paint.** The stage shows a video and no player exists anywhere on the page (zero
 *   iframes in the first response is the whole facade architecture). `selected` therefore has to
 *   be meaningful while `active` is `null`.
 * · **Closing.** Tearing a player down returns the stage to that video's cover rather than
 *   blanking it, so `close()` clears `active` and leaves `selected` where it is.
 *
 * `selected === null` means **"whatever the server chose"**. The default is page data — the first
 * video that actually rendered — and `getServerSnapshot()` takes no arguments and must return a
 * stable value, so the sentinel lives here and `bench-stage.tsx` resolves it against the prop it
 * was given. That is what makes the server's HTML and the client's first frame agree by
 * construction rather than by both computing the same number.
 *
 * ## One state object, replaced rather than mutated
 *
 * `useSyncExternalStore` calls `getSnapshot` on every render and re-renders when the reference
 * changes, so a snapshot built fresh on each call is an infinite loop. Every operation therefore
 * either replaces `state` or returns without touching it, and the no-op paths below are load-
 * bearing rather than defensive.
 *
 * ## Why `loadStartSecond` is separate from `seekSecond`
 *
 * This is the difference between the ruled behaviour and a defect. The iframe's `src` is derived
 * from `loadStartSecond` ONLY. If it read the live `seekSecond`, then jumping from question 3 to
 * question 5 would change the `src` attribute, and changing an iframe's `src` RELOADS it — which
 * is exactly the six-reloads-per-video cost DEC 2026-08-15d exists to remove. So a seek within
 * the open video bumps `seekNonce` and `seekSecond` while leaving `loadToken` and
 * `loadStartSecond` untouched, and the `src` string stays byte-identical across those renders.
 *
 * `seekNonce` is what makes two consecutive jumps to the SAME second distinguishable: without it
 * the second press would produce an identical snapshot and no effect would run.
 *
 * ## Why a store and not React state, and why a factory with a module-level singleton
 *
 * The stage and the index are siblings with server markup in between: the wrapper that HEARS the
 * press sits above the slot that has to RENDER the player. A context provider would solve that
 * and still leave the store as the natural home for "one player, ever" — with the state being a
 * single `denemeNo`, two open players is not a state this code can express.
 *
 * The singleton is what the page uses; the factory is what `active-video.test.ts` uses, so the
 * invariants are tested on a fresh instance per case instead of through a reset hatch that only
 * exists for tests.
 *
 * ## …and why the singleton needs `reset`, which is not a convenience method
 *
 * A module-level value outlives the page: App Router route changes are client-side, so the module
 * is never re-evaluated and the state survives leaving the book page. `getServerSnapshot` is
 * consulted only while hydrating a full document load, NEVER on a client transition — so on a
 * RETURN to a book page the stage would read a stale `active` during its first render and go
 * straight to the iframe branch, with `autoplay=1`, no click and no key press. That is the one
 * state this architecture exists to make unreachable (→ PR #63 review `CODE63-I1`), and before
 * the fix it was reachable in three presses: İzle, breadcrumb, back.
 *
 * `reset` is called from the bench island's unmount cleanup. It is unconditional where the
 * pre-bench `close(denemeNo)` had to be scoped, and the reason that scoping existed is gone: the
 * page now has ONE island rather than thirty, so "my island is going away" and "the page is going
 * away" are the same event. It clears `selected` too — a stale selection would put another book's
 * video number on the stage.
 *
 * **One tick is not covered, and that is known rather than overlooked.** The cleanup is a passive
 * effect, so on a SAME-ROUTE remount — where React deletes the old subtree and inserts the new one
 * in a single commit — the new tree renders BEFORE the old tree's cleanup runs, and reads a store
 * that is still stale. The path that reaches it today is the header's language switcher:
 * `/kitaplar/{slug}` and `/en/books/{slug}` are different segments, so the subtree is re-created,
 * and next-intl's `Link` makes it a client transition rather than a document load. A reader who
 * pressed İzle seconds earlier gets one commit of that iframe back, then the cleanup fires and it
 * is gone — no playback, no focus move, no persistent frame; one embed request that repeats a
 * request the same reader authorised in this same document, for this same video. That is why it
 * is accepted rather than fixed here.
 *
 * WHAT WOULD MAKE IT A REAL DEFECT, so that whoever gets there does not have to rediscover it: a
 * direct book→book link. The store's `denemeNo` would then match a video of a DIFFERENT book, and
 * the tick would request an embed for a video the reader never asked for — the gesture-free
 * third-party request this whole architecture exists to prevent. No such link exists on this page
 * today. Whoever adds one closes the residue in the same change; full closure scopes the store to
 * the page instance, which sits with Atlas as a tracked follow-up.
 */
export interface ActiveVideo {
  readonly denemeNo: number;
  /** Bumped only when the OPEN video changes — the iframe's identity and `src` follow this. */
  readonly loadToken: number;
  /** Frozen at load time; the only second that reaches the `src`. */
  readonly loadStartSecond: number;
  /** The most recently requested second, applied through `seekTo`. */
  readonly seekSecond: number;
  /** Bumped on every request, so repeat jumps to one second are still distinguishable. */
  readonly seekNonce: number;
}

export interface BenchState {
  /** Which video the stage shows; `null` means the server's default. */
  readonly selected: number | null;
  /** The loaded player, or `null` when the stage is showing a cover. */
  readonly active: ActiveVideo | null;
}

export interface ActiveVideoStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): BenchState;
  getServerSnapshot(): BenchState;
  /** Moves the stage WITHOUT loading a player. Tears down a player on another video. */
  select(denemeNo: number): void;
  /** Moves the stage AND loads/seeks its player. */
  open(denemeNo: number, startSecond: number): void;
  /** Closes the player IF `denemeNo` is the video that has it open; the selection survives. */
  close(denemeNo: number): void;
  /** Clears both axes — the page is leaving. */
  reset(): void;
}

/** The one snapshot the server ever produces, and the same reference every time it is asked
 *  for: a fresh object here re-renders forever under `useSyncExternalStore`. */
const EMPTY: BenchState = Object.freeze({ selected: null, active: null });

export function createActiveVideoStore(): ActiveVideoStore {
  let state: BenchState = EMPTY;
  let loadToken = 0;
  let seekNonce = 0;
  const listeners = new Set<() => void>();

  const commit = (next: BenchState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return state;
    },
    getServerSnapshot() {
      return EMPTY;
    },
    select(denemeNo) {
      const keepsPlayer = state.active !== null && state.active.denemeNo === denemeNo;
      if (state.selected === denemeNo && (keepsPlayer || state.active === null)) return;
      commit({ selected: denemeNo, active: keepsPlayer ? state.active : null });
    },
    open(denemeNo, startSecond) {
      seekNonce += 1;
      const current = state.active;
      const active =
        current !== null && current.denemeNo === denemeNo
          ? { ...current, seekSecond: startSecond, seekNonce }
          : {
              denemeNo,
              loadToken: (loadToken += 1),
              loadStartSecond: startSecond,
              seekSecond: startSecond,
              seekNonce,
            };
      commit({ selected: denemeNo, active });
    },
    close(denemeNo) {
      if (state.active === null || state.active.denemeNo !== denemeNo) return;
      commit({ selected: state.selected, active: null });
    },
    reset() {
      if (state === EMPTY) return;
      commit(EMPTY);
    },
  };
}

const store = createActiveVideoStore();

export const selectVideo = store.select;
export const openVideo = store.open;
export const closeVideo = store.close;
export const resetBench = store.reset;

export function useBenchState(): BenchState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
