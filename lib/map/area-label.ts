import { overlapArea, type Box } from "@/lib/map/pin-label-placement";
import { segmentHitsBox } from "@/lib/map/segment-labels";
import { pointInPolygon } from "@/lib/map/shape-geometry";

/**
 * Where the area tool writes its km² (T-121).
 *
 * Inside first: horizontal scan lines across the ring's box give candidates per inside interval
 * (its midpoint, and the midpoint of the part of it inside `view`, for a shape partly panned out
 * of sight), plus the ring's area centroid itself. A candidate fits when its centre
 * is inside the ring and no ring edge touches its box (then the whole box is inside), and the box
 * stays in `view`, off every vertex dot and off `obstacles` (the result panel). The fitting
 * candidate closest to the centroid wins, so a convex shape gets its label in the middle and a
 * concave one in its widest part near the middle.
 *
 * Outside next: just below, above, right of and left of the ring's box, clear of the edge dots, in
 * that order; the first free one wins. Nothing free: the label is dropped, the cartographic
 * default, and the area is always in the result panel. Pin labels are placed after this one and
 * keep off it.
 *
 * All values are map units; the caller converts CSS px with `atScreenSize`.
 */

interface Point {
  x: number;
  y: number;
}

export interface AreaLabelSize {
  width: number;
  height: number;
}

/** Scan lines across the ring's box; enough to find the wide part of a hand-drawn shape. */
const SCAN_LINES = 24;
const EPSILON = 1e-9;

/** The ring's area centroid, or its vertex mean when the ring has no area. */
function centroid(ring: readonly Point[]): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < EPSILON) {
    return {
      x: ring.reduce((sum, p) => sum + p.x, 0) / ring.length,
      y: ring.reduce((sum, p) => sum + p.y, 0) / ring.length,
    };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

export function placeAreaLabel(
  ring: readonly Point[],
  size: AreaLabelSize,
  {
    view,
    gap,
    dotRadius,
    obstacles = [],
  }: { view: Box; gap: number; dotRadius: number; obstacles?: readonly Box[] },
): Point | null {
  if (ring.length < 3) return null;
  const { width: w, height: h } = size;
  const edges = ring.map((p, i) => [p, ring[(i + 1) % ring.length]!] as const);
  const blockers = [
    ...obstacles,
    ...ring.map((p) => ({
      x: p.x - dotRadius,
      y: p.y - dotRadius,
      w: dotRadius * 2,
      h: dotRadius * 2,
    })),
  ];
  const boxAt = (c: Point): Box => ({ x: c.x - w / 2, y: c.y - h / 2, w, h });
  const touchesEdge = (box: Box) => edges.some(([a, b]) => segmentHitsBox(a, b, box));
  const isClear = (box: Box) =>
    box.w * box.h - overlapArea(box, view) <= EPSILON &&
    blockers.every((other) => overlapArea(box, other) <= 0);

  const minX = Math.min(...ring.map((p) => p.x));
  const maxX = Math.max(...ring.map((p) => p.x));
  const minY = Math.min(...ring.map((p) => p.y));
  const maxY = Math.max(...ring.map((p) => p.y));
  const target = centroid(ring);

  const candidates: Point[] = [target];
  for (let k = 0; k < SCAN_LINES; k++) {
    const y = minY + ((k + 0.5) * (maxY - minY)) / SCAN_LINES;
    const xs: number[] = [];
    for (const [a, b] of edges) {
      if (a.y > y === b.y > y) continue;
      xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const left = xs[i]!;
      const right = xs[i + 1]!;
      candidates.push({ x: (left + right) / 2, y });
      // The part of the interval inside the view, for a shape partly panned out of sight.
      const seenLeft = Math.max(left, view.x);
      const seenRight = Math.min(right, view.x + view.w);
      if (seenRight > seenLeft) candidates.push({ x: (seenLeft + seenRight) / 2, y });
    }
  }
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const box = boxAt(c);
    if (!pointInPolygon(c, ring) || touchesEdge(box) || !isClear(box)) continue;
    const distance = Math.hypot(c.x - target.x, c.y - target.y);
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
    }
  }
  if (best) return best;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const off = dotRadius + gap;
  const outside: Point[] = [
    { x: midX, y: maxY + off + h / 2 },
    { x: midX, y: minY - off - h / 2 },
    { x: maxX + off + w / 2, y: midY },
    { x: minX - off - w / 2, y: midY },
  ];
  for (const c of outside) {
    const box = boxAt(c);
    if (!touchesEdge(box) && isClear(box)) return c;
  }
  return null;
}
