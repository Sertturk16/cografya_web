import { describe, expect, it } from "vitest";
import { isPasswordPolicyCompliant, PASSWORD_MAX, PASSWORD_MIN } from "./form-rules";

/**
 * Review `VAL85-R3` (aliases `TEST85-I1`): {@link isPasswordPolicyCompliant} is the reset-
 * confirm screen's one client-side gate on the new password, and it was shipped with no
 * direct test — `form-rules.contract.test.ts` (gate G2) only compares `PASSWORD_MIN`/
 * `PASSWORD_MAX` against `openapi/openapi.json`, never calling the function's own
 * character-class logic. THIS FILE IS DELIBERATELY A SEPARATE MODULE FROM THAT ONE (the
 * validator's own instruction): G2's contract is "constants equal the spec", and folding an
 * uncontracted class-rule table into it would let a future "G2 is green" read as covering
 * more than G2 actually promises — the exact scope-drift class this same round already found
 * twice (`SEC85-M1`, `CODE85-M6`).
 */

/** A minimal string of exactly `length` characters that satisfies all three character
 *  classes — "Aa1" padded with lowercase filler. `length` is always taken from the real
 *  exported bounds, never hardcoded, so this stays correct if the contract-derived bounds
 *  ever move. */
function compliantOfLength(length: number): string {
  return "Aa1" + "a".repeat(Math.max(0, length - 3));
}

describe("isPasswordPolicyCompliant — positive", () => {
  const accepted = [
    "Abcdef1",
    "Password1",
    "aB3aB3aB3",
    compliantOfLength(PASSWORD_MIN),
    compliantOfLength(PASSWORD_MAX),
  ];

  for (const value of accepted) {
    it(`accepts ${JSON.stringify(value)} (length ${value.length})`, () => {
      expect(isPasswordPolicyCompliant(value)).toBe(true);
    });
  }
});

describe("isPasswordPolicyCompliant — negative, one missing class at a time", () => {
  // Positive control first: the shared base IS accepted, so the negative cases below are
  // proof a single missing class flips the result, not proof the base itself was already
  // rejected for an unrelated reason.
  const base = "Abcdef1";
  it("positive control — the shared base string is itself accepted", () => {
    expect(isPasswordPolicyCompliant(base)).toBe(true);
  });

  it("rejects with no lowercase", () => {
    expect(isPasswordPolicyCompliant("ABCDEF1")).toBe(false);
  });

  it("rejects with no uppercase", () => {
    expect(isPasswordPolicyCompliant("abcdef1")).toBe(false);
  });

  it("rejects with no digit", () => {
    expect(isPasswordPolicyCompliant("Abcdefg")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isPasswordPolicyCompliant("")).toBe(false);
  });
});

describe("isPasswordPolicyCompliant — length bounds", () => {
  it(`rejects one character below PASSWORD_MIN (${PASSWORD_MIN})`, () => {
    const value = compliantOfLength(PASSWORD_MIN - 1);
    expect(value.length).toBe(PASSWORD_MIN - 1);
    expect(isPasswordPolicyCompliant(value)).toBe(false);
  });

  it(`rejects one character above PASSWORD_MAX (${PASSWORD_MAX})`, () => {
    const value = compliantOfLength(PASSWORD_MAX + 1);
    expect(value.length).toBe(PASSWORD_MAX + 1);
    expect(isPasswordPolicyCompliant(value)).toBe(false);
  });

  it(`accepts exactly PASSWORD_MIN (${PASSWORD_MIN}) characters`, () => {
    expect(isPasswordPolicyCompliant(compliantOfLength(PASSWORD_MIN))).toBe(true);
  });

  it(`accepts exactly PASSWORD_MAX (${PASSWORD_MAX}) characters`, () => {
    expect(isPasswordPolicyCompliant(compliantOfLength(PASSWORD_MAX))).toBe(true);
  });
});
