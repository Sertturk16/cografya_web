import { describe, expect, it } from "vitest";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "./tr-provinces.generated";
import { MINI_MAP_VIEWBOX, MINI_PROVINCE_SHAPES } from "./tr-provinces-mini.generated";

/**
 * THE MINI ARTIFACT'S CONTRACT — the guard that lets the homepage carry a second copy of the
 * country's outline without the two copies quietly diverging.
 *
 * Both files come out of one `pnpm generate:map` run from one source with one pinned frame, so
 * today they agree by construction. This file is what keeps that true LATER: the queued
 * geoBoundaries re-source rewrites the geometry, and a regeneration that dropped a province,
 * moved the frame or blew the homepage's byte budget would otherwise land silently green.
 *
 * Structural only (`CONVENTIONS.md` §2). Nothing here asserts anything about any particular
 * province's shape, position or size — those are geographic facts and belong to the source
 * data and the provenance record, never to a test.
 */
describe("mini Türkiye artifact", () => {
  it("covers exactly the same plate codes as the interactive artifact", () => {
    const primary = PROVINCE_SHAPES.map((shape) => shape.plateCode).sort();
    const mini = MINI_PROVINCE_SHAPES.map((shape) => shape.plateCode).sort();

    // Set equality AND cardinality: a decimation that dropped a province would leave a hole
    // in the thumbnail that nobody would notice at 520 px.
    expect(mini).toEqual(primary);
    expect(new Set(mini).size).toBe(mini.length);
  });

  it("draws into the identical coordinate space", () => {
    // The viewBox is emitted as a literal in each file rather than shared at runtime (so the
    // homepage's module graph stays clear of the 63 kB interactive artifact). This assertion
    // is what makes that safe.
    expect(MINI_MAP_VIEWBOX).toBe(MAP_VIEWBOX);
  });

  it("emits a drawable, closed path for every province", () => {
    for (const shape of MINI_PROVINCE_SHAPES) {
      expect(shape.d.startsWith("M")).toBe(true);
      expect(shape.d.endsWith("Z")).toBe(true);
      // At least one line-to: two points cannot enclose an area, so a shape that decimated to
      // a bare move-to would paint nothing at all.
      expect(shape.d).toContain("L");
    }
  });

  it("keeps every coordinate inside the viewBox", () => {
    const [, , width, height] = MINI_MAP_VIEWBOX.split(" ").map(Number);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    for (const shape of MINI_PROVINCE_SHAPES) {
      for (const [x, y] of coordinatesOf(shape.d)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(width as number);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(height as number);
      }
    }
  });

  it("uses whole-unit coordinates (the 0-decimal decimation)", () => {
    for (const shape of MINI_PROVINCE_SHAPES) {
      for (const [x, y] of coordinatesOf(shape.d)) {
        expect(Number.isInteger(x)).toBe(true);
        expect(Number.isInteger(y)).toBe(true);
      }
    }
  });

  /**
   * THE BUDGET IS A TEST, not a note in a plan.
   *
   * The homepage committed to a first-response growth of at most +30 kB gzip, and this
   * artifact is the bulk of it. A future regeneration at a finer tolerance — or a re-source
   * that multiplies the vertex count, which is exactly what the geoBoundaries wave does to
   * the interactive artifact — must FAIL here rather than quietly making the site's
   * most-visited page heavier.
   *
   * The ceilings sit ~15 % above the measured values (2,116 vertices / 16,425 path characters
   * at ε=2), which is room for a re-source's honest variation and not room for a tolerance
   * change. Raising them is a deliberate act that comes with a fresh page-weight measurement.
   */
  it("stays inside the homepage byte budget", () => {
    const vertices = MINI_PROVINCE_SHAPES.reduce(
      (sum, shape) => sum + (shape.d.match(/[ML]/g)?.length ?? 0),
      0,
    );
    const pathChars = MINI_PROVINCE_SHAPES.reduce((sum, shape) => sum + shape.d.length, 0);

    expect(vertices).toBeLessThanOrEqual(2450);
    expect(pathChars).toBeLessThanOrEqual(19_000);

    // And it must be a real decimation of the interactive artifact, not a copy of it: if the
    // two ever converge in size, the homepage is paying the full map's price for a thumbnail.
    // Measured today at 0.285; the bar is deliberately loose, because the RATIO is what the
    // geoBoundaries re-source moves (it grows the interactive artifact, not this one) while
    // the absolute ceilings above are what actually protect the page.
    const primaryChars = PROVINCE_SHAPES.reduce((sum, shape) => sum + shape.d.length, 0);
    expect(pathChars).toBeLessThan(primaryChars * 0.5);
  });
});

/** Every `M`/`L` coordinate pair in a path `d` string. */
function coordinatesOf(d: string): [number, number][] {
  const out: [number, number][] = [];
  for (const match of d.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
    out.push([Number(match[1]), Number(match[2])]);
  }
  return out;
}
