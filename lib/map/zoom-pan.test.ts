import { describe, expect, it } from "vitest";
import {
  CLICK_DURATION_THRESHOLD_MS,
  CLICK_MOVE_THRESHOLD_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  type ViewBox,
  clampPan,
  clampZoom,
  formatViewBox,
  isRealClick,
  moveDistance,
  panBy,
  parseViewBox,
  zoomAtPoint,
  zoomOf,
} from "./zoom-pan";

// The committed world-fit viewBox is projection-agnostic; these tests use a round
// stand-in so the arithmetic is easy to reason about. The real value is read from the
// SVG at runtime, so the exact numbers here don't couple the tests to the projection.
const WORLD: ViewBox = { x: 0, y: 0, w: 1000, h: 400 };

describe("parseViewBox", () => {
  it("parses a space-separated viewBox string", () => {
    expect(parseViewBox("0 0 1000 400")).toEqual({ x: 0, y: 0, w: 1000, h: 400 });
  });

  it("tolerates comma/extra-whitespace separators", () => {
    expect(parseViewBox("  10, 20 , 30   40 ")).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it("throws on the wrong number of components", () => {
    expect(() => parseViewBox("0 0 1000")).toThrow();
  });

  it("throws on a non-positive width or height", () => {
    expect(() => parseViewBox("0 0 0 400")).toThrow();
    expect(() => parseViewBox("0 0 1000 -1")).toThrow();
  });

  it("throws on non-finite numbers", () => {
    expect(() => parseViewBox("0 0 abc 400")).toThrow();
  });
});

describe("formatViewBox", () => {
  it("round-trips a whole-number viewBox", () => {
    expect(formatViewBox(WORLD)).toBe("0 0 1000 400");
  });

  it("rounds to 2 decimals to keep the attribute compact", () => {
    expect(formatViewBox({ x: 1.23456, y: 0, w: 10, h: 5 })).toBe("1.23 0 10 5");
  });
});

describe("clampZoom", () => {
  it("passes through an in-range zoom", () => {
    expect(clampZoom(6)).toBe(6);
  });

  it("clamps below MIN_ZOOM (no zooming out past the full world)", () => {
    expect(clampZoom(0.5)).toBe(MIN_ZOOM);
  });

  it("clamps above MAX_ZOOM (owner-ruled 12×)", () => {
    expect(clampZoom(999)).toBe(MAX_ZOOM);
  });
});

describe("zoomOf", () => {
  it("reports 1× for the world-fit view", () => {
    expect(zoomOf(WORLD, WORLD)).toBe(1);
  });

  it("reports 4× when the view width is a quarter of the world", () => {
    expect(zoomOf(WORLD, { x: 0, y: 0, w: 250, h: 100 })).toBe(4);
  });
});

describe("clampPan", () => {
  it("forces the view back onto the world origin at 1× (no empty margin)", () => {
    const drifted: ViewBox = { x: -50, y: 30, w: 1000, h: 400 };
    expect(clampPan(drifted, WORLD)).toEqual({ x: 0, y: 0, w: 1000, h: 400 });
  });

  it("clamps a zoomed view to the left/top edges", () => {
    const past: ViewBox = { x: -20, y: -10, w: 250, h: 100 };
    expect(clampPan(past, WORLD)).toEqual({ x: 0, y: 0, w: 250, h: 100 });
  });

  it("clamps a zoomed view to the right/bottom edges", () => {
    const past: ViewBox = { x: 900, y: 380, w: 250, h: 100 };
    // maxX = 1000 - 250 = 750; maxY = 400 - 100 = 300
    expect(clampPan(past, WORLD)).toEqual({ x: 750, y: 300, w: 250, h: 100 });
  });

  it("leaves an already-in-bounds view untouched", () => {
    const inside: ViewBox = { x: 100, y: 50, w: 250, h: 100 };
    expect(clampPan(inside, WORLD)).toEqual(inside);
  });
});

describe("zoomAtPoint (cursor-anchored zoom)", () => {
  it("keeps the anchored world point stationary when zooming in", () => {
    // Anchor at the exact viewport centre of the world view: world point (500, 200).
    const next = zoomAtPoint(WORLD, WORLD, 4, 0.5, 0.5);
    expect(zoomOf(WORLD, next)).toBe(4);
    // The world point under the centre must still be the centre after zoom.
    expect(next.x + 0.5 * next.w).toBeCloseTo(500, 6);
    expect(next.y + 0.5 * next.h).toBeCloseTo(200, 6);
  });

  it("keeps an off-centre cursor point stationary", () => {
    // Cursor at 25% across / 75% down of the world view → world point (250, 300).
    const next = zoomAtPoint(WORLD, WORLD, 2, 0.25, 0.75);
    expect(next.x + 0.25 * next.w).toBeCloseTo(250, 6);
    expect(next.y + 0.75 * next.h).toBeCloseTo(300, 6);
  });

  it("clamps the requested zoom to MAX_ZOOM", () => {
    const next = zoomAtPoint(WORLD, WORLD, 999, 0.5, 0.5);
    expect(zoomOf(WORLD, next)).toBeCloseTo(MAX_ZOOM, 6);
  });

  it("never produces a view that escapes the world bbox", () => {
    // Anchor at the top-left corner while zooming in — result must stay clamped.
    const next = zoomAtPoint(WORLD, WORLD, 8, 0, 0);
    expect(next.x).toBeGreaterThanOrEqual(WORLD.x);
    expect(next.y).toBeGreaterThanOrEqual(WORLD.y);
    expect(next.x + next.w).toBeLessThanOrEqual(WORLD.x + WORLD.w + 1e-9);
    expect(next.y + next.h).toBeLessThanOrEqual(WORLD.y + WORLD.h + 1e-9);
  });
});

describe("panBy", () => {
  it("moves the view and stays clamped", () => {
    const view: ViewBox = { x: 100, y: 50, w: 250, h: 100 };
    expect(panBy(view, WORLD, 50, 25)).toEqual({ x: 150, y: 75, w: 250, h: 100 });
  });

  it("does not pan past the world edge", () => {
    const view: ViewBox = { x: 700, y: 250, w: 250, h: 100 };
    // Requested +100/+100 would exceed maxX=750 / maxY=300 → clamped.
    expect(panBy(view, WORLD, 100, 100)).toEqual({ x: 750, y: 300, w: 250, h: 100 });
  });
});

describe("moveDistance", () => {
  it("computes euclidean travel", () => {
    expect(moveDistance(3, 4)).toBe(5);
  });
});

describe("isRealClick (SPEC §4 threshold)", () => {
  it("treats a small, brief gesture as a real click → navigate", () => {
    expect(isRealClick(2, 100)).toBe(true);
  });

  it("rejects a gesture that moved too far (it was a pan)", () => {
    expect(isRealClick(CLICK_MOVE_THRESHOLD_PX + 0.5, 100)).toBe(false);
  });

  it("rejects a gesture that lasted too long (a slow press-drag)", () => {
    expect(isRealClick(2, CLICK_DURATION_THRESHOLD_MS + 1)).toBe(false);
  });

  it("requires BOTH conditions: exactly-at-threshold move is not a click", () => {
    // Strict `<` on both axes: a value equal to the threshold is a drag, not a click.
    expect(isRealClick(CLICK_MOVE_THRESHOLD_PX, 10)).toBe(false);
    expect(isRealClick(1, CLICK_DURATION_THRESHOLD_MS)).toBe(false);
  });

  it("sanity: MIN/MAX zoom bounds are the owner-ruled values", () => {
    expect(MIN_ZOOM).toBe(1);
    expect(MAX_ZOOM).toBe(12);
  });
});
