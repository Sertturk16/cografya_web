import { describe, expect, it } from "vitest";
import { canonicalizePhone } from "./form-rules";

/**
 * Review `TEST87-I1`: {@link canonicalizePhone} shipped with zero direct test coverage —
 * it feeds the REQUIRED `phone` field of `buildRegisterPayload`'s payload, has three
 * conditional branches (bare/`0`-prefix/`90`-prefix), and its own docblock claims support
 * for exactly those three written forms. THIS FILE IS DELIBERATELY A SEPARATE MODULE from
 * `form-rules.contract.test.ts` (the same reasoning `form-rules.password-policy.test.ts`
 * already recorded for `isPasswordPolicyCompliant`): G2's contract is "constants equal the
 * spec", and `canonicalizePhone`'s branch logic is not contract-derived at all
 * ({@link PHONE_E164_PATTERN}'s own docblock — read from the api source, no gate) — folding
 * it into G2 would let a future "G2 is green" read as covering more than G2 promises.
 */

describe("canonicalizePhone — the three documented written forms, all converge on one E.164 shape", () => {
  const CANONICAL = "+905551234567";

  it("bare 10-digit (no leading 0, no country code)", () => {
    expect(canonicalizePhone("5551234567")).toBe(CANONICAL);
  });

  it("0-prefixed 11-digit (the field's own placeholder shape, `5XX XXX XX XX`, written with a leading 0)", () => {
    expect(canonicalizePhone("05551234567")).toBe(CANONICAL);
  });

  it("90-prefixed 12-digit (country code, no leading +)", () => {
    expect(canonicalizePhone("905551234567")).toBe(CANONICAL);
  });

  it("+90-prefixed input — the api's own canonical form fed straight back in", () => {
    expect(canonicalizePhone("+905551234567")).toBe(CANONICAL);
  });

  it("accepts the same three forms with human formatting (spaces) mixed in", () => {
    expect(canonicalizePhone("0555 123 45 67")).toBe(CANONICAL);
    expect(canonicalizePhone("555 123 45 67")).toBe(CANONICAL);
    expect(canonicalizePhone("+90 555 123 45 67")).toBe(CANONICAL);
  });
});

describe("canonicalizePhone — negative cases, including the documented-but-untested edge", () => {
  it("positive control — a valid bare number is itself accepted", () => {
    expect(canonicalizePhone("5551234567")).not.toBeNull();
  });

  it(
    "rejects a 00-international prefix — deliberately: the function's own docblock claims " +
      "support for exactly three written forms (bare, 0-prefix, 90-prefix), and a `00`-prefixed " +
      "input is a fourth, unsupported form. `00905551234567` has 14 digits, matches neither the " +
      "`90`+12-digit nor the `0`+11-digit branch, so it falls through to the bare-digits branch " +
      "unmodified and fails the E.164 length check — a silent-but-INTENTIONAL null, not a bug " +
      "(TEST87-I1's fix instruction: document the edge with a comment or an explicit test, not " +
      "silently leave it unproven). A future reader who wants `00` support must add a fourth " +
      "branch and a new test here, not assume this input already worked.",
    () => {
      expect(canonicalizePhone("0090 532 123 45 67")).toBeNull();
    },
  );

  it("rejects the empty string", () => {
    expect(canonicalizePhone("")).toBeNull();
  });

  it("rejects a number with too few digits", () => {
    expect(canonicalizePhone("555123")).toBeNull();
  });

  it("rejects a number with too many digits (not the 90-prefix 12-digit shape)", () => {
    expect(canonicalizePhone("15551234567")).toBeNull();
  });

  it("rejects a string with no digits at all", () => {
    expect(canonicalizePhone("abc")).toBeNull();
  });

  it("rejects a landline-shaped number (does not start with mobile prefix 5)", () => {
    expect(canonicalizePhone("2121234567")).toBeNull();
  });
});
