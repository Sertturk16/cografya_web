import { describe, expect, it } from "vitest";
import { pinLabelPlacement } from "./pin-label-placement";

describe("pinLabelPlacement", () => {
  it("puts a lone pin's label above it", () => {
    expect(pinLabelPlacement({ x: 3, y: 3 }, [{ x: 3, y: 3 }])).toEqual({ side: "above" });
  });

  it("puts each label on the side facing away from the points' centre", () => {
    const pts = [
      { x: 0, y: -10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -10, y: 0 },
    ];
    expect(pts.map((p) => pinLabelPlacement(p, pts).side)).toEqual([
      "above",
      "right",
      "below",
      "left",
    ]);
  });

  it("prefers above/below when the pin is as far off vertically as sideways", () => {
    const pts = [
      { x: 5, y: -5 },
      { x: -5, y: 5 },
    ];
    expect(pinLabelPlacement(pts[0]!, pts).side).toBe("above");
    expect(pinLabelPlacement(pts[1]!, pts).side).toBe("below");
  });

  it("reads the centre from all points, not the origin", () => {
    const pts = [
      { x: 100, y: 50 },
      { x: 120, y: 50 },
    ];
    expect(pinLabelPlacement(pts[0]!, pts).side).toBe("left");
    expect(pinLabelPlacement(pts[1]!, pts).side).toBe("right");
  });
});
