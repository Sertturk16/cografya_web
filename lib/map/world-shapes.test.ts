import { describe, expect, it } from "vitest";
import { COUNTRY_SHAPES } from "./world-countries.generated";

/**
 * Structural invariants of the generated `/dunya` geometry. These assert SHAPE, not facts:
 * no country name or coordinate is written down here. Whether Lesotho's outline is accurate
 * is a source-data question the Natural Earth snapshot answers; what a test can own is the
 * set of rules a future regeneration, retuning or refactor could silently break.
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
 * TWO NUMBERS ARE DELIBERATELY PINNED (a conscious exception to the no-facts rule, from the
 * PR #35 review): the enclave-hole census and the sub-visible sliver census. Both are
 * regression RATCHETS — "some shape somewhere still has a hole" would have let 10 of the 11
 * holes silently regress, including the exact Lesotho defect this file guards. A legitimate
 * regeneration that changes either number must update the constant here, consciously, in the
 * same commit as the artifact.
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

/** Absolute shoelace area of a ring. */
function ringArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a === undefined || b === undefined) continue;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum / 2);
}

/**
 * A point guaranteed to lie INSIDE the ring, found by scanning horizontal lines and taking
 * the midpoint of the widest crossing span. The vertex-average centroid this replaces lands
 * OUTSIDE its own ring for 53 concave rings across 27 real countries (Canada, Chile,
 * Norway, …), which silently mis-scored every classification derived from it (PR #35 review).
 * Returns `null` only when no scanline yields a verifiable interior point — possible only
 * for near-degenerate slivers, and the callers fail loudly if such a ring is big enough to
 * matter.
 */
function interiorPoint(ring: Point[]): Point | null {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of ring) {
    if (point[1] < minY) minY = point[1];
    if (point[1] > maxY) maxY = point[1];
  }
  if (!(maxY > minY)) return null;
  // Irrational-ish fractions avoid hitting vertices/horizontal edges exactly; 25 scanlines
  // are plenty for every real ring in the artifact.
  const fractions = [
    0.5, 0.382, 0.618, 0.271, 0.729, 0.15, 0.85, 0.06, 0.94, 0.33, 0.67, 0.44, 0.56, 0.21, 0.79,
    0.11, 0.89, 0.26, 0.74, 0.41, 0.59, 0.03, 0.97, 0.48, 0.52,
  ];
  for (const t of fractions) {
    const y = minY + (maxY - minY) * t;
    const crossings: number[] = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a === undefined || b === undefined) continue;
      if (a[1] > y !== b[1] > y) {
        crossings.push(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]));
      }
    }
    if (crossings.length < 2 || crossings.length % 2 !== 0) continue;
    crossings.sort((p, q) => p - q);
    let bestIndex = 0;
    let bestWidth = -1;
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const width = (crossings[k + 1] ?? 0) - (crossings[k] ?? 0);
      if (width > bestWidth) {
        bestWidth = width;
        bestIndex = k;
      }
    }
    const candidate: Point = [
      ((crossings[bestIndex] ?? 0) + (crossings[bestIndex + 1] ?? 0)) / 2,
      y,
    ];
    // Verify before trusting — the whole point of replacing the centroid.
    if (contains(ring, candidate)) return candidate;
  }
  return null;
}

/** How many of a shape's subpaths enclose a point. Even ⇒ unpainted under `evenodd`. */
function crossings(subpaths: Point[][], point: Point): number {
  return subpaths.filter((ring) => ring.length >= 3 && contains(ring, point)).length;
}

const SHAPES = COUNTRY_SHAPES.map((shape) => ({ ...shape, subpaths: toSubpaths(shape.d) }));

/** A ring below this encloses less than ~7 px² even at MAX_ZOOM (12×). */
const SLIVER_AREA = 0.05;

/**
 * Interior point of `subpath` if it is a HOLE of `shape` (unpainted under `evenodd`),
 * `null` otherwise. Single home for the hole predicate — the two tests below used to state
 * its two halves independently. Throws when a non-sliver ring yields no interior point:
 * that would mean the classification below is silently skipping geometry that matters.
 */
