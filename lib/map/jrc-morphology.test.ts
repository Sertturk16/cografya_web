import { describe, expect, it } from "vitest";
import {
  closeMask,
  componentsIntersecting,
  countSet,
  createMask,
  fillInteriorHoles,
  labelComponents,
  maskFromRows,
  maskToRows,
  selectBodyComponents,
  ringSignedArea,
  traceRings,
} from "../../scripts/lib/jrc-morphology.mjs";

/**
 * Unit tests for the JRC Global Surface Water raster→vector core (P7 plan §11, T1–T4).
 *
 * Every raster here is SYNTHETIC. Not one lake, area figure or official number appears —
 * per the team rule, tests check STRUCTURE and INVARIANTS; fact-checking a measured area is
 * a separate, human process (the owner sample gate). What these tests protect is the step
 * where a wrong operator produces a plausible but WRONG lake: the closing that bridges Tuz
 * Gölü's salt-crust seams, the hole fill that reclaims a dried bed without swallowing a
 * bay, the 4-connectivity that stops one basin leaking into its neighbour, and the boundary
 * tracer that has to hand back a simple closed ring.
 *
 * The raster step itself (`scripts/lib/jrc-raster.mjs`) has NO CI gate — it needs a 505 MB
 * download that is never committed (plan §11, acknowledged gap). This file is the gate for
 * everything downstream of the pixels.
 */

/** GSW pixel edge, metres. The recipe's radii are quoted in metres; the code works in pixels. */
const PIXEL_M = 30;
/** Pinned closing radius of the recipe: 300 m = 10 px (P7 plan §5.1 `CLOSING_RADIUS_M`). */
const CLOSING_RADIUS_PX = 300 / PIXEL_M;

/** Set an inclusive pixel rectangle. */
function fillRect(
  mask: { width: number; data: Uint8Array },
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) mask.data[y * mask.width + x] = 1;
  }
}

/**
 * Two water blocks separated by a dry channel `gapM` metres wide, with a margin far larger
 * than the closing radius on every side so the window edge never participates.
 *
 * `blockLengthPx` is the length of the two blocks ALONG the channel — the width of the
 * contact front. It is a parameter because the bridging reach depends on it (see the
 * "short contact front" case below).
 */
function twoBlocksAcrossGap(gapM: number, blockLengthPx = 60) {
  const gap = Math.round(gapM / PIXEL_M);
  const blockWidth = 20;
  const margin = 20;
  const width = margin * 2 + blockWidth * 2 + gap;
  const height = margin * 2 + blockLengthPx;
  const mask = createMask(width, height);
  const top = margin;
  const bottom = margin + blockLengthPx - 1;
  fillRect(mask, margin, margin + blockWidth - 1, top, bottom);
  fillRect(mask, margin + blockWidth + gap, margin + blockWidth * 2 + gap - 1, top, bottom);
  return mask;
}

function componentCount(mask: Parameters<typeof labelComponents>[0]): number {
  return labelComponents(mask).count;
}

