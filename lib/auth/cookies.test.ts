import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAccessCookie,
  clearSessionCookies,
  deriveSecureCookieAttribute,
  normalizeMaxAge,
  sessionCookieMutations,
} from "./cookies";

const TOKENS = {
  accessToken: "access-token-value",
  accessTokenExpiresInSeconds: 900,
  refreshToken: "refresh-token-value",
  refreshTokenExpiresInSeconds: 2_592_000,
};

describe("T-C1 — set descriptors", () => {
  it("carries the fixed attribute set, no `domain` key, and the two api TTLs", () => {
    const [access, refresh] = sessionCookieMutations(TOKENS, "https://cografya.example");

    expect(access.name).toBe(ACCESS_COOKIE_NAME);
    expect(refresh.name).toBe(REFRESH_COOKIE_NAME);

    for (const descriptor of [access, refresh]) {
      expect(descriptor.options.httpOnly).toBe(true);
      expect(descriptor.options.sameSite).toBe("lax");
      expect(descriptor.options.path).toBe("/");
      expect(descriptor.options).not.toHaveProperty("domain");
    }

    expect(access.options.maxAge).toBe(900);
    expect(refresh.options.maxAge).toBe(2_592_000);
    expect(access.value).toBe(TOKENS.accessToken);
    expect(refresh.value).toBe(TOKENS.refreshToken);
  });
});

describe("T-C2 — Secure derivation", () => {
  it("is true for an https site URL", () => {
    expect(deriveSecureCookieAttribute("https://cografya.example")).toBe(true);
  });

  it("is true for a NON-loopback http site URL (protocol is not consulted)", () => {
    expect(deriveSecureCookieAttribute("http://cografya.example")).toBe(true);
  });

  for (const loopback of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    it(`is false for the loopback host in ${loopback}`, () => {
      expect(deriveSecureCookieAttribute(loopback)).toBe(false);
    });
  }
});

describe("T-C3 — clear equals set field-for-field except maxAge/value", () => {
  it("matches the set descriptors on every other attribute", () => {
    const siteUrl = "https://cografya.example";
    const [setAccess, setRefresh] = sessionCookieMutations(TOKENS, siteUrl);
    const [clearAccess, clearRefresh] = clearSessionCookies(siteUrl);

    expect(clearAccess.name).toBe(setAccess.name);
    expect(clearAccess.value).toBe("");
    expect(clearAccess.options).toEqual({ ...setAccess.options, maxAge: 0 });

    expect(clearRefresh.name).toBe(setRefresh.name);
    expect(clearRefresh.value).toBe("");
    expect(clearRefresh.options).toEqual({ ...setRefresh.options, maxAge: 0 });
  });
});

describe("T-C4 — TTL guard", () => {
  for (const [label, input] of [
    ["zero", 0],
    ["negative", -5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ] as const) {
    it(`normalizes ${label} to 1`, () => {
      expect(normalizeMaxAge(input)).toBe(1);
    });
  }

  it("floors a fractional TTL", () => {
    expect(normalizeMaxAge(900.7)).toBe(900);
  });
});

describe("T-C5 — Secure is bound from derivation through to the real descriptor (SEC84-M3)", () => {
  // T-C2 only ever calls the pure `deriveSecureCookieAttribute()` in isolation; nothing
  // asserted that its result actually reaches a produced cookie descriptor's `secure`
  // field. Today's code passes it through correctly (`buildAttributes(secure, maxAge)`),
  // so this is the regression gate for the reverse rule (`secure: true` hardcoded, or the
  // derived value silently dropped) — not a behaviour change.
  const SITE_URLS = [
    "https://cografya.example",
    "http://cografya.example",
    "http://localhost:3000",
  ];

  it("sessionCookieMutations' secure field matches deriveSecureCookieAttribute for the same site URL", () => {
    for (const siteUrl of SITE_URLS) {
      const [access, refresh] = sessionCookieMutations(TOKENS, siteUrl);
      const expected = deriveSecureCookieAttribute(siteUrl);
      expect(access.options.secure).toBe(expected);
      expect(refresh.options.secure).toBe(expected);
    }
  });

  it("clearSessionCookies' secure field matches deriveSecureCookieAttribute for the same site URL", () => {
    for (const siteUrl of SITE_URLS) {
      const [access, refresh] = clearSessionCookies(siteUrl);
      const expected = deriveSecureCookieAttribute(siteUrl);
      expect(access.options.secure).toBe(expected);
      expect(refresh.options.secure).toBe(expected);
    }
  });

  it("clearAccessCookie's secure field matches deriveSecureCookieAttribute for the same site URL", () => {
    for (const siteUrl of SITE_URLS) {
      const descriptor = clearAccessCookie(siteUrl);
      expect(descriptor.options.secure).toBe(deriveSecureCookieAttribute(siteUrl));
    }
  });
});
