import { describe, expect, it } from "vitest";
import {
  INTERNAL_REQUEST_HEADER,
  buildApiRequestHeaders,
  describeThrottleExemption,
} from "./internal-token";

/**
 * Structural contract tests for the trusted-client throttle-exemption header. Four
 * invariants are worth a test here, all of them structural (no facts, no api round-trip):
 *
 *   1. **Fail-closed** — with no configured token the produced headers are byte-identical
 *      to the pre-#67 client (`{ Accept }` only). A regression here would start sending an
 *      `x-internal-request-token: undefined` header to the api on every SSG page.
 *   2. **The header name matches the api constant exactly** (lowercase). A silent rename on
 *      either side of the contract re-enables the 429 build failures with no error message
 *      anywhere, which is exactly the class of drift a pinned string catches in CI.
 *   3. **The 429 diagnostic never carries the value** — it is appended to an `ApiError`
 *      message that the build-time resilient wrappers `console.warn`, i.e. straight into
 *      retained CI logs, so "state only" is a security invariant, not a style preference.
 *   4. **The diagnostic cannot contradict the wire** — it must report "configured" exactly
 *      when the header is actually attached.
 *
 * The client-bundle leak guard for the env var NAME lives in `lib/env.server.test.ts`
 * (it is an assertion about the CLIENT schema `lib/env.ts`, not about this module).
 */
const VALID_TOKEN = "a".repeat(48);

describe("buildApiRequestHeaders", () => {
  it("sends no exemption header when no token is configured (fail-closed)", () => {
    expect(buildApiRequestHeaders(undefined)).toEqual({ Accept: "application/json" });
    expect(buildApiRequestHeaders(undefined)).not.toHaveProperty(INTERNAL_REQUEST_HEADER);
  });

  it("treats an empty token as unset, mirroring the api guard", () => {
    expect(buildApiRequestHeaders("")).toEqual({ Accept: "application/json" });
  });

  it("attaches the token verbatim alongside Accept when configured", () => {
    expect(buildApiRequestHeaders(VALID_TOKEN)).toEqual({
      Accept: "application/json",
      "x-internal-request-token": VALID_TOKEN,
    });
  });

  it("never mutates a shared object between calls", () => {
    const withToken = buildApiRequestHeaders(VALID_TOKEN);
    const withoutToken = buildApiRequestHeaders(undefined);
    expect(withToken).toHaveProperty(INTERNAL_REQUEST_HEADER);
    expect(withoutToken).not.toHaveProperty(INTERNAL_REQUEST_HEADER);
  });
});

describe("INTERNAL_REQUEST_HEADER", () => {
  it("pins the api-side contract string, lowercase", () => {
    // Must equal INTERNAL_REQUEST_HEADER in cografya_api
    // src/common/throttler/trusted-client.ts — Node lowercases incoming header keys.
    expect(INTERNAL_REQUEST_HEADER).toBe("x-internal-request-token");
    expect(INTERNAL_REQUEST_HEADER).toBe(INTERNAL_REQUEST_HEADER.toLowerCase());
  });
});

describe("describeThrottleExemption", () => {
  it("never reveals the token value (the string is logged verbatim on a 429)", () => {
    const hint = describeThrottleExemption(VALID_TOKEN);

    expect(hint).not.toContain(VALID_TOKEN);
    // Also not a prefix of it: a truncated secret in a log line is still a disclosure.
    expect(hint).not.toContain(VALID_TOKEN.slice(0, 8));
  });

  it("names the env var in both states so the operator can act on the message", () => {
    expect(describeThrottleExemption(VALID_TOKEN)).toContain("INTERNAL_REQUEST_TOKEN");
    expect(describeThrottleExemption(undefined)).toContain("INTERNAL_REQUEST_TOKEN");
  });

  it("never contradicts what was actually sent on the wire", () => {
    // The diagnostic and the header must share one predicate: a hint that says "configured"
    // while no header was attached (or vice versa) sends the operator down the wrong path.
    for (const token of [undefined, "", VALID_TOKEN]) {
      const headerAttached = INTERNAL_REQUEST_HEADER in buildApiRequestHeaders(token);
      const hint = describeThrottleExemption(token);

      expect(hint).toMatch(/configured/i);
      expect(/not configured/i.test(hint)).toBe(!headerAttached);
    }
  });
});
