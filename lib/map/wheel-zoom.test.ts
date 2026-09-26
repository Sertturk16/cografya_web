import { describe, expect, it } from "vitest";
import { isApplePlatform, offsetFromCentre, wheelZoomFactor } from "./wheel-zoom";

describe("wheelZoomFactor", () => {
  it("is 1 for no movement", () => {
    expect(wheelZoomFactor(0, 0)).toBe(1);
  });

  it("zooms in for an upward wheel and out for a downward one, symmetrically", () => {
    const up = wheelZoomFactor(-100, 0);
    const down = wheelZoomFactor(100, 0);
    expect(up).toBeGreaterThan(1);
    expect(up * down).toBeCloseTo(1);
  });

  it("caps one mouse notch at about x1.65", () => {
    expect(wheelZoomFactor(-100, 0)).toBeCloseTo(Math.exp(0.5));
    expect(wheelZoomFactor(-1000, 0)).toBeCloseTo(Math.exp(0.5));
  });

  it("keeps a trackpad pinch step small", () => {
    expect(wheelZoomFactor(-4, 0)).toBeCloseTo(Math.exp(0.04));
  });

  it("converts line and page deltas to pixels", () => {
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(Math.exp(0.48));
    expect(wheelZoomFactor(1, 2)).toBeCloseTo(Math.exp(-0.5));
  });
});

describe("isApplePlatform", () => {
  it.each([
    ["MacIntel", true],
    ["macOS", true],
    ["iPhone", true],
    ["iPad", true],
    ["Win32", false],
    ["Windows", false],
    ["Linux x86_64", false],
    ["", false],
  ])("%s → %s", (platform, expected) => {
    expect(isApplePlatform(platform)).toBe(expected);
  });
});

describe("offsetFromCentre", () => {
  it("measures from the centre of the padding box, inside the border", () => {
    const box = {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
      clientLeft: 1,
      clientTop: 1,
      clientWidth: 200,
      clientHeight: 100,
    };
    // Centre: (10 + 1 + 100, 20 + 1 + 50) = (111, 71).
    expect(offsetFromCentre(box, 111, 71)).toEqual({ x: 0, y: 0 });
    expect(offsetFromCentre(box, 11, 121)).toEqual({ x: -100, y: 50 });
  });
});
