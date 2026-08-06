import { describe, expect, it } from "vitest";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import {
  aspectOfViewBox,
  boundsOfPaths,
  interiorPointForPaths,
  parsePathPoints,
  parsePathRings,
  viewBoxForPaths,
} from "./map-bbox";

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

describe("parsePathRings", () => {
  it("splits a multi-subpath path into one ring per M", () => {
    // Concatenating the subpaths — which `parsePathPoints` deliberately does — would join
    // the last point of one piece to the first point of the next with a segment that is on
    // no border anywhere, and a crossing count over that is meaningless.
    expect(parsePathRings(`${RECT}M100 100L110 100L110 110L100 110Z`)).toHaveLength(2);
    expect(parsePathRings(RECT)).toHaveLength(1);
  });

  it("drops anything that cannot enclose an area", () => {
    expect(parsePathRings("M0 0L5 5Z")).toEqual([]);
    expect(parsePathRings("")).toEqual([]);
  });
});

/**
 * `interiorPointForPaths` — STRUCTURE, NOT COORDINATES.
 *
 * No assertion below names a place or a number from the map. What is under test is the single
 * invariant the function exists to provide: the point it returns is INSIDE the shapes it was
 * given. That is checked by an even-odd test written HERE, independently of the module's own
 * — a test that reused the implementation's containment check could only prove it is
 * self-consistent.
 *
 * The invariant matters because the obvious alternative is wrong in a way that looks right:
 * a bounding-box centre falls outside any sufficiently concave province (PR #48 measured
 * exactly this when a bbox-centre click kept answering for a NEIGHBOUR), and a ✓ drawn there
 * sits in the sea or on someone else's territory.
 */
function containsPoint(paths: readonly string[], x: number, y: number): boolean {
  let inside = false;
  for (const d of paths) {
    for (const ring of parsePathRings(d)) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [ax = 0, ay = 0] = ring[i] ?? [];
        const [bx = 0, by = 0] = ring[j] ?? [];
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      }
    }
  }
  return inside;
}

describe("interiorPointForPaths", () => {
  it("returns a point inside a simple rectangle", () => {
    const point = interiorPointForPaths([RECT]);
    expect(point).not.toBeNull();
    expect(containsPoint([RECT], point!.x, point!.y)).toBe(true);
  });

  it("stays out of a concave shape's hollow", () => {
    // A "C": its bounding-box centre is in the notch, i.e. outside the shape. This is the
    // whole reason the function searches instead of averaging.
    const C = "M0 0L100 0L100 20L20 20L20 80L100 80L100 100L0 100Z";
    const point = interiorPointForPaths([C]);
    expect(point).not.toBeNull();
    expect(containsPoint([C], point!.x, point!.y)).toBe(true);
    expect(containsPoint([C], 50, 50)).toBe(false); // the bbox centre — the trap
  });

  it("lands inside EVERY shape in the committed artifact", () => {
    for (const shape of PROVINCE_SHAPES) {
      const point = interiorPointForPaths([shape.d]);
      expect(point, shape.plateCode).not.toBeNull();
      expect(containsPoint([shape.d], point!.x, point!.y), shape.plateCode).toBe(true);
    }
  });

  it("lands inside the union when several disjoint shapes are grouped", () => {
    // The bölge-mode case: one mark for a group of provinces. The groups here are arbitrary
    // slices of the artifact, NOT the coğrafi bölge — this file must not encode which
    // province belongs where (CONVENTIONS §4), and a slice is the harder test anyway, since
    // its members need not touch.
    const size = Math.ceil(PROVINCE_SHAPES.length / 7);
    for (let i = 0; i < PROVINCE_SHAPES.length; i += size) {
      const paths = PROVINCE_SHAPES.slice(i, i + size).map((shape) => shape.d);
      const point = interiorPointForPaths(paths);
      expect(point, `group at ${i}`).not.toBeNull();
      expect(containsPoint(paths, point!.x, point!.y), `group at ${i}`).toBe(true);
    }
  });

  it("answers rather than guessing when there is nothing to be inside of", () => {
    expect(interiorPointForPaths([])).toBeNull();
    expect(interiorPointForPaths(["M5 5L5 5Z"])).toBeNull();
  });
});
