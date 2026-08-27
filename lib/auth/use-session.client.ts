"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
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
 * `useAuthSession()` — the shared session-check hook (plan §5.3.1). Two consumers:
 * `login-form.tsx` (refactored to call this instead of carrying its own copy of the effect
 * below) and `video-bench.tsx` (the login gate, §5.3.2). Same fetch, same
 * `AUTH_FETCH_TIMEOUT_MS` budget, same same-origin/no-store/abort-on-unmount contract as the
 * code being extracted — this repo's own stated lesson (`video-bench.tsx`'s `denemeNoOf`
 * docblock: two copies of the same few lines "could answer differently the day one of them
 * learned about a second attribute") is why a second inline copy is not written for the
 * second consumer.
 *
 * Returns a `useState`-shaped tuple rather than a bare value, DELIBERATELY departing from the
 * plan's own illustrative one-line sketch (`const authState = useAuthSession();`): the
 * signed-in branch of `login-form.tsx`'s existing `handleLogout` optimistically flips the
 * rendered state to `"anonymous"` the instant a logout succeeds, without waiting for (or
 * forcing) a second network round trip — a real, pre-existing behaviour this extraction must
 * not regress. Exposing the setter is what lets that one call site keep doing exactly that
 * with no other line in `login-form.tsx` changing; `video-bench.tsx`, which never needs to
 * force the value, destructures only the first element.
 */
export function useAuthSession(): readonly [
  AuthSessionState,
  Dispatch<SetStateAction<AuthSessionState>>,
] {
  const [state, setState] = useState<AuthSessionState>("checking");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
    fetchAuthSessionState(controller.signal)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  return [state, setState] as const;
}
