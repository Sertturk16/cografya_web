import type { MarineLayer, MarineValue } from "@/lib/api/types";
import { hasNumber, marineValueView } from "./value-state";

/**
 * Direction rendering for the marine value band: whether an arrow may be drawn at all, which
 * way it points, and what the sentence next to it says.
 *
 * EVERY GATE IS READ FROM DATA. There is no boolean in this repo that says "wind arrows are
 * on now", no calm threshold written down, no convention string spelled out. The three facts
 * that decide the render — is a direction convention published, what does a degree mean, and
 * below which magnitude does this quantity count as calm — all live in the api's layer
 * catalogue, because all three are provider product decisions that can change without us.
 * If the api ever pulls `directionConvention` back to `null`, the arrow disappears on the
 * next revalidate with no deploy; that is the binding arrow-unlock rule (SPEC §5.5), and the
 * only way to honour it is to never cache the answer in code.
 *
 * WHY THE ROTATION IS ONE FUNCTION. ECMWF derives wind bearings from the vector components
 * 10u/10v, and a sign error there produces a bearing exactly 180° wrong — a reversed arrow
 * that looks perfectly correct on screen and would sit in production until a sailor noticed.
 * The api guards its half with a regression suite; this is the web half of the same guard:
 * one function, one table test over eight cardinal bearings × both conventions.
 */

/** The eight compass sectors, in bearing order from north. Index = sector number. */
export const COMPASS_POINTS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** `direction.from` / `direction.towards` — the label that precedes the compass name. */
export const MARINE_DIRECTION_CONVENTION_KEY: Record<"from" | "towards", string> = {
  from: "direction.from",
  towards: "direction.towards",
};

/** Compass sector → message key, exhaustive by type (same reasoning as the status map). */
export const MARINE_COMPASS_KEY: Record<CompassPoint, string> = {
  n: "compass.n",
  ne: "compass.ne",
  e: "compass.e",
  se: "compass.se",
  s: "compass.s",
  sw: "compass.sw",
  w: "compass.w",
  nw: "compass.nw",
};

export type MarineDirectionView =
  /** Draw the arrow. `rotationDeg` is the FLOW direction; `bearing`/`compass` are the datum. */
  | {
      kind: "arrow";
      bearing: number;
      rotationDeg: number;
      compass: CompassPoint;
      convention: "from" | "towards";
    }
  /** Below the layer's calm threshold: a word ("Sakin"), never an arrow at a meaningless angle. */
  | { kind: "calm" }
  /** No arrow and no calm claim — the magnitude renders alone. */
  | { kind: "none" };

/** Wraps any bearing into `[0, 360)`; negatives and ≥360 inputs included. */
export function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * The CSS rotation for the arrow glyph, in degrees.
 *
 * The glyph is authored pointing NORTH (up) at 0°, and the arrow always shows where the flow
 * is GOING, because that is what an arrow means to everyone who has ever seen a weather map.
 * The text alongside always states where it comes FROM, because that is what a meteorological
 * bearing means. The two are not in tension; they are two readings of one number, and both
 * are on screen.
 *
 * - `from` — 315° means "out of the north-west", so the flow travels towards the south-east:
 *   rotate by `bearing + 180`.
 * - `towards` — the bearing already IS the flow direction: rotate by the bearing.
 *
 * Non-finite input yields `0` rather than a `NaN` transform, which CSS would drop silently
 * and leave a north-pointing arrow next to a south-westerly wind.
 */
export function arrowRotationDeg(bearing: number, convention: "from" | "towards"): number {
  if (!Number.isFinite(bearing)) return 0;
  return normalizeBearing(convention === "from" ? bearing + 180 : bearing);
}

/**
 * The compass sector a bearing falls in — EIGHT sectors of 45°, not sixteen.
 *
 * Sixteen would claim a precision the source grids do not have (0.25° for ECMWF), and the
 * exact degree is printed beside the name anyway, so nothing is lost. Sector boundaries are
 * offset by half a sector (22.5°) so that north spans 337.5°–22.5° rather than starting at
 * north, which is what makes 359.9° read as "kuzey" instead of "kuzeybatı".
 */
export function compassPoint(bearing: number): CompassPoint {
  const normalized = normalizeBearing(Number.isFinite(bearing) ? bearing : 0);
  const index = Math.floor(normalizeBearing(normalized + 22.5) / 45);
  // `index` is provably 0–7; the fallback exists only because `noUncheckedIndexedAccess`
  // cannot prove it, and it is unreachable rather than defensive.
  return COMPASS_POINTS[index] ?? "n";
}

interface DirectionInput {
  /** The magnitude value (wave height, wind speed) — the one the calm threshold governs. */
  magnitude: MarineValue;
  /** The magnitude's catalogue row, which publishes `calmThreshold`. */
  magnitudeLayer: MarineLayer | undefined;
  /** The paired direction value (wave direction, wind direction). */
  direction: MarineValue;
  /** The direction's catalogue row, which publishes `directionConvention`. */
  directionLayer: MarineLayer | undefined;
}

/**
 * The single gate that decides what appears next to a magnitude.
 *
 * Order matters and is not arbitrary:
 *
 * 1. **Calm wins first.** When the magnitude is a real number below its layer's
 *    `calmThreshold`, the direction is meaningless — a 0.03 m sea has no wave direction worth
 *    drawing — so we say "sakin" whatever the direction field contains. The server never
 *    suppresses the direction value (nulling it would make calm indistinguishable from no
 *    data); suppressing the ARROW is the display's job, and this is that decision.
 * 2. **Then the arrow-unlock condition**, in full: a published convention, a real direction
 *    number, and a real magnitude number. A direction with no magnitude beside it is an angle
 *    with nothing travelling along it.
 * 3. **Otherwise nothing** — the magnitude (or its own status word) renders alone.
 *
 * A missing catalogue row (`undefined`) is treated as "no convention published" and as "no
 * threshold published": with no catalogue we cannot know what a degree means here, and
 * guessing is exactly what the unlock condition forbids.
 */
export function marineDirectionView(input: DirectionInput): MarineDirectionView {
  const magnitude = marineValueView(input.magnitude);
  const direction = marineValueView(input.direction);

  const calmThreshold = input.magnitudeLayer?.calmThreshold ?? null;
  if (hasNumber(magnitude) && calmThreshold !== null && magnitude.value < calmThreshold) {
    return { kind: "calm" };
  }

  const convention = input.directionLayer?.directionConvention ?? null;
  if (convention === null || !hasNumber(direction) || !hasNumber(magnitude)) {
    return { kind: "none" };
  }

  const bearing = normalizeBearing(direction.value);
  return {
    kind: "arrow",
    bearing,
    rotationDeg: arrowRotationDeg(bearing, convention),
    compass: compassPoint(bearing),
    convention,
  };
}
