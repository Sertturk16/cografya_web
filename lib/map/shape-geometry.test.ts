import { describe, expect, it } from "vitest";
import {
  boundsOfPoints,
  largestSubpathBounds,
  largestSubpathCenter,
  largestSubpathInteriorPoint,
  locatorRingCenter,
  needsRing,
  parseSubpaths,
  pointInPolygon,
  RING_MAX_EXTENT_UNITS,
  shapeBounds,
} from "./shape-geometry";
import { PROVINCE_SHAPES } from "./tr-provinces.generated";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "./world-countries.generated";

/**
 * Structural + invariant tests for the locator map's geometry (CONVENTIONS §2: structure,
 * never facts). NOTHING here asserts that a named place has a particular size or position —
 * the artifacts are regenerated data and such an assertion would be a fact test wearing a
 * unit test's clothes. What is pinned is the parser's contract, the ring rule's boundary
 * behaviour, and the ONE property that made this module necessary: that both artifact
 * encodings decode, and that the "largest subpath" rule is not the same thing as the
 * full-bbox centre.
 */

describe("parseSubpaths", () => {
  it("decodes the ABSOLUTE M/L/Z encoding the Türkiye artifact uses", () => {
    const points = parseSubpaths("M10 20L30 20L30 40Z");
    expect(points).toEqual([
      [
        { x: 10, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 40 },
      ],
    ]);
  });

  it("decodes the RELATIVE M+l encoding the world artifact uses", () => {
    // The exact shape of a world `d`: one absolute moveto, then a relative lineto run whose
    // command letter appears once. Feeding this to an absolute-only parser is the silent
    // wrong answer this module exists to prevent.
    const points = parseSubpaths("M10 20l20 0 0 20Z");
    expect(points).toEqual([
      [
        { x: 10, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 40 },
      ],
    ]);
  });

  it("reads a relative subpath's own origin as absolute after a closepath", () => {
    const subpaths = parseSubpaths("M0 0l10 0 0 10ZM100 100l5 0 0 5Z");
    expect(subpaths).toHaveLength(2);
    expect(subpaths[1]?.[0]).toEqual({ x: 100, y: 100 });
  });

  it("parses sub-unit and negative numbers written without a leading zero", () => {
    // `.5` and `-.5` are how the encoder writes fractions; a naive number regex loses them.
    const points = parseSubpaths("M.5 .5l-.5 1.5Z");
    expect(points[0]).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 0, y: 2 },
    ]);
  });

  it("throws on a command outside the emitted subset rather than guessing", () => {
    expect(() => parseSubpaths("M0 0C1 1 2 2 3 3Z")).toThrow(/unsupported path command/);
  });
});

describe("boundsOfPoints / shapeBounds", () => {
  it("returns null for an empty shape instead of a zero box", () => {
    expect(boundsOfPoints([])).toBeNull();
    expect(shapeBounds("")).toBeNull();
  });

  it("spans every subpath, not just the first", () => {
    const bounds = shapeBounds("M0 0l10 0 0 10ZM100 100l10 0 0 10Z");
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 110, maxY: 110, width: 110, height: 110 });
  });
});

describe("largestSubpathCenter", () => {
  it("picks the centre of the largest subpath, NOT the centre of the full bounding box", () => {
    // A big mainland plus one far-away speck — the shape of every country with overseas
    // territory. The full-bbox centre sits between them, i.e. nowhere.
    const d = "M0 0l100 0 0 100 -100 0ZM900 400l2 0 0 2 -2 0Z";
    const center = largestSubpathCenter(d);
    expect(center).toEqual({ x: 50, y: 50 });

    const full = shapeBounds(d);
    expect(full).not.toBeNull();
    const fullBoxCenter = { x: (full!.minX + full!.maxX) / 2, y: (full!.minY + full!.maxY) / 2 };
    expect(center).not.toEqual(fullBoxCenter);
  });

  it("breaks an area tie on vertex count, so degenerate shapes stay deterministic", () => {
    // Two zero-area subpaths (the artifact really contains such shapes — a 1 × 0 bbox).
    // First: (0,0) → (10,0), 2 vertices. Second: (50,50) → (60,50) → (70,50), 3 vertices.
    // Both have area 0, so the vertex count decides and the centre is the SECOND one's.
    const center = largestSubpathCenter("M0 0l10 0ZM50 50l10 0 10 0Z");
    expect(center).toEqual({ x: 60, y: 50 });
  });

  it("returns null when there is nothing to centre", () => {
    expect(largestSubpathCenter("")).toBeNull();
  });
});

