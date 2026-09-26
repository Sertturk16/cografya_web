/**
 * Which side of a map pin its label goes on (T-122). Pins keep one on-screen size at every zoom,
 * so two close vertices (a small polygon on a phone map) put two labels centred above them into
 * each other. Each label instead faces away from the centre of all the pins: the side a
 * neighbour is least likely to be on. A lone pin, or one on the centre, keeps the label above.
 *
 * Given the visible `view` and how far a label reaches from its pin (`reach`, map units), a label
 * that would leave the view turns back into it (T-124): at 1× on a phone the view is barely wider
 * than Türkiye, and "Edirne" and "Iğdır" facing away from each other ran off the plate. A sideways
 * label that does not fit goes above or below instead (away from the centre where it can), and an
 * above/below label that does not fit takes the other vertical side.
 */

export type PinLabelSide = "above" | "below" | "left" | "right";

interface Point {
  x: number;
  y: number;
}

interface LabelFit {
  view: { x: number; y: number; w: number; h: number };
  reach: { x: number; y: number };
}

function fits(pin: Point, side: PinLabelSide, { view, reach }: LabelFit): boolean {
  switch (side) {
    case "left":
      return pin.x - reach.x >= view.x;
    case "right":
      return pin.x + reach.x <= view.x + view.w;
    case "above":
      return pin.y - reach.y >= view.y;
    case "below":
      return pin.y + reach.y <= view.y + view.h;
  }
}

export function pinLabelPlacement(
  pin: Point,
  all: readonly Point[],
  fit?: LabelFit,
): { side: PinLabelSide } {
  let dx = 0;
  let dy = 0;
  if (all.length >= 2) {
    dx = pin.x - all.reduce((sum, p) => sum + p.x, 0) / all.length;
    dy = pin.y - all.reduce((sum, p) => sum + p.y, 0) / all.length;
  }
  const vertical: PinLabelSide = dy > 0 ? "below" : "above";
  const side: PinLabelSide = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : vertical;
  if (!fit || fits(pin, side, fit)) return { side };
  if (side === "left" || side === "right") {
    if (fits(pin, vertical, fit)) return { side: vertical };
  }
  return { side: vertical === "above" ? "below" : "above" };
}
