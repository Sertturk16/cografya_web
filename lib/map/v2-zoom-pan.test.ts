import { describe, expect, it } from "vitest";
import { clampPanOffset } from "./v2-zoom-pan";

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
