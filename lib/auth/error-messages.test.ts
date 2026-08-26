import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { AUTH_ERROR_MESSAGE_KEYS } from "./error-messages";
import type { AuthBffCode } from "./transport.server";

/**
 * Exhaustiveness + key-resolution gate (plan §9 G3,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). Compile-time
 * exhaustiveness already comes free from `AUTH_ERROR_MESSAGE_KEYS`'s own
 * `Record<AuthBffCode, string>` annotation — `tsc` refuses a missing member. This file's job
 * is the half `tsc` cannot check: that every mapped key resolves to a real, non-empty
 * sentence in BOTH catalogues, not just a compiling string literal.
 */

function resolve(catalogue: Record<string, unknown>, dottedKey: string): unknown {
  return dottedKey.split(".").reduce<unknown>((node, segment) => {
    if (typeof node !== "object" || node === null) return undefined;
    return (node as Record<string, unknown>)[segment];
  }, catalogue);
}

const CODES = Object.keys(AUTH_ERROR_MESSAGE_KEYS) as AuthBffCode[];

describe("AUTH_ERROR_MESSAGE_KEYS", () => {
  it("covers all thirteen AuthBffCode members, each exactly once", () => {
    // The number is a positive control on the compile-time exhaustiveness `tsc` already
    // enforces: if a fourteenth member existed without a key, the `Record` assignment above
    // would fail to compile before this test ever ran; this line makes the count legible to
    // a human reading a red CI job rather than a TypeScript diagnostic.
    expect(CODES).toHaveLength(13);
    expect(new Set(CODES).size).toBe(13);
  });

  it.each(CODES)("%s resolves to a non-empty string in BOTH catalogues", (code) => {
    const key = AUTH_ERROR_MESSAGE_KEYS[code];
    const trValue = resolve(trMessages.Auth, key);
    const enValue = resolve(enMessages.Auth, key);

    expect(typeof trValue, `tr Auth.${key}`).toBe("string");
    expect((trValue as string).trim().length, `tr Auth.${key}`).toBeGreaterThan(0);

    expect(typeof enValue, `en Auth.${key}`).toBe("string");
    expect((enValue as string).trim().length, `en Auth.${key}`).toBeGreaterThan(0);
  });
});
