import { describe, expect, it } from "vitest";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { aspectOfViewBox, boundsOfPaths, parsePathPoints, viewBoxForPaths } from "./map-bbox";

/**
 * Structural guards for the region-subset frame (never geography assertions — no test here
 * claims where a province IS; they claim that a box computed from paths contains those
 * paths and matches the stage's shape).
 */

/** A 10 × 20 rectangle at (10, 20), in the artifact's own absolute M/L/Z idiom. */
const RECT = "M10 20L20 20L20 40L10 40Z";

function parseViewBox(viewBox: string): number[] {
  return viewBox.split(" ").map(Number);
}

describe("parsePathPoints", () => {
  it("reads absolute M/L pairs", () => {
    expect(parsePathPoints(RECT)).toEqual([
      [10, 20],
      [20, 20],
      [20, 40],
      [10, 40],
    ]);
  });

  it("handles decimals and negatives", () => {
    expect(parsePathPoints("M-1.5 2.25L3 -4")).toEqual([
      [-1.5, 2.25],
      [3, -4],
    ]);
  });

  it("returns nothing for a path with no coordinates", () => {
    expect(parsePathPoints("Z")).toEqual([]);
    expect(parsePathPoints("")).toEqual([]);
  });

  // The parser's premise, asserted against the committed artifact rather than assumed:
  // every generated path is absolute M/L/Z, so reading numbers pairwise IS the point list.
  // A generator that ever emitted a curve or a relative command would break this first.
  it("matches the command vocabulary the generated artifact actually uses", () => {
    const commands = new Set<string>();
    for (const shape of PROVINCE_SHAPES) {
      for (const match of shape.d.matchAll(/[A-Za-z]/g)) commands.add(match[0]);
    }

    expect([...commands].sort()).toEqual(["L", "M", "Z"]);
  });
});

describe("boundsOfPaths", () => {
  it("bounds a single path tightly", () => {
    expect(boundsOfPaths([RECT])).toEqual({ minX: 10, minY: 20, maxX: 20, maxY: 40 });
  });

  it("spans every path it is given", () => {
    expect(boundsOfPaths([RECT, "M100 5L120 200Z"])).toEqual({
      minX: 10,
      minY: 5,
      maxX: 120,
      maxY: 200,
    });
  });

  it("is null when there is nothing to bound", () => {
    expect(boundsOfPaths([])).toBeNull();
    expect(boundsOfPaths(["Z"])).toBeNull();
  });
});

describe("aspectOfViewBox", () => {
  it("reads width ÷ height", () => {
    expect(aspectOfViewBox("0 0 1000 500")).toBe(2);
    expect(aspectOfViewBox(MAP_VIEWBOX)).toBeCloseTo(1000 / 429, 6);
  });

  it("is null for anything it cannot use as a ratio", () => {
    for (const bad of ["", "0 0 100", "0 0 100 0", "a b c d"]) {
      expect(aspectOfViewBox(bad)).toBeNull();
    }
  });
});

describe("viewBoxForPaths", () => {
  it("is null for an empty subset, so the caller can keep the full map's frame", () => {
    expect(viewBoxForPaths([])).toBeNull();
  });

  // A degenerate subset takes the SAME answer as an empty one. `pad` scales with the
  // subset's longer side, so a zero-extent subset pads by zero and would otherwise produce
  // `"x y 0 0"`: an invisible map inside a stage whose aspect is unreadable.
  it("is null for a subset with no extent, rather than a 0 × 0 box", () => {
    expect(viewBoxForPaths(["M40 70L40 70Z"])).toBeNull();
    expect(viewBoxForPaths(["M40 70Z", "M40 70L40 70Z"])).toBeNull();
  });

  it("contains every point of every path it framed", () => {
    const box = viewBoxForPaths([RECT, "M100 5L120 200Z"]);
    expect(box).not.toBeNull();
    const parsed = parseViewBox(box as string);
    const [minX = 0, minY = 0, width = 0, height = 0] = parsed;

    expect(minX).toBeLessThanOrEqual(10);
    expect(minY).toBeLessThanOrEqual(5);
    expect(minX + width).toBeGreaterThanOrEqual(120);
    expect(minY + height).toBeGreaterThanOrEqual(200);
  });

  // The magnification the region mode exists for: the frame follows the SUBSET's shape, so
  // a tall-ish region is not padded out to the country's letterbox and shrunk by half.
  it("keeps a subset's own proportions, within the padding", () => {
    const aspect = aspectOfViewBox(viewBoxForPaths(["M0 0L100 0L100 200L0 200Z"]) as string);

    expect(aspect).toBeCloseTo(1, 1); // NOT the full map's 2.33
  });

  // The one shape guard: a frame is never taller than it is wide, because the stage takes
  // its aspect from the frame and a portrait map would push the question off screen.
  it("never returns a frame taller than it is wide", () => {
    for (const paths of [[RECT], ["M0 0L5 0L5 900L0 900Z"], ["M0 0L400 0L400 10L0 10Z"]]) {
      const [, , width = 0, height = 0] = parseViewBox(viewBoxForPaths(paths) as string);
      expect(width / height).toBeGreaterThanOrEqual(1);
    }
  });

  it("centres a too-narrow subset inside the widened frame", () => {
    const [minX = 0, , width = 0] = parseViewBox(
      viewBoxForPaths(["M100 0L110 0L110 200L100 200Z"]) as string,
    );

    expect(minX + width / 2).toBeCloseTo(105, 1);
  });
});
