"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type AuthIntent, requestAuth } from "@/lib/auth/auth-modal.client";
import { AUTH_FETCH_TIMEOUT_MS } from "@/lib/auth/submit.client";
import {
  clearSessionFlag,
  hasSessionFlag,
  setSessionFlag,
} from "@/lib/session/session-flag.client";

export type AuthSessionState = "checking" | "authenticated" | "anonymous";

/** What the session check ends as; `"checking"` is the absence of an answer, not a guest. */
export type SettledAuthSessionState = Exclude<AuthSessionState, "checking">;

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
    if (res.status === 200) {
      setSessionFlag();
      return "authenticated";
    }
    clearSessionFlag();
    return "anonymous";
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
  /** Writes straight through — the logout path (`v2-login-card.tsx`'s optimistic
   *  `setSessionState("anonymous")`) and the modal's own post-auth success path both use this. */
  set(next: AuthSessionState): void;
  /** Drops to `"checking"` and starts a fresh fetch — exported for a future consumer that needs
   *  to force a re-check; no call site in this task uses it yet. */
  invalidate(): void;
  /** Resolves with the first settled state: at once when the check has already answered,
   *  otherwise on the next commit that leaves `"checking"`. Starts the fetch itself when nobody
   *  has, and the fetch's `AUTH_FETCH_TIMEOUT_MS` abort ends as `"anonymous"`, so it cannot hang. */
  whenSettled(): Promise<SettledAuthSessionState>;
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

  const store: AuthSessionStore = {
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
      if (!hasSessionFlag()) {
        commit("anonymous");
        return;
      }
      runFetch();
    },
    set(next) {
      if (next === "authenticated") {
        setSessionFlag();
      } else if (next === "anonymous") {
        clearSessionFlag();
      }
      commit(next);
    },
    invalidate() {
      fetchInFlight = false;
      commit("checking");
      runFetch();
    },
    whenSettled() {
      if (state !== "checking") return Promise.resolve(state);
      return new Promise<SettledAuthSessionState>((resolve) => {
        const unsubscribe = store.subscribe(() => {
          if (state === "checking") return;
          unsubscribe();
          resolve(state);
        });
        store.ensureFetched();
      });
    },
  };
  return store;
}

const store = createAuthSessionStore();

export type SessionGateOutcome = "ran" | "auth-requested" | "cancelled";

export interface SessionGateOptions {
  readonly intent: AuthIntent;
  /** The gated action itself; runs when the session is, or settles as, authenticated. */
  readonly onAuthenticated: () => void;
  /** A guest was sent to the auth dialog; the id is what the caller's resume effect matches. */
  readonly onAuthRequested: (requestId: string) => void;
  /** The session was still `"checking"`, so the press now waits for it. */
  readonly onWaiting?: () => void;
  /** Read once the session settles; `true` (the control unmounted, the reader moved on) drops
   *  the press without running either outcome. */
  readonly isCancelled?: () => boolean;
}

export interface SessionGateDeps {
  readonly store: Pick<AuthSessionStore, "getSnapshot" | "whenSettled">;
  readonly requestAuth: (intent: AuthIntent) => string;
}

/**
 * THE LOGIN GATE for a press (T-162). `"checking"` is not `"anonymous"`: treating it as one
 * opened the auth dialog for a signed-in reader who pressed before the session check answered,
 * the dialog then turned into "Zaten Giriş Yaptın" and the press was lost. A known state is
 * dispatched SYNCHRONOUSLY, inside the press, so an action that needs the user activation keeps
 * it; only a `"checking"` press waits for {@link AuthSessionStore.whenSettled}.
 */
export function gateOnAuthSession(
  options: SessionGateOptions,
  deps: SessionGateDeps = { store, requestAuth },
): Promise<SessionGateOutcome> {
  const dispatch = (settled: SettledAuthSessionState): SessionGateOutcome => {
    if (settled === "authenticated") {
      options.onAuthenticated();
      return "ran";
    }
    options.onAuthRequested(deps.requestAuth(options.intent));
    return "auth-requested";
  };

  const now = deps.store.getSnapshot();
  if (now !== "checking") return Promise.resolve(dispatch(now));

  options.onWaiting?.();
  return deps.store
    .whenSettled()
    .then((settled) => (options.isCancelled?.() === true ? "cancelled" : dispatch(settled)));
}

/**
 * {@link gateOnAuthSession} for a single control: `waiting` drives the control's loading state,
 * a second press while waiting is ignored, an unmount cancels the wait, and both callbacks are
 * read at settle time so the action sees the latest render's state.
 */
export function useSessionGate(
  intent: AuthIntent,
  onAuthenticated: () => void,
  onAuthRequested: (requestId: string) => void,
): { readonly waiting: boolean; readonly run: () => void } {
  const [waiting, setWaiting] = useState(false);
  const waitingRef = useRef(false);
  const mountedRef = useRef(false);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const onAuthRequestedRef = useRef(onAuthRequested);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
    onAuthRequestedRef.current = onAuthRequested;
  }, [onAuthenticated, onAuthRequested]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(() => {
    if (waitingRef.current) return;
    void gateOnAuthSession({
      intent,
      onAuthenticated: () => onAuthenticatedRef.current(),
      onAuthRequested: (requestId) => onAuthRequestedRef.current(requestId),
      onWaiting: () => {
        waitingRef.current = true;
        setWaiting(true);
      },
      isCancelled: () => !mountedRef.current,
    }).finally(() => {
      if (!waitingRef.current) return;
      waitingRef.current = false;
      if (mountedRef.current) setWaiting(false);
    });
  }, [intent]);

  return { waiting, run } as const;
}

/**
 * `useAuthSession()` — the shared session-check hook. **THIRTEEN consumers** today
 * (`git grep -l "useAuthSession(" -- '*.ts' '*.tsx'`, tests and this file excluded): three under
 * `components/book/` and ten under `components/v2/`. All of them read the SAME store through this
 * hook, so a successful modal login propagates to every one without a page reload
 * (uyelik-auth-redesign plan §5.4/K1).
 *
 * A COUNT AND THE COMMAND THAT PRODUCES IT, not a list. The list this replaces had been
 * half-updated across two rewrites and named three files that no longer existed
 * (`login-form.tsx`, `favorite-button.tsx`, `game-round-save.tsx` — V1, deleted in T-032 PR4)
 * while missing most of the ones that did. A hand-maintained roster in a docblock decays exactly
 * that way, and nothing fails when it does.
 *
 * Returns a `useState`-shaped tuple rather than a bare value, DELIBERATELY departing from an
 * illustrative one-line sketch some plan text uses (`const authState = useAuthSession();`):
 * the signed-in branch of `v2-login-card.tsx`'s `handleLogout` optimistically flips the
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
