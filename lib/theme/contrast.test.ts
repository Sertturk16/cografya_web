import { describe, expect, it } from "vitest";
import {
  blendOver,
  contrastRatio,
  ratio,
  relativeLuminance,
  TEXT_MIN,
  GRAPHICAL_MIN,
} from "./contrast";

describe("relativeLuminance", () => {
  it("anchors at the two endpoints WCAG defines exactly", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });

  it("uses the linear ramp below the 0.03928 breakpoint", () => {
    // #0a0a0a is 10/255 = 0.0392, just under the knee, so it takes the /12.92 branch.
    expect(relativeLuminance("#0a0a0a")).toBeCloseTo(0.0392 / 12.92, 4);
  });
});

describe("contrastRatio", () => {
  it("gives 21 for black on white — the published maximum", () => {
    expect(ratio("#000000", "#ffffff")).toBe(21);
  });

  it("gives 1 for a colour against itself", () => {
    expect(ratio("#b0522e", "#b0522e")).toBe(1);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#496f35", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#496f35"),
      10,
    );
  });

  it("accepts three-digit hex and a missing #", () => {
    expect(ratio("#fff", "000")).toBe(21);
  });

  it("rejects anything that is not an sRGB hex", () => {
    expect(() => relativeLuminance("oklch(0.65 0.13 40)")).toThrow(/sRGB hex/);
  });
});

/**
 * Reproduces a figure `app/globals.css` already documents, so a change to this module that
 * silently shifted the maths would be caught against a number the repo has relied on since
 * before this file existed.
 */
describe("agrees with a ratio already recorded in globals.css", () => {
  it("--color-success #496f35 on white is 5.82:1", () => {
    expect(ratio("#496f35", "#ffffff")).toBeCloseTo(5.82, 1);
  });

  it("--color-success #496f35 on --color-surface #f1e9de is 4.84:1", () => {
    expect(ratio("#496f35", "#f1e9de")).toBeCloseTo(4.84, 1);
  });

  it("--game-hover-edge #211c19 on Marmara #0072b2 is 3.25:1", () => {
    expect(ratio("#211c19", "#0072b2")).toBeCloseTo(3.25, 1);
  });
});

describe("the warning foreground pairing (T-034 bridge tokens)", () => {
  const WARNING = "#c9860f";

  it("white on --color-warning fails normal-text contrast", () => {
    const r = ratio("#ffffff", WARNING);
    expect(r).toBeLessThan(TEXT_MIN);
    expect(r).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });

  it("--color-ink-dark on --color-warning clears it", () => {
    expect(ratio("#211c19", WARNING)).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

describe("blendOver", () => {
  it("returns the backdrop at alpha 0 and the fill at alpha 1", () => {
    expect(blendOver("#c9860f", 0, "#ffffff")).toBe("#ffffff");
    expect(blendOver("#c9860f", 1, "#ffffff")).toBe("#c9860f");
  });

  it("reproduces the tint the -strong members were derived against", () => {
    // 15% --color-warning over --color-surface: the worst surface a tinted chip lands on.
    const tint = blendOver("#c9860f", 0.15, "#f1e9de");
    expect(ratio("#c9860f", tint)).toBeLessThan(TEXT_MIN);
    expect(ratio("#7d5207", tint)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("rejects an alpha outside 0-1", () => {
    expect(() => blendOver("#000000", 1.5, "#ffffff")).toThrow(/alpha/);
  });
});
