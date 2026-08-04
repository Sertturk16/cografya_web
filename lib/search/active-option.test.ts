import { describe, expect, it } from "vitest";
import { nextActiveIndex } from "./active-option";

describe("nextActiveIndex", () => {
  it("moves down and up through the list", () => {
    expect(nextActiveIndex(0, 5, 1)).toBe(1);
    expect(nextActiveIndex(3, 5, -1)).toBe(2);
  });

  it("wraps at both ends", () => {
    expect(nextActiveIndex(4, 5, 1)).toBe(0);
    expect(nextActiveIndex(0, 5, -1)).toBe(4);
  });

  it("starts from the first option when nothing is selected and the user goes down", () => {
    expect(nextActiveIndex(-1, 5, 1)).toBe(0);
  });

  it("starts from the LAST option when nothing is selected and the user goes up", () => {
    // The case a modulo would get wrong: -1 - 1 must wrap to the end, not to -2 or to 3.
    expect(nextActiveIndex(-1, 5, -1)).toBe(4);
  });

  it("stays selectable in a single-option list", () => {
    expect(nextActiveIndex(-1, 1, 1)).toBe(0);
    expect(nextActiveIndex(0, 1, 1)).toBe(0);
    expect(nextActiveIndex(0, 1, -1)).toBe(0);
  });

  it("reports no selection when there is nothing to select", () => {
    expect(nextActiveIndex(-1, 0, 1)).toBe(-1);
    expect(nextActiveIndex(2, 0, -1)).toBe(-1);
  });

  it("always returns an index that is valid for the list", () => {
    for (let count = 1; count <= 8; count += 1) {
      for (let current = -1; current < count; current += 1) {
        for (const delta of [1, -1] as const) {
          const next = nextActiveIndex(current, count, delta);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
        }
      }
    }
  });
});
