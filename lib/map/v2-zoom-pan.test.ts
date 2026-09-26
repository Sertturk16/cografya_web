import { describe, expect, it } from "vitest";
import { clampPanOffset, pinchZoomPan } from "./v2-zoom-pan";

describe("clampPanOffset", () => {
  const container = { width: 1000, height: 600 };

  it("locks pan to (0, 0) at zoom 1", () => {
    expect(clampPanOffset({ x: 50, y: -50 }, 1, container.width, container.height)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampPanOffset({ x: 0, y: 0 }, 1, container.width, container.height)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("locks pan to (0, 0) for sub-1 zoom or non-positive container dimensions", () => {
    expect(clampPanOffset({ x: 100, y: 100 }, 0.8, container.width, container.height)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampPanOffset({ x: 100, y: 100 }, 2, 0, 600)).toEqual({ x: 0, y: 0 });
    expect(clampPanOffset({ x: 100, y: 100 }, 2, 1000, 0)).toEqual({ x: 0, y: 0 });
  });

  it("allows movement within boundary at zoom > 1", () => {
    // At zoom = 2, maxPanX = (2 - 1) * 1000 / 2 = 500, maxPanY = (2 - 1) * 600 / 2 = 300
    const offset = { x: 200, y: -150 };
    expect(clampPanOffset(offset, 2, container.width, container.height)).toEqual({
      x: 200,
      y: -150,
    });
  });

  it("strictly clamps positive and negative excursions to exact maximums", () => {
    // At zoom = 2: maxPanX = 500, maxPanY = 300
    expect(clampPanOffset({ x: 1200, y: 800 }, 2, container.width, container.height)).toEqual({
      x: 500,
      y: 300,
    });
    expect(clampPanOffset({ x: -9999, y: -5000 }, 2, container.width, container.height)).toEqual({
      x: -500,
      y: -300,
    });
  });

  it("scales bounds proportionally with zoom factor", () => {
    // At zoom = 3: maxPanX = 2 * 1000 / 2 = 1000, maxPanY = 2 * 600 / 2 = 600
    expect(clampPanOffset({ x: 1500, y: -700 }, 3, container.width, container.height)).toEqual({
      x: 1000,
      y: -600,
    });

    // At zoom = 1.4: maxPanX = 0.4 * 1000 / 2 = 200, maxPanY = 0.4 * 600 / 2 = 120
    expect(clampPanOffset({ x: 250, y: -200 }, 1.4, container.width, container.height)).toEqual({
      x: 200,
      y: -120,
    });
  });
});

describe("pinchZoomPan", () => {
  const box = { width: 1000, height: 600 };
  const start = { zoom: 1, pan: { x: 0, y: 0 }, dist: 100, mid: { x: 100, y: 50 } };

  /** Where the map point that sat under the start midpoint is drawn after the step. */
  function anchorOnScreen(result: { zoom: number; pan: { x: number; y: number } }) {
    const u = {
      x: (start.mid.x - start.pan.x) / start.zoom,
      y: (start.mid.y - start.pan.y) / start.zoom,
    };
    return { x: result.zoom * u.x + result.pan.x, y: result.zoom * u.y + result.pan.y };
  }

  it("keeps the map point under the fingers' midpoint in place while zooming in", () => {
    const result = pinchZoomPan(start, 200, start.mid, 4, box.width, box.height);
    expect(result.zoom).toBe(2);
    expect(result.pan).toEqual({ x: -100, y: -50 });
    expect(anchorOnScreen(result)).toEqual(start.mid);
  });

  it("carries the anchor along when the midpoint itself moves (two-finger pan)", () => {
    const mid = { x: 150, y: 80 };
    const result = pinchZoomPan(start, 200, mid, 4, box.width, box.height);
    expect(result.pan).toEqual({ x: -50, y: -20 });
    expect(anchorOnScreen(result)).toEqual(mid);
  });

  it("stops at the surface's own maximum zoom", () => {
    expect(pinchZoomPan(start, 1000, start.mid, 4, box.width, box.height).zoom).toBe(4);
    expect(pinchZoomPan(start, 1000, start.mid, 3, box.width, box.height).zoom).toBe(3);
  });

  it("never zooms out past 1x, and 1x always means no pan", () => {
    const zoomed = { zoom: 2, pan: { x: 120, y: -40 }, dist: 200, mid: { x: 0, y: 0 } };
    expect(pinchZoomPan(zoomed, 50, zoomed.mid, 4, box.width, box.height)).toEqual({
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  });

  it("clamps the pan so a two-finger drag cannot reveal space beyond the map", () => {
    const zoomed = { zoom: 2, pan: { x: 400, y: 0 }, dist: 100, mid: { x: -400, y: 0 } };
    // Raw pan would be 400 - (-400 - 400) = 1200; at 2x the box allows 500.
    const result = pinchZoomPan(zoomed, 100, { x: 400, y: 0 }, 4, box.width, box.height);
    expect(result).toEqual({ zoom: 2, pan: { x: 500, y: 0 } });
  });

  it("holds the start zoom when the start distance cannot define a ratio", () => {
    const degenerate = { zoom: 2, pan: { x: 0, y: 0 }, dist: 0, mid: { x: 0, y: 0 } };
    expect(pinchZoomPan(degenerate, 300, degenerate.mid, 4, box.width, box.height).zoom).toBe(2);
  });
});
