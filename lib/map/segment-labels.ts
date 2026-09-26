import { overlapArea, type Box } from "@/lib/map/pin-label-placement";

/**
 * Where each leg's distance label goes on the distance tool's route (T-120).
 *
 * A label is horizontal text centred on its leg's midpoint, moved along the leg's normal by the
 * smallest distance at which its box no longer touches the line: half the box's extent across the
 * normal plus `gap`. So a flat leg's label sits just above it and a steep leg's just beside it.
 * The side facing away from the route's centre (the outside of the bend) is tried first; a
 * straight route, whose centre is on every leg, prefers above, then right.
 *
 * A side is free when its box stays inside `view` (the plate minus the control bands), covers no
 * dot, no `obstacles` box (the result panel), no label placed before it and no other leg. When
 * neither side is free, or the leg is shorter on screen than its label plus its two dots, the
 * label is dropped: the cartographic default, and the total is always in the result panel. Pin
 * labels are placed after these (`placePinLabels` takes them as obstacles), because a leg label
 * has two places and a pin label eight.
 *
 * All values are map units; the caller converts CSS px with `atScreenSize`.
 */

interface Point {
  x: number;
  y: number;
}

export interface SegmentLabelSize {
  width: number;
  height: number;
}

const EPSILON = 1e-9;

/** Whether the segment a→b touches the box (Liang–Barsky clipping; touching counts). */
export function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let enter = 0;
  let leave = 1;
  const edges: readonly (readonly [number, number])[] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.w - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.h - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > leave) return false;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return false;
      if (t < leave) leave = t;
    }
  }
  return true;
}

export function placeSegmentLabels(
  points: readonly Point[],
  sizes: readonly SegmentLabelSize[],
  {
    view,
    gap,
    dotRadius,
    obstacles = [],
  }: { view: Box; gap: number; dotRadius: number; obstacles?: readonly Box[] },
): (Point | null)[] {
  const legs = points.length - 1;
  if (legs < 1) return [];
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const dots = points.map((p) => ({
    x: p.x - dotRadius,
    y: p.y - dotRadius,
    w: dotRadius * 2,
    h: dotRadius * 2,
  }));
  const placed: Box[] = [];

  const isFree = (box: Box, leg: number) => {
    if (box.w * box.h - overlapArea(box, view) > EPSILON) return false;
    for (const other of [...obstacles, ...dots, ...placed]) {
      if (overlapArea(box, other) > 0) return false;
    }
    for (let j = 0; j < legs; j++) {
      if (j !== leg && segmentHitsBox(points[j]!, points[j + 1]!, box)) return false;
    }
    return true;
  };

  const result: (Point | null)[] = [];
  for (let leg = 0; leg < legs; leg++) {
    const a = points[leg]!;
    const b = points[leg + 1]!;
    const size = sizes[leg];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!size || length < EPSILON) {
      result.push(null);
      continue;
    }
    const { width: w, height: h } = size;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    // The label's extent along the leg, plus both pins' dots, must fit on the leg.
    if (Math.abs(ux) * w + Math.abs(uy) * h + 4 * dotRadius > length) {
      result.push(null);
      continue;
    }
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let nx = -uy;
    let ny = ux;
    const outward = (mx - cx) * nx + (my - cy) * ny;
    const flip =
      Math.abs(outward) > EPSILON
        ? outward < 0
        : ny > EPSILON || (Math.abs(ny) <= EPSILON && nx < 0);
    if (flip) {
      nx = -nx;
      ny = -ny;
    }
    const offset = (Math.abs(nx) * w) / 2 + (Math.abs(ny) * h) / 2 + gap;
    let chosen: Point | null = null;
    for (const side of [1, -1]) {
      const centre = { x: mx + side * nx * offset, y: my + side * ny * offset };
      const box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
      if (isFree(box, leg)) {
        chosen = centre;
        placed.push(box);
        break;
      }
    }
    result.push(chosen);
  }
  return result;
}
