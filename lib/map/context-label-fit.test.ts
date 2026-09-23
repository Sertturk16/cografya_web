import { describe, expect, it } from "vitest";
import { TALL_CONTEXT_SHAPES, TR_CONTEXT_TALL_VIEWBOX } from "@/lib/map/tr-context-tall.generated";
import { parseSubpaths } from "@/lib/map/shape-geometry";
import {
  CONTEXT_LABEL_PX,
  contextLabelLayout,
  horizontalRoom,
  labelWidthEm,
  sliceScale,
  viewBoxSize,
  type LabelTarget,
} from "@/lib/map/context-label-fit";

/**
 * T-082. The neighbour labels on `/turkiye` are 12 SVG units, and the SVG scales with its box:
 * 10.85px in the 1440px desktop box, 2.2–2.8px in a phone's 231–301px square. These pin the
 * counter-scale that holds them near 10.85px everywhere, and the fit rule that drops a label
 * its country cannot hold at that size. Box widths are the measured content boxes (border
 * excluded): 229, 269 and 299px at 320/360/390, 1148px at 1440.
 */
const target = (iso: string): LabelTarget => {
  const shape = TALL_CONTEXT_SHAPES.find((s) => s.iso === iso);
  if (!shape) throw new Error(`no ${iso} in the tall artifact`);
  return { rings: parseSubpaths(shape.d), x: shape.labelPoint.x, y: shape.labelPoint.y };
};
const DESKTOP = 1148 / 1270;
const PHONE_390 = 299 / 1270;
const PHONE_360 = 269 / 1270;
const PHONE_320 = 229 / 1270;

/** The labels the explorer draws, as it names them (`COUNTRY_NAMES_TR`). */
const LABELS: ReadonlyArray<readonly [string, string]> = [
  ["AM", "Ermenistan"],
  ["AZ", "Azerbaycan"],
  ["BG", "Bulgaristan"],
  ["GE", "Gürcistan"],
  ["GR", "Yunanistan"],
  ["IQ", "Irak"],
  ["IR", "İran"],
  ["RU", "Rusya"],
  ["SY", "Suriye"],
  ["UA", "Ukrayna"],
  ["RO", "Romanya"],
  ["MD", "Moldova"],
  ["EG", "Mısır"],
  ["LY", "Libya"],
  ["JO", "Ürdün"],
  ["SA", "Suudi Arabistan"],
];
/** The nine the 1440px desktop box shows today (the wide frame's; the rest are outside it). */
const DESKTOP_VISIBLE = ["AM", "AZ", "BG", "GE", "GR", "IQ", "IR", "RU", "SY"];

const { width: VB_W, height: VB_H } = viewBoxSize(TR_CONTEXT_TALL_VIEWBOX);
const shown = (scale: number) => {
  const layout = contextLabelLayout(scale);
  return LABELS.filter(([iso, name]) => layout.fits(name, target(iso))).map(([iso]) => iso);
};

describe("viewBoxSize / sliceScale", () => {
  it("reads the tall frame and scales `slice` by the larger axis", () => {
    expect(viewBoxSize(TR_CONTEXT_TALL_VIEWBOX)).toEqual({ width: 1270, height: 1270 });
    expect(sliceScale(1148, 523, VB_W, VB_H)).toBeCloseTo(DESKTOP, 6);
    expect(sliceScale(301, 301, VB_W, VB_H)).toBeCloseTo(301 / 1270, 6);
    // A box taller than wide still fills: `slice` takes the larger ratio.
    expect(sliceScale(200, 400, VB_W, VB_H)).toBeCloseTo(400 / 1270, 6);
  });
});

describe("contextLabelLayout", () => {
  it("before a measurement (SSR, first paint) is exactly today's desktop rendering", () => {
    const layout = contextLabelLayout(null);
    expect(layout.fontSize).toBe(12);
    for (const [iso, name] of LABELS) expect(layout.fits(name, target(iso)), iso).toBe(true);
  });

  it("at the 1440px desktop box keeps the 12-unit font and every label it shows today", () => {
    const layout = contextLabelLayout(DESKTOP);
    expect(layout.fontSize).toBe(12);
    expect(shown(DESKTOP)).toEqual(expect.arrayContaining(DESKTOP_VISIBLE));
  });

  it("holds the on-screen size constant on a phone and when zoomed", () => {
    for (const scale of [PHONE_320, PHONE_390, PHONE_390 * 3, 637 / 1270]) {
      const { fontSize } = contextLabelLayout(scale);
      expect(fontSize * scale, `scale ${scale}`).toBeCloseTo(CONTEXT_LABEL_PX, 1);
    }
    expect(CONTEXT_LABEL_PX).toBeGreaterThanOrEqual(10);
    expect(CONTEXT_LABEL_PX).toBeLessThanOrEqual(11);
  });

  it("on a phone keeps the labels their countries can hold, and only those", () => {
    // The Caucasus, the Balkans, Moldova and Arabia's two-word name cannot hold a legible label
    // at 229-299px, and "Ürdün" and "Libya" measured over their borders at 360-390px by the
    // circle rule this replaced. At 320 Romania's room (130 units) is just short of "Romanya".
    expect(shown(PHONE_390)).toEqual(["IQ", "IR", "SY", "UA", "RO", "EG"]);
    expect(shown(PHONE_360)).toEqual(["IQ", "IR", "SY", "UA", "RO", "EG"]);
    expect(shown(PHONE_320)).toEqual(["IQ", "IR", "SY", "UA", "EG"]);
  });

  it("brings labels back as the reader zooms in", () => {
    const base = shown(PHONE_390);
    const zoomed = shown(PHONE_390 * 3);
    expect(zoomed.length).toBeGreaterThan(base.length);
    expect(base.every((iso) => zoomed.includes(iso))).toBe(true);
  });
});

describe("the fit rule's parts", () => {
  it("measures label width from glyph advances, never narrower than the browser", () => {
    // Whole-word widths read with getComputedTextLength at 100px in the shipped font. The sum
    // ignores kerning, so it can only read wide: "Yunanistan" by 2.4%, every other name <1%.
    for (const [name, measured] of [
      ["Yunanistan", 4.842],
      ["Ürdün", 2.76],
      ["Suudi Arabistan", 7.084],
      ["İran", 1.7],
    ] as const) {
      expect(labelWidthEm(name) / measured, name).toBeGreaterThanOrEqual(0.995);
      expect(labelWidthEm(name) / measured, name).toBeLessThan(1.03);
    }
  });

  it("reads the room around a point from the outline", () => {
    const square = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    ];
    expect(horizontalRoom(square, 3, 5)).toBe(3);
    expect(horizontalRoom(square, 5, 5)).toBe(5);
    expect(horizontalRoom(square, 12, 5)).toBe(0);
    expect(horizontalRoom(square, 5, 11)).toBe(0);
  });
});
