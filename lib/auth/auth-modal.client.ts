"use client";

import { useSyncExternalStore } from "react";

/**
 * The modal request/resolve store (uyelik-auth-redesign plan §5.5) — the same
 * factory-plus-module-singleton shape `lib/auth/use-session.client.ts` and
 * `components/book/active-video.ts` already use.
 *
 * It holds NO callbacks — deliberately. A callback parked in module state across renders is a
 * stale-closure and leak hazard; this repo's own store precedent keeps module state to plain
 * serialisable values. The resume therefore lives IN THE CALL SITE, where the data already is:
 * each gated control keeps its own `requestId` in a `useRef`, subscribes to this store, and on
 * `resolvedRequestId === myId` calls `consumeResolved(myId)` and, only if that returns `true`,
 * performs its own resume. `consumeResolved` returning `true` exactly once is what makes a
 * double-run impossible even under React 19 Strict Mode's double-invoked effects (K3).
 */

export type AuthIntent = "favorite" | "video" | "gameRound" | "measurement" | "generic";
export type AuthMode = "login" | "register";

export interface AuthModalState {
  readonly open: boolean;
  readonly intent: AuthIntent;
  readonly mode: AuthMode;
  /** Identifies the request currently being served, or `null` when none is open. */
  readonly requestId: string | null;
  /** Set when auth SUCCEEDS; survives `close()` so the requester can consume it on its own
   *  schedule (the modal itself does not know who asked). */
  readonly resolvedRequestId: string | null;
}

export interface AuthModalStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): AuthModalState;
  getServerSnapshot(): AuthModalState;
  /** Opens the dialog for `intent`, in the default `"register"` mode (§5.5 — AK-48's own
   *  "become a member" framing: a first-time organic reader has no account yet), and returns a
   *  fresh request id the caller must hold onto to recognise its own resolution later. */
  requestAuth(intent: AuthIntent): string;
  setMode(mode: AuthMode): void;
  /** Auth succeeded: closes the dialog and records the just-served request as resolved. */
  resolveAuth(): void;
  /** Esc / backdrop / close button: closes the dialog without resolving anything. */
  dismissAuth(): void;
  /** `true` exactly once for the matching, unconsumed id; `false` for a foreign id or an
   *  already-consumed one. */
  consumeResolved(requestId: string): boolean;
}

const EMPTY: AuthModalState = Object.freeze({
  open: false,
  intent: "generic",
  mode: "register",
  requestId: null,
  resolvedRequestId: null,
});

export function createAuthModalStore(): AuthModalStore {
  let state: AuthModalState = EMPTY;
  const listeners = new Set<() => void>();

  const commit = (next: AuthModalState) => {
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
    requestAuth(intent) {
      const requestId = crypto.randomUUID();
      // A fresh request supersedes any earlier, unconsumed resolution — starting a new flow
      // makes the old one moot even though the ids can never actually collide.
      commit({ open: true, intent, mode: "register", requestId, resolvedRequestId: null });
      return requestId;
    },
    setMode(mode) {
      commit({ ...state, mode });
    },
    resolveAuth() {
      if (state.requestId === null) return;
      commit({ ...state, open: false, resolvedRequestId: state.requestId });
    },
    dismissAuth() {
      commit({ ...state, open: false, requestId: null });
    },
    consumeResolved(requestId) {
      if (state.resolvedRequestId !== requestId) return false;
      commit({ ...state, resolvedRequestId: null });
      return true;
    },
  };
}

const store = createAuthModalStore();

export const requestAuth = store.requestAuth;
export const setAuthModalMode = store.setMode;
export const resolveAuth = store.resolveAuth;
export const dismissAuth = store.dismissAuth;
export const consumeResolved = store.consumeResolved;

export function getAuthModalSnapshot(): AuthModalState {
  return store.getSnapshot();
}

export function subscribeAuthModal(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function getAuthModalServerSnapshot(): AuthModalState {
  return store.getServerSnapshot();
}

/** The one hook every consumer (the dialog itself, and each gated call site's resume effect)
 *  reads the modal state through. */
export function useAuthModalState(): AuthModalState {
  return useSyncExternalStore(subscribeAuthModal, getAuthModalSnapshot, getAuthModalServerSnapshot);
}
