/**
 * Which side of a map pin its label goes on (T-122). Pins keep one on-screen size at every zoom,
 * so two close vertices (a small polygon on a phone map) put two labels centred above them into
 * each other. Each label instead faces away from the centre of all the pins: the side a
 * neighbour is least likely to be on. A lone pin, or one on the centre, keeps the label above.
 *
 * That is only the preference. `placePinLabels` below picks the side each label actually takes,
 * keeping it inside the view (T-124: at 1× on a phone the view is barely wider than Türkiye, and
 * "Edirne" and "Iğdır" facing away from each other ran off the plate) and off other pins and
 * labels (T-127).
 */

export type PinLabelSide =
  | "above"
  | "below"
  | "left"
  | "right"
  | "above-left"
  | "above-right"
  | "below-left"
  | "below-right";

/** How far along each axis a diagonal label sits from its pin, as a share of the gap. */
export const DIAGONAL = Math.SQRT1_2;

interface Point {
  x: number;
  y: number;
}

export function pinLabelPlacement(pin: Point, all: readonly Point[]): { side: PinLabelSide } {
  if (all.length < 2) return { side: "above" };
  const cx = all.reduce((sum, p) => sum + p.x, 0) / all.length;
  const cy = all.reduce((sum, p) => sum + p.y, 0) / all.length;
  const dx = pin.x - cx;
  const dy = pin.y - cy;
  if (Math.abs(dx) > Math.abs(dy)) return { side: dx > 0 ? "right" : "left" };
  return { side: dy > 0 ? "below" : "above" };
}

/** A pin and its label's size, all in map units: `gap` from the dot's centre to the label. */
export interface PinLabel extends Point {
  gap: number;
  width: number;
  height: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The rectangle a label covers on `side` of its pin, matching how the map draws it: centred
 *  across the pin for above/below, centred on it vertically for left/right. */
export function labelBox(pin: PinLabel, side: PinLabelSide): Box {
  const { x, y, gap, width: w, height: h } = pin;
  switch (side) {
    case "above":
      return { x: x - w / 2, y: y - gap - h, w, h };
    case "below":
      return { x: x - w / 2, y: y + gap, w, h };
    case "left":
      return { x: x - gap - w, y: y - h / 2, w, h };
    case "right":
      return { x: x + gap, y: y - h / 2, w, h };
    case "above-left":
      return { x: x - gap * DIAGONAL - w, y: y - gap * DIAGONAL - h, w, h };
    case "above-right":
      return { x: x + gap * DIAGONAL, y: y - gap * DIAGONAL - h, w, h };
    case "below-left":
      return { x: x - gap * DIAGONAL - w, y: y + gap * DIAGONAL, w, h };
    case "below-right":
      return { x: x + gap * DIAGONAL, y: y + gap * DIAGONAL, w, h };
  }
}

/** Area two boxes share. */
function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Every pin's label side at once (T-127).
 *
 * Each label starts from the `pinLabelPlacement` side and walks down a list of the others:
 * vertical away from the centre, the other vertical, the two sideways sides, then the four
 * corners. It takes the
 * first side whose box stays inside `view` (T-124: the plate minus the controls' bands), covers
 * no other pin's dot and overlaps no label already placed. When no side is free it takes the one
 * that sticks out of the view and covers the least, never simply the preferred one: that ran
 * "Iğdır" off the plate when its pin sat inside a control band.
 *
 * The four sides are not always enough: the eight corners of "Marmara Denizi" in a 239 px box
 * have no overlap-free layout on four sides (checked exhaustively) and 1 705 once the corners
 * are allowed, so the four corner positions follow the sides. Placing in order, a late label can
 * still find every side taken; a few passes then let any label still overlapping something move
 * to a cheaper side against everyone's current place.
 *
 * Pin-to-centre alone put "Trabzon" to the right, away from the coast's centre and straight
 * into Rize's dot and label, in the "Karadeniz Kıyısı" example.
 */
export function placePinLabels(
  pins: readonly PinLabel[],
  { view, dotRadius }: { view: Box; dotRadius: number },
): PinLabelSide[] {
  const dots = pins.map((p) => ({
    x: p.x - dotRadius,
    y: p.y - dotRadius,
    w: dotRadius * 2,
    h: dotRadius * 2,
  }));
  const cx = pins.reduce((sum, p) => sum + p.x, 0) / pins.length;
  const cy = pins.reduce((sum, p) => sum + p.y, 0) / pins.length;
  const candidates = pins.map((pin) => {
    const vAway = pin.y > cy ? "below" : "above";
    const vNear = vAway === "above" ? "below" : "above";
    const hAway = pin.x > cx ? "right" : "left";
    const hNear = hAway === "right" ? "left" : "right";
    // The four sides first, then the corners, each list starting away from the centre.
    const order: PinLabelSide[] = [
      pinLabelPlacement(pin, pins).side,
      vAway,
      vNear,
      hAway,
      hNear,
      `${vAway}-${hAway}`,
      `${vAway}-${hNear}`,
      `${vNear}-${hAway}`,
      `${vNear}-${hNear}`,
    ];
    return order.filter((side, i) => order.indexOf(side) === i);
  });
  const sides: (PinLabelSide | null)[] = pins.map(() => null);

  // What a side costs: the label's area outside the view, on another pin's dot or on another
  // label placed so far. Zero is a free side.
  const cost = (index: number, side: PinLabelSide) => {
    const box = labelBox(pins[index]!, side);
    let total = box.w * box.h - overlapArea(box, view);
    dots.forEach((dot, j) => {
      if (j !== index) total += overlapArea(box, dot);
    });
    sides.forEach((other, j) => {
      if (j !== index && other) total += overlapArea(box, labelBox(pins[j]!, other));
    });
    return total;
  };
  // The first free side in candidate order, or failing that the cheapest.
  const choose = (index: number) => {
    let side = candidates[index]![0]!;
    let best = Infinity;
    for (const candidate of candidates[index]!) {
      const c = cost(index, candidate);
      if (c < best) {
        best = c;
        side = candidate;
      }
      if (c === 0) break;
    }
    return { side, best };
  };

  pins.forEach((_, index) => {
    sides[index] = choose(index).side;
  });
  // A label placed early never saw the ones after it. Let any label still overlapping something
  // move to a cheaper side against everyone's current place, until nothing improves.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    pins.forEach((_, index) => {
      const current = sides[index]!;
      const now = cost(index, current);
      if (now === 0) return;
      const next = choose(index);
      if (next.best < now) {
        sides[index] = next.side;
        moved = true;
      }
    });
    if (!moved) break;
  }
  return sides as PinLabelSide[];
}
