import { describe, expect, it } from "vitest";
import { labelBox, pinLabelPlacement, placePinLabels, type PinLabel } from "./pin-label-placement";

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

describe("placePinLabels", () => {
  const view = { x: -55, y: -310, w: 1080, h: 1080 };
  /** A label about "Trabzon"-sized at 1× on a 360 px phone, in map units. */
  const label = (x: number, y: number, width = 150): PinLabel => ({
    x,
    y,
    gap: 30,
    width,
    height: 40,
  });
  const dotRadius = 18;
  const overlap = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it("keeps the away-from-centre side when nothing is in the way", () => {
    const pins = [label(300, 200), label(700, 200)];
    expect(placePinLabels(pins, { view, dotRadius })).toEqual(["left", "right"]);
  });

  // T-127: the "Karadeniz Kıyısı" example, five pins along the coast. Trabzon's label faced
  // right, away from the centre, straight into Rize's dot and label ("T…Rize").
  it("never lets a label cover another pin's dot or another label", () => {
    const pins = [
      label(610, 40, 130), // Samsun
      label(700, 60, 90), // Ordu
      label(760, 62, 130), // Giresun
      label(860, 60, 140), // Trabzon
      label(905, 48, 80), // Rize
    ];
    const sides = placePinLabels(pins, { view, dotRadius });
    const boxes = pins.map((p, i) => labelBox(p, sides[i]!));
    for (let i = 0; i < pins.length; i++) {
      for (let j = 0; j < pins.length; j++) {
        if (i === j) continue;
        const dot = {
          x: pins[j]!.x - dotRadius,
          y: pins[j]!.y - dotRadius,
          w: dotRadius * 2,
          h: dotRadius * 2,
        };
        expect(overlap(boxes[i]!, dot), `label ${i} on pin ${j}'s dot`).toBe(false);
        if (j > i) expect(overlap(boxes[i]!, boxes[j]!), `labels ${i} and ${j}`).toBe(false);
      }
    }
  });

  // T-124: at 1× on a phone the view is barely wider than Türkiye.
  it("turns a label that would leave the view back into it", () => {
    // Edirne and Iğdır facing away from each other ran off both sides of the plate.
    const pins = [label(15, 110), label(990, 190)];
    const sides = placePinLabels(pins, { view, dotRadius });
    pins.forEach((p, i) => {
      const box = labelBox(p, sides[i]!);
      expect(box.x, `label ${i}`).toBeGreaterThanOrEqual(view.x);
      expect(box.x + box.w, `label ${i}`).toBeLessThanOrEqual(view.x + view.w);
    });
  });

  it("turns a label at the top or bottom edge back into the view", () => {
    const pins = [label(500, -300), label(520, 760)];
    expect(placePinLabels(pins, { view, dotRadius })).toEqual(["below", "above"]);
  });

  it("puts a lone pin's label above it", () => {
    expect(placePinLabels([label(500, 200)], { view, dotRadius })).toEqual(["above"]);
  });

  it("takes the side that overflows least when no side is clear", () => {
    // A pin in a narrow view: no side fits, but the one sticking out least must win rather
    // than the preferred side, which ran "Iğdır" off the plate.
    const narrow = { x: 900, y: 100, w: 120, h: 200 };
    const pins = [label(300, 200), label(990, 200, 100)];
    // right sticks out 100 × 40, left 40 × 40, above and below 20 × 40 each.
    const [, side] = placePinLabels(pins, { view: narrow, dotRadius });
    expect(side).toBe("above");
  });

  // The "Marmara Denizi" example at 320 px: eight corners in a 239 px box. Placed in order
  // only, a late label found every side taken and settled on the least-bad overlap.
  it("keeps a dense ring of labels apart", () => {
    const px = (x: number, y: number) => label(x * 4.5, y * 4.5, 34 * 4.5);
    const pins = [
      px(57, 138),
      px(89, 110),
      px(117, 106),
      px(147, 110),
      px(182, 121),
      px(152, 137),
      px(107, 141),
      px(81, 139),
    ].map((p) => ({ ...p, gap: 9 * 4.5, height: 15 * 4.5 }));
    const sides = placePinLabels(pins, {
      view: { x: 0, y: 0, w: 239 * 4.5, h: 239 * 4.5 },
      dotRadius: 6 * 4.5,
    });
    const boxes = pins.map((p, i) => labelBox(p, sides[i]!));
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        expect(overlap(boxes[i]!, boxes[j]!), `labels ${i + 1} and ${j + 1}`).toBe(false);
      }
    }
  });
});
