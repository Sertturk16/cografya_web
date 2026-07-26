import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_REQUEST_HEADER } from "./api/internal-token";

/**
 * Boot-time validation contract for `lib/env.server.ts`.
 *
 * Why the dynamic `import()` dance: the schema parses at MODULE LOAD and throws on failure
 * (that is the "abort boot loudly" behaviour under test), so each case has to stub the env
 * and then re-evaluate the module — hence `vi.resetModules()` + `await import()` instead of
 * a top-level import. `server-only` is aliased to an empty stub for tests only
 * (`vitest.config.ts`); the source assertion in the last block keeps that alias from hiding
 * a removed guard.
 *
 * What is pinned here, and why each is worth a test:
 *
 *   1. **The 32-character boundary**, in both directions. The constraint's own comment
 *      promises that a truncated value "aborts boot loudly"; with no test, loosening it to
 *      `min(4)` — or dropping `.optional()`, which would break every build that does NOT
 *      configure the token, i.e. the documented default — ships silently.
 *   2. **Schema ⇄ wire agreement.** The value leaves as an HTTP header value, so its
 *      character class is a correctness constraint, not cosmetics. Whitespace is either
 *      refused by `Headers` (an internal newline throws a `TypeError` that the build-time
 *      resilient wrappers SWALLOW → a green build with zero prerendered pages and a gutted
 *      sitemap) or silently TRIMMED (→ a digest mismatch against the api's untrimmed value
 *      → permanent 429s while the api logs "exemption: active"). Control and non-ASCII
 *      characters slip past a naive `\S` check and several still throw — quoting the
 *      offending value VERBATIM in the message, i.e. into retained build logs. So: every
 *      value the schema accepts must be a valid, unmutated header value, and the whole
 *      whitespace/control/non-ASCII family must be refused at boot.
 *   3. **The client-bundle leak guard**, asserted where the leak can actually happen (the
 *      `NEXT_PUBLIC_*` schema in `lib/env.ts`) rather than against an unrelated constant.
 *
 * All fixtures are SYNTHETIC shapes (repeated characters) — no real or real-looking secret
 * belongs in a test file.
 */

/** Shortest value the schema is meant to accept. */
const MIN_LENGTH_TOKEN = "a".repeat(32);

const NUL = String.fromCharCode(0x00);
const DEL = String.fromCharCode(0x7f);

/** Shapes an operator can legitimately mint, as synthetic look-alikes. */
const ACCEPTED_TOKENS: readonly [string, string][] = [
  ["exactly 32 characters (the boundary)", MIN_LENGTH_TOKEN],
  ["a hex shape (`openssl rand -hex 32`)", "9f".repeat(32)],
  ["a single-line base64 shape with padding", `${"A".repeat(43)}=`],
  ["a base64url shape (`-` and `_`)", `${"a".repeat(20)}-${"b".repeat(20)}_${"c".repeat(6)}`],
];

/** Every family that must abort boot instead of reaching `fetch`. */
const REJECTED_TOKENS: readonly [string, string][] = [
  ["31 characters (one under the minimum)", "a".repeat(31)],
  ["an empty assignment", ""],
  [
    "an internal newline (a wrapped `openssl rand -base64 64`)",
    `${"a".repeat(20)}\n${"b".repeat(20)}`,
  ],
  ["a trailing newline (`Headers` would silently trim it)", `${"a".repeat(40)}\n`],
  ["surrounding spaces (`Headers` would silently trim them)", ` ${"a".repeat(40)} `],
  ["an internal space", `${"a".repeat(20)} ${"b".repeat(20)}`],
  ["an internal tab", `${"a".repeat(20)}\t${"b".repeat(20)}`],
  ["a NUL control character", `${"a".repeat(20)}${NUL}${"b".repeat(20)}`],
  ["a DEL control character", `${"a".repeat(20)}${DEL}${"b".repeat(20)}`],
  ["a non-ASCII character", `${"a".repeat(40)}ş`],
];

async function loadServerEnv() {
  vi.resetModules();
  return await import("./env.server");
}

beforeEach(() => {
  // Pinned so a stray shell value cannot make an unrelated field decide these cases.
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3001");
  vi.stubEnv("INTERNAL_REQUEST_TOKEN", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("serverEnvSchema — INTERNAL_REQUEST_TOKEN", () => {
  it("boots with no token configured (the documented default: no header, all reads throttled)", async () => {
    const { serverEnv } = await loadServerEnv();

    expect(serverEnv.INTERNAL_REQUEST_TOKEN).toBeUndefined();
  });

  for (const [label, token] of ACCEPTED_TOKENS) {
    it(`accepts ${label}`, async () => {
      vi.stubEnv("INTERNAL_REQUEST_TOKEN", token);

      const { serverEnv } = await loadServerEnv();

      expect(serverEnv.INTERNAL_REQUEST_TOKEN).toBe(token);
    });
  }

  for (const [label, token] of REJECTED_TOKENS) {
    it(`aborts boot on ${label}`, async () => {
      vi.stubEnv("INTERNAL_REQUEST_TOKEN", token);

      await expect(loadServerEnv()).rejects.toThrow(
        /Invalid server environment variables: INTERNAL_REQUEST_TOKEN/,
      );
    });
  }

  it("names the LENGTH problem in the api's own wording (message parity)", async () => {
    vi.stubEnv("INTERNAL_REQUEST_TOKEN", "a".repeat(31));

    await expect(loadServerEnv()).rejects.toThrow(
      /INTERNAL_REQUEST_TOKEN must be at least 32 characters when set/,
    );
  });
});

describe("serverEnvSchema — every accepted token is a valid HTTP header value", () => {
  // The reason the character class exists. If this ever fails, a green boot can still
  // produce either a swallowed build-time `TypeError` or a silently trimmed value that
  // mismatches the api's digest — the two failure modes the schema is there to prevent.
  for (const [label, token] of ACCEPTED_TOKENS) {
    it(`carries ${label} to the api unmutated`, () => {
      const headers = new Headers();

      expect(() => headers.append(INTERNAL_REQUEST_HEADER, token)).not.toThrow();
      expect(headers.get(INTERNAL_REQUEST_HEADER)).toBe(token);
    });
  }
});

describe("INTERNAL_REQUEST_TOKEN — client-bundle leak guard", () => {
  const clientEnvSource = readFileSync(new URL("./env.ts", import.meta.url), "utf8");
  const serverEnvSource = readFileSync(new URL("./env.server.ts", import.meta.url), "utf8");

  it("is never declared as a NEXT_PUBLIC_ variable in the client env schema", () => {
    const publicVarNames = clientEnvSource.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? [];

    // Control assertion: if the file moves or the pattern stops matching, fail loudly
    // instead of passing on an empty list (the vacuous-guard trap this test replaces).
    expect(publicVarNames.length).toBeGreaterThan(0);
    expect(publicVarNames.filter((name) => name.includes("INTERNAL_REQUEST_TOKEN"))).toEqual([]);
  });

  it("stays out of the client schema entirely", () => {
    // `lib/env.ts` holds the vars Next inlines into the browser bundle. The secret has
    // exactly one legitimate home, and it is the server schema.
    expect(clientEnvSource).not.toContain("INTERNAL_REQUEST_TOKEN");
    expect(serverEnvSource).toContain("INTERNAL_REQUEST_TOKEN");
  });

  it("keeps the `server-only` tripwire on the server schema", () => {
    // Tests alias `server-only` to an empty stub, so removing this import would no longer
    // break anything at test time — pin it in the source instead.
    expect(serverEnvSource).toContain('import "server-only";');
  });
});
