import { describe, expect, it } from "vitest";
import type { MapRect } from "./projection";
import {
  DEFAULT_LABEL_LAYOUT,
  frameForLabelledPoints,
  nearestEdge,
  placePointLabels,
  type LabelledPointInput,
} from "./point-labels";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Every fixture below is synthetic geometry — no
 * real coordinate, no province, no reference point. What is asserted is the layout's
 * CONTRACT: one label per point, no overlaps, nothing hidden, same input → same output.
 * Where a specific label ends up is a rendering decision that the rendered samples review,
 * not an invariant, so no test pins a coordinate.
 */

const FRAME: MapRect = { minX: 0, minY: 0, maxX: 1000, maxY: 400 };

function point(key: string, x: number, y: number, label = key): LabelledPointInput {
  return { key, label, x, y };
}

function boxesOverlap(a: MapRect, b: MapRect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

describe("nearestEdge", () => {
  it.each([
    ["up", 500, 10],
    ["down", 500, 390],
    ["left", 10, 200],
    ["right", 990, 200],
  ] as const)("pushes a point near the %s edge outward", (expected, x, y) => {
    expect(nearestEdge(x, y, FRAME)).toBe(expected);
  });

  it("breaks a perfect tie deterministically rather than at random", () => {
    const square: MapRect = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(nearestEdge(50, 50, square)).toBe(nearestEdge(50, 50, square));
  });
});

describe("placePointLabels", () => {
  const crowded: LabelledPointInput[] = [
    point("a", 100, 40, "Alpha"),
    point("b", 108, 44, "Bravo"),
    point("c", 116, 41, "Charlie"),
    point("d", 104, 52, "Delta"),
    point("e", 112, 48, "Echo"),
    point("f", 120, 55, "Foxtrot"),
  ];

  it("labels every point exactly once and preserves input order", () => {
    const placed = placePointLabels(crowded, FRAME);
    expect(placed.map((item) => item.key)).toEqual(crowded.map((item) => item.key));
  });

  it("never drops a point, however crowded — six labels on one spot still yield six", () => {
    // A missing marker is a lie about the data; a cluttered one is a visible bug report.
    const pileUp = crowded.map((item, index) => point(`p${index}`, 500, 200, item.label));
    expect(placePointLabels(pileUp, FRAME)).toHaveLength(pileUp.length);
  });

  it("produces no overlapping label boxes", () => {
    const placed = placePointLabels(crowded, FRAME);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        expect(boxesOverlap(a!.box, b!.box), `${a!.key} overlaps ${b!.key}`).toBe(false);
      }
    }
  });

  it("never lets a label cover another point's marker", () => {
    const placed = placePointLabels(crowded, FRAME);
    for (const item of placed) {
      for (const other of crowded) {
        if (other.key === item.key) continue;
        const covers =
          item.box.minX <= other.x &&
          item.box.maxX >= other.x &&
          item.box.minY <= other.y &&
          item.box.maxY >= other.y;
        expect(covers, `${item.key}'s label covers ${other.key}`).toBe(false);
      }
    }
  });

  it("is deterministic — the same input always renders the same map", () => {
    expect(placePointLabels(crowded, FRAME)).toEqual(placePointLabels(crowded, FRAME));
  });

  it("keeps a lone label adjacent to its marker and draws no leader line", () => {
    const [only] = placePointLabels([point("solo", 500, 30, "Solo")], FRAME);
    expect(only).toBeDefined();
    expect(only!.leader).toBeNull();
  });

  it("draws a leader line once a label has been pushed away from its marker", () => {
    // Enough same-spot points that the last ones cannot sit next to their own marker.
    const pileUp = Array.from({ length: 8 }, (_, index) =>
      point(`p${index}`, 500, 200, `Label ${index}`),
    );
    const placed = placePointLabels(pileUp, FRAME);
    expect(placed.some((item) => item.leader !== null)).toBe(true);
  });

  it("starts a leader outside the marker so the line never prints across the dot", () => {
    const pileUp = Array.from({ length: 8 }, (_, index) =>
      point(`p${index}`, 500, 200, `Label ${index}`),
    );
    for (const item of placePointLabels(pileUp, FRAME)) {
      if (item.leader === null) continue;
      const distance = Math.hypot(item.leader.x1 - item.x, item.leader.y1 - item.y);
      expect(distance).toBeCloseTo(DEFAULT_LABEL_LAYOUT.markerRadius, 6);
    }
  });

  it("returns an empty layout for an empty input", () => {
    expect(placePointLabels([], FRAME)).toEqual([]);
  });
});

describe("frameForLabelledPoints", () => {
  it("contains the base frame, every marker and every label box", () => {
    const points = [point("a", 5, 5, "Alpha"), point("b", 995, 395, "Bravo")];
    const placed = placePointLabels(points, FRAME);
    const frame = frameForLabelledPoints(FRAME, placed);

    expect(frame.minX).toBeLessThanOrEqual(FRAME.minX);
    expect(frame.minY).toBeLessThanOrEqual(FRAME.minY);
    expect(frame.maxX).toBeGreaterThanOrEqual(FRAME.maxX);
    expect(frame.maxY).toBeGreaterThanOrEqual(FRAME.maxY);

    for (const item of placed) {
      expect(frame.minX).toBeLessThanOrEqual(item.box.minX);
      expect(frame.minY).toBeLessThanOrEqual(item.box.minY);
      expect(frame.maxX).toBeGreaterThanOrEqual(item.box.maxX);
      expect(frame.maxY).toBeGreaterThanOrEqual(item.box.maxY);
    }
  });

  it("falls back to the base frame (plus breathing room) when there is nothing to place", () => {
    const frame = frameForLabelledPoints(FRAME, []);
    expect(frame.minX).toBeLessThan(FRAME.minX);
    expect(frame.maxX).toBeGreaterThan(FRAME.maxX);
  });
});
