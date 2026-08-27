import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./same-origin";

/**
 * The cases `lib/auth/transport.server.test.ts` T12 already covers through
 * `handleAuthRequest`, exercised directly against the extracted function — plus the new
 * caller (`lib/video-progress/transport.server.ts`'s `PUT` handler) needs no separate case
 * here: it is the SAME function, not a second implementation.
 */

function requestWithOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  return new Request("https://example.invalid/", { headers });
}

describe("isSameOrigin", () => {
  it("accepts an Origin that matches exactly", () => {
    expect(
      isSameOrigin(requestWithOrigin("https://cografya.example"), "https://cografya.example"),
    ).toBe(true);
  });

  it("rejects a missing Origin header — a same-origin browser call always sends one", () => {
    expect(isSameOrigin(requestWithOrigin(null), "https://cografya.example")).toBe(false);
  });

  it("rejects a different Origin", () => {
    expect(
      isSameOrigin(requestWithOrigin("https://evil.example"), "https://cografya.example"),
    ).toBe(false);
  });

  it("rejects a same-host, different-scheme Origin", () => {
    expect(
      isSameOrigin(requestWithOrigin("http://cografya.example"), "https://cografya.example"),
    ).toBe(false);
  });

  it("rejects a same-scheme, different-port Origin", () => {
    expect(
      isSameOrigin(requestWithOrigin("https://cografya.example:8443"), "https://cografya.example"),
    ).toBe(false);
  });
});
