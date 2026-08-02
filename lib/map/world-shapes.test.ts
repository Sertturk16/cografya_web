import { describe, expect, it } from "vitest";
import { COUNTRY_SHAPES } from "./world-countries.generated";

/**
 * Structural invariants of the generated `/dunya` geometry. These assert SHAPE, not facts:
 * no country name, coordinate or hole count is written down here. Whether Lesotho's outline
 * is accurate is a source-data question the Natural Earth snapshot answers; what a test can
 * own is the set of rules a future regeneration, retuning or refactor could silently break.
 *
 * Two of those rules were BROKEN in production until 2026-08-02 and are the reason this file
 * exists:
 *
 *   1. **Enclave holes.** Interior rings used to be dropped, so South Africa painted straight
 *      over Lesotho — invisible, and unclickable despite having a real `<a>` in the HTML.
 *   2. **Holes must be enclaves, never gaps.** DEC 2026-07-26 ("the world map must not have
 *      holes") is about MISSING LANDMASS. An enclave hole is the opposite: legitimate exactly
 *      because another country's shape fills it. This file pins that distinction — a future
 *      tuning cannot punch a hole into open sea without failing here.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT COVER. The holes only render as holes because
 * `world-map-section.tsx` paints with `fill-rule="evenodd"`; that half is a DOM property and
 * the repo runs a single `node` vitest environment with no jsdom (the same constraint
 * `territories.test.ts` and `game-map.nav-guard.test.ts` document). It is verified
 * empirically on the PR's rendered samples, including a hit-test proving a click at Lesotho's
 * centroid resolves to `/dunya/lesotho` rather than `/dunya/guney-afrika`. A mocked-DOM
 * assertion here would be coverage theatre.
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
  const next = () => {
    const raw = tokens[i++];
    const value = raw === undefined ? Number.NaN : Number.parseFloat(raw);
    if (Number.isNaN(value)) throw new Error(`Expected a number at token ${i - 1} of "${d}"`);
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
      command = command === "M" ? "L" : "l";
      continue;
    }
    if (command === "l" || command === "L") {
      const a = next();
      const b = next();
      x = command === "L" ? a : x + a;
      y = command === "L" ? b : y + b;
      current?.push([x, y]);
      continue;
    }
    throw new Error(`Unsupported path command "${command}" in "${d.slice(0, 40)}…"`);
  }
  return subpaths;
}

/** Ray-cast containment. */
function contains(polygon: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) continue;
    const straddles = a[1] > point[1] !== b[1] > point[1];
    if (straddles && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function centroid(ring: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const point of ring) {
    x += point[0];
    y += point[1];
  }
  return [x / ring.length, y / ring.length];
}

/** How many of a shape's subpaths enclose a point. Even ⇒ unpainted under `evenodd`. */
function crossings(subpaths: Point[][], point: Point): number {
  return subpaths.filter((ring) => ring.length >= 3 && contains(ring, point)).length;
}

const SHAPES = COUNTRY_SHAPES.map((shape) => ({ ...shape, subpaths: toSubpaths(shape.d) }));

describe("world map geometry", () => {
  it("emits a parseable, non-degenerate outline for every shape", () => {
    const broken = SHAPES.filter(
      (shape) =>
        shape.subpaths.length === 0 || shape.subpaths.some((subpath) => subpath.length < 3),
    ).map((shape) => shape.iso);
    expect(broken).toEqual([]);
  });

  it("stays relatively encoded", () => {
    // One absolute `M` opens the shape; everything after it is a delta. An accidental return
    // to absolute commands would not look wrong on screen — it would quietly put ~130 kB back
    // on every `/dunya` response, which is the kind of regression only a test catches.
    const absolute = SHAPES.filter((shape) => /[LHVCSQTA]/.test(shape.d)).map((s) => s.iso);
    expect(absolute).toEqual([]);
    expect(SHAPES.every((shape) => shape.d.startsWith("M"))).toBe(true);
  });

  it("still carries enclave holes", () => {
    // Regression guard on the Lesotho defect: interior rings must reach the artifact.
    const withHoles = SHAPES.filter((shape) =>
      shape.subpaths.some((subpath) => {
        const inner = crossings(shape.subpaths, centroid(subpath));
        return inner > 0 && inner % 2 === 0;
      }),
    );
    expect(withHoles.length).toBeGreaterThan(0);
  });

  it("never leaves a hole that no other country fills", () => {
    // The DEC 2026-07-26 boundary, stated structurally: an unpainted region inside a country
    // is legitimate only when some OTHER country paints it. Anything else is a gap in the
    // landmass, which is the thing that ruling forbids.
    const gaps: string[] = [];
    for (const shape of SHAPES) {
      for (const subpath of shape.subpaths) {
        const point = centroid(subpath);
        const inner = crossings(shape.subpaths, point);
        if (inner === 0 || inner % 2 === 1) continue; // painted, or outside the shape
        const filled = SHAPES.some(
          (other) => other.iso !== shape.iso && crossings(other.subpaths, point) % 2 === 1,
        );
        if (!filled) gaps.push(shape.iso);
      }
    }
    expect(gaps).toEqual([]);
  });
});
