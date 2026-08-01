import type { MapRect } from "@/lib/map/projection";

/**
 * Placing text labels next to point markers on the inline-SVG Türkiye map, without
 * overlaps and without a hand-tuned offset table.
 *
 * ## Why an algorithm rather than 30 hand-set offsets
 *
 * The 30 marine reference points are not evenly spread: 15 sit along the Black Sea coast
 * within 80 svg units of the frame's top edge, and 6 more crowd into a 93 × 26 unit pocket
 * on the Marmara. Written by hand, every one of those offsets would be a magic number that
 * silently rots the day the api moves a point or the ODbL snapshot shifts the projection —
 * and nobody would notice until two labels printed on top of each other in production.
 *
 * So placement is DERIVED: a deterministic greedy search over candidate slots, first fit
 * wins, and a label is never dropped (an unplaceable one takes its last candidate, which
 * is visibly wrong rather than invisibly missing).
 *
 * ## Why "push the label toward the nearest frame edge"
 *
 * These markers sit OFFSHORE, so the open water — the empty part of the picture — is
 * always on the side of the nearest frame edge. Pushing labels that way is what an atlas
 * does, and it needs no table of basins: the rule reads the geometry the api already
 * supplies. `lib/marine/basins.ts` deliberately holds no basin list for the same reason,
 * and this module holds none either.
 *
 * ## Text width without a text measurer
 *
 * There is no font metric on the server, so a label's width is estimated as
 * `characters × fontSize × charWidthRatio`. That is an approximation, and it is the right
 * one here: the ratio is tuned CONSERVATIVELY (wider than the real average advance of the
 * body font), so the collision test errs toward extra spacing. A too-wide estimate costs a
 * few svg units of air; a too-narrow one costs a collision.
 */

/** Which way a label is pushed away from its marker. */
export type LabelDirection = "up" | "down" | "left" | "right";

/** Where the text is anchored horizontally (maps 1:1 to SVG `text-anchor`). */
export type LabelAnchor = "start" | "middle" | "end";

/** One point to be drawn and labelled. */
export interface LabelledPointInput {
  /** Stable identity — the React key and the test handle. */
  readonly key: string;
  /** The visible label text. */
  readonly label: string;
  /** Marker position, in the map's coordinate space. */
  readonly x: number;
  readonly y: number;
}

/** One point after placement. */
export interface PlacedPointLabel extends LabelledPointInput {
  /** Text anchor position (the SVG text baseline origin). */
  readonly labelX: number;
  readonly labelY: number;
  readonly anchor: LabelAnchor;
  /** The direction the label was pushed in (exposed for tests and debugging). */
  readonly direction: LabelDirection;
  /** The box the label occupies — used for the frame, and asserted in the tests. */
  readonly box: MapRect;
  /**
   * Leader line from the marker to the label, or `null` when the label sits close enough
   * that a line would be noise rather than a cue.
   */
  readonly leader: {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  } | null;
}

export interface LabelLayoutOptions {
  /** Label font size, in map units. */
  readonly fontSize: number;
  /** Estimated glyph advance as a fraction of the font size (deliberately generous). */
  readonly charWidthRatio: number;
  /** Clearance between a marker and the nearest edge of its own label. */
  readonly markerGap: number;
  /** Distance between successive candidate slots in the push direction. */
  readonly slotStep: number;
  /** Minimum clearance between two labels, and between a label and a foreign marker. */
  readonly labelGap: number;
  /** Marker radius — a label may not cover another point's marker. */
  readonly markerRadius: number;
  /** How many slots to try before giving up and taking the last one. */
  readonly maxSlots: number;
}

export const DEFAULT_LABEL_LAYOUT: LabelLayoutOptions = {
  fontSize: 11,
  charWidthRatio: 0.56,
  markerGap: 7,
  slotStep: 12,
  labelGap: 2.5,
  markerRadius: 4,
  maxSlots: 9,
};

/** Cap height above the baseline, as a fraction of the font size. */
const ASCENT_RATIO = 0.78;
/** Descender depth below the baseline, as a fraction of the font size. */
const DESCENT_RATIO = 0.24;
/** A leader line is drawn once the label sits further away than this many units. */
const LEADER_THRESHOLD = 13;

function estimateWidth(label: string, options: LabelLayoutOptions): number {
  return label.length * options.fontSize * options.charWidthRatio;
}

/**
 * The frame edge a point is closest to — i.e. which way the open sea lies.
 *
 * Ties resolve in a fixed order (up, down, left, right) so the layout is deterministic:
 * the same input always produces the same picture, which is what makes the rendered
 * samples reviewable and the tests meaningful.
 */
