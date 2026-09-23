import { describe, expect, it } from "vitest";
import { DESKTOP_SCALE } from "@/lib/map/context-label-fit";
import {
  SEA_LABELS,
  SEA_LINE_WIDTH_EM,
  seaLabelLayout,
  seaPlacementFits,
} from "@/lib/map/sea-label-layout";
import { parseSubpaths, pointInPolygon } from "@/lib/map/shape-geometry";
import { TALL_CONTEXT_SHAPES } from "@/lib/map/tr-context-tall.generated";

/** A phone's map square (T-079), inside its 1px border: 244px at 320, 284px at 360. */
const PHONE_360 = 284 / 1270;
const PHONE_320 = 244 / 1270;
/** The 768px box is 654×420, so its width decides the slice scale. */
const TABLET_768 = 654 / 1270;

const LAND = TALL_CONTEXT_SHAPES.flatMap((shape) => parseSubpaths(shape.d));
const isLand = (x: number, y: number) => LAND.some((ring) => pointInPolygon({ x, y }, ring));

const byName = (scale: number | null) =>
  Object.fromEntries(seaLabelLayout(scale).map((label) => [label.name, label]));

describe("seaLabelLayout", () => {
  it("draws all four seas on one line, unrotated, at the desktop box", () => {
    const labels = byName(null);
    expect(Object.keys(labels)).toEqual(["KARADENİZ", "AKDENİZ", "EGE DENİZİ", "MARMARA DENİZİ"]);
    for (const label of Object.values(labels)) {
      expect(label.rotate).toBe(0);
      expect(label.lines).toEqual([label.name]);
    }
    // The design sizes that were already legible stay; only Marmara's 8.6px rises to its floor.
    expect(labels["KARADENİZ"]?.fontSize).toBe(18);
    expect(labels["EGE DENİZİ"]?.fontSize).toBe(14);
    expect((labels["MARMARA DENİZİ"]?.fontSize ?? 0) * DESKTOP_SCALE).toBeCloseTo(9, 1);
  });

  it("never draws a label under its floor, at any scale or zoom", () => {
    for (let scale = 0.1; scale <= 3; scale += 0.01) {
      for (const label of seaLabelLayout(scale)) {
        const floor = SEA_LABELS.find((sea) => sea.name === label.name)?.minPx ?? Infinity;
        expect(label.fontSize * scale).toBeGreaterThanOrEqual(floor - 0.01);
      }
    }
  });

  it("only ever draws a placement the label fits", () => {
    for (let scale = 0.1; scale <= 3; scale += 0.01) {
      for (const label of seaLabelLayout(scale)) {
        const sea = SEA_LABELS.find((s) => s.name === label.name);
        const placement = sea?.placements.find((p) => p.x === label.x && p.y === label.y);
        expect(placement).toBeDefined();
        expect(seaPlacementFits(placement!, label.fontSize)).toBe(true);
      }
    }
  });

  it("on a phone, turns the Aegean down its long axis and drops Marmara", () => {
    for (const scale of [PHONE_360, PHONE_320]) {
      const labels = byName(scale);
      expect(labels["EGE DENİZİ"]?.rotate).toBe(-90);
      expect(labels["MARMARA DENİZİ"]).toBeUndefined();
      expect(labels["KARADENİZ"]).toBeDefined();
      expect(labels["AKDENİZ"]).toBeDefined();
    }
  });

  it("keeps the Aegean horizontal at 768, where it fits between the coasts", () => {
    expect(byName(TABLET_768)["EGE DENİZİ"]?.rotate).toBe(0);
  });

  it("brings Marmara back, stacked, on a phone map at its 3× maximum zoom", () => {
    expect(byName(PHONE_360 * 3)["MARMARA DENİZİ"]?.lines).toEqual(["MARMARA", "DENİZİ"]);
  });
});

describe("sea placements", () => {
  const placements = SEA_LABELS.flatMap((sea) =>
    sea.placements.map((placement, i) => ({ id: `${sea.name}#${i}`, sea, placement })),
  );

  it.each(placements)("$id has a measured width for every line", ({ placement }) => {
    for (const line of placement.lines) expect(SEA_LINE_WIDTH_EM[line]).toBeGreaterThan(0);
  });

  // Rooms are authored from the artifact's open-water runs (see the module docblock); an anchor on
  // land means a regenerated artifact moved the coast under a hand-placed label.
  it.each(placements)("$id is anchored on open water", ({ placement }) => {
    expect(isLand(placement.x, placement.y)).toBe(false);
  });
});
