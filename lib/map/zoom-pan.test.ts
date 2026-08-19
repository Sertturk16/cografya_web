import { describe, expect, it } from "vitest";
import {
  ASPECT_EPSILON,
  CLICK_MOVE_THRESHOLD_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  type ViewBox,
  clampPan,
  clampZoom,
  fitViewToAspect,
  formatViewBox,
  isRealClick,
  moveDistance,
  panBy,
  parseViewBox,
  unionBox,
  viewToIncludeShape,
  zoomAtPoint,
  zoomFromPinch,
  zoomOf,
} from "./zoom-pan";

// The committed world-fit viewBox is projection-agnostic; these tests use a round
// stand-in so the arithmetic is easy to reason about. The real value is read from the
// SVG at runtime, so the exact numbers here don't couple the tests to the projection.
const WORLD: ViewBox = { x: 0, y: 0, w: 1000, h: 400 };

describe("parseViewBox", () => {
  it("parses a space-separated viewBox string", () => {
    expect(parseViewBox("0 0 1000 400")).toEqual({ x: 0, y: 0, w: 1000, h: 400 });
  });

  it("tolerates comma/extra-whitespace separators", () => {
    expect(parseViewBox("  10, 20 , 30   40 ")).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it("throws on the wrong number of components", () => {
    expect(() => parseViewBox("0 0 1000")).toThrow();
  });

  it("throws on a non-positive width or height", () => {
    expect(() => parseViewBox("0 0 0 400")).toThrow();
    expect(() => parseViewBox("0 0 1000 -1")).toThrow();
  });

  it("throws on non-finite numbers", () => {
    expect(() => parseViewBox("0 0 abc 400")).toThrow();
  });
});

describe("formatViewBox", () => {
  it("round-trips a whole-number viewBox", () => {
    expect(formatViewBox(WORLD)).toBe("0 0 1000 400");
  });

  it("rounds to 2 decimals to keep the attribute compact", () => {
    expect(formatViewBox({ x: 1.23456, y: 0, w: 10, h: 5 })).toBe("1.23 0 10 5");
  });
});

describe("clampZoom", () => {
  it("passes through an in-range zoom", () => {
    expect(clampZoom(6)).toBe(6);
  });

  it("clamps below MIN_ZOOM (no zooming out past the full world)", () => {
    expect(clampZoom(0.5)).toBe(MIN_ZOOM);
  });

  it("clamps above MAX_ZOOM (owner-ruled 12×)", () => {
    expect(clampZoom(999)).toBe(MAX_ZOOM);
  });
});

describe("zoomOf", () => {
  it("reports 1× for the world-fit view", () => {
    expect(zoomOf(WORLD, WORLD)).toBe(1);
  });

  it("reports 4× when the view width is a quarter of the world", () => {
    expect(zoomOf(WORLD, { x: 0, y: 0, w: 250, h: 100 })).toBe(4);
  });
});

describe("clampPan", () => {
  it("forces the view back onto the world origin at 1× (no empty margin)", () => {
    const drifted: ViewBox = { x: -50, y: 30, w: 1000, h: 400 };
    expect(clampPan(drifted, WORLD)).toEqual({ x: 0, y: 0, w: 1000, h: 400 });
  });

  it("clamps a zoomed view to the left/top edges", () => {
    const past: ViewBox = { x: -20, y: -10, w: 250, h: 100 };
    expect(clampPan(past, WORLD)).toEqual({ x: 0, y: 0, w: 250, h: 100 });
  });

  it("clamps a zoomed view to the right/bottom edges", () => {
    const past: ViewBox = { x: 900, y: 380, w: 250, h: 100 };
    // maxX = 1000 - 250 = 750; maxY = 400 - 100 = 300
    expect(clampPan(past, WORLD)).toEqual({ x: 750, y: 300, w: 250, h: 100 });
  });

  it("leaves an already-in-bounds view untouched", () => {
    const inside: ViewBox = { x: 100, y: 50, w: 250, h: 100 };
    expect(clampPan(inside, WORLD)).toEqual(inside);
  });
});

describe("zoomAtPoint (cursor-anchored zoom)", () => {
  it("keeps the anchored world point stationary when zooming in", () => {
    // Anchor at the exact viewport centre of the world view: world point (500, 200).
    const next = zoomAtPoint(WORLD, WORLD, 4, 0.5, 0.5);
    expect(zoomOf(WORLD, next)).toBe(4);
    // The world point under the centre must still be the centre after zoom.
    expect(next.x + 0.5 * next.w).toBeCloseTo(500, 6);
    expect(next.y + 0.5 * next.h).toBeCloseTo(200, 6);
  });

  it("keeps an off-centre cursor point stationary", () => {
    // Cursor at 25% across / 75% down of the world view → world point (250, 300).
    const next = zoomAtPoint(WORLD, WORLD, 2, 0.25, 0.75);
    expect(next.x + 0.25 * next.w).toBeCloseTo(250, 6);
    expect(next.y + 0.75 * next.h).toBeCloseTo(300, 6);
  });

  it("clamps the requested zoom to MAX_ZOOM", () => {
    const next = zoomAtPoint(WORLD, WORLD, 999, 0.5, 0.5);
    expect(zoomOf(WORLD, next)).toBeCloseTo(MAX_ZOOM, 6);
  });

  it("never produces a view that escapes the world bbox (top-left anchor)", () => {
    // Anchor at the top-left corner while zooming in — result must stay clamped.
    const next = zoomAtPoint(WORLD, WORLD, 8, 0, 0);
    expect(next.x).toBeGreaterThanOrEqual(WORLD.x);
    expect(next.y).toBeGreaterThanOrEqual(WORLD.y);
    expect(next.x + next.w).toBeLessThanOrEqual(WORLD.x + WORLD.w + 1e-9);
    expect(next.y + next.h).toBeLessThanOrEqual(WORLD.y + WORLD.h + 1e-9);
  });

  it("never produces a view that escapes the world bbox (bottom-right anchor)", () => {
    // Symmetric counterpart to the top-left case (review M7): anchor at the far corner.
    const next = zoomAtPoint(WORLD, WORLD, 8, 1, 1);
    expect(next.x).toBeGreaterThanOrEqual(WORLD.x);
    expect(next.y).toBeGreaterThanOrEqual(WORLD.y);
    expect(next.x + next.w).toBeLessThanOrEqual(WORLD.x + WORLD.w + 1e-9);
    expect(next.y + next.h).toBeLessThanOrEqual(WORLD.y + WORLD.h + 1e-9);
  });
});

describe("zoomFromPinch (SPEC §3 pinch ratio)", () => {
  it("zooms in when the fingers spread apart", () => {
    // 2× the start separation from a 3× base → 6×.
    expect(zoomFromPinch(3, 100, 200)).toBe(6);
  });

  it("zooms out when the fingers come together", () => {
    // Half the start separation from a 6× base → 3×.
    expect(zoomFromPinch(6, 200, 100)).toBe(3);
  });

  it("leaves zoom unchanged when the separation is unchanged", () => {
    expect(zoomFromPinch(4, 150, 150)).toBe(4);
  });

  it("clamps a runaway spread to MAX_ZOOM", () => {
    expect(zoomFromPinch(8, 100, 1000)).toBe(MAX_ZOOM);
  });

  it("clamps an over-pinch to MIN_ZOOM (never past the full world)", () => {
    expect(zoomFromPinch(2, 400, 1)).toBe(MIN_ZOOM);
  });

  it("holds the start zoom on a degenerate zero start distance", () => {
    expect(zoomFromPinch(5, 0, 200)).toBe(5);
  });
});

describe("viewToIncludeShape (keyboard focus-follows-view, WCAG 2.4.7)", () => {
  const VIEW: ViewBox = { x: 0, y: 0, w: 250, h: 100 }; // a 4× zoomed view at the origin

  it("returns the SAME view reference when the shape is already fully visible", () => {
    const shape: ViewBox = { x: 10, y: 10, w: 20, h: 20 };
    expect(viewToIncludeShape(VIEW, WORLD, shape)).toBe(VIEW);
  });

  it("pans right just enough to bring a shape off the right edge into view", () => {
    const shape: ViewBox = { x: 300, y: 0, w: 20, h: 20 }; // right edge 320 > view right 250
    // x moves to 320 - 250 = 70; y already in range.
    expect(viewToIncludeShape(VIEW, WORLD, shape)).toEqual({ x: 70, y: 0, w: 250, h: 100 });
  });

  it("pans to the leading edges for a shape off the top-left", () => {
    const view: ViewBox = { x: 500, y: 200, w: 250, h: 100 };
    const shape: ViewBox = { x: 400, y: 150, w: 20, h: 20 };
    expect(viewToIncludeShape(view, WORLD, shape)).toEqual({ x: 400, y: 150, w: 250, h: 100 });
  });

  it("centres a shape larger than the viewport (never zooms in), preserving zoom", () => {
    const view: ViewBox = { x: 100, y: 0, w: 250, h: 100 };
    const shape: ViewBox = { x: 0, y: 0, w: 400, h: 50 }; // wider than the 250-wide view
    // x centred: 0 + 200 - 125 = 75; y already contained → stays 0; w/h unchanged.
    expect(viewToIncludeShape(view, WORLD, shape)).toEqual({ x: 75, y: 0, w: 250, h: 100 });
  });

  it("keeps the resulting view clamped inside the world bbox", () => {
    const view: ViewBox = { x: 750, y: 300, w: 250, h: 100 }; // hard against the SE corner
    const shape: ViewBox = { x: 980, y: 390, w: 15, h: 8 };
    const next = viewToIncludeShape(view, WORLD, shape);
    expect(next.x + next.w).toBeLessThanOrEqual(WORLD.x + WORLD.w + 1e-9);
    expect(next.y + next.h).toBeLessThanOrEqual(WORLD.y + WORLD.h + 1e-9);
  });
});

describe("panBy", () => {
  it("moves the view and stays clamped", () => {
    const view: ViewBox = { x: 100, y: 50, w: 250, h: 100 };
    expect(panBy(view, WORLD, 50, 25)).toEqual({ x: 150, y: 75, w: 250, h: 100 });
  });

  it("does not pan past the world edge", () => {
    const view: ViewBox = { x: 700, y: 250, w: 250, h: 100 };
    // Requested +100/+100 would exceed maxX=750 / maxY=300 → clamped.
    expect(panBy(view, WORLD, 100, 100)).toEqual({ x: 750, y: 300, w: 250, h: 100 });
  });
});

describe("moveDistance", () => {
  it("computes euclidean travel", () => {
    expect(moveDistance(3, 4)).toBe(5);
  });
});

describe("isRealClick (SPEC §4 threshold, movement-only — owner-ruled 2026-07-18)", () => {
  it("treats a small (stationary) gesture as a real click → navigate", () => {
    expect(isRealClick(2)).toBe(true);
  });

  it("rejects a gesture that moved too far (it was a pan)", () => {
    expect(isRealClick(CLICK_MOVE_THRESHOLD_PX + 0.5)).toBe(false);
  });

  it("navigates a stationary press regardless of how long it was held (no duration gate)", () => {
    // A deliberate slow press-and-hold to aim at a small target still navigates: hold
    // time is no longer a gate, only movement is.
    expect(isRealClick(0)).toBe(true);
  });

  it("uses a strict `<` boundary: exactly-at-threshold move is a drag, not a click", () => {
    expect(isRealClick(CLICK_MOVE_THRESHOLD_PX)).toBe(false);
  });
});

describe("zoom bounds (owner-ruled)", () => {
  it("pins MIN/MAX to the owner-ruled values", () => {
    expect(MIN_ZOOM).toBe(1);
    expect(MAX_ZOOM).toBe(12);
  });
});

/* ---- Aspect awareness (→ DEC 2026-08-17g md. 1) -------------------------------------------
   Everything above this line is the pre-existing suite and is deliberately untouched: it
   exercises the path where the stage carries the map's own shape, which is `/dunya` and every
   region round. Its passing unchanged IS the regression argument for those surfaces — the
   default `base = world` makes the new arithmetic identical to the old one there.

   `PHONE_ASPECT` is the ruled phone stage (1.2) against a world of 2.5 (1000 × 400), so the
   numbers stay mental-arithmetic sized: cover = 480 × 400, contain = 1000 × 833.33. */

const PHONE_ASPECT = 1.2;

describe("fitViewToAspect (the 1× reference when the stage has its own shape)", () => {
  it("returns the world itself when the aspects match", () => {
    expect(fitViewToAspect(WORLD, 2.5, "cover")).toEqual(WORLD);
    expect(fitViewToAspect(WORLD, 2.5, "contain")).toEqual(WORLD);
  });

  it("absorbs a sub-pixel aspect drift instead of cropping (ASPECT_EPSILON)", () => {
    // A measured box rounds to 1078 × 431.3 where the ratio asks for 431.2: a 0.02%
    // difference. Cropping there would rewrite /dunya's viewBox for a rounding error.
    const drifted = 2.5 * (1 + ASPECT_EPSILON / 2);
    expect(fitViewToAspect(WORLD, drifted, "cover")).toEqual(WORLD);
    expect(fitViewToAspect(WORLD, drifted, "contain")).toEqual(WORLD);
  });

  it("crops east-west for a taller stage, keeping every row of the world (cover)", () => {
    // The positive control for the test above: a real reframing must NOT be absorbed.
    expect(fitViewToAspect(WORLD, PHONE_ASPECT, "cover")).toEqual({
      x: 260,
      y: 0,
      w: 480,
      h: 400,
    });
  });

  it("grows past the world so the whole of it stays visible (contain)", () => {
    const view = fitViewToAspect(WORLD, PHONE_ASPECT, "contain");
    expect(view.w).toBe(1000);
    expect(view.h).toBeCloseTo(833.333, 3);
    // Centred on the world's centre: as much backdrop above as below.
    expect(view.y).toBeCloseTo(200 - 833.333 / 2, 3);
    expect(view.x).toBe(0);
  });

  it("contains the world and fits inside it, respectively", () => {
    const cover = fitViewToAspect(WORLD, PHONE_ASPECT, "cover");
    const contain = fitViewToAspect(WORLD, PHONE_ASPECT, "contain");
    expect(cover.w).toBeLessThanOrEqual(WORLD.w);
    expect(cover.h).toBeLessThanOrEqual(WORLD.h);
    expect(contain.w).toBeGreaterThanOrEqual(WORLD.w);
    expect(contain.h).toBeGreaterThanOrEqual(WORLD.h);
    expect(cover.w / cover.h).toBeCloseTo(PHONE_ASPECT, 6);
    expect(contain.w / contain.h).toBeCloseTo(PHONE_ASPECT, 6);
  });

  it("falls back to the world for a nonsense aspect", () => {
    expect(fitViewToAspect(WORLD, 0, "cover")).toEqual(WORLD);
    expect(fitViewToAspect(WORLD, Number.NaN, "contain")).toEqual(WORLD);
  });
});

describe("clampPan with a view larger than the world (the reset view)", () => {
  it("centres an over-tall view instead of pinning it to an edge", () => {
    const contain = fitViewToAspect(WORLD, PHONE_ASPECT, "contain");
    const dragged = { ...contain, y: contain.y + 500 };
    const clamped = clampPan(dragged, WORLD);
    expect(clamped.y).toBeCloseTo(contain.y, 6);
    expect(clamped.x).toBe(0);
  });

  it("still pins an exactly-world-sized view to the world origin (unchanged behaviour)", () => {
    expect(clampPan({ x: 40, y: 40, w: 1000, h: 400 }, WORLD)).toEqual({
      x: 0,
      y: 0,
      w: 1000,
      h: 400,
    });
  });
});

describe("zoomAtPoint with an explicit 1× reference", () => {
  it("is the pre-existing arithmetic when the reference is the world", () => {
    const view: ViewBox = { x: 100, y: 40, w: 250, h: 100 };
    expect(zoomAtPoint(view, WORLD, 2, 0.5, 0.5, WORLD)).toEqual(
      zoomAtPoint(view, WORLD, 2, 0.5, 0.5),
    );
  });

  it("sizes the view from the reference, so a 1.2 stage never letterboxes", () => {
    const base = fitViewToAspect(WORLD, PHONE_ASPECT, "contain");
    const view = fitViewToAspect(WORLD, PHONE_ASPECT, "cover");
    const zoomed = zoomAtPoint(view, WORLD, zoomOf(base, view) * 2, 0.5, 0.5, base);
    expect(zoomed.w / zoomed.h).toBeCloseTo(PHONE_ASPECT, 6);
  });

  it("opens cropped and resets to the whole world, both at legal zooms", () => {
    const base = fitViewToAspect(WORLD, PHONE_ASPECT, "contain");
    const opening = fitViewToAspect(WORLD, PHONE_ASPECT, "cover");
    // The opening frame is what the taller stage buys: ~2.08× the reset view here.
    expect(zoomOf(base, opening)).toBeCloseTo(1000 / 480, 6);
    // …and the reset view is 1×, i.e. reachable with the zoom floor in place.
    expect(zoomOf(base, base)).toBe(MIN_ZOOM);
  });
});

describe("unionBox (a shown answer can be a whole bölge)", () => {
  it("returns null for an empty list", () => {
    expect(unionBox([])).toBeNull();
  });

  it("returns the box itself for a single member", () => {
    const box: ViewBox = { x: 10, y: 20, w: 30, h: 40 };
    expect(unionBox([box])).toEqual(box);
  });

  it("spans every member", () => {
    expect(
      unionBox([
        { x: 10, y: 20, w: 30, h: 40 },
        { x: 100, y: 5, w: 10, h: 10 },
      ]),
    ).toEqual({ x: 10, y: 5, w: 100, h: 55 });
  });
});

/* The other half of both new branches (→ PR #69 review TA69-M1). A stage WIDER than the map
   is unreachable today — the phone formula floors at the map's own ratio, `/dunya` renders
   `height: auto`, and `map-bbox.ts` floors a region frame at 1 against a world of 2.5 — so
   this is the branch that goes live unexercised the first time any surface gets a landscape
   stage. `contain` is also the only way to reach `clampPan`'s x-axis oversize branch
   strictly; everything above it reaches only the `w === world.w` equality. */
const WIDE_ASPECT = 4;

describe("fitViewToAspect for a stage wider than the world", () => {
  it("crops north-south instead of east-west (cover)", () => {
    const view = fitViewToAspect(WORLD, WIDE_ASPECT, "cover");
    expect(view.w).toBe(1000);
    expect(view.h).toBe(250);
    expect(view.x).toBe(0);
    expect(view.y).toBe(75); // centred on the world's centre: (400 − 250) / 2
  });

  it("grows past the world's width so all of it stays visible (contain)", () => {
    const view = fitViewToAspect(WORLD, WIDE_ASPECT, "contain");
    expect(view.h).toBe(400);
    expect(view.w).toBe(1600);
    expect(view.x).toBe(-300); // (1000 − 1600) / 2
    expect(view.y).toBe(0);
  });

  it("centres a view wider than the world instead of pinning it to an edge", () => {
    const contain = fitViewToAspect(WORLD, WIDE_ASPECT, "contain");
    const dragged = { ...contain, x: contain.x + 500 };
    expect(clampPan(dragged, WORLD).x).toBeCloseTo(contain.x, 6);
  });
});

describe("ASPECT_EPSILON is a pinned constant, not whatever the test says it is", () => {
  it("is half a percent", () => {
    // The suite's own precedent: MIN_ZOOM / MAX_ZOOM are pinned to literals. Without this the
    // epsilon cases below build their input FROM the constant and pass at any value — widen it
    // past ~0.485 and the ruled 1.2 phone stage reads as "the same shape as the world", the
    // crop and the magnification this whole feature exists for go inert, and every other test
    // in this file still passes (→ TA69-M2).
    expect(ASPECT_EPSILON).toBe(0.005);
  });

  it("reframes an aspect a full percent away from the world's", () => {
    // Stated in absolute terms, so it does not reference the constant it is guarding.
    const drifted = 2.5 * 1.01;
    expect(fitViewToAspect(WORLD, drifted, "cover")).not.toEqual(WORLD);
    expect(fitViewToAspect(WORLD, drifted, "contain")).not.toEqual(WORLD);
  });
});

describe("the opening frame is always a legal zoom", () => {
  it("stays inside [MIN_ZOOM, MAX_ZOOM] across every aspect a stage can take", () => {
    // `fitViewToAspect` does not clamp, and the opening view is written straight to the
    // attribute without passing through `clampZoom` (→ TA69-M6). The claim is a RANGE claim,
    // not a universal one: it holds over the aspects today's layout can produce — the region
    // frame's floor of 1 (`lib/game/map-bbox.ts` MIN_ASPECT) at one end, a landscape stage at
    // the other. Below ~0.19 against this world it would genuinely open past 12×, which is why
    // that floor is load-bearing rather than cosmetic.
    for (let aspect = 1; aspect <= 6; aspect += 0.05) {
      const base = fitViewToAspect(WORLD, aspect, "contain");
      const opening = fitViewToAspect(WORLD, aspect, "cover");
      const zoom = zoomOf(base, opening);
      expect(zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
      expect(zoom).toBeLessThanOrEqual(MAX_ZOOM);
    }
  });
});
