/**
 * Trusted-client throttle-exemption header — the web half of the api's
 * `TrustedClientThrottlerGuard` contract (cografya_api PR #67).
 *
 * The api exempts safe reads (GET/HEAD) that present the shared secret
 * `INTERNAL_REQUEST_TOKEN` in the `x-internal-request-token` header from its global
 * 120 req/min rate limit. Without it a full `next build` (572 pages across 9 workers)
 * reliably trips the limiter and fails — the reason this wiring exists.
 *
 * SECURITY — the whole boundary in three rules:
 *
 *   1. The header NAME is not a secret; the VALUE is. Never use a `NEXT_PUBLIC_`
 *      prefix for it (that would inline the secret into every client bundle) and never
 *      read it outside a `server-only` module.
 *   2. **Fail-closed, mirroring `isTrustedClientRequest` on the api side:** an absent
 *      OR empty token means the header is simply not sent. The exemption does not exist
 *      until a secret is deliberately configured, and behaviour with no token is
 *      byte-identical to the pre-#67 client.
 *   3. This module is deliberately free of `import "server-only"` and of any
 *      `process.env` read: it holds a header name and a pure function, so it carries no
 *      secret and stays unit-testable. The env read lives in `lib/env.server.ts`; the
 *      value is passed in by the single caller (`lib/api/client.ts`).
 */

/**
 * The api's header name, lowercase to match the api-side constant
 * (`src/common/throttler/trusted-client.ts`) exactly. A rename on either side is a
 * contract change that routes through Atlas — the unit test pins this string so a silent
 * drift fails CI instead of quietly re-enabling the 429s.
 */
export const INTERNAL_REQUEST_HEADER = "x-internal-request-token";

/**
 * The fail-closed predicate, single-sourced so the header we SEND and the diagnostic we
 * PRINT can never disagree about whether an exemption was attempted. Module-private: the
 * two consumers below are the only ones that need it.
 */
function isTokenConfigured(
  internalRequestToken: string | undefined,
): internalRequestToken is string {
  return internalRequestToken !== undefined && internalRequestToken !== "";
}

/**
 * Request headers for a server-side api **GET**: the JSON `Accept` every call sends, plus
 * the trusted-client token when (and only when) one is configured.
 *
 * GET/HEAD ONLY — do not reuse this for a write call site. The api hard-scopes the
 * exemption to safe methods, so a POST (the roadmap's AI-vision endpoint, admin CRUD)
 * would carry the secret for nothing: no bypass, just extra exposure surface.
 */
export function buildApiRequestHeaders(
  internalRequestToken: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };

  // Fail-closed: no secret configured (unset or empty) → no header, no exemption.
  if (isTokenConfigured(internalRequestToken)) {
    headers[INTERNAL_REQUEST_HEADER] = internalRequestToken;
  }

  return headers;
}

/**
 * Operator-facing diagnostic appended to a 429 from the api. A plain
 * `ApiError … status 429` is byte-identical whether the token is absent, stale, rotated on
 * one side only or mangled — so the natural reading is "rate limit, retry" and nothing
 * points at `INTERNAL_REQUEST_TOKEN`. This names the suspect.
 *
 * SECURITY: reports the STATE only, never the value — the returned string is logged by the
 * build-time resilient wrappers, so a value here would land in retained CI logs.
 * `internal-token.test.ts` pins that.
 */
export function describeThrottleExemption(internalRequestToken: string | undefined): string {
  return isTokenConfigured(internalRequestToken)
    ? "trusted-client exemption token IS configured on the web side — verify it matches the api's INTERNAL_REQUEST_TOKEN byte-for-byte (a rotation on one side only looks exactly like this)"
    : "trusted-client exemption token is NOT configured on the web side — set INTERNAL_REQUEST_TOKEN to the api's value to exempt build reads from the rate limit";
}
