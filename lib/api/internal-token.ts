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
 * Request headers for a server-side api GET: the JSON `Accept` every call sends, plus the
 * trusted-client token when (and only when) one is configured.
 */
export function buildApiRequestHeaders(
  internalRequestToken: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };

  // Fail-closed: no secret configured (unset or empty) → no header, no exemption.
  if (internalRequestToken !== undefined && internalRequestToken !== "") {
    headers[INTERNAL_REQUEST_HEADER] = internalRequestToken;
  }

  return headers;
}
