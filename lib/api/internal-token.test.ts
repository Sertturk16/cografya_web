import { describe, expect, it } from "vitest";
import { INTERNAL_REQUEST_HEADER, buildApiRequestHeaders } from "./internal-token";

/**
 * Structural contract tests for the trusted-client throttle-exemption header. Three
 * invariants are worth a test here, all of them structural (no facts, no api round-trip):
 *
 *   1. **Fail-closed** — with no configured token the produced headers are byte-identical
 *      to the pre-#67 client (`{ Accept }` only). A regression here would start sending an
 *      `x-internal-request-token: undefined` header to the api on every SSG page.
 *   2. **The header name matches the api constant exactly** (lowercase). A silent rename on
 *      either side of the contract re-enables the 429 build failures with no error message
 *      anywhere, which is exactly the class of drift a pinned string catches in CI.
 *   3. **The env var is server-only by name** — nothing in this module may carry a
 *      `NEXT_PUBLIC_` prefix, since that would inline the secret into client bundles.
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

  it("is not a NEXT_PUBLIC_ surface", () => {
    // Guards the one mistake that would leak the secret into every client bundle.
    expect(INTERNAL_REQUEST_HEADER).not.toContain("NEXT_PUBLIC");
  });
});
