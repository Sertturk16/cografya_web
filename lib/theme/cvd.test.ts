import { describe, expect, it } from "vitest";
import { simulate, VISIONS } from "./cvd";
import { deltaE00 } from "./delta-e";

describe("simulate", () => {
  it("returns normal vision unchanged, in hex", () => {
    expect(simulate("#0072b2", "normal")).toBe("#0072b2");
  });

  it("normalises oklch input to hex on the way out", () => {
    expect(simulate("oklch(1 0 0)", "normal")).toBe("#ffffff");
  });

  it("leaves the achromatic axis alone under every simulation", () => {
    // Grey has no chroma to lose, so a correct matrix is near-identity on it. This is the
    // control that catches a transposed matrix: a transposed one tints grey.
    for (const vision of VISIONS) {
      expect(deltaE00(simulate("#808080", vision), "#808080")).toBeLessThan(2);
    }
  });

  it("actually collapses red against green for the red-green deficiencies", () => {
    // The positive control. A simulate() that returned its input would pass every assertion
    // in Task 4 while proving nothing, so one test has to show the transform doing work.
    const apart = deltaE00("#d55e00", "#009e73");
    expect(
      deltaE00(simulate("#d55e00", "protanopia"), simulate("#009e73", "protanopia")),
    ).toBeLessThan(apart);
    expect(
      deltaE00(simulate("#d55e00", "deuteranopia"), simulate("#009e73", "deuteranopia")),
    ).toBeLessThan(apart);
  });

  it("names exactly the four visions the palette is checked against", () => {
    expect([...VISIONS]).toEqual(["normal", "protanopia", "deuteranopia", "tritanopia"]);
  });
});
