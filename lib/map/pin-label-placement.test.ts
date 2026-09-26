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

  describe("inside a view (T-124)", () => {
    // Edirne–Iğdır at 1× on a phone: the two pins sit a few px from the plate's sides.
    const view = { x: -55, y: -310, w: 1080, h: 1080 };
    const pts = [
      { x: 15, y: 110 },
      { x: 990, y: 190 },
    ];
    const reach = { x: 150, y: 40 };

    it("moves a sideways label that would leave the view above or below the pin", () => {
      expect(pinLabelPlacement(pts[0]!, pts, { view, reach }).side).toBe("above");
      expect(pinLabelPlacement(pts[1]!, pts, { view, reach }).side).toBe("below");
    });

    it("keeps the sideways label where it fits", () => {
      const wide = { x: -400, y: -310, w: 1800, h: 1080 };
      expect(pinLabelPlacement(pts[0]!, pts, { view: wide, reach }).side).toBe("left");
    });

    it("turns a label at the top or bottom edge back into the view", () => {
      const top = { x: 500, y: -300 };
      const bottom = { x: 520, y: 760 };
      const pair = [top, bottom];
      expect(pinLabelPlacement(top, pair, { view, reach: { x: 150, y: 40 } }).side).toBe("below");
      expect(pinLabelPlacement(bottom, pair, { view, reach: { x: 150, y: 40 } }).side).toBe(
        "above",
      );
    });
  });
});
