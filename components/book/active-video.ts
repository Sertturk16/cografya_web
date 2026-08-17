"use client";

import { useSyncExternalStore } from "react";

/**
 * Which deneme's player is open — the whole of "one player on the page", as data.
 *
 * ## Why a store and not React state
 *
 * The architecture is 30 independent client islands, one per deneme block (SPEC §4.3: "30
 * blok, 30 delege dinleyici"), each wrapping server-rendered children. Two things have to
 * cross island boundaries: opening block 3 must close block 1, and the wrapper that HEARD the
 * click sits above the slot that has to RENDER the player, with server markup in between.
 *
 * A context provider solves the second and not the first; it would still need a broadcast
 * channel for "somebody else opened". One store solves both, and it makes the invariant
 * structural rather than careful: the state IS a single `denemeNo`, so two open players is not
 * a bug this code can have. `getServerSnapshot` returns `null`, which is also what makes
 * hydration safe by construction — the server and the first client frame agree that every
 * block is a facade.
 *
 * ## The four fields, and why `loadStartSecond` is separate from `seekSecond`
 *
 * This is the difference between the ruled behaviour and a defect. The iframe's `src` is
 * derived from `loadStartSecond` ONLY. If it read the live `seekSecond`, then jumping from
 * question 3 to question 5 would change the `src` attribute, and changing an iframe's `src`
 * RELOADS it — which is exactly the six-reloads-per-video cost DEC 2026-08-15d exists to
 * remove. So a seek within the open block bumps `seekNonce` and `seekSecond` while leaving
 * `loadToken` and `loadStartSecond` untouched, and the `src` string stays byte-identical
 * across those renders. `SPEC.md` §9's criterion 13 measures the result.
 *
 * `seekNonce` is what makes two consecutive jumps to the SAME second distinguishable: without
 * it the second click would produce an identical snapshot and no effect would run.
 *
 * ## Why a factory with a module-level singleton
 *
 * The singleton is what the page uses; the factory is what `active-video.test.ts` uses, so the
 * invariant is tested on a fresh instance per case instead of through a reset hatch that only
 * exists for tests. Three lines, and no test-only export on the shipped surface.
 *
 * ## …and why the singleton needs `close`, which is not a convenience method
 *
 * A module-level value outlives the page: App Router route changes are client-side, so the
 * module is never re-evaluated and `active` survives leaving the book page. `getServerSnapshot`
 * is consulted only while hydrating a full document load, NEVER on a client transition — so on
 * a RETURN to a book page the matching block would read a stale `active` during its first
 * render and go straight to the iframe branch, with `autoplay=1`, no click and no key press.
 * That is the one state this whole architecture exists to make unreachable (→ PR #63 review
 * `CODE63-I1`), and it was reachable in three presses: İzle, breadcrumb, back.
 *
 * "Unreachable" has one knowing exception, and it is not recorded twice: a same-route remount
 * commits the new tree before the departing block's cleanup runs, so the store is still stale
 * for that one render. Its scope, the path that reaches it today and the condition that would
 * turn it into a real defect are written where the cleanup lives — `deneme-player.tsx`, "One
 * tick is not covered".
 *
 * `close` is therefore SCOPED to a block rather than global. The caller is the block's own
 * island, from its unmount cleanup (`deneme-player.tsx`), and a route change unmounts all
 * thirty of them at once — so the one holding the open player clears it and the other
 * twenty-nine are no-ops. A global `close()` called from every block would also work today,
 * but it would additionally fire when a SINGLE block leaves the list while another block's
 * player is open, closing a player the reader is watching. The scope is what makes the cleanup
 * mean "my player is going away" instead of "some block unmounted".
 */
export interface ActiveVideo {
  readonly denemeNo: number;
  /** Bumped only when the OPEN block changes — the iframe's identity and `src` follow this. */
  readonly loadToken: number;
  /** Frozen at load time; the only second that reaches the `src`. */
  readonly loadStartSecond: number;
  /** The most recently requested second, applied through `seekTo`. */
  readonly seekSecond: number;
  /** Bumped on every request, so repeat jumps to one second are still distinguishable. */
  readonly seekNonce: number;
}

export interface ActiveVideoStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ActiveVideo | null;
  getServerSnapshot(): null;
  open(denemeNo: number, startSecond: number): void;
  /** Closes the player IF `denemeNo` is the block that has it open; a no-op otherwise. */
  close(denemeNo: number): void;
}

export function createActiveVideoStore(): ActiveVideoStore {
  let active: ActiveVideo | null = null;
  let loadToken = 0;
  let seekNonce = 0;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return active;
    },
    getServerSnapshot() {
      return null;
    },
    open(denemeNo, startSecond) {
      seekNonce += 1;
      active =
        active !== null && active.denemeNo === denemeNo
          ? { ...active, seekSecond: startSecond, seekNonce }
          : {
              denemeNo,
              loadToken: (loadToken += 1),
              loadStartSecond: startSecond,
              seekSecond: startSecond,
              seekNonce,
            };
      for (const listener of listeners) listener();
    },
    close(denemeNo) {
      if (active === null || active.denemeNo !== denemeNo) return;
      active = null;
      for (const listener of listeners) listener();
    },
  };
}

const store = createActiveVideoStore();

export const openVideo = store.open;
export const closeVideo = store.close;

export function useActiveVideo(): ActiveVideo | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
