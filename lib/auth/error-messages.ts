import type { AuthBffCode } from "./transport.server";

/**
 * Exhaustive map from every BFF error code to the `Auth` message-catalogue key that carries
 * its sentence (plan §4.5/§6.1,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). Keys are RELATIVE to
 * the `Auth` namespace — a caller resolves one with `useTranslations("Auth")` then
 * `t(AUTH_ERROR_MESSAGE_KEYS[code])`.
 *
 * `AuthBffCode` is a closed thirteen-member union exported by `transport.server.ts`, so a
 * member added there makes this object literal fail to satisfy the `Record` type at compile
 * time — the map IS the gate (this file's own docblock in the plan calls it exactly that).
 * `error-messages.test.ts` (gate G3) covers what `tsc` cannot: that every mapped key
 * actually resolves to a non-empty sentence in BOTH catalogues.
 *
 * No screen-specific override exists yet (the plan's "a second, narrow
 * `Partial<Record<…>>` per screen" mechanism) because none of PR-1's three screens needs the
 * same code to read differently — every code below means the same thing everywhere it can
 * occur in `/giris`, `/sifre-sifirlama` and `/sifre-sifirlama/yeni`. Add the override layer
 * only when a real second meaning shows up, not ahead of it.
 */
export const AUTH_ERROR_MESSAGE_KEYS: Record<AuthBffCode, string> = {
  "errors.auth.invalidCredentials": "errors.invalidCredentials",
  "errors.auth.emailNotVerified": "errors.emailNotVerified",
  "errors.auth.accountDisabled": "errors.accountDisabled",
  "errors.auth.tooManyAttempts": "errors.tooManyAttempts",
  "errors.auth.rateLimited": "errors.rateLimited",
  "errors.verify.codeInvalid": "errors.codeInvalid",
  "errors.password.resetTokenInvalid": "errors.resetTokenInvalid",
  "errors.transport.invalidRequest": "errors.invalidRequest",
  "errors.transport.forbidden": "errors.forbidden",
  "errors.transport.unavailable": "errors.unavailable",
  // Never actually rendered from these screens: the `/giris` island treats ANY non-200
  // response from `GET /api/auth/session` (including this exact code) as "no session, show
  // the form" (plan §6.2) rather than routing it through the shared error region. Given a
  // real key anyway so the map stays an honest total function instead of aliasing an
  // unrelated sentence to a code it does not describe.
  "errors.auth.unauthenticated": "errors.unauthenticated",
  // Never reachable from these screens: no PR-1 island calls `refresh` — the plan's own
  // Property line (`transport.server.ts` P3's docblock: "`refresh` is called ONLY from this
  // module's own request path").
  "errors.auth.sessionExpired": "errors.sessionExpired",
  // STRUCTURALLY UNREACHABLE (plan §3.2 #1, measured against `cografya_api` `dev` @
  // `89fed7e`): Nest's `ValidationPipe.flattenValidationErrors` always wraps a DTO-validation
  // failure in a string ARRAY, and `extractApiErrorCode` only ever recognises a STRING
  // `message` — so this key can never actually leave the api and reach the browser; every
  // `register` 400 collapses to `errors.transport.invalidRequest` instead. Kept here, with a
  // real string, only because `AuthBffCode` is a closed union and this object must stay a
  // TOTAL `Record` over it (a missing member would not compile). Its absence from the
  // rendered UI is a measured property of the api, not a bug to "clean up" — do not delete
  // this row.
  "errors.register.weakPassword": "errors.weakPassword",
};
