import { describe, expect, it } from "vitest";
import {
  MARKER_HIT_RADIUS_PX,
  markerHitRadius,
  markerTextLegible,
} from "@/lib/map/marker-legibility";

/** Measured content boxes: `/deniz` 1214px and `/deprem` 1164px at 1440, 326/284px at 360. */
const deniz = (box: number) => box / 1270;

describe("markerTextLegible (T-087)", () => {
  it("keeps the 8.5-unit desktop values, where they measure ~8px", () => {
    expect(markerTextLegible(8.5, deniz(1214))).toBe(true);
    expect(markerTextLegible(8.5, 1164 / 1270)).toBe(true);
  });

  it("moves them off the marker on a phone and a tablet, where they measure 2-6px", () => {
    for (const box of [284, 326, 700, 900]) expect(markerTextLegible(8.5, box / 1270)).toBe(false);
  });

  it("draws the desktop map before the box is measured", () => {
    expect(markerTextLegible(8.5, null)).toBe(true);
  });
});

describe("markerHitRadius (T-087)", () => {
  it("never gives a marker less than design.md's 24px touch target", () => {
    for (const box of [284, 326, 700, 1214]) {
      const scale = box / 1270;
      expect(markerHitRadius(3.5, scale) * scale).toBeGreaterThanOrEqual(MARKER_HIT_RADIUS_PX);
    }
  });

  it("keeps a larger authored radius, and the authored one before measurement", () => {
    expect(markerHitRadius(23, 1214 / 1270)).toBe(23);
    expect(markerHitRadius(7, null)).toBe(7);
  });
});
