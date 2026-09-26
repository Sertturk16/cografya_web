import { describe, expect, it } from "vitest";
import { TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
import { TR_CONTEXT_TALL_VIEWBOX } from "@/lib/map/tr-context-tall.generated";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";
import { parseViewBox, type ViewBox } from "@/lib/map/zoom-pan";
import { fitPointsView, toolBaseView } from "./tool-view";

const WIDE = parseViewBox(TR_CONTEXT_VIEWBOX);
const TALL = parseViewBox(TR_CONTEXT_TALL_VIEWBOX);
const TURKEY = parseViewBox(MAP_VIEWBOX);
const DESKTOP_ASPECT = WIDE.w / WIDE.h;

const contains = (outer: ViewBox, inner: ViewBox) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.w >= inner.x + inner.w &&
  outer.y + outer.h >= inner.y + inner.h;

describe("toolBaseView", () => {
  it("is exactly today's wide frame in the desktop box", () => {
    const view = toolBaseView(DESKTOP_ASPECT);
    expect(view.x).toBeCloseTo(WIDE.x, 6);
    expect(view.y).toBeCloseTo(WIDE.y, 6);
    expect(view.w).toBeCloseTo(WIDE.w, 6);
    expect(view.h).toBeCloseTo(WIDE.h, 6);
  });

  it("crops the sides and grows north and south in a phone box, so Türkiye draws larger", () => {
    const aspect = 1; // the phone box is square
    const view = toolBaseView(aspect);
    expect(view.w / view.h).toBeCloseTo(aspect, 6);
    expect(view.w).toBeLessThan(WIDE.w);
    expect(view.h).toBeGreaterThan(WIDE.h);
    expect(contains(view, TURKEY), "all of Türkiye stays on screen").toBe(true);
    expect(contains(TALL, view), "only where the tall context artifact has geography").toBe(true);
  });

  it("never reaches past the tall frame, even in a portrait fullscreen", () => {
    for (const aspect of [0.45, 0.6, 1, 1.6, 2.05, 3]) {
      const view = toolBaseView(aspect);
      expect(contains(TALL, view), `aspect ${aspect}`).toBe(true);
      expect(contains(view, TURKEY), `aspect ${aspect}`).toBe(true);
    }
  });

  it("falls back to the wide frame for a box it cannot measure", () => {
    expect(toolBaseView(Number.NaN)).toEqual(toolBaseView(DESKTOP_ASPECT));
    expect(toolBaseView(0)).toEqual(toolBaseView(DESKTOP_ASPECT));
  });
});

describe("fitPointsView", () => {
  const base = toolBaseView(1);
  const box = { w: 279, h: 279 }; // the 360 px phone plate
  const insets = { top: 60, right: 12, bottom: 52, left: 12 };
  /** Where a map point lands in the box for a given view (meet fit, as the tool's svg). */
  const toScreen = (view: ViewBox, p: { x: number; y: number }) => {
    const s = Math.min(box.w / view.w, box.h / view.h);
    const offX = (box.w - view.w * s) / 2;
    const offY = (box.h - view.h * s) / 2;
    return { x: offX + (p.x - view.x) * s, y: offY + (p.y - view.y) * s };
  };

  it.each([
    // Samsun–Rize-like pair on the Black Sea coast: wide, near the top where the buttons sit.
    {
      name: "a coastal pair",
      points: [
        { x: 610, y: 40 },
        { x: 850, y: 60 },
      ],
    },
    // Sinop–Mersin-like pair: TALL, so fitting it to the whole box put the northern point
    // under the top buttons (56 px from the top edge against a 60 px band).
    {
      name: "a north–south pair",
      points: [
        { x: 500, y: 20 },
        { x: 500, y: 380 },
      ],
    },
  ])("keeps $name inside the area the buttons leave free", ({ points }) => {
    const view = fitPointsView(points, base, box, insets);
    for (const p of points) {
      const s = toScreen(view, p);
      expect(s.y, "below the top buttons").toBeGreaterThanOrEqual(insets.top);
      expect(s.y, "above the scale bar").toBeLessThanOrEqual(box.h - insets.bottom);
      expect(s.x).toBeGreaterThanOrEqual(insets.left);
      expect(s.x).toBeLessThanOrEqual(box.w - insets.right);
    }
  });

  it("stays at 1x inside the base view for a pair spanning the country", () => {
    const view = fitPointsView(
      [
        { x: 20, y: 120 },
        { x: 990, y: 190 },
      ],
      base,
      box,
      insets,
    );
    expect(view.w).toBeCloseTo(base.w, 6);
    expect(contains(base, view)).toBe(true);
  });

  it("does not zoom past the ceiling for a single point", () => {
    const view = fitPointsView([{ x: 500, y: 200 }], base, box, insets, { maxZoom: 8 });
    expect(base.w / view.w).toBeLessThanOrEqual(8 + 1e-9);
    expect(base.w / view.w).toBeGreaterThan(1);
  });
});
