/**
 * The unsaved-changes store (T-062) — the site's ONE answer to "this form has edits in it and
 * the member is about to leave".
 *
 * ## Why a module singleton and not a context
 *
 * The thing that has to ask the question is the wrapped `Link` in `i18n/navigation.ts`, which
 * renders in the header, the footer and every card on the page — outside any provider a form
 * could mount. A context would have to be provided at the very top of the tree, and there are two
 * tops: `(site)/layout.tsx` and `(play)/layout.tsx`. A module singleton read through
 * `useSyncExternalStore` is the same store under both, which is the shape
 * `lib/auth/auth-modal.client.ts` and `lib/auth/use-session.client.ts` already use here.
 *
 * ## NO CALLBACKS IN MODULE STATE
 *
 * The auth-modal store states the rule and the reason: a callback parked in module state across
 * renders is a stale-closure and a leak. So the pending navigation is held as a PATH — a plain
 * string — and the dialog performs the navigation itself when the member confirms. That is also
 * why {@link UnsavedChangesStore.confirmLeave} RETURNS the path rather than running anything.
 *
 * ## Counting sources, not flags
 *
 * `/hesabim/ayarlar` has three independent forms on one page and any subset of them can be dirty
 * at once. A boolean would be written by whichever form re-rendered last; a count of held sources
 * cannot be. Each holder gets an opaque id and releases exactly once (releasing twice is a no-op,
 * because React 19 Strict Mode double-invokes effects and the cleanup has to be idempotent).
 *
 * No DOM at module scope: this repo's vitest environment is `node` with no jsdom, and everything
 * here is plain values so it can be unit-tested directly. The one DOM concern — the
 * `beforeunload` listener — lives in `use-unsaved-changes.client.ts`'s effect.
 */

export interface UnsavedChangesState {
  /** How many mounted forms currently hold unsaved edits. */
  readonly dirtyCount: number;
  /**
   * Where the member was trying to go when the guard stopped them, or `null` when nothing is
   * pending. A ROOT-RELATIVE, ALREADY LOCALE-RESOLVED path (the `href` an `<a>` resolved to),
   * which is why the dialog pushes it through `next/navigation`'s router and not next-intl's —
   * the same reason `v2-login-card.tsx` and `v2-verify-email-card.tsx` record for their own
   * redirects. Re-prefixing an already-prefixed path would send an `/en` reader to `/en/en/…`.
   */
  readonly pendingPath: string | null;
}

export interface UnsavedChangesStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): UnsavedChangesState;
  getServerSnapshot(): UnsavedChangesState;
  /**
   * Registers one form as holding unsaved edits. Returns its release, which is idempotent: a
   * second call is a no-op rather than a double decrement.
   */
  hold(): () => void;
  /**
   * The navigation guard. `true` means "go ahead, nothing is dirty". `false` means the store has
   * recorded `path` as pending and the caller must NOT navigate — the dialog now owns it.
   *
   * A second blocked navigation while the dialog is already open overwrites the pending path: the
   * member's latest intent is the one to honour, and there is only ever one dialog.
   */
  guard(path: string): boolean;
  /** "Leave anyway": clears the pending path and hands it back for the caller to navigate to. */
  confirmLeave(): string | null;
  /** "Stay on this page", Escape, or the backdrop: forgets the pending navigation. */
  cancelLeave(): void;
  /**
   * Drops every held source. Used when a leave is confirmed — the forms are about to unmount and
   * their own cleanups would fire anyway, but the guard must not block the very navigation it was
   * just told to allow.
   */
  releaseAll(): void;
}

const EMPTY: UnsavedChangesState = Object.freeze({ dirtyCount: 0, pendingPath: null });

export function createUnsavedChangesStore(): UnsavedChangesStore {
  let state: UnsavedChangesState = EMPTY;
  const listeners = new Set<() => void>();
  const held = new Set<symbol>();

  const commit = (next: UnsavedChangesState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const sync = (pendingPath: string | null) => {
    commit({ dirtyCount: held.size, pendingPath });
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
    hold() {
      const id = Symbol("unsaved-changes-source");
      held.add(id);
      sync(state.pendingPath);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        held.delete(id);
        sync(state.pendingPath);
      };
    },
    guard(path) {
      if (held.size === 0) return true;
      sync(path);
      return false;
    },
    confirmLeave() {
      const path = state.pendingPath;
      if (path === null) return null;
      sync(null);
      return path;
    },
    cancelLeave() {
      if (state.pendingPath === null) return;
      sync(null);
    },
    releaseAll() {
      held.clear();
      sync(state.pendingPath);
    },
  };
}

const store = createUnsavedChangesStore();

export const holdUnsavedChanges = store.hold;
export const guardNavigation = store.guard;
export const confirmLeave = store.confirmLeave;
export const cancelLeave = store.cancelLeave;
export const releaseAllUnsavedChanges = store.releaseAll;

export function subscribeUnsavedChanges(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function getUnsavedChangesSnapshot(): UnsavedChangesState {
  return store.getSnapshot();
}

export function getUnsavedChangesServerSnapshot(): UnsavedChangesState {
  return store.getServerSnapshot();
}
