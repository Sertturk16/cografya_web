import { describe, expect, it } from "vitest";
import {
  boundsOfPoints,
  centerOfBounds,
  largestSubpathBounds,
  largestSubpathCenter,
  needsRing,
  parseSubpaths,
  RING_MAX_EXTENT_UNITS,
  shapeBounds,
} from "./shape-geometry";
import { PROVINCE_SHAPES } from "./tr-provinces.generated";
import { COUNTRY_SHAPES } from "./world-countries.generated";

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

  it("places every ring centre inside the piece it was measured on", () => {
    // NOT "inside the shape's full bounding box". That earlier claim was advertised as "the
    // invariant that would have caught the France bug" and it cannot be: the centre of the
    // largest subpath is inside the FULL bbox by construction, so the assertion passed for
    // France before the fix and after it. It could never fail, which is another way of saying
    // it tested nothing (→ DEC 2026-08-11h md.1, side note).
    //
    // What is asserted instead is the property the ring actually needs: the centre lands on
    // the piece whose size decided the ring, so a ring can never sit on water between two
    // territories. This one CAN fail — it fails for any implementation that measures one
    // geometry and positions on another, which is exactly the defect this range fixes.
    for (const shape of COUNTRY_SHAPES) {
      const mainland = largestSubpathBounds(shape.d);
      expect(mainland, shape.iso).not.toBeNull();
      const center = centerOfBounds(mainland!);
      expect(center.x, shape.iso).toBeGreaterThanOrEqual(mainland!.minX);
      expect(center.x, shape.iso).toBeLessThanOrEqual(mainland!.maxX);
      expect(center.y, shape.iso).toBeGreaterThanOrEqual(mainland!.minY);
      expect(center.y, shape.iso).toBeLessThanOrEqual(mainland!.maxY);
    }
  });

  it("rings the scattered-territory shapes the full-bbox reading judged large", () => {
    // The concrete consequence of DEC 2026-08-11h md.1, pinned by BEHAVIOUR rather than by a
    // count: these three are the ruling's own worked examples. Their full bounding boxes span
    // most of the map (Caribbean municipalities; the date line) while the piece a reader
    // actually sees is 0.6–5.0 CSS px at the shipped 560 px width. Asserting the pair — full
    // box says "large", mainland says "ring" — is what would break if the decision geometry
    // ever drifted back, and it names no total that a seed change could invalidate.
    for (const iso of ["NL", "KI", "FJ"]) {
      const shape = COUNTRY_SHAPES.find((s) => s.iso === iso);
      expect(shape, iso).toBeDefined();
      expect(needsRing(shapeBounds(shape!.d)!), `${iso} full bbox`).toBe(false);
      expect(needsRing(largestSubpathBounds(shape!.d)!), `${iso} mainland`).toBe(true);
    }
  });
});
