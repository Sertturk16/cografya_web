"use client";

import type { AuthBffCode } from "./transport.server";

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

  try {
    const res = await fetch(`/api/auth/${action}${query}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const parsed: unknown = await res.json();
    return parseBffBody(parsed);
  } catch {
    return { ok: false, code: "errors.transport.unavailable" };
  }
}

function parseBffBody(value: unknown): SubmitAuthResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return { ok: false, code: "errors.transport.unavailable" };
  }
  const body = value as Record<string, unknown>;

  if (body.ok === true) {
    return {
      ok: true,
      redirectTo: typeof body.redirectTo === "string" ? body.redirectTo : undefined,
    };
  }
  if (body.ok === false && typeof body.code === "string") {
    return { ok: false, code: body.code as AuthBffCode };
  }
  return { ok: false, code: "errors.transport.unavailable" };
}
