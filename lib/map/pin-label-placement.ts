/**
 * Which side of a map pin its label goes on (T-122). Pins keep one on-screen size at every zoom,
 * so two close vertices (a small polygon on a phone map) put two labels centred above them into
 * each other. Each label instead faces away from the centre of all the pins: the side a
 * neighbour is least likely to be on. A lone pin, or one on the centre, keeps the label above.
 */

export type PinLabelSide = "above" | "below" | "left" | "right";

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
