import { describe, expect, it } from "vitest";
import {
  CELL_FALLBACK_KM,
  MAX_DECLARED_SHIFT_KM,
  cellFallbackDisplayKm,
  roundKmToOneDecimal,
} from "./cell-fallback";

/**
 * STRUCTURAL guards for the A-1 declared cell fallback. `CONVENTIONS.md` §2: a test checks
 * structure and invariants, never facts. So nothing below asserts that Antalya's shift is
 * 7,55 km — that is the ledger's claim and the api's load gate re-derives it every run. What
 * IS asserted is everything that must hold whatever the ledger says: the list stays closed,
 * the values stay inside the bound the api enforces, and the rounding that turns a stored
 * value into a published digit behaves the way a reader would.
 *
 * The one place a literal set appears is the plate codes, and that is deliberate: "exactly
 * these five and no others" is not a measurement, it is the A-1 ruling's own closed-list
 * condition. A sixth entry appearing here without a ledger change is precisely the event
 * this file exists to stop.
 */

/** The closed set A-1 declares (Antalya, Mersin, Ordu, Sinop, Trabzon). */
const DECLARED_PLATE_CODES = ["07", "33", "52", "57", "61"] as const;

describe("the declared cell-fallback list is closed", () => {
  it("carries exactly the five declared provinces", () => {
    expect(Object.keys(CELL_FALLBACK_KM).sort()).toEqual([...DECLARED_PLATE_CODES].sort());
  });

  it("is frozen, so a caller cannot quietly add a sixth at runtime", () => {
    expect(Object.isFrozen(CELL_FALLBACK_KM)).toBe(true);
  });

  it.each(DECLARED_PLATE_CODES)("stores a usable distance for %s", (plateCode) => {
    const km = CELL_FALLBACK_KM[plateCode];
    expect(Number.isFinite(km)).toBe(true);
    expect(km).toBeGreaterThan(0);
  });

  it.each(DECLARED_PLATE_CODES)("keeps %s inside the api's own abort ceiling", (plateCode) => {
    // The api stops its load run past this bound (SPEC §4.1-4). A copy that drifted beyond it
    // would be describing a state the pipeline would never have produced.
    expect(CELL_FALLBACK_KM[plateCode]).toBeLessThan(MAX_DECLARED_SHIFT_KM);
  });

  it.each(DECLARED_PLATE_CODES)("writes %s to at most two decimals", (plateCode) => {
    // This is the PRECONDITION `roundKmToOneDecimal` documents, asserted rather than assumed:
    // its `Math.round(km * 10)` step lands exactly on the midpoint only for values written to
    // two decimals. An entry with more would round by luck.
    const written = String(CELL_FALLBACK_KM[plateCode]).split(".")[1] ?? "";
    expect(written.length).toBeLessThanOrEqual(2);
  });
});

describe("roundKmToOneDecimal publishes one decimal, half-up on the written number", () => {
  // Synthetic inputs on purpose — these prove the FUNCTION's behaviour and would keep
  // passing (correctly) if every ledger value changed tomorrow.
  it.each([
    [7.42, 7.4],
    [11.34, 11.3],
    [13.19, 13.2],
  ])("rounds %s to %s", (input, expected) => {
    expect(roundKmToOneDecimal(input)).toBe(expected);
  });

  it.each([
    [1.25, 1.3],
    [2.45, 2.5],
    [8.85, 8.9],
  ])("takes the half-way case %s upward, to %s", (input, expected) => {
    // The case the whole helper exists for. `(1.25).toFixed(1)` and `Intl.NumberFormat`
    // disagree here, because one rounds the exact binary double and the other does not — so
    // leaving the choice to the formatter would make the published digit depend on the
    // runtime's ICU. These assertions pin the answer to the one a reader would give.
    expect(roundKmToOneDecimal(input)).toBe(expected);
  });

  it("does not disagree with toFixed by accident — it disagrees on purpose", () => {
    // A canary for the exact trap. If a future refactor swaps the implementation for
    // `Number(km.toFixed(1))`, this line is what notices.
    expect(Number((7.55).toFixed(1))).toBe(7.5);
    expect(roundKmToOneDecimal(7.55)).toBe(7.6);
  });
});

describe("cellFallbackDisplayKm", () => {
  it("returns null for a province with no declared shift", () => {
    // 76 of 81. Not a missing value: those provinces are read from their own centre's cell,
    // which the always-rendered `notice.readingPoint` line already states.
    expect(cellFallbackDisplayKm("06")).toBeNull();
  });

  it("returns null for a plate code that is not a province at all", () => {
    expect(cellFallbackDisplayKm("99")).toBeNull();
    expect(cellFallbackDisplayKm("")).toBeNull();
  });

  it.each(DECLARED_PLATE_CODES)("returns a one-decimal value for %s", (plateCode) => {
    const shown = cellFallbackDisplayKm(plateCode);
    expect(shown).not.toBeNull();
    const decimals = String(shown).split(".")[1] ?? "";
    expect(decimals.length).toBeLessThanOrEqual(1);
  });

  it.each(DECLARED_PLATE_CODES)("stays faithful to the stored value for %s", (plateCode) => {
    // The published figure is a rounding of the stored one, never a different number.
    const shown = cellFallbackDisplayKm(plateCode);
    expect(shown).not.toBeNull();
    expect(Math.abs((shown as number) - CELL_FALLBACK_KM[plateCode]!)).toBeLessThanOrEqual(0.05);
  });

  it("never hands a two-decimal figure to the page", () => {
    // The rule this whole helper exists to enforce (→ Atlas ruling): two decimals would
    // promise ten-metre precision for a value sampled from a cell tens of kilometres across.
    for (const plateCode of DECLARED_PLATE_CODES) {
      expect(String(cellFallbackDisplayKm(plateCode))).not.toMatch(/\.\d\d/);
    }
  });
});