describe("largestSubpathInteriorPoint", () => {
  it("chooses land inside a synthetic concave mainland, not its empty bbox centre", () => {
    const concave = "M0 0L10 0L10 10L8 10L8 2L2 2L2 10L0 10ZM100 100L101 100L101 101Z";
    const point = largestSubpathInteriorPoint(concave);
    const mainland = parseSubpaths(concave)[0]!;

    expect(point).not.toEqual({ x: 5, y: 5 });
    expect(point).not.toBeNull();
    expect(pointInPolygon(point!, mainland)).toBe(true);
  });

  it("keeps a complete ring inside the viewBox at either horizontal edge", () => {
    const viewBox = { minX: 0, minY: 0, maxX: 1000, maxY: 521, width: 1000, height: 521 };
    const right = locatorRingCenter("M990 100L998 100L998 108L990 108Z", viewBox, 14);
    const left = locatorRingCenter("M2 100L10 100L10 108L2 108Z", viewBox, 14);

    expect(right).toEqual({ x: 986, y: 104 });
    expect(left).toEqual({ x: 14, y: 104 });
  });
});

describe("needsRing", () => {
  it("rings a shape strictly under the threshold and not one at it", () => {
    const box = (size: number) => ({
      minX: 0,
      minY: 0,
      maxX: size,
      maxY: size,
      width: size,
      height: size,
    });
    expect(needsRing(box(RING_MAX_EXTENT_UNITS - 0.1))).toBe(true);
    expect(needsRing(box(RING_MAX_EXTENT_UNITS))).toBe(false);
    expect(needsRing(box(RING_MAX_EXTENT_UNITS + 0.1))).toBe(false);
  });

  it("uses the LONGEST side, so a long thin shape is not ringed", () => {
    expect(needsRing({ minX: 0, minY: 0, maxX: 200, maxY: 1, width: 200, height: 1 })).toBe(false);
  });
});

describe("the committed artifacts", () => {
  const [minX = 0, minY = 0, width = 0, height = 0] = WORLD_MAP_VIEWBOX.split(" ").map(Number);
  const worldBounds = { minX, minY, maxX: minX + width, maxY: minY + height, width, height };
  const ringRadius = 14;

  it("parses every Türkiye province shape", () => {
    for (const shape of PROVINCE_SHAPES) {
      expect(() => parseSubpaths(shape.d), shape.plateCode).not.toThrow();
      expect(shapeBounds(shape.d), shape.plateCode).not.toBeNull();
    }
  });

  it("parses every world country shape", () => {
    for (const shape of COUNTRY_SHAPES) {
      expect(() => parseSubpaths(shape.d), shape.iso).not.toThrow();
      expect(shapeBounds(shape.d), shape.iso).not.toBeNull();
    }
  });

  it("keeps every rendered country ring fully inside the world viewBox", () => {
    for (const shape of COUNTRY_SHAPES) {
      const mainland = largestSubpathBounds(shape.d);
      expect(mainland, shape.iso).not.toBeNull();
      const center = locatorRingCenter(shape.d, worldBounds, ringRadius);
      if (!needsRing(mainland!)) {
        expect(center, shape.iso).toBeNull();
        continue;
      }
      expect(center, shape.iso).not.toBeNull();
      expect(center!.x - ringRadius, shape.iso).toBeGreaterThanOrEqual(worldBounds.minX);
      expect(center!.x + ringRadius, shape.iso).toBeLessThanOrEqual(worldBounds.maxX);
      expect(center!.y - ringRadius, shape.iso).toBeGreaterThanOrEqual(worldBounds.minY);
      expect(center!.y + ringRadius, shape.iso).toBeLessThanOrEqual(worldBounds.maxY);
    }
  });
});
