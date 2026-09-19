import { describe, expect, it } from "vitest";
import {
  blendOver,
  contrastRatio,
  parseColor,
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

  it("agrees with the published curve at a low value", () => {
    // #0a0a0a is 10/255 ≈ 0.0392, below both candidate sRGB knees (0.03928 and 0.04045), so
    // this does not by itself discriminate which branch ran: the curve is continuous at the
    // knee, and at this sample size the two branches agree to 7.5e-7 against this 5e-5
    // tolerance, so an implementation that deleted the conditional would also pass.
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

describe("oklch input", () => {
  it("resolves the two achromatic endpoints to pure white and pure black", () => {
    expect(relativeLuminance("oklch(1 0 0)")).toBeCloseTo(1, 6);
    expect(relativeLuminance("oklch(0 0 0)")).toBe(0);
  });

  it("gives the published maximum for oklch white on oklch black", () => {
    expect(ratio("oklch(1 0 0)", "oklch(0 0 0)")).toBe(21);
  });

  it("measures a real .dark brand token against a real .dark surface", () => {
    // --primary and --background, both copied from app/globals.css's .dark block.
    // This is the query the module could not answer before: one oklch, one hex.
    expect(ratio("oklch(0.65 0.13 40.65)", "#0b1416")).toBe(5.47);
  });

  it("measures the warning token on the card surface it is actually used over", () => {
    expect(ratio("oklch(0.75 0.13 75)", "#121e21")).toBe(7.53);
  });

  it("still rejects a string that is none of the three accepted syntaxes", () => {
    expect(() => relativeLuminance("rebeccapurple")).toThrow(/hex, oklch or lab/);
  });

  it("blends an oklch fill over a hex backdrop", () => {
    // 100% of the fill is the fill, whatever syntax it arrived in.
    expect(blendOver("oklch(1 0 0)", 1, "#000000")).toBe("#ffffff");
  });
});

describe("lab() input — the syntax a browser hands BACK for an oklch token", () => {
  /**
   * `getComputedStyle` does not echo `oklch(…)`. Chrome serializes a resolved oklch colour as
   * `lab(L a b)`, so an instrument that measures what a page actually paints meets this notation
   * and not the one `app/globals.css` authors. Before T-033 task 8 this module rejected it, and
   * the measurement harness that hit the rejection fell back to the DECLARED token in silence —
   * a whole dark column of readings sourced from the stylesheet while claiming to be resolved
   * DOM ink. The two happened to agree; that is a fact to be measured, not assumed.
   *
   * CSS Color 4's `lab()` is D50. The two matrices the conversion needs are unit-testable only
   * through their endpoints and through real sRGB primaries, so both are exercised: an
   * implementation that skipped the Bradford adaptation still lands white and black correctly
   * and misses the primaries by several bytes.
   */
  it("anchors at the two achromatic endpoints", () => {
    expect(parseColor("lab(100 0 0)")).toEqual([255, 255, 255]);
    expect(parseColor("lab(0 0 0)")).toEqual([0, 0, 0]);
  });

  it("round-trips the sRGB primaries, which is what proves the D50 adaptation ran", () => {
    // The published D50 Lab coordinates of sRGB red and blue. Dropping the D50 → D65 Bradford
    // step leaves red at roughly #ff0f00 and blue at #001bff — plausible-looking and wrong.
    expect(parseColor("lab(54.2905 80.8124 69.8911)")).toEqual([255, 0, 0]);
    expect(parseColor("lab(29.5683 68.2986 -112.0294)")).toEqual([0, 0, 255]);
  });

  it("agrees with the oklch declaration it is the browser's echo of", () => {
    // Measured, not asserted from theory: `lab(73.7049 29.9329 29.6267)` is what Chrome reported
    // for `text-primary-strong` on the book page in dark; `oklch(0.78 0.11 40.65)` is what
    // `app/globals.css`'s `.dark` block declares for `--primary-strong`. They resolve to the
    // same byte triple, so a reading taken from the DOM and one taken from the stylesheet are
    // now the same reading rather than two that were never compared.
    const resolved = "lab(73.7049 29.9329 29.6267)";
    const declared = "oklch(0.78 0.11 40.65)";
    expect(parseColor(resolved)).toEqual(parseColor(declared));
    // …and on the three dark surfaces that ink is actually painted on.
    expect(ratio(resolved, "#121e21")).toBe(ratio(declared, "#121e21")); // the tile, bg-card
    expect(ratio(resolved, "#0b1416")).toBe(ratio(declared, "#0b1416")); // the page background
    expect(ratio(resolved, "#1b2b2f")).toBe(ratio(declared, "#1b2b2f")); // the hovered tile
  });

  it("accepts a negative b and a percentage L, and rejects an alpha", () => {
    expect(parseColor("lab(29.5683 68.2986 -112.0294)")).toEqual([0, 0, 255]);
    expect(parseColor("lab(100% 0 0)")).toEqual([255, 255, 255]);
    // A translucent colour has no contrast of its own; it belongs in `blendOver` with its
    // backdrop named, which is the same line `parseOklch` draws for `oklch(1 0 0 / 10%)`.
    expect(() => parseColor("lab(50 0 0 / 50%)")).toThrow(/hex, oklch or lab/);
  });

  it("blends a lab fill over a hex backdrop", () => {
    expect(blendOver("lab(100 0 0)", 1, "#000000")).toBe("#ffffff");
  });
});