export function nearestEdge(x: number, y: number, frame: MapRect): LabelDirection {
  const distances: readonly (readonly [LabelDirection, number])[] = [
    ["up", y - frame.minY],
    ["down", frame.maxY - y],
    ["left", x - frame.minX],
    ["right", frame.maxX - x],
  ];
  let best: LabelDirection = "up";
  let bestDistance = Infinity;
  for (const [direction, distance] of distances) {
    if (distance < bestDistance) {
      best = direction;
      bestDistance = distance;
    }
  }
  return best;
}

function boxFor(
  labelX: number,
  labelY: number,
  anchor: LabelAnchor,
  width: number,
  options: LabelLayoutOptions,
): MapRect {
  const minX =
    anchor === "middle" ? labelX - width / 2 : anchor === "end" ? labelX - width : labelX;
  return {
    minX,
    maxX: minX + width,
    minY: labelY - options.fontSize * ASCENT_RATIO,
    maxY: labelY + options.fontSize * DESCENT_RATIO,
  };
}

function overlaps(a: MapRect, b: MapRect, gap: number): boolean {
  return (
    a.minX - gap < b.maxX && a.maxX + gap > b.minX && a.minY - gap < b.maxY && a.maxY + gap > b.minY
  );
}

/**
 * Does the segment (x1,y1)→(x2,y2) touch the rectangle? Slab test, clipping the segment's
 * parameter range axis by axis.
 *
 * This is what stops a LEADER LINE from being drawn across somebody else's label: a
 * connector that runs under another name makes the reader guess which dot a name belongs
 * to, which is the one thing a labelled map may not do.
 */
function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, rect: MapRect): boolean {
  let tMin = 0;
  let tMax = 1;
  const axes: readonly (readonly [number, number, number, number])[] = [
    [x1, x2 - x1, rect.minX, rect.maxX],
    [y1, y2 - y1, rect.minY, rect.maxY],
  ];
  for (const [origin, delta, low, high] of axes) {
    if (delta === 0) {
      if (origin < low || origin > high) return false;
      continue;
    }
    const t1 = (low - origin) / delta;
    const t2 = (high - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }
  return true;
}

/**
 * Would this label box print over ANOTHER point's marker?
 *
 * It is the same AABB test as `overlaps`, with the marker as a zero-area rectangle and its
 * radius as the gap — so it delegates instead of restating the four comparisons. Written
 * out twice, the only thing keeping the two boundary rules (`<` vs `<=`) in step would be
 * that nobody edited one without the other.
 */
function coversMarker(box: MapRect, point: LabelledPointInput, radius: number): boolean {
  return overlaps(box, { minX: point.x, maxX: point.x, minY: point.y, maxY: point.y }, radius);
}

interface Candidate {
  readonly labelX: number;
  readonly labelY: number;
  readonly anchor: LabelAnchor;
  readonly direction: LabelDirection;
}

/** The push directions to try, in preference order, for a point whose open sea is `preferred`. */
function directionOrder(preferred: LabelDirection): readonly LabelDirection[] {
  const opposite: Record<LabelDirection, LabelDirection> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };
  const perpendicular: readonly LabelDirection[] =
    preferred === "up" || preferred === "down" ? ["left", "right"] : ["up", "down"];
  return [preferred, ...perpendicular, opposite[preferred]];
}

/** The three alignments offered at one distance in one direction. */
function slotCandidates(
  point: LabelledPointInput,
  direction: LabelDirection,
  distance: number,
  options: LabelLayoutOptions,
): Candidate[] {
  if (direction === "up" || direction === "down") {
    const labelY =
      direction === "up"
        ? point.y - distance
        : point.y + distance + options.fontSize * ASCENT_RATIO;
    return [
      { labelX: point.x, labelY, anchor: "middle", direction },
      { labelX: point.x - options.markerGap, labelY, anchor: "end", direction },
      { labelX: point.x + options.markerGap, labelY, anchor: "start", direction },
    ];
  }
  const labelX = direction === "left" ? point.x - distance : point.x + distance;
  const anchor: LabelAnchor = direction === "left" ? "end" : "start";
  const centred = point.y + options.fontSize * (ASCENT_RATIO - DESCENT_RATIO) * 0.5;
  return [
    { labelX, labelY: centred, anchor, direction },
    { labelX, labelY: centred - options.slotStep, anchor, direction },
    { labelX, labelY: centred + options.slotStep, anchor, direction },
  ];
}

/**
 * Candidate placements for one point, best first.
 *
 * Ordered by DISTANCE first and by direction second. That ordering is the whole trick in
 * the Marmara pocket, where six markers share a 93 × 26 unit box: a label that cannot fit
 * above its dot drops into the sea just below it instead of being exiled four steps north,
 * past two other names, on the grounds that north is where the open water is. A name close
 * to the wrong side of its dot beats a name far away on the right side.
 *
 * Slot `k` is `markerGap + k · slotStep` from the marker, and each slot offers three
 * alignments, so a label can also slide sideways before it is pushed a step further out.
 */
