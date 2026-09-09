import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  ALLOWED_SCHEMES,
  REGISTER_PATH_PATTERN,
  RenderAuthError,
  allocateBaseName,
  assertLoopbackTarget,
  assertNoRegisterPath,
  assertSameOrigin,
  isLoopbackAddress,
  isLoopbackHostname,
  normalizeHostname,
  originKey,
  redactSecrets,
  registerSecret,
  sanitizePathForFilename,
  type DnsLookupFn,
} from "./render-auth-guards.ts";

// -------------------------------------------------------------------------------------------
// A. assertLoopbackTarget
// -------------------------------------------------------------------------------------------

describe("assertLoopbackTarget", () => {
  const loopbackV4: DnsLookupFn = async () => [{ address: "127.0.0.1", family: 4 }];
  const loopbackV6: DnsLookupFn = async () => [{ address: "::1", family: 6 }];

  it("accepts http://localhost:3000", async () => {
    await expect(assertLoopbackTarget("http://localhost:3000", loopbackV4)).resolves.toBeInstanceOf(
      URL,
    );
  });

  it("accepts http://127.0.0.1:3000", async () => {
    await expect(assertLoopbackTarget("http://127.0.0.1:3000", loopbackV4)).resolves.toBeInstanceOf(
      URL,
    );
  });

  it("accepts https://localhost:3000", async () => {
    await expect(
      assertLoopbackTarget("https://localhost:3000", loopbackV4),
    ).resolves.toBeInstanceOf(URL);
  });

  it("accepts http://[::1]:3000 and calls the lookup with the STRIPPED hostname (SEC131-M1)", async () => {
    const spy = vi.fn(async () => [{ address: "::1", family: 6 }]);
    await expect(assertLoopbackTarget("http://[::1]:3000", spy)).resolves.toBeInstanceOf(URL);
    expect(spy).toHaveBeenCalledWith("::1");
    expect(spy).not.toHaveBeenCalledWith("[::1]");
  });

  it("accepts http://[0:0:0:0:0:0:0:1]:3000 (expanded IPv6 form, WHATWG-normalized)", async () => {
    await expect(
      assertLoopbackTarget("http://[0:0:0:0:0:0:0:1]:3000", loopbackV6),
    ).resolves.toBeInstanceOf(URL);
  });

  it("accepts http://%6cocalhost:3000 (http: is a special scheme — the host IS percent-decoded)", async () => {
    await expect(
      assertLoopbackTarget("http://%6cocalhost:3000", loopbackV4),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects file://127.0.0.1/etc/ on scheme, before the host is even looked at (VAL131SEC-M2)", async () => {
    const spy = vi.fn(loopbackV4);
    await expect(assertLoopbackTarget("file://127.0.0.1/etc/", spy)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects ftp://localhost/ on scheme", async () => {
    await expect(assertLoopbackTarget("ftp://localhost/", loopbackV4)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("rejects http://evil.example/", async () => {
    await expect(assertLoopbackTarget("http://evil.example/", loopbackV4)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("rejects a host that resolves off-loopback", async () => {
    const spy: DnsLookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
    await expect(assertLoopbackTarget("http://localhost:3000", spy)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("rejects when only SOME resolved addresses are loopback (the .every half)", async () => {
    const spy: DnsLookupFn = async () => [
      { address: "127.0.0.1", family: 4 },
      { address: "93.184.216.34", family: 4 },
    ];
    await expect(assertLoopbackTarget("http://localhost:3000", spy)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("rejects an empty resolution list", async () => {
    const spy: DnsLookupFn = async () => [];
    await expect(assertLoopbackTarget("http://localhost:3000", spy)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("rejects when DNS throws", async () => {
    const spy: DnsLookupFn = async () => {
      throw new Error("ENOTFOUND localhost");
    };
    await expect(assertLoopbackTarget("http://localhost:3000", spy)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("rejects http://localhost./ (fail-closed, pinned deliberately)", async () => {
    await expect(assertLoopbackTarget("http://localhost./", loopbackV4)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("rejects a malformed URL", async () => {
    await expect(assertLoopbackTarget("not a url", loopbackV4)).rejects.toBeInstanceOf(
      RenderAuthError,
    );
  });

  it("ALLOWED_SCHEMES contains exactly http: and https:", () => {
    expect([...ALLOWED_SCHEMES].sort()).toEqual(["http:", "https:"]);
  });
});

// -------------------------------------------------------------------------------------------
// B. isLoopbackAddress
// -------------------------------------------------------------------------------------------

describe("isLoopbackAddress", () => {
  it.each([
    ["::1", true],
    ["127.0.0.1", true],
    ["127.255.255.255", true],
    ["::ffff:127.0.0.1", true],
    ["128.0.0.1", false],
    ["127.0.0.256", false], // SEC143-M2 class: out-of-range octet
    ["1127.0.0.1", false],
    ["0177.0.0.1", false],
  ])("isLoopbackAddress(%s) === %s", (address, expected) => {
    expect(isLoopbackAddress(address)).toBe(expected);
  });
});

// -------------------------------------------------------------------------------------------
// C. normalizeHostname
// -------------------------------------------------------------------------------------------

describe("normalizeHostname", () => {
  it("strips IPv6 bracket notation", () => {
    expect(normalizeHostname("[::1]")).toBe("::1");
  });

  it("lowercases", () => {
    expect(normalizeHostname("LOCALHOST")).toBe("localhost");
  });

  it("is idempotent", () => {
    const once = normalizeHostname("[::1]");
    expect(normalizeHostname(once)).toBe(once);
    expect(once).toBe("::1");
  });

  it("isLoopbackHostname is safe against a raw bracketed hostname too", () => {
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
  });
});

// -------------------------------------------------------------------------------------------
// D. REGISTER_PATH_PATTERN / assertNoRegisterPath
// -------------------------------------------------------------------------------------------

describe("REGISTER_PATH_PATTERN / assertNoRegisterPath", () => {
  it.each([
    ["/kayit", true],
    ["/kayit/", true],
    ["/en/register", true],
    ["/v2/kayit", true],
    ["/kayit?x=1", true], // VAL131SEC-M1 — the old pattern missed this
    ["/kayit#a", true], // VAL131SEC-M1 — and this
    ["/kayitli-varliklar", false], // negative control — no false positive
    ["/registered", false], // negative control
    ["/giris", false], // negative control
  ])("REGISTER_PATH_PATTERN.test(%s) === %s", (input, expected) => {
    expect(REGISTER_PATH_PATTERN.test(input)).toBe(expected);
  });

  it("assertNoRegisterPath throws RenderAuthError on a register path", () => {
    expect(() => assertNoRegisterPath("/kayit")).toThrow(RenderAuthError);
  });

  it("assertNoRegisterPath does not throw on a non-register path", () => {
    expect(() => assertNoRegisterPath("/giris")).not.toThrow();
  });
});

// -------------------------------------------------------------------------------------------
// E. originKey / assertSameOrigin
// -------------------------------------------------------------------------------------------

describe("originKey / assertSameOrigin", () => {
  const base = new URL("http://localhost:3000");

  it("accepts /v2/profil (same origin)", () => {
    const url = new URL("/v2/profil", base);
    expect(() => assertSameOrigin(url, base, "test")).not.toThrow();
  });

  it.each(["//evil.example/x", "/\\evil.example/x", "///evil.example/x"])(
    "rejects the measured escape spelling %s",
    (raw) => {
      const url = new URL(raw, base);
      expect(() => assertSameOrigin(url, base, "test")).toThrow(RenderAuthError);
    },
  );

  it("rejects a landed http://evil.example/x", () => {
    const landed = new URL("http://evil.example/x");
    expect(() => assertSameOrigin(landed, base, "test")).toThrow(RenderAuthError);
  });

  it("http://[::1]:3000 compares equal to itself", () => {
    const a = new URL("http://[::1]:3000");
    const b = new URL("http://[::1]:3000/some/path");
    expect(originKey(a)).toBe(originKey(b));
    expect(() => assertSameOrigin(b, a, "test")).not.toThrow();
  });

  it("file://127.0.0.1/a must NOT compare equal to file://other/b (originKey, never the getter)", () => {
    const a = new URL("file://127.0.0.1/a");
    const b = new URL("file://other/b");
    expect(originKey(a)).not.toBe(originKey(b));
    expect(() => assertSameOrigin(a, b, "test")).toThrow(RenderAuthError);
  });
});

// -------------------------------------------------------------------------------------------
// F. redactSecrets / registerSecret
// -------------------------------------------------------------------------------------------

describe("redactSecrets / registerSecret", () => {
  // This test MUST run before any registerSecret() call in this file — it is the true no-op
  // case (nothing registered yet), not merely a string that happens not to match.
  it("is a no-op when nothing has been registered", () => {
    expect(redactSecrets("nothing secret here")).toBe("nothing secret here");
  });

  it("replaces every occurrence of a registered secret", () => {
    registerSecret("s3cr3t-test-value");
    expect(redactSecrets("password is s3cr3t-test-value and again s3cr3t-test-value")).toBe(
      "password is [REDACTED:RENDER_AUTH_PASSWORD] and again [REDACTED:RENDER_AUTH_PASSWORD]",
    );
  });

  it("redacts the measured Playwright call-log message shape, keeping the surrounding diagnostic text", () => {
    registerSecret("HuntedPassword42");
    const message =
      'page.fill: Timeout 15000ms exceeded.\nCall log:\n  fill("HuntedPassword42")\n  waiting for element to be visible, enabled and editable';
    const redacted = redactSecrets(message);
    expect(redacted).not.toContain("HuntedPassword42");
    expect(redacted).toContain('fill("[REDACTED:RENDER_AUTH_PASSWORD]")');
    expect(redacted).toContain("waiting for element to be visible, enabled and editable");
  });
});

// -------------------------------------------------------------------------------------------
// G. allocateBaseName
// -------------------------------------------------------------------------------------------

describe("allocateBaseName", () => {
  it("gives /a/b and /a_b distinct names despite sanitizing to the same string", () => {
    const counts = new Map<string, number>();
    const first = allocateBaseName(counts, "/a/b");
    const second = allocateBaseName(counts, "/a_b");
    expect(sanitizePathForFilename("/a/b")).toBe(sanitizePathForFilename("/a_b"));
    expect(first).toBe("a_b");
    expect(second).toBe("a_b-2");
    expect(first).not.toBe(second);
  });

  it("suffix allocation is deterministic for a given call sequence", () => {
    const counts = new Map<string, number>();
    expect(allocateBaseName(counts, "/x")).toBe("x");
    expect(allocateBaseName(counts, "/x")).toBe("x-2");
    expect(allocateBaseName(counts, "/x")).toBe("x-3");
  });

  it("maps / to root", () => {
    const counts = new Map<string, number>();
    expect(allocateBaseName(counts, "/")).toBe("root");
  });

  it("a --paths entry sanitising to __login-step is pushed to __login-step-2 against a pre-seeded reserved-name map", () => {
    const counts = new Map<string, number>([
      ["__login-step", 1],
      ["__run", 1],
    ]);
    expect(allocateBaseName(counts, "/__login-step")).toBe("__login-step-2");
  });
});

// -------------------------------------------------------------------------------------------
// H. Structural tripwires — text assertions against render-authenticated-page.ts itself, not
// semantic ones. They catch the accidental call site: a future contributor adding a second
// `page.goto`, or an inline origin comparison that bypasses originKey entirely.
// -------------------------------------------------------------------------------------------

describe("structural tripwires on render-authenticated-page.ts", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./render-authenticated-page.ts", import.meta.url)),
    "utf8",
  );

  it("(i) .goto( appears exactly once, inside a navigate() function", () => {
    const gotoMatches = source.match(/\.goto\s*\(/g) ?? [];
    expect(gotoMatches).toHaveLength(1);
    expect(source).toContain("async function navigate(");
  });

  it("(ii) the built-in origin getter never appears — every comparison goes through originKey", () => {
    const originGetterMatches = source.match(/\.origin\b/g) ?? [];
    expect(originGetterMatches).toHaveLength(0);
  });
});