describe("T1 — morphological closing bridges dry seams", () => {
  /**
   * The physical job: Tuz Gölü's salt crust splits the water into fragments that the OSM
   * snapshot records as three separate bodies. Closing at the pinned radius rejoins them.
   */
  it("bridges a 300 m seam at the pinned 300 m radius", () => {
    const mask = twoBlocksAcrossGap(300);
    expect(componentCount(mask)).toBe(2);
    expect(componentCount(closeMask(mask, CLOSING_RADIUS_PX))).toBe(1);
  });

  /**
   * CORRECTION TO THE PLAN'S PROSE, asserted rather than argued (P7 plan §11 T1 reads
   * "300 m bridged / 400 m NOT bridged"). A morphological closing with a disk of radius r
   * bridges a channel up to 2·r wide, not r: dilation grows BOTH banks by r. At the pinned
   * r = 300 m the reach is therefore ~600 m, so a 400 m seam bridges too.
   *
   * The physical parameter is untouched — r = 10 px is exactly the value that produced the
   * research measurement the sample gate is calibrated against. Only the plan's statement
   * of the operator's reach was wrong, and this assertion is where that is recorded.
   */
  it("also bridges a 400 m seam — the reach is 2·r, not r", () => {
    expect(componentCount(closeMask(twoBlocksAcrossGap(400), CLOSING_RADIUS_PX))).toBe(1);
  });

  it("leaves a 630 m channel open — just past the 2·r reach", () => {
    const mask = twoBlocksAcrossGap(630);
    expect(componentCount(closeMask(mask, CLOSING_RADIUS_PX))).toBe(2);
  });

  it("leaves a 900 m channel open", () => {
    expect(componentCount(closeMask(twoBlocksAcrossGap(900), CLOSING_RADIUS_PX))).toBe(2);
  });

  /**
   * 2·r is an UPPER bound, not a promise. Where the two banks face each other along a short
   * front, the bridge dilation creates is thin enough for the erosion half of the closing to
   * pinch it off again. Pinning this keeps anyone from "fixing" a future surprise by
   * enlarging the radius: the honest reading is that closing rejoins seams, it does not
   * guarantee to rejoin every seam narrower than 2·r.
   */
  it("does not promise 2·r across a short contact front", () => {
    const wideFront = twoBlocksAcrossGap(570, 60);
    const shortFront = twoBlocksAcrossGap(570, 20);
    expect(componentCount(closeMask(wideFront, CLOSING_RADIUS_PX))).toBe(1);
    expect(componentCount(closeMask(shortFront, CLOSING_RADIUS_PX))).toBe(2);
  });

  it("never removes water — closing is extensive", () => {
    const mask = twoBlocksAcrossGap(300);
    const closed = closeMask(mask, CLOSING_RADIUS_PX);
    expect(countSet(closed)).toBeGreaterThan(countSet(mask));
    for (let i = 0; i < mask.data.length; i++) {
      if (mask.data[i]) expect(closed.data[i]).toBe(1);
    }
  });
});

describe("T2 — interior hole filling reclaims a dried bed but not a bay", () => {
  /** A dried lake bed is part of the lake (P7 plan §4.1 step 7). */
  it("fills a fully enclosed dry basin", () => {
    const mask = maskFromRows([
      ".......",
      ".#####.",
      ".#...#.",
      ".#...#.",
      ".#...#.",
      ".#####.",
      ".......",
    ]);
    expect(maskToRows(fillInteriorHoles(mask))).toEqual([
      ".......",
      ".#####.",
      ".#####.",
      ".#####.",
      ".#####.",
      ".#####.",
      ".......",
    ]);
  });

  /**
   * The classic failure of a naive hole fill is swallowing a bay. A bay's dry pixels reach
   * the outside world, so they must survive untouched.
   */
  it("leaves a bay that opens to the outside alone", () => {
    // The row layout IS the test input; collapsed to one line it is unreviewable, so every
    // raster literal in this file carries a `prettier-ignore`.
    // prettier-ignore
    const rows = [
      ".......",
      ".#####.",
      ".#...#.",
      ".#...#.",
      ".#...#.",
      ".##.##.",
      "..#.#..",
    ];
    expect(maskToRows(fillInteriorHoles(maskFromRows(rows)))).toEqual(rows);
  });

  /**
   * Connectivity pairing, pinned. Foreground is 4-connected, so the background flood must be
   * 8-connected; otherwise a shoreline that only touches itself DIAGONALLY — i.e. is not a
   * connected shoreline at all — would still count as closed and the basin would be flooded.
   * Here the mouth of the bay is a single diagonal step, and it stays open.
   */
  it("treats a diagonal-only mouth as open (4-foreground / 8-background)", () => {
    // The basin's dry pixels reach the outside ONLY through the corner between (3,3) and
    // (4,4). Under a 4-connected background flood this basin would read as sealed and be
    // flooded; under the 8-connected one it stays open, which is the honest answer, because
    // the shoreline that "seals" it is itself only diagonally connected.
    // prettier-ignore
    const rows = [
      ".......",
      ".#####.",
      ".#...#.",
      ".#..##.",
      ".###...",
      ".......",
    ];
    expect(maskToRows(fillInteriorHoles(maskFromRows(rows)))).toEqual(rows);
  });

  it("is idempotent and never removes water", () => {
    // prettier-ignore
    const mask = maskFromRows([
      ".......",
      ".#####.",
      ".#...#.",
      ".#####.",
      ".......",
    ]);
    const once = fillInteriorHoles(mask);
    expect(maskToRows(fillInteriorHoles(once))).toEqual(maskToRows(once));
    for (let i = 0; i < mask.data.length; i++) {
      if (mask.data[i]) expect(once.data[i]).toBe(1);
    }
  });
});

