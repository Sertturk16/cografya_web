"use client";

import { type Dispatch, type SetStateAction, useEffect, useSyncExternalStore } from "react";
import { AUTH_FETCH_TIMEOUT_MS } from "@/lib/auth/submit.client";

export type AuthSessionState = "checking" | "authenticated" | "anonymous";

/**
 * The pure half of the session check — extracted from `login-form.tsx`'s original inline
 * effect (UYELIK-06 plan §5.3.1) so it is unit-testable without a DOM: this repo's vitest
 * environment is `node` (`vitest.config.ts`), so a hook cannot be rendered here — only the
 * async logic it wraps can be exercised directly, the same split `submit.client.ts`'s
 * `submitAuth`/`parseBffBody` already draws (`VAL85-R3`/`TEST85-I1`).
 *
 * Same fetch, same same-origin/no-store contract as the code this replaces. "Anything other
 * than a clean 200" — a 401, a network failure, or the caller's own abort — collapses to
 * `"anonymous"`, matching `login-form.tsx`'s original posture exactly.
 */
export async function fetchAuthSessionState(signal: AbortSignal): Promise<AuthSessionState> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    return res.status === 200 ? "authenticated" : "anonymous";
  } catch {
    return "anonymous";
  }
}

/**
 * The shared, invalidatable session store (uyelik-auth-redesign plan §5.4) — a module-level
 * singleton, following `components/book/active-video.ts`'s own documented pattern (factory +
 * module singleton + `useSyncExternalStore`): that file's docblock explains why a module
 * singleton outlives the page, and for a session that outlasting IS correct — a session is
 * global to the document, unlike the bench's own per-book state.
 *
 * WHY A STORE REPLACES THE OLD PER-COMPONENT `useState`. With a page redirect (the old design)
 * every consumer remounted and re-fetched on its own; a modal changes nothing in the DOM tree
 * around it, so without a shared store `FavoriteButton`, `VideoBench` and `ToolIsland` would
 * each keep holding their own stale `"anonymous"` forever after a successful modal login
 * (plan §2.3). A shared store also collapses what used to be N parallel
 * `/api/auth/session` requests (one per mounted consumer) into exactly one.
 */
export interface AuthSessionStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): AuthSessionState;
  /** ALWAYS `"checking"` — the same value the pre-store hook started at, so the server render
   *  and the first client render agree exactly as before and no hydration mismatch is
   *  introduced (K2). */
  getServerSnapshot(): AuthSessionState;
  /** Idempotent: at most one in-flight `/api/auth/session` request exists at a time, no matter
   *  how many consumers call this. */
  ensureFetched(): void;
  /** Writes straight through — the logout path (`login-form.tsx`'s optimistic
   *  `setSessionState("anonymous")`) and the modal's own post-auth success path both use this. */
  set(next: AuthSessionState): void;
  /** Drops to `"checking"` and starts a fresh fetch — exported for a future consumer that needs
   *  to force a re-check; no call site in this task uses it yet. */
  invalidate(): void;
}

export function createAuthSessionStore(): AuthSessionStore {
  let state: AuthSessionState = "checking";
  let fetchInFlight = false;
  const listeners = new Set<() => void>();

  const commit = (next: AuthSessionState) => {
    if (state === next) return;
    state = next;
    for (const listener of listeners) listener();
  };

  const runFetch = () => {
    fetchInFlight = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
    fetchAuthSessionState(controller.signal)
      .then((next) => {
        fetchInFlight = false;
        commit(next);
      })
      .finally(() => clearTimeout(timeout));
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
      return "checking";
    },
    ensureFetched() {
      if (fetchInFlight) return;
      runFetch();
    },
    set(next) {
      commit(next);
    },
    invalidate() {
      fetchInFlight = false;
      commit("checking");
      runFetch();
    },
  };
}

const store = createAuthSessionStore();

/**
 * `useAuthSession()` — the shared session-check hook. Every consumer in the tree
 * (`login-form.tsx`, `video-bench.tsx`, `favorite-button.tsx`, `game-round-save.tsx`,
 * `tool-island.tsx`, `game-history-panel.tsx`, the auth dialog) reads the SAME store through
 * this hook, so a successful modal login propagates to all of them without a page reload
 * (uyelik-auth-redesign plan §5.4/K1).
 *
 * Returns a `useState`-shaped tuple rather than a bare value, DELIBERATELY departing from an
 * illustrative one-line sketch some plan text uses (`const authState = useAuthSession();`):
 * the signed-in branch of `login-form.tsx`'s existing `handleLogout` optimistically flips the
 * rendered state to `"anonymous"` the instant a logout succeeds, without waiting for (or
 * forcing) a second network round trip — a real, pre-existing behaviour this store-backed
 * version must not regress. The setter now WRITES THROUGH TO THE STORE, so that same call
 * also correctly propagates to every other mounted consumer, which the original per-component
 * `useState` never could.
 */
export function useAuthSession(): readonly [
  AuthSessionState,
  Dispatch<SetStateAction<AuthSessionState>>,
] {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    store.ensureFetched();
  }, []);

  const setState: Dispatch<SetStateAction<AuthSessionState>> = (value) => {
    const next =
      typeof value === "function"
        ? (value as (previous: AuthSessionState) => AuthSessionState)(store.getSnapshot())
        : value;
    store.set(next);
  };

  return [state, setState] as const;
}
