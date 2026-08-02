import { describe, expect, it } from "vitest";
import { INLAND_WATER_SHAPES } from "./tr-inland-water.generated";
import { MAP_VIEWBOX } from "./tr-provinces.generated";

/**
 * Structural invariants of the generated TR inland-water geometry.
 *
 * These assert SHAPE, not FACTS. No lake name, no area figure and no body count sourced from
 * the data is written down here: whether Van Gölü is 3 571 km² is a source-data question the
 * ODbL snapshot answers, and hard-coding it would turn a cartography decision into a test
 * failure. What a test can own is the set of rules a future regeneration, retuning or
 * threshold change could silently break.
 *
 * The rule this file exists for above all others is **CO-REGISTRATION**. The water layer and
 * the province layer are two independent artifacts, produced by two generators, from two
 * snapshots, and they are drawn into ONE `<svg>` on four different surfaces. Nothing about
 * that arrangement is self-correcting: if the shared frame ever moves under one of them, the
 * lakes slide off their shores and every page still renders, still passes typecheck, and
 * still looks like a map. The frame is pinned in `scripts/lib/tr-frame.mjs` for that reason,
 * and the assertion below is the runtime half of the pin — it reads the province artifact's
 * own `MAP_VIEWBOX` rather than a literal, so the two cannot be updated apart.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT COVER. That the layer is painted LAST (which is what
 * hides the boundary across a lake and what makes a mid-lake click inert) is a DOM ordering
 * property, and the repo runs a single `node` vitest environment with no jsdom — the same
 * constraint `world-shapes.test.ts` and `game-map.nav-guard.test.ts` document. The source
 * contract for it is pinned in `components/map/inland-water-layer.contract.test.ts`, and the
 * empirical proof is the PR's rendered samples, including a mid-lake click that leaves the
 * URL unchanged.
 */

type Point = readonly [number, number];

/**
 * Parse the `M`/`m`/`l`/`Z` subset the generator emits into absolute subpaths. Deliberately
 * strict: it THROWS on any other command, which is what makes the "still relatively encoded"
 * assertion below meaningful rather than decorative.
 */
function toSubpaths(d: string): Point[][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const subpaths: Point[][] = [];
  let current: Point[] | null = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command: string | null = null;
  let i = 0;
  const next = (): number => {
    const raw = tokens[i++];
    const value = raw === undefined ? Number.NaN : Number.parseFloat(raw);
    if (Number.isNaN(value)) throw new Error(`Expected a number at token ${i - 1}`);
    return value;
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (token !== undefined && /[A-Za-z]/.test(token)) {
      command = token;
      i++;
    }
    if (command === "Z") {
      x = startX;
      y = startY;
      command = null;
      continue;
    }
    if (command === "M" || command === "m") {
      const a = next();
      const b = next();
      x = command === "M" ? a : x + a;
      y = command === "M" ? b : y + b;
      startX = x;
      startY = y;
      current = [[x, y]];
      subpaths.push(current);
      command = "l";
      continue;
    }
    if (command === "l") {
      x += next();
      y += next();
      current?.push([x, y]);
      continue;
    }
    throw new Error(`Unsupported path command "${command}" in inland-water geometry`);
  }
  return subpaths;
}

const VIEWBOX = MAP_VIEWBOX.split(" ").map(Number);
const VIEW_WIDTH = VIEWBOX[2] ?? Number.NaN;
const VIEW_HEIGHT = VIEWBOX[3] ?? Number.NaN;

/**
 * How far outside the frame a vertex may sit. Not zero: the province outlines are simplified
 * at 0.45 units and the water is not, so a coastal lagoon can legitimately reach a fraction
 * of a unit past the landmass bounding box the frame was fitted to. This mirrors the
 * generator's own `FRAME_TOLERANCE`, and its job is to fail LOUDLY if the two artifacts ever
 * stop sharing a coordinate space — a drift of even a few units puts lakes inland of, or out
 * to sea from, their real shores.
 */
const FRAME_TOLERANCE = 1.5;

describe("the generated inland-water artifact", () => {
  it("draws at least one body", () => {
    // A threshold typo (`400` for `40`) would empty the layer, and an empty `<g>` renders
    // perfectly happily. The generator throws on this too; this is the artifact-side pin.
    expect(INLAND_WATER_SHAPES.length).toBeGreaterThan(0);
  });

  it("keys every body with a unique, stable OSM id", () => {
    const ids = INLAND_WATER_SHAPES.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[rw]\d+$/);
  });

  it("emits no name, area or other prose in the artifact", () => {
    // DEC 2026-08-01r-4: no measured or published figure leaves the generator. The artifact
    // is geometry plus a key — a shape with a second data field is the first step back
    // toward publishing "Van Gölü, 3 571 km²" off a number nobody verified.
    for (const shape of INLAND_WATER_SHAPES) {
      expect(Object.keys(shape).sort()).toEqual(["d", "id"]);
    }
  });

  it("emits non-empty, closed, relatively encoded path data", () => {
    for (const shape of INLAND_WATER_SHAPES) {
      expect(shape.d.startsWith("M")).toBe(true);
      expect(shape.d.endsWith("Z")).toBe(true);
      // Exactly one absolute move-to: every later subpath hops relatively from the previous
      // one. A regression to absolute encoding costs ~40 % more bytes for zero benefit.
      expect(shape.d.match(/M/g)).toHaveLength(1);
      expect(() => toSubpaths(shape.d)).not.toThrow();
    }
  });

  it("gives every subpath enough vertices to enclose an area", () => {
    for (const shape of INLAND_WATER_SHAPES) {
      for (const subpath of toSubpaths(shape.d)) {
        expect(subpath.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("places every vertex inside the province artifact's own viewBox", () => {
    // CO-REGISTRATION — the one that matters. Read from `MAP_VIEWBOX`, never a literal.
    for (const shape of INLAND_WATER_SHAPES) {
      for (const subpath of toSubpaths(shape.d)) {
        for (const [x, y] of subpath) {
          expect(x).toBeGreaterThanOrEqual(-FRAME_TOLERANCE);
          expect(x).toBeLessThanOrEqual(VIEW_WIDTH + FRAME_TOLERANCE);
          expect(y).toBeGreaterThanOrEqual(-FRAME_TOLERANCE);
          expect(y).toBeLessThanOrEqual(VIEW_HEIGHT + FRAME_TOLERANCE);
        }
      }
    }
  });

  it("spreads the bodies across the whole country, not one corner", () => {
    // Cheap catastrophe detector: a projection or frame mistake typically collapses every
    // body into a small patch while leaving all the assertions above green. Türkiye is
    // ~988 units wide, so real inland water must span a large fraction of it.
    const xs: number[] = [];
    const ys: number[] = [];
    for (const shape of INLAND_WATER_SHAPES) {
      for (const subpath of toSubpaths(shape.d)) {
        for (const [x, y] of subpath) {
          xs.push(x);
          ys.push(y);
        }
      }
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(VIEW_WIDTH * 0.6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(VIEW_HEIGHT * 0.4);
  });
});