function candidatesFor(
  point: LabelledPointInput,
  preferred: LabelDirection,
  options: LabelLayoutOptions,
): Candidate[] {
  const directions = directionOrder(preferred);
  const candidates: Candidate[] = [];
  for (let slot = 0; slot < options.maxSlots; slot++) {
    const distance = options.markerGap + slot * options.slotStep;
    for (const direction of directions) {
      candidates.push(...slotCandidates(point, direction, distance, options));
    }
  }
  return candidates;
}

function leaderFor(
  point: LabelledPointInput,
  box: MapRect,
  options: LabelLayoutOptions,
): PlacedPointLabel["leader"] {
  // Nearest point of the label box to the marker — the shortest, least fussy connector.
  const targetX = Math.min(Math.max(point.x, box.minX), box.maxX);
  const targetY = Math.min(Math.max(point.y, box.minY), box.maxY);
  const distance = Math.hypot(targetX - point.x, targetY - point.y);
  if (distance <= LEADER_THRESHOLD) return null;

  // Start at the marker's edge rather than its centre so the line never prints over the dot.
  const ratio = options.markerRadius / distance;
  return {
    x1: point.x + (targetX - point.x) * ratio,
    y1: point.y + (targetY - point.y) * ratio,
    x2: targetX,
    y2: targetY,
  };
}

/**
 * Places a label beside every input point.
 *
 * Invariants (pinned by `point-labels.test.ts`): output length equals input length and
 * preserves input order; no two label boxes overlap; no label box covers another point's
 * marker; the same input always produces the same output.
 *
 * `frame` is the reference frame the "nearest edge" rule reads — normally the map's own
 * `MAP_VIEWBOX`, NOT the (larger) frame this layout ends up needing.
 */
export function placePointLabels(
  points: readonly LabelledPointInput[],
  frame: MapRect,
  options: LabelLayoutOptions = DEFAULT_LABEL_LAYOUT,
): PlacedPointLabel[] {
  const placed: PlacedPointLabel[] = [];
  const takenBoxes: MapRect[] = [];

  for (const point of points) {
    const preferred = nearestEdge(point.x, point.y, frame);
    const width = estimateWidth(point.label, options);
    const candidates = candidatesFor(point, preferred, options);

    let chosen: { candidate: Candidate; box: MapRect } | null = null;
    for (const candidate of candidates) {
      const box = boxFor(candidate.labelX, candidate.labelY, candidate.anchor, width, options);
      const leader = leaderFor(point, box, options);
      const collides =
        takenBoxes.some((taken) => overlaps(box, taken, options.labelGap)) ||
        points.some(
          (other) => other.key !== point.key && coversMarker(box, other, options.markerRadius),
        ) ||
        (leader !== null &&
          takenBoxes.some((taken) =>
            segmentHitsRect(leader.x1, leader.y1, leader.x2, leader.y2, taken),
          ));
      if (!collides) {
        chosen = { candidate, box };
        break;
      }
    }

    // Unplaceable: take the furthest candidate rather than drop the label. A visibly
    // crowded map is a bug report; a silently missing point is a lie about the data.
    const fallback = candidates[candidates.length - 1];
    if (chosen === null && fallback !== undefined) {
      chosen = {
        candidate: fallback,
        box: boxFor(fallback.labelX, fallback.labelY, fallback.anchor, width, options),
      };
    }
    if (chosen === null) continue;

    takenBoxes.push(chosen.box);
    placed.push({
      ...point,
      labelX: chosen.candidate.labelX,
      labelY: chosen.candidate.labelY,
      anchor: chosen.candidate.anchor,
      direction: chosen.candidate.direction,
      box: chosen.box,
      leader: leaderFor(point, chosen.box, options),
    });
  }

  return placed;
}

/**
 * The frame that contains the base map, every marker and every placed label.
 *
 * Labels are pushed OUTWARD, so many of them land outside `MAP_VIEWBOX` by design — the
 * offshore points themselves already sit outside the landmass bounding box the projection
 * was framed on. Computing the union keeps the map self-correcting: move a point, add a
 * point, and the frame follows instead of clipping the label at the panel edge.
 */
export function frameForLabelledPoints(
  base: MapRect,
  placed: readonly PlacedPointLabel[],
  options: LabelLayoutOptions = DEFAULT_LABEL_LAYOUT,
): MapRect {
  let { minX, minY, maxX, maxY } = base;
  for (const item of placed) {
    minX = Math.min(minX, item.box.minX, item.x - options.markerRadius);
    minY = Math.min(minY, item.box.minY, item.y - options.markerRadius);
    maxX = Math.max(maxX, item.box.maxX, item.x + options.markerRadius);
    maxY = Math.max(maxY, item.box.maxY, item.y + options.markerRadius);
  }
  const breathing = options.fontSize * 0.5;
  return {
    minX: minX - breathing,
    minY: minY - breathing,
    maxX: maxX + breathing,
    maxY: maxY + breathing,
  };
}
