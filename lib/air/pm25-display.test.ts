import { describe, expect, it } from "vitest";
import { PM25_CONTRACT_UNIT, PM25_DECIMALS, pm25DisplayUnit, roundPm25 } from "./pm25-display";

/** Structure and invariants only — no value below is a claim about a province's air. */

describe("pm25DisplayUnit", () => {
  it("maps the contract's token to the catalogue's typography", () => {
    expect(pm25DisplayUnit(PM25_CONTRACT_UNIT, "µg/m³")).toBe("µg/m³");
  });

  it("pins the contract token's exact code points, not merely its appearance", () => {
    // U+00B5 MICRO SIGN + ASCII "3". A reviewer cannot see the difference between this and
    // U+03BC GREEK SMALL LETTER MU or U+00B3 SUPERSCRIPT THREE by eye, so a machine checks.
    expect([...PM25_CONTRACT_UNIT].map((c) => c.codePointAt(0))).toEqual([
      0x00b5, 0x67, 0x2f, 0x6d, 0x33,
    ]);
  });

  it("returns an UNRECOGNISED token unchanged rather than relabelling it", () => {
    // Showing someone else's unit raw is honest and visibly odd; printing "µg/m³" over it
    // would silently relabel their number. The contract does not promise one token.
    expect(pm25DisplayUnit("ppb", "µg/m³")).toBe("ppb");
    expect(pm25DisplayUnit("µg/m³", "µg/m³")).toBe("µg/m³");
    expect(pm25DisplayUnit("", "µg/m³")).toBe("");
  });
});

describe("roundPm25", () => {
  it("publishes one decimal", () => {
    expect(PM25_DECIMALS).toBe(1);
    expect(roundPm25(22.74346923828125)).toBe(22.7);
    expect(roundPm25(48.024398803710938)).toBe(48);
    expect(roundPm25(10.415)).toBe(10.4);
  });

  it("produces a value with no more than one decimal place, for any input", () => {
    for (const raw of [0, 1.04999, 13.7068, 19.25, 22.74346923828125, 47.2503, 48.0244]) {
      const rounded = roundPm25(raw);
      expect(Math.round(rounded * 10)).toBe(rounded * 10);
    }
  });

  it("is idempotent — rounding an already-rounded value changes nothing", () => {
    // This is what lets the JSON-LD PropertyValue and the visible figure be THE SAME
    // number rather than two representations of it (SEO-POLICY §B5 5.7).
    for (const raw of [13.7068, 22.74346923828125, 47.2503]) {
      expect(roundPm25(roundPm25(raw))).toBe(roundPm25(raw));
    }
  });

  it("agrees with Intl's own rounding at the same precision", () => {
    // The visible string comes from `format.number(roundPm25(v), {min:1, max:1})`. If the
    // two rounding modes ever disagreed, the page and the structured data would drift apart
    // by a digit with every check still green.
    const intl = new Intl.NumberFormat("en", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    for (const raw of [13.7068, 19.25, 22.74346923828125, 47.2503, 48.0244]) {
      expect(intl.format(roundPm25(raw))).toBe(intl.format(raw));
    }
  });
});
