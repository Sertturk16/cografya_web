import { describe, expect, it } from "vitest";
import { formatViewBox, parseViewBox, projectToMapPoint } from "./projection";
import { MAP_PROJECTION, MAP_VIEWBOX } from "./tr-provinces.generated";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Nothing here asserts WHERE a real place lands on
 * the map — that is a geographic fact, it belongs to the api and to the ODbL snapshot, and
 * pinning "İzmir is at x = 54.2" would turn a legitimate snapshot refresh into a red build.
 *
 * What is pinned is the transform's own contract: it is monotonic, it inverts latitude, it
 * agrees with the constants the generator emitted, and it does not clamp. Those are the
 * properties a marker layer depends on.
 */

describe("projectToMapPoint", () => {
  it("puts the projection's own north-west reference corner at the padding inset", () => {
    // Not a fact about Türkiye: it is the definition of the emitted constants. If the
    // generator ever changes its framing without changing this contract, this fails.
    const corner = projectToMapPoint(MAP_PROJECTION.minLon, MAP_PROJECTION.maxLat);
    expect(corner.x).toBeCloseTo(MAP_PROJECTION.padding, 10);
    expect(corner.y).toBeCloseTo(MAP_PROJECTION.padding, 10);
  });

  it("is strictly increasing in longitude", () => {
    const west = projectToMapPoint(MAP_PROJECTION.minLon + 1, MAP_PROJECTION.maxLat);
    const east = projectToMapPoint(MAP_PROJECTION.minLon + 2, MAP_PROJECTION.maxLat);
    expect(east.x).toBeGreaterThan(west.x);
  });

  it("inverts latitude — north is up, so a higher latitude has a LOWER y", () => {
    const north = projectToMapPoint(MAP_PROJECTION.minLon, MAP_PROJECTION.maxLat);
    const south = projectToMapPoint(MAP_PROJECTION.minLon, MAP_PROJECTION.maxLat - 1);
    expect(south.y).toBeGreaterThan(north.y);
  });

  it("does NOT clamp — an offshore point outside the source bounding box stays outside", () => {
    // The whole reason this module exists: the marine reference points sit off the coast,
    // i.e. beyond the landmass box the projection was framed on. Clamping would silently
    // move a marker to somewhere it is not.
    const offshore = projectToMapPoint(MAP_PROJECTION.minLon - 3, MAP_PROJECTION.maxLat + 3);
    expect(offshore.x).toBeLessThan(MAP_PROJECTION.padding);
    expect(offshore.y).toBeLessThan(MAP_PROJECTION.padding);
  });

  it("scales both axes by the same emitted factor (no independent x/y stretch)", () => {
    const origin = projectToMapPoint(MAP_PROJECTION.minLon, MAP_PROJECTION.maxLat);
    const moved = projectToMapPoint(MAP_PROJECTION.minLon + 1, MAP_PROJECTION.maxLat - 1);
    expect(moved.x - origin.x).toBeCloseTo(MAP_PROJECTION.cosLat * MAP_PROJECTION.scale, 10);
    expect(moved.y - origin.y).toBeCloseTo(MAP_PROJECTION.scale, 10);
  });
});

describe("MAP_PROJECTION (the generated artifact's own shape)", () => {
  it("carries finite constants with a positive scale and a cos-latitude in (0, 1]", () => {
    // A broken generator emit (NaN, Infinity, a zero scale) would collapse every marker
    // onto one pixel — silently, because SVG just does not draw it.
    for (const value of Object.values(MAP_PROJECTION)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(MAP_PROJECTION.scale).toBeGreaterThan(0);
    expect(MAP_PROJECTION.cosLat).toBeGreaterThan(0);
    expect(MAP_PROJECTION.cosLat).toBeLessThanOrEqual(1);
    expect(MAP_PROJECTION.padding).toBeGreaterThanOrEqual(0);
  });
});

describe("parseViewBox / formatViewBox", () => {
  it("reads the committed viewBox into a rectangle whose origin is its own minimum", () => {
    const rect = parseViewBox(MAP_VIEWBOX);
    expect(rect).not.toBeNull();
    expect(rect!.maxX).toBeGreaterThan(rect!.minX);
    expect(rect!.maxY).toBeGreaterThan(rect!.minY);
  });

  it("round-trips a rectangle with a negative origin (labels push the frame outward)", () => {
    const rect = { minX: -49.8, minY: -18, maxX: 1005.5, maxY: 434.5 };
    expect(parseViewBox(formatViewBox(rect))).toEqual(rect);
  });

  it("accepts comma separators and surrounding whitespace", () => {
    expect(parseViewBox("  0, 0, 10, 20 ")).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 20 });
  });

  it.each(["", "0 0 10", "0 0 10 20 30", "0 0 ten 20"])(
    "returns null rather than a NaN frame for %j",
    (input) => {
      expect(parseViewBox(input)).toBeNull();
    },
  );
});
