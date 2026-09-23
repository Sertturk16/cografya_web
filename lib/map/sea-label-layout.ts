/**
 * Sea names on `/turkiye`'s map (T-084).
 *
 * Like the neighbour labels (`context-label-fit.ts`, T-082), these are SVG text sized in viewBox
 * units, so the box scales them: KARADENİZ is 20px at 1440px and 5px in a phone's ~290px square,
 * MARMARA DENİZİ 3px. This module gives each name an on-screen floor and picks where it goes.
 *
 * A FLOOR, NOT A CONSTANT SIZE. The desktop sizes carry a hierarchy (the two open seas at 18
 * units, the Aegean at 14, the inland Marmara at 9.5) and a constant on-screen size flattened it:
 * tried at 12px, KARADENİZ read no heavier than "Bulgaristan" at 1440px and MARMARA DENİZİ had
 * nowhere to go. So a label keeps its design size wherever that is legible and never renders
 * below `minPx`; the floors sit at or above the neighbour labels' 10.85px except Marmara's,
 * because an inland sea is the smallest feature named on the map.
 *
 * WHY AUTHORED ROOMS AND NOT A LAND TEST. The neighbour rule measures each country's outline. A
 * sea has no outline in the artifacts, and its complement (everything that is not land) is no
 * substitute here: the Aegean is islands all the way down, and EGE DENİZİ at its desktop size
 * already crosses a few units of Lesbos and Euboea, as every printed atlas's Aegean label does.
 * A strict "no land under the text" rule hides it at 1440px. So each placement records the
 * length of water it may use (`room`, and `across` for a stacked block), read from the open-water
 * runs of `tr-context-tall.generated.ts` at the anchor with islands allowed, and a label takes
 * the first placement it fits. None fits → the label is not drawn. The test pins every anchor to
 * open water, so a regenerated artifact that moves a coast reds instead of drifting.
 */

import { DESKTOP_SCALE } from "@/lib/map/context-label-fit";

export interface SeaPlacement {
  /** Anchor in viewBox units: the text's horizontal centre and first baseline, pre-rotation. */
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  /** Degrees about the anchor. -90 reads bottom to top. */
  readonly rotate?: number;
  /** Water available along the text, in viewBox units. */
  readonly room: number;
  /** Water available across a stacked block (cap top to last baseline), in viewBox units. */
  readonly across?: number;
}

export interface SeaLabel {
  readonly name: string;
  /** The size at the 1440px desktop box, in viewBox units. */
  readonly fontUnits: number;
  /** The smallest on-screen size, in CSS px. */
  readonly minPx: number;
  /** Tried in order; the first the label fits wins. */
  readonly placements: readonly SeaPlacement[];
}

export interface SeaLabelDraw {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  readonly rotate: number;
  /** In viewBox units. */
  readonly fontSize: number;
}

/**
 * Advance widths in em of the sea labels' face (Fraunces Bold, `tracking-wider` 0.05em, trailing
 * spacing included), measured in the browser with `getComputedTextLength()` at 100 units. Keyed by
 * line, because the lines are a closed set; the test asserts every placement's lines are here.
 */
export const SEA_LINE_WIDTH_EM: Readonly<Record<string, number>> = {
  KARADENİZ: 6.922,
  AKDENİZ: 5.273,
  "EGE DENİZİ": 6.607,
  "MARMARA DENİZİ": 10.446,
  MARMARA: 6.114,
  DENİZİ: 4.072,
};

/** Baseline-to-baseline distance of a stacked label, in em. */
export const SEA_LINE_HEIGHT_EM = 1.1;

/** Fraunces' cap height in em: the ink above the first baseline of a stacked block. */
const CAP_HEIGHT_EM = 0.72;

export const SEA_LABELS: readonly SeaLabel[] = [
  {
    name: "KARADENİZ",
    fontUnits: 18,
    minPx: 12,
    // Open water at the anchor runs x 102–824.
    placements: [{ x: 480, y: -20, lines: ["KARADENİZ"], room: 680 }],
  },
  {
    name: "AKDENİZ",
    fontUnits: 18,
    minPx: 12,
    placements: [
      // Between Rhodes and Cyprus: water runs x 36–348 at cap height, so ±120 either side.
      { x: 228, y: 480, lines: ["AKDENİZ"], room: 240 },
      // South of Cyprus the run is x -150…510 (frame edge to the Levant coast). Below the
      // desktop box's visible band (y ≤ 551), but a phone's square frame shows it.
      { x: 250, y: 565, lines: ["AKDENİZ"], room: 480 },
    ],
  },
  {
    name: "EGE DENİZİ",
    fontUnits: 14,
    minPx: 11,
    placements: [
      // Between Euboea and the İzmir coast, x -95…67 at cap height, islands allowed.
      { x: -25, y: 240, lines: ["EGE DENİZİ"], room: 150 },
      // Down the sea's long axis: on a phone the horizontal label is wider than the Aegean and
      // runs off the frame's left edge (x -150); vertically it runs from off Lesbos to the
      // Cyclades, which at 320px (a 246px box, 11px = 57 units, 376 long) still reads as sea.
      { x: -10, y: 300, lines: ["EGE DENİZİ"], rotate: -90, room: 400 },
    ],
  },
  {
    name: "MARMARA DENİZİ",
    fontUnits: 9.5,
    minPx: 9,
    placements: [
      // The sea's widest rows, y 86–108, run x 76–220.
      { x: 145, y: 108, lines: ["MARMARA DENİZİ"], room: 115 },
      // Stacked over the same body (y 80–110) for a laptop-sized box, or a phone map at its 3×
      // zoom. Centred on the top line's rows, which leave x 99–187: ±44 about x 143.
      { x: 143, y: 95, lines: ["MARMARA", "DENİZİ"], room: 86, across: 30 },
    ],
  },
];

function widthEm(line: string): number {
  const em = SEA_LINE_WIDTH_EM[line];
  if (em === undefined) throw new Error(`No measured width for sea label line "${line}"`);
  return em;
}

/** Whether `placement` holds its text at `fontSize` viewBox units. */
export function seaPlacementFits(placement: SeaPlacement, fontSize: number): boolean {
  const along = Math.max(...placement.lines.map(widthEm)) * fontSize;
  if (along > placement.room) return false;
  if (placement.lines.length === 1) return true;
  const block = (CAP_HEIGHT_EM + SEA_LINE_HEIGHT_EM * (placement.lines.length - 1)) * fontSize;
  return placement.across !== undefined && block <= placement.across;
}

/**
 * `scale` is CSS px per viewBox unit as rendered, zoom included; `null` before the box has been
 * measured (server render and first paint), which lays out the desktop box.
 */
export function seaLabelLayout(scale: number | null): SeaLabelDraw[] {
  const s = scale !== null && scale > 0 ? scale : DESKTOP_SCALE;
  const out: SeaLabelDraw[] = [];
  for (const label of SEA_LABELS) {
    const fontSize = Math.round((Math.max(label.fontUnits * s, label.minPx) / s) * 100) / 100;
    const placement = label.placements.find((p) => seaPlacementFits(p, fontSize));
    if (!placement) continue;
    out.push({
      name: label.name,
      x: placement.x,
      y: placement.y,
      lines: placement.lines,
      rotate: placement.rotate ?? 0,
      fontSize,
    });
  }
  return out;
}
