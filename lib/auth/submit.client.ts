"use client";

import { AUTH_ERROR_MESSAGE_KEYS } from "./error-messages";
import { safeReturnPath } from "./redirect";
import type { AuthBffCode } from "./transport.server";

/**
 * Wall-clock budget for the browser→BFF round trip (review `VAL85-V3`/`SEC85-M3`). Mirrors
 * `lib/api/client.ts`'s `apiGet` reasoning at browser scale: `fetch` has no default timeout,
 * and before this PR's fix these were the repo's only two unbounded client-side `fetch`
 * calls (the other being `login-form.tsx`'s session check, which imports this same
 * constant). One value, one place — `search-combobox.tsx`'s `FETCH_TIMEOUT_MS` is the
 * in-repo precedent this mirrors, not a shared import, because that module's timeout guards
 * a background index load with its own retry story, not a form submission.
 */
export const AUTH_FETCH_TIMEOUT_MS = 8000;

/**
 * The closed set of actions a BROWSER island may submit through {@link submitAuth} (plan
 * §4.5, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). Derived from
 * `transport.server.ts`'s `AUTH_ACTIONS` table, minus the two members no island ever calls
 * this way:
 *
 * - `"session"` — a GET, read directly with `fetch` by the `/giris` island (plan §6.2); this
 *   wrapper only ever issues a POST.
 * - `"refresh"` — never called from any island; the plan's own Property line
 *   (`transport.server.ts` P3's docblock: "`refresh` is called ONLY from this module's own
 *   request path").
 *
 * `transport.server.ts` carries `import "server-only"` and is not importable from a client
 * bundle; this union is intentionally NOT re-exported from there. It is typed by hand
 * against the same seven POST rows `AUTH_ACTIONS` declares, and a future ninth action added
 * there needs a matching edit here — there is no compile-time link between the two, the same
 * posture `transport.server.ts`'s own `handleAuthRequest` docblock records for its literal
 * mount-point string.
 */
export type AuthAction =
  | "register"
  | "verify-email"
  | "verify-email/resend"
  | "login"
  | "logout"
  | "password-reset/request"
  | "password-reset/confirm";

export type SubmitAuthResult =
  | { readonly ok: true; readonly redirectTo?: string }
  | { readonly ok: false; readonly code: AuthBffCode };

interface SubmitAuthOptions {
  /**
   * Appended to the REQUEST URL's query string, because that is where
   * `handleTokenIssuingAction` reads it from (plan §3.1/§4.5). Only meaningful for `login`
   * and (PR-2) `verify-email` — the two actions that issue a session. Every other action
   * ignores it if supplied.
   */
  readonly returnTo?: string;
}

/**
 * The ONE `fetch` wrapper every auth island uses (plan §4.5). `POST`s to
 * `/api/auth/<action>` with `Content-Type: application/json`, `credentials: "same-origin"`
 * (so the browser attaches the `Origin` header `isValidOrigin` requires) and
 * `cache: "no-store"`.
 *
 * A network failure, an abort, or a body that is not one of the BFF's known shapes is
 * normalised to `{ ok:false, code:"errors.transport.unavailable" }` — the same collapse the
 * BFF already makes for an api 5xx, so the UI has one story for "we could not reach it".
 *
 * NO-STORAGE PROPERTY (gate G5): this function never reads or writes `localStorage`,
 * `sessionStorage`, `indexedDB`, `document.cookie` or the Cache API, and never logs a
 * request or response body.
 */
export async function submitAuth(
  action: AuthAction,
  body: object,
  opts: SubmitAuthOptions = {},
): Promise<SubmitAuthResult> {
  const query = opts.returnTo ? `?returnTo=${encodeURIComponent(opts.returnTo)}` : "";

  // Timer cleared in `finally`, mirroring `apiGet`'s reasoning: the whole request, including
  // the body read below, sits inside the budget — a response whose headers arrive instantly
  // and whose body then stalls is the same hang as a connection that never answers.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`/api/auth/${action}${query}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const parsed: unknown = await res.json();
    return parseBffBody(parsed);
  } catch {
    // Covers a network failure AND the timeout's own abort identically — both are "we could
    // not reach it" to the UI, which is the one story this function promises.
    return { ok: false, code: "errors.transport.unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Both branches close over the SAME unchecked-network-input principle (review `SEC85-M2`/
 * `CODE85-M3`/`VAL85-M1`): a value the api chose is safe to trust as typed; a value that only
 * PASSED THROUGH the api unexamined (the client's own `Origin`-rejection 403, a malformed
 * upstream body) is not, and must be checked before it is trusted as a member of a closed
 * type or handed to a browser API that acts on it.
 *
 * - `code` is checked for UNION MEMBERSHIP before the cast (`Object.hasOwn` against
 *   `AUTH_ERROR_MESSAGE_KEYS`, a compile-time-TOTAL `Record<AuthBffCode, string>` — so a
 *   future member added to the union enters this check for free, unlike a hand-written
 *   `Set`). An unrecognised code was never a crash (`t()` never throws — `use-intl` catches
 *   the lookup failure and falls back to the bare string `"Auth"`) and never a leaked server
 *   string (the value reaching `t()` is `AUTH_ERROR_MESSAGE_KEYS[code]`, the lookup RESULT,
 *   never `code` itself) — but it was a real gap in the map's own documented total-function
 *   promise, and this closes it.
 * - `redirectTo` is re-validated through {@link safeReturnPath} rather than trusted as a
 *   `string`-typed passthrough: this is a NAVIGATION target (`login-form.tsx`'s
 *   `router.replace(result.redirectTo ?? fallbackHome)`), one class more sensitive than a
 *   message-catalogue key. The BFF already sanitises its own `redirectTo` the same way
 *   (`transport.server.ts`'s `safeReturnPath(url.searchParams.get('returnTo'))`), so this is
 *   defence in depth against a future second populating source, not a fix to a reachable bug
 *   today.
 */
function parseBffBody(value: unknown): SubmitAuthResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return { ok: false, code: "errors.transport.unavailable" };
  }
  const body = value as Record<string, unknown>;

  if (body.ok === true) {
    return {
      ok: true,
      redirectTo: typeof body.redirectTo === "string" ? safeReturnPath(body.redirectTo) : undefined,
    };
  }
  if (
    body.ok === false &&
    typeof body.code === "string" &&
    Object.hasOwn(AUTH_ERROR_MESSAGE_KEYS, body.code)
  ) {
    return { ok: false, code: body.code as AuthBffCode };
  }
  return { ok: false, code: "errors.transport.unavailable" };
}