describe("T3 — connected components are 4-connected", () => {
  /**
   * Component leakage is the named risk of this wave (P7 plan §14 R1): one basin's seed
   * picking up a neighbouring basin through a one-pixel diagonal touch would silently merge
   * two lakes into one blob. 4-connectivity is what makes a corner touch NOT a connection.
   */
  it("keeps two blocks that touch only at a corner separate", () => {
    // prettier-ignore
    const mask = maskFromRows([
      "##..",
      "##..",
      "..##",
      "..##",
    ]);
    expect(labelComponents(mask).count).toBe(2);
  });

  it("joins two blocks that share an edge", () => {
    // prettier-ignore
    const mask = maskFromRows([
      "##..",
      "###.",
      "..##",
      "..##",
    ]);
    expect(labelComponents(mask).count).toBe(1);
  });

  it("reports component sizes and finds the components a seed box touches", () => {
    // prettier-ignore
    const mask = maskFromRows([
      "##...",
      "##...",
      ".....",
      "...#.",
      ".....",
    ]);
    const labelling = labelComponents(mask);
    expect(labelling.count).toBe(2);
    expect(labelling.sizes.slice(1).sort((a, b) => b - a)).toEqual([4, 1]);

    const hitBig = componentsIntersecting(labelling, mask.width, { x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(hitBig).toHaveLength(1);
    expect(hitBig[0]?.size).toBe(4);

    const hitBoth = componentsIntersecting(labelling, mask.width, { x0: 0, y0: 0, x1: 4, y1: 4 });
    expect(hitBoth.map((entry) => entry.size)).toEqual([4, 1]);

    const hitNone = componentsIntersecting(labelling, mask.width, { x0: 4, y0: 4, x1: 4, y1: 4 });
    expect(hitNone).toEqual([]);
  });
});

describe("T4 — boundary tracing returns simple closed rings", () => {
  it("traces a rectangle as one closed, four-cornered, positively-signed ring", () => {
    const mask = createMask(10, 8);
    fillRect(mask, 2, 6, 1, 5);
    const rings = traceRings(mask);
    expect(rings).toHaveLength(1);
    const ring = rings[0];
    expect(ring).toBeDefined();
    if (!ring) return;
    expectClosedSimpleRing(ring);
    expect(ring.length - 1).toBe(4);
    // Corner coordinates, so the ring is the pixel rectangle's outline exactly.
    expect(new Set(ring.slice(0, -1).map((point) => point.join(",")))).toEqual(
      new Set(["2,1", "7,1", "7,6", "2,6"]),
    );
    expect(ringSignedArea(ring)).toBe(countSet(mask));
  });

  it("traces a staircase outline with at least four nodes and no self-intersection", () => {
    // prettier-ignore
    const mask = maskFromRows([
      "......",
      ".###..",
      ".###..",
      ".#####",
      ".#####",
      "......",
    ]);
    const rings = traceRings(mask);
    expect(rings).toHaveLength(1);
    const ring = rings[0];
    expect(ring).toBeDefined();
    if (!ring) return;
    expectClosedSimpleRing(ring);
    expect(ring.length - 1).toBeGreaterThanOrEqual(4);
    expect(ringSignedArea(ring)).toBe(countSet(mask));
  });

  it("returns a hole as a separate, negatively-signed ring", () => {
    const mask = maskFromRows([
      ".......",
      ".#####.",
      ".#...#.",
      ".#...#.",
      ".#...#.",
      ".#####.",
      ".......",
    ]);
    const rings = traceRings(mask);
    expect(rings).toHaveLength(2);
    const areas = rings.map((ring) => ringSignedArea(ring)).sort((a, b) => b - a);
    expect(areas[0]).toBe(25);
    expect(areas[1]).toBe(-9);
    for (const ring of rings) expectClosedSimpleRing(ring);
    // After hole filling there is exactly one ring and no negative area left.
    const filledRings = traceRings(fillInteriorHoles(mask));
    expect(filledRings).toHaveLength(1);
    expect(filledRings[0] ? ringSignedArea(filledRings[0]) : 0).toBe(25);
  });

  /**
   * Two blocks meeting at a single corner are two 4-connected components, so the tracer must
   * hand back two separate simple rings rather than one ring that touches itself. This is the
   * saddle case the tracer resolves by turning towards its own water.
   */
  it("splits a corner contact into two simple rings", () => {
    // prettier-ignore
    const mask = maskFromRows([
      "##..",
      "##..",
      "..##",
      "..##",
    ]);
    const rings = traceRings(mask);
    expect(rings).toHaveLength(2);
    for (const ring of rings) {
      expectClosedSimpleRing(ring);
      expect(ringSignedArea(ring)).toBe(4);
    }
  });
});

// --- ring assertions ----------------------------------------------------------------

/** Closed (first vertex repeated last), ≥ 4 distinct vertices, and not self-intersecting. */
function expectClosedSimpleRing(ring: [number, number][]): void {
  expect(ring.length).toBeGreaterThanOrEqual(5);
  const first = ring[0];
  const last = ring[ring.length - 1];
  expect(first).toBeDefined();
  expect(last).toBeDefined();
  if (!first || !last) return;
  expect(last).toEqual(first);

  const open = ring.slice(0, -1);
  expect(open.length).toBeGreaterThanOrEqual(4);
  expect(new Set(open.map((point) => point.join(","))).size).toBe(open.length);

  const n = open.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Skip the two pairs that legitimately share an endpoint.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const a = open[i];
      const b = open[(i + 1) % n];
      const c = open[j];
      const d = open[(j + 1) % n];
      if (!a || !b || !c || !d) continue;
      expect(segmentsIntersect(a, b, c, d)).toBe(false);
    }
  }
}

