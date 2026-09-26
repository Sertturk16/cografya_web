import { describe, expect, it } from "vitest";
import { overlapArea, type Box } from "./pin-label-placement";
import { placeSegmentLabels, segmentHitsBox } from "./segment-labels";

const SIZE = { width: 20, height: 8 };
const BIG_VIEW: Box = { x: -500, y: -500, w: 1000, h: 1000 };
const opts = (extra: Partial<Parameters<typeof placeSegmentLabels>[2]> = {}) => ({
  view: BIG_VIEW,
  gap: 2,
  dotRadius: 1,
  ...extra,
});
const boxAt = (c: { x: number; y: number }): Box => ({
  x: c.x - SIZE.width / 2,
  y: c.y - SIZE.height / 2,
  w: SIZE.width,
  h: SIZE.height,
});

describe("segmentHitsBox", () => {
  it("sees a segment crossing, touching and missing a box", () => {
    const box = { x: 0, y: 0, w: 10, h: 10 };
    expect(segmentHitsBox({ x: -5, y: 5 }, { x: 15, y: 5 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 10, y: -5 }, { x: 10, y: 15 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 11, y: -5 }, { x: 11, y: 15 }, box)).toBe(false);
    expect(segmentHitsBox({ x: -5, y: -5 }, { x: -1, y: 20 }, box)).toBe(false);
  });
});

describe("placeSegmentLabels", () => {
  it("puts a straight horizontal leg's label above it, just clear of the line", () => {
    // d = half the label's height + gap = 4 + 2.
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([{ x: 50, y: -6 }]);
  });

  it("puts a straight vertical leg's label to its right, half the label's width off", () => {
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([{ x: 12, y: 50 }]);
  });

  it("keeps a diagonal leg's label box off its own line, on the leg's normal", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 100 };
    const [c] = placeSegmentLabels([a, b], [SIZE], opts());
    expect(c).not.toBeNull();
    expect(segmentHitsBox(a, b, boxAt(c!))).toBe(false);
    // On the perpendicular through the midpoint: (c - m) · (b - a) = 0.
    expect((c!.x - 50) * 100 + (c!.y - 50) * 100).toBeCloseTo(0, 9);
  });

  it("puts each label on the outside of the bend", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(placeSegmentLabels(route, [SIZE, SIZE], opts())).toEqual([
      { x: 50, y: -6 },
      { x: 112, y: 50 },
    ]);
  });

  it("takes the other side when the first is under an obstacle", () => {
    const obstacles = [{ x: 30, y: -20, w: 40, h: 15 }];
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [SIZE],
        opts({ obstacles }),
      ),
    ).toEqual([{ x: 50, y: 6 }]);
  });

  it("takes the other side when the first leaves the view", () => {
    const view = { x: -50, y: 0, w: 200, h: 100 };
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 3 },
          { x: 100, y: 3 },
        ],
        [SIZE],
        opts({ view }),
      ),
    ).toEqual([{ x: 50, y: 9 }]);
  });

  it("hides the label when both sides are blocked", () => {
    const obstacles = [
      { x: 30, y: -20, w: 40, h: 15 },
      { x: 30, y: 0.5, w: 40, h: 15 },
    ];
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [SIZE],
        opts({ obstacles }),
      ),
    ).toEqual([null]);
  });

  it("hides the label of a leg shorter than the label and its two dots", () => {
    // 20 along + 4 × dotRadius > 20.
    expect(
      placeSegmentLabels(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([null]);
  });

  it("hides a zero-length leg instead of dividing by zero", () => {
    expect(
      placeSegmentLabels(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        [SIZE],
        opts(),
      ),
    ).toEqual([null]);
  });

  it("hides a label that would cross another leg on either side", () => {
    // Leg B→C touches the "above" box, leg C→D runs through the "below" box.
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 60, y: -8 },
      { x: 40, y: 40 },
    ];
    expect(placeSegmentLabels(route, [SIZE, SIZE, SIZE], opts())[0]).toBeNull();
  });

  it("returns nothing for fewer than two points", () => {
    expect(placeSegmentLabels([{ x: 0, y: 0 }], [], opts())).toEqual([]);
    expect(placeSegmentLabels([], [], opts())).toEqual([]);
  });

  it("never overlaps two labels, a dot or any leg on a zigzag route", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 60, y: 10 },
      { x: 120, y: -5 },
      { x: 180, y: 20 },
      { x: 240, y: 0 },
      { x: 250, y: 30 },
    ];
    const centres = placeSegmentLabels(
      route,
      route.slice(1).map(() => SIZE),
      opts(),
    );
    const boxes = centres.flatMap((c) => (c ? [boxAt(c)] : []));
    expect(boxes.length).toBeGreaterThan(2);
    boxes.forEach((box, i) => {
      boxes.forEach((other, j) => {
        if (i !== j) expect(overlapArea(box, other)).toBe(0);
      });
      route.forEach((p) => {
        expect(overlapArea(box, { x: p.x - 1, y: p.y - 1, w: 2, h: 2 })).toBe(0);
      });
    });
    centres.forEach((c, i) => {
      if (!c) return;
      route.slice(1).forEach((b, j) => {
        if (j !== i) expect(segmentHitsBox(route[j]!, b, boxAt(c))).toBe(false);
      });
    });
  });
});
