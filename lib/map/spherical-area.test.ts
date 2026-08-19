import { describe, expect, it } from "vitest";
import { EARTH_RADIUS_M, type LonLat, ringAreaKm2 } from "./spherical-area";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Nothing here asserts the area of a real lake or
 * province — that is a fact about the world, it belongs to the api and the provenance
 * ledger, and pinning it would turn a legitimate snapshot refresh into a red build. Every
 * ring below is synthetic.
 *
 * ## Why this file carries pinned NUMBERS, unusually for a structural test
 *
 * This formula MOVED here out of `scripts/lib/water-geometry.mjs` (CBS-P2 SPEC §5.2), where
 * it had been deciding for months which lakes get drawn. The vectors below were captured
 * from that pre-move implementation and are pinned so a future edit cannot silently change
 * what the water artifacts were built from. They are not claims about geography: they are
 * this function's own output on inputs that do not exist.
 *
 * ## And why the pinning is load-bearing rather than belt-and-braces (measured)
 *
 * The obvious guard — CI's `pnpm generate:water:check` — does NOT cover this arithmetic. It
 * was tested directly: with `EARTH_RADIUS_M` changed by 30 % the regenerated artifact came
 * back byte-identical and the gate stayed green, because the offline generator spends this
 * function only on a console diagnostic (`generate-tr-inland-water.mjs:499`). That gate
 * covers the module WIRING (breaking the import specifier does turn it red) and nothing
 * else. So these vectors are the only thing standing between an edit here and a silently
 * different water map.
 *
 * Do not replace them with a recomputation of the formula under test. That version passes
 * unconditionally and proves nothing.
 */

/** A 1°×1° box in the northern hemisphere. Synthetic — no place is at its corners. */
const BOX: readonly LonLat[] = [
  [32, 39],
  [33, 39],
  [33, 40],
  [32, 40],
];

const TRIANGLE: readonly LonLat[] = [
  [30, 36],
  [31, 36],
  [30.5, 37],
];

describe("ringAreaKm2 — pinned to the pre-move implementation", () => {
  it("returns the captured value for a 1°×1° box", () => {
    expect(ringAreaKm2(BOX)).toBe(9540.512136366135);
  });

  it("returns the captured value for a triangle", () => {
    expect(ringAreaKm2(TRIANGLE)).toBe(4969.519050928256);
  });

  it("returns the captured values for equator-adjacent and high-latitude boxes", () => {
    // The same 1°×1° extent is a smaller ground area further from the equator. Pinning both
    // ends fixes the latitude dependence, which is the whole reason this is not a planar
    // shoelace: a bug that dropped the `sin(latitude)` term would still pass a single-box
    // test taken near 39°.
    const equatorial: readonly LonLat[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const high: readonly LonLat[] = [
      [0, 60],
      [1, 60],
      [1, 61],
      [0, 61],
    ];
    expect(ringAreaKm2(equatorial)).toBe(12363.718145180046);
    expect(ringAreaKm2(high)).toBe(6088.417933464369);
    expect(ringAreaKm2(high)).toBeLessThan(ringAreaKm2(equatorial));
  });

  it("still uses the IUGG mean radius the water artifacts were built from", () => {
    // The constant is exported and shared with `measure.ts`, so it is reachable from two
    // sides now. This pins it at its source.
    expect(EARTH_RADIUS_M).toBe(6371008.8);
  });
});

describe("ringAreaKm2 — invariants", () => {
  it("is winding-independent: a clockwise ring equals its counter-clockwise twin", () => {
    // The sign must never leak to a caller. The area tool would otherwise show a negative
    // number for shapes drawn in one direction (SPEC §6.3).
    expect(ringAreaKm2([...BOX].reverse())).toBe(ringAreaKm2(BOX));
  });

  it("is independent of which vertex the ring starts at", () => {
    // Written out rather than sliced from BOX: `noUncheckedIndexedAccess` would make that a
    // string of non-null assertions, and a literal says what is being tested more plainly.
    const rotated: readonly LonLat[] = [
      [33, 39],
      [33, 40],
      [32, 40],
      [32, 39],
    ];
    expect(ringAreaKm2(rotated)).toBe(ringAreaKm2(BOX));
  });

  it("accepts an explicitly closed ring, agreeing with the open form to float noise", () => {
    // The generators pass closed rings, the drawing tools pass open ones. The repeated
    // vertex contributes a term that is zero in exact arithmetic — but the accumulation
    // order changes, so this is a tolerance comparison and not `toBe` on purpose.
    const closed: readonly LonLat[] = [
      [30, 36],
      [31, 36],
      [30.5, 37],
      [30, 36],
    ];
    expect(ringAreaKm2(closed)).toBeCloseTo(ringAreaKm2(TRIANGLE), 9);
  });

  it("returns 0 for anything that is not yet a ring", () => {
    // Every click on a half-drawn polygon calls this, so fewer than three points is a normal
    // state and not an error.
    expect(ringAreaKm2([])).toBe(0);
    expect(ringAreaKm2([[32, 39]])).toBe(0);
    expect(
      ringAreaKm2([
        [32, 39],
        [33, 40],
      ]),
    ).toBe(0);
  });

  it("returns 0 for a degenerate ring whose vertices coincide", () => {
    expect(
      ringAreaKm2([
        [32, 39],
        [32, 39],
        [32, 39],
      ]),
    ).toBe(0);
  });
});
