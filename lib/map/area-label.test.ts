import { describe, expect, it } from "vitest";
import { overlapArea, type Box } from "./pin-label-placement";
import { placeAreaLabel } from "./area-label";
import { segmentHitsBox } from "./segment-labels";
import { pointInPolygon } from "./shape-geometry";

/**
 * T-121. The area tool writes its km² inside the polygon; when the label does not fit inside it
 * goes just outside, and when nothing is free it is dropped (the panel always has the area).
 */
const SIZE = { width: 20, height: 8 };
const BIG_VIEW: Box = { x: -500, y: -500, w: 1000, h: 1000 };
const opts = (extra: Partial<Parameters<typeof placeAreaLabel>[2]> = {}) => ({
  view: BIG_VIEW,
  gap: 2,
  dotRadius: 1,
  ...extra,
});
const boxAt = (c: { x: number; y: number }, size = SIZE): Box => ({
  x: c.x - size.width / 2,
  y: c.y - size.height / 2,
  w: size.width,
  h: size.height,
});
const edgesOf = (ring: { x: number; y: number }[]) =>
  ring.map((p, i) => [p, ring[(i + 1) % ring.length]!] as const);

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
// An L whose area centroid (≈32.2, 32.2) falls in the notch, outside the shape. The vertical arm
// is exactly as wide as the label, so only the horizontal arm (y 0–20) can hold it.
const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 20 },
  { x: 20, y: 20 },
  { x: 20, y: 100 },
  { x: 0, y: 100 },
];
const TINY = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 5, y: 8 },
];

describe("placeAreaLabel", () => {
  it("centres the label on a convex ring's centroid", () => {
    expect(placeAreaLabel(SQUARE, SIZE, opts())).toEqual({ x: 50, y: 50 });
  });

  it("finds room inside a concave ring whose centroid falls outside it", () => {
    const c = placeAreaLabel(L_SHAPE, SIZE, opts());
    expect(c).not.toBeNull();
    expect(pointInPolygon(c!, L_SHAPE)).toBe(true);
    expect(c!.y).toBeLessThan(20);
    for (const [a, b] of edgesOf(L_SHAPE)) expect(segmentHitsBox(a, b, boxAt(c!))).toBe(false);
  });

  it("puts the label just below a ring too small to hold it", () => {
    // Bottom of the ring's box (8) + dot radius (1) + gap (2) + half the label height (4).
    expect(placeAreaLabel(TINY, SIZE, opts())).toEqual({ x: 5, y: 15 });
  });

  it("goes above when below leaves the view", () => {
    const view: Box = { x: -100, y: -100, w: 200, h: 110 }; // ends at y = 10
    expect(placeAreaLabel(TINY, SIZE, opts({ view }))).toEqual({ x: 5, y: -7 });
  });

  it("goes above when below is on an obstacle (the result panel)", () => {
    const panel: Box = { x: -50, y: 10, w: 100, h: 40 };
    expect(placeAreaLabel(TINY, SIZE, opts({ obstacles: [panel] }))).toEqual({ x: 5, y: -7 });
  });

  it("drops the label when every candidate is blocked", () => {
    const wall: Box = { x: -400, y: -400, w: 800, h: 800 };
    expect(placeAreaLabel(TINY, SIZE, opts({ obstacles: [wall] }))).toBeNull();
    expect(placeAreaLabel(SQUARE, SIZE, opts({ obstacles: [wall] }))).toBeNull();
  });

  it("never covers a corner dot, moving outside instead", () => {
    const flat = [
      { x: 0, y: 0 },
      { x: 24, y: 0 },
      { x: 24, y: 12 },
      { x: 0, y: 12 },
    ];
    // Small dots: the label fits inside, box 2–22 × 2–10.
    expect(placeAreaLabel(flat, SIZE, opts({ dotRadius: 1 }))).toEqual({ x: 12, y: 6 });
    // Dots of radius 3 reach into that box, so it goes below: 12 + 3 + 2 + 4.
    const c = placeAreaLabel(flat, SIZE, opts({ dotRadius: 3 }));
    expect(c).toEqual({ x: 12, y: 21 });
  });

  it("keeps an inside label within the view when the ring is partly off it", () => {
    const view: Box = { x: 60, y: -10, w: 200, h: 200 }; // the ring's left 60 units are off view
    const c = placeAreaLabel(SQUARE, SIZE, opts({ view }));
    expect(c).not.toBeNull();
    const box = boxAt(c!);
    expect(box.w * box.h - overlapArea(box, view)).toBeLessThan(1e-9);
    expect(pointInPolygon(c!, SQUARE)).toBe(true);
  });

  it("puts a zero-area ring's label beside the line, not on it", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const c = placeAreaLabel(line, SIZE, opts());
    expect(c).not.toBeNull();
    for (const [a, b] of edgesOf(line)) expect(segmentHitsBox(a, b, boxAt(c!))).toBe(false);
  });

  it("has nothing to label below three points", () => {
    expect(placeAreaLabel(TINY.slice(0, 2), SIZE, opts())).toBeNull();
  });
});
