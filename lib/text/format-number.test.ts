import { describe, expect, it } from "vitest";
import { formatNumber, tr } from "./format-number";

describe("formatNumber (T-093)", () => {
  it("writes the Turkish decimal comma on a TR page", () => {
    expect(formatNumber(21.5, "tr", 1)).toBe("21,5");
    expect(formatNumber(2.9, "tr", 1)).toBe("2,9");
  });

  it("keeps the decimal point on an EN page", () => {
    expect(formatNumber(21.5, "en", 1)).toBe("21.5");
  });

  it("fixes the fraction digits when asked, padding a whole number", () => {
    expect(formatNumber(4, "tr", 1)).toBe("4,0");
    expect(formatNumber(0.25, "tr", 2)).toBe("0,25");
  });

  it("groups thousands with the locale's separator", () => {
    expect(formatNumber(8849, "tr")).toBe("8.849");
    expect(formatNumber(8849, "en")).toBe("8,849");
  });

  it("tr() is the Turkish shorthand", () => {
    expect(tr(27.81, 1)).toBe("27,8");
    expect(tr(0.5)).toBe("0,5");
  });
});
