import { describe, expect, it } from "vitest";
import {
  MAGNITUDE_MARKER_RADIUS,
  magnitudeBucket,
  magnitudeBucketToken,
  type MagnitudeBucket,
} from "./magnitude";

describe("magnitudeBucket boundary values", () => {
  // The contract's own floor/ceiling (`EARTHQUAKE_MIN_MAGNITUDE_FLOOR`/`…_CEILING`,
  // −1…10) plus every bucket edge named in the plan (§5.6): under 3, 3–3.9, 4–4.9, 5–5.9,
  // 6 and up. Each boundary is tested on BOTH sides so a fence-post error cannot hide.
  const cases: [magnitude: number, expected: MagnitudeBucket][] = [
    [-1, 1], // the contract's own floor
    [0, 1],
    [2.99, 1],
    [3, 2], // lower edge of bucket 2
    [3.9, 2],
    [3.99, 2],
    [4, 3], // lower edge of bucket 3
    [4.9, 3],
    [5, 4], // lower edge of bucket 4
    [5.9, 4],
    [6, 5], // lower edge of bucket 5
    [7.5, 5],
    [10, 5], // the contract's own ceiling
  ];

  for (const [magnitude, expected] of cases) {
    it(`magnitude ${magnitude} → bucket ${expected}`, () => {
      expect(magnitudeBucket(magnitude)).toBe(expected);
    });
  }
});

describe("magnitudeBucketToken", () => {
  it("names the app/globals.css custom property for each bucket", () => {
    expect(magnitudeBucketToken(1)).toBe("--eq-mag-1");
    expect(magnitudeBucketToken(5)).toBe("--eq-mag-5");
  });
});

describe("MAGNITUDE_MARKER_RADIUS", () => {
  it("is monotonically increasing across all five buckets", () => {
    const radii = ([1, 2, 3, 4, 5] as const).map((bucket) => MAGNITUDE_MARKER_RADIUS[bucket]);
    for (let i = 0; i < radii.length - 1; i++) {
      expect(radii[i]!).toBeLessThan(radii[i + 1]!);
    }
  });

  it("declares exactly the five buckets, no more and no fewer", () => {
    expect(Object.keys(MAGNITUDE_MARKER_RADIUS).sort()).toEqual(["1", "2", "3", "4", "5"]);
  });
});