function holeProbe(subpaths: Point[][], subpath: Point[]): Point | null {
  const point = interiorPoint(subpath);
  if (point === null) {
    if (ringArea(subpath) >= SLIVER_AREA) {
      throw new Error("No interior point found for a non-sliver ring — probe is unsound");
    }
    return null; // a near-degenerate sliver can be neither a meaningful hole nor hide a gap
  }
  const inner = crossings(subpaths, point);
  return inner > 0 && inner % 2 === 0 ? point : null;
}

/**
 * Regression ratchets (see the file header). Measured on the committed artifact; a
 * regeneration that legitimately changes them must update these numbers consciously.
 * - HOLE_CENSUS: 11 of the snapshot's 12 enclave interior rings survive to the artifact
 *   (the 12th encloses a marker-fallback micro-state whose diamond covers the spot; its
 *   hole is sub-visible by the generator's MIN_VISIBLE_RING_AREA rule).
 * - SLIVER_CEILING: sub-`SLIVER_AREA` subpaths still shipped (sub-pixel islets plus the
 *   smallest enclave holes). Must never grow silently — the zero-area degenerate-subpath
 *   class (invisible Maldives/BVI shapes) came from exactly this direction.
 */
const HOLE_CENSUS = 11;
const SLIVER_CEILING = 180;

describe("world map geometry", () => {
  it("emits a parseable, non-degenerate outline for every shape", () => {
    const broken = SHAPES.filter(
      (shape) =>
        shape.subpaths.length === 0 || shape.subpaths.some((subpath) => subpath.length < 3),
    ).map((shape) => shape.iso);
    expect(broken).toEqual([]);
  });

  it("does not grow the sub-visible sliver census", () => {
    const slivers = SHAPES.reduce(
      (count, shape) =>
        count + shape.subpaths.filter((subpath) => ringArea(subpath) < SLIVER_AREA).length,
      0,
    );
    expect(slivers).toBeLessThanOrEqual(SLIVER_CEILING);
  });

  it("stays relatively encoded", () => {
    // One absolute `M` opens the shape; everything after it is a delta. An accidental return
    // to absolute commands would not look wrong on screen — it would quietly put ~130 kB back
    // on every `/dunya` response, which is the kind of regression only a test catches. `M` is
    // checked separately from the other absolute commands: restating every subpath with its
    // own absolute `M` is the single largest byte regression available and would slip through
    // a character class that only lists the L/H/V/C/S/Q/T/A family.
    const absolute = SHAPES.filter((shape) => /[LHVCSQTA]/.test(shape.d)).map((s) => s.iso);
    expect(absolute).toEqual([]);
    const reopened = SHAPES.filter((shape) => /M/.test(shape.d.slice(1))).map((s) => s.iso);
    expect(reopened).toEqual([]);
    expect(SHAPES.every((shape) => shape.d.startsWith("M"))).toBe(true);
  });

  it("still carries every enclave hole", () => {
    // Regression guard on the Lesotho defect, pinned to the full census: with a bare "> 0"
    // the artifact could lose 10 of the 11 holes — including South Africa's, the original
    // bug — while some unrelated hole kept the test green.
    let holes = 0;
    for (const shape of SHAPES) {
      for (const subpath of shape.subpaths) {
        if (holeProbe(shape.subpaths, subpath) !== null) holes++;
      }
    }
    expect(holes).toBe(HOLE_CENSUS);
  });

  it("never leaves a hole that no other country fills", () => {
    // The DEC 2026-07-26 boundary, stated structurally: an unpainted region inside a country
    // is legitimate only when some OTHER country paints it. Anything else is a gap in the
    // landmass, which is the thing that ruling forbids.
    const gaps: string[] = [];
    for (const shape of SHAPES) {
      for (const subpath of shape.subpaths) {
        const point = holeProbe(shape.subpaths, subpath);
        if (point === null) continue; // painted, outside the shape, or a sub-sliver ring
        const filled = SHAPES.some(
          (other) => other.iso !== shape.iso && crossings(other.subpaths, point) % 2 === 1,
        );
        if (!filled) gaps.push(shape.iso);
      }
    }
    expect(gaps).toEqual([]);
  });
});