type Pt = [number, number];

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function onSegment(a: Pt, b: Pt, p: Pt): boolean {
  return (
    cross(a, b, p) === 0 &&
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

/** Proper or improper intersection of two closed segments; integer coordinates, so exact. */
function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if ((d1 > 0 !== d2 > 0 || d1 < 0 !== d2 < 0) && (d3 > 0 !== d4 > 0 || d3 < 0 !== d4 < 0)) {
    return true;
  }
  return onSegment(c, d, a) || onSegment(c, d, b) || onSegment(a, b, c) || onSegment(a, b, d);
}

describe("T12 — the identity test composes a body from labelled components", () => {
  /**
   * Three water blocks on one row, with controllable gaps:
   *
   *   [CORE]  gapA  [NEAR]  gapB  [FAR]
   *
   * The identity box always sits inside CORE. This is the Tuz/Hirfanlı and the Yay/Çöl
   * geometry in miniature — a body, a fragment that belongs to it, and a separate lake that
   * does not — and it is the regression tripwire for both defects: each shipped a plausible
   * lake that was actually two (→ DEC 2026-08-04d, DEC 2026-08-04g).
   */
  function threeBlocks(gapA: number, gapB: number) {
    const block = 6;
    const margin = 30;
    const width = margin * 2 + block * 3 + gapA + gapB;
    const height = margin * 2 + block;
    const mask = createMask(width, height);
    const y0 = margin;
    const y1 = margin + block - 1;
    let x = margin;
    const spans: [number, number][] = [];
    for (const gap of [gapA, gapB, 0]) {
      fillRect(mask, x, x + block - 1, y0, y1);
      spans.push([x, x + block - 1]);
      x += block + gap;
    }
    const core = spans[0] ?? [0, 0];
    return {
      mask,
      identityBox: { x0: core[0] + 1, y0: y0 + 1, x1: core[0] + 2, y1: y0 + 2 },
    };
  }

  function select(gapA: number, gapB: number, neighbourPx: number, includeFragments = true) {
    const { mask, identityBox } = threeBlocks(gapA, gapB);
    const labelling = labelComponents(mask);
    expect(labelling.count).toBe(3);
    return selectBodyComponents(labelling, mask.width, mask.height, identityBox, {
      neighbourPx,
      includeFragments,
    });
  }

  it("takes the component the identity box sits in", () => {
    const result = select(20, 20, 0);
    expect(result.identity).toHaveLength(1);
    expect(result.selected).toEqual(result.identity);
    expect(result.rejected).toHaveLength(2);
  });

  it("pulls in a fragment inside the reach and leaves one outside it alone", () => {
    // NEAR is 8 px away, FAR is 40 px beyond that. A 10 px reach takes NEAR only.
    const result = select(8, 40, 10);
    expect(result.selected).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
  });

  it("is exact at the pixel boundary — this is the defect that shipped", () => {
    // `gapA` counts the EMPTY columns between two blocks, so the nearest-pixel distance is
    // `gapA + 1`. The reach must reach that distance exactly: one pixel short and the
    // fragment stays out, one pixel over and it comes in. The Yay/Çöl merge was precisely
    // this — a documented radius that rounded to one pixel too many.
    const empties = 5;
    const trueGapPx = empties + 1;
    expect(select(empties, 60, trueGapPx - 1).selected).toHaveLength(1);
    expect(select(empties, 60, trueGapPx).selected).toHaveLength(2);
  });

  it("never chains — a fragment cannot drag its own neighbour in", () => {
    // CORE—NEAR is 6 px and NEAR—FAR is 6 px, so FAR is 6 px from NEAR but 18 px from CORE.
    // A transitive rule would take all three; measuring from the identity set never does.
    const result = select(6, 6, 8);
    expect(result.selected).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
  });

  it("takes only the identity component when fragments are not requested", () => {
    // `main-only` must mean main-only even when a fragment is well inside the reach.
    const result = select(4, 40, 20, false);
    expect(result.selected).toHaveLength(1);
  });

  it("reports rejected components largest-first, after the selection is final", () => {
    const result = select(8, 40, 10);
    const sizes = result.rejected.map((entry) => entry.size);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    // Anything reported as rejected must genuinely not be in the body.
    for (const entry of result.rejected) expect(result.selected).not.toContain(entry.label);
  });

  it("returns nothing when the identity box touches no water", () => {
    const { mask } = threeBlocks(20, 20);
    const labelling = labelComponents(mask);
    const result = selectBodyComponents(
      labelling,
      mask.width,
      mask.height,
      { x0: 0, y0: 0, x1: 2, y1: 2 },
      { neighbourPx: 10, includeFragments: true },
    );
    expect(result.identity).toHaveLength(0);
    expect(result.selected).toHaveLength(0);
  });

  it("refuses a fractional reach rather than rounding it", () => {
    // Rounding a metre value into pixels is what merged two named lakes; a non-integer reach
    // is now a programming error, not a silent nearest-pixel.
    expect(() => select(8, 40, 4.5)).toThrow(/non-negative integer/);
  });
});
