import { describe, expect, it } from "vitest";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";

describe("deltaE00", () => {
  it("is zero for a colour against itself", () => {
    expect(deltaE00("#0072b2", "#0072b2")).toBe(0);
  });

  it("is order-independent", () => {
    expect(deltaE00("#0072b2", "#e69f00")).toBe(deltaE00("#e69f00", "#0072b2"));
  });

  it("gives exactly 100 for black against white — the pure-lightness anchor", () => {
    expect(deltaE00("#000000", "#ffffff")).toBe(100);
  });

  it("reads the oklch syntax too, through the shared parser", () => {
    expect(deltaE00("oklch(1 0 0)", "#ffffff")).toBe(0);
  });

  it("rates two Okabe-Ito tints far apart even though their luminances nearly match", () => {
    // ege / akdeniz measure 1.02:1 in WCAG terms — all but identical by luminance.
    // Colour difference is the instrument that sees them as distinct.
    expect(deltaE00("#e69f00", "#56b4e9")).toBeGreaterThan(CATEGORICAL_MIN);
  });

  it("correctly handles hue difference wrap-around past -180°", () => {
    // marmara (#0072b2) and ege (#e69f00) have a hue difference that wraps past -180°.
    // This tests the bug fix for truncated vs floored modulo in JavaScript.
    expect(deltaE00("#0072b2", "#e69f00")).toBe(55.3);
    expect(deltaE00("#0072b2", "#e69f00")).toBe(deltaE00("#e69f00", "#0072b2"));
  });
});
