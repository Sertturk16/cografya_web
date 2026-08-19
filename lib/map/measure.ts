import type { MapPoint } from "@/lib/map/projection";
import {
  EARTH_RADIUS_M,
  type LonLat,
  ringAreaKm2 as ringAreaKm2FromTuples,
} from "@/lib/map/spherical-area";
import { MAP_PROJECTION } from "@/lib/map/tr-provinces.generated";

/**
 * The measurement layer for the CBS tools — pure, DOM-free, testable (CBS-P2 SPEC §5.2).
 *
 * Sibling of `lib/map/zoom-pan.ts` and deliberately the same shape: every function here is a
 * plain calculation over numbers, so the tool islands hold interaction and this module holds
 * arithmetic. Nothing in this file touches `window`, `document` or React.
 *
 * ## Two coordinate spaces, named apart on purpose
 *
 * `MapPoint` is a point in the Türkiye map's SVG space (`lib/map/projection.ts`), and
 * {@link GeoPoint} is a longitude/latitude pair in decimal degrees. A tool click arrives as
 * the first and has to become the second before any distance is real. Mixing them is the
 * defect class this separation exists to make impossible to write.
 *
 * `GeoPoint` is an OBJECT (`{ lon, lat }`) while `lib/map/spherical-area.ts` speaks GeoJSON
 * tuples (`[lon, lat]`). That is not an oversight: the tuple form is the generators' existing
 * contract and must not move, while UI code that builds points from clicks is where the
 * classic lat/lon transposition happens, and a named field cannot be transposed silently.
 * {@link ringAreaKm2} is the single adapter between the two.
 *
 * ## No formatting happens here
 *
 * SPEC §6 requires every number a reader sees to come from next-intl's formatter, because the
 * decimal separator differs between the locales. So this module returns NUMBERS and
 * STRUCTURED PARTS, never display strings — {@link toDmsParts} hands back degrees/minutes/
 * seconds plus a cardinal KEY, and the component maps that key to the localized letter from
 * `messages/*.json` and formats the numbers. This is why SPEC §5.2's `formatLatLon(point,
 * style)` slot is filled by a parts function rather than a formatter: a `formatLatLon` that
 * returned a string would have to format numbers itself, which §6 forbids.
 */

/** A geographic coordinate in decimal degrees. */
export interface GeoPoint {
  readonly lon: number;
  readonly lat: number;
}

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = EARTH_RADIUS_M / 1000;

/**
 * Great-circle kilometres per degree, derived from the SAME radius the area formula uses.
 *
 * Deliberately derived rather than written as a textbook 111.32: that figure is the
 * EQUATORIAL radius's value, and a tool that measured area on one Earth and distance on
 * another would be quietly inconsistent in a way no test would catch.
 */
const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;

// ---------------------------------------------------------------------------------------
// Projection inverse
// ---------------------------------------------------------------------------------------

/**
 * The algebraic inverse of `projectToMapPoint()` — SVG space back to lon/lat.
 *
 * Reads the SAME emitted constants the forward transform reads, so the pair cannot drift:
 * if the ODbL snapshot is refreshed and the generator re-frames the map, both directions
 * follow automatically. Hand-copying the five numbers here is exactly what
 * `lib/map/projection.ts` warns against.
 *
 * The result is NOT clamped to Türkiye's frame. A point the user places outside the drawn
 * landmass is a real coordinate and the coordinate tool says so in words (SPEC §6.2);
 * clamping would silently report a place the user did not pick.
 */
export function unprojectMapPoint(point: MapPoint): GeoPoint {
  const { minLon, maxLat, cosLat, scale, padding } = MAP_PROJECTION;
  return {
    lon: minLon + (point.x - padding) / (cosLat * scale),
    lat: maxLat - (point.y - padding) / scale,
  };
}

/**
 * Ground kilometres spanned by one SVG unit, measured east-west at a given latitude.
 *
 * THIS IS WHAT MAKES THE SCALE BAR HONEST EAST-WEST. The map is projected with a single
 * `cos(reference latitude)` correction pinned at 38.96° N, so one SVG unit is 1.677 km there
 * and demonstrably not elsewhere: +4.3 % at Hatay's latitude, −4.7 % north of Sinop. A scale
 * bar computed from the fixed constant tells the reader a lie that roams across a 9 % band,
 * which is not acceptable in a measuring instrument (SPEC §6.4).
 *
 * **One axis, not two** (→ PR #71 review CODE71-M4). The VERTICAL scale in this projection is
 * constant at `KM_PER_DEGREE / scale`, so a bar corrected for east-west reading is off by the
 * same band with the opposite sign when a reader measures north-south with it: at 35.8° N,
 * 1.750 km/unit horizontally against 1.677 vertically. That is SPEC §6.4's contract exactly
 * and not a defect — but the UI must not present the bar as isotropic, and this sentence is
 * here so the tool PR does not assume it is.
 */
export function kmPerMapUnitAt(latitude: number): number {
  const { cosLat, scale } = MAP_PROJECTION;
  return (KM_PER_DEGREE * Math.cos(latitude * DEG_TO_RAD)) / (cosLat * scale);
}

// ---------------------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------------------

/**
 * Great-circle ("kuş uçuşu") distance between two coordinates, in kilometres.
 *
 * Haversine, which is numerically well-behaved at the short distances this tool produces —
 * the spherical law of cosines loses precision on near-coincident points, and two clicks a
 * few pixels apart are exactly that case.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const latA = a.lat * DEG_TO_RAD;
  const latB = b.lat * DEG_TO_RAD;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Total length of an OPEN polyline (the route mode's sum of legs), in kilometres.
 *
 * Zero for an empty or single-point line: a route with one point has no length, and the tool
 * asks for this on every click while the user is still placing the second point.
 */
export function polylineLengthKm(points: readonly GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    if (!previous || !current) continue;
    total += haversineKm(previous, current);
  }
  return total;
}

/**
 * Perimeter of a ring treated as implicitly CLOSED, in kilometres — the area tool's second
 * output (SPEC §6.3).
 *
 * Defined as the open length plus the closing leg, so it is `polylineLengthKm` plus one
 * segment rather than a second traversal with its own rounding behaviour. Fewer than three
 * points is not a ring and returns 0, matching {@link ringAreaKm2}: the two numbers appear
 * side by side and must not disagree about whether a shape exists yet.
 */
export function ringPerimeterKm(points: readonly GeoPoint[]): number {
  if (points.length < 3) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  return polylineLengthKm(points) + haversineKm(last, first);
}

// ---------------------------------------------------------------------------------------
// Area
// ---------------------------------------------------------------------------------------

/**
 * Unsigned spherical area of the ring the user drew, in km².
 *
 * The one adapter between this module's `{ lon, lat }` objects and the tuple contract the
 * water generators have always used. The formula itself is NOT reimplemented here — see
 * `lib/map/spherical-area.ts` for why there is exactly one copy of it in this repo.
 *
 * **DOMAIN: the ring must not cross the antimeridian** (→ PR #71 review CODE71-I2). The
 * underlying formula sums longitude DIFFERENCES, so a step from +179.5° to −179.5° is read as
 * a 359° sweep rather than a 1° one, and the answer comes back ~359× too large with no signal.
 * Faz-1's tools are bounded to the Türkiye frame (25.6–45.1° E) and cannot reach it; a future
 * worldwide caller must clamp or split its input first. `spherical-area.ts`'s header carries
 * the measurement.
 */
export function ringAreaKm2(points: readonly GeoPoint[]): number {
  const ring: LonLat[] = points.map((point) => [point.lon, point.lat]);
  return ringAreaKm2FromTuples(ring);
}

/**
 * Whether a closed ring crosses itself — the state in which the area tool must show no
 * number at all (SPEC §6.3).
 *
 * A self-intersecting outline has no single well-defined area, and the spherical formula
 * will still return one: the lobes cancel by winding, so a bow-tie reports something close
 * to the DIFFERENCE of its halves. Showing that number to a student is worse than showing
 * nothing, which is why this predicate gates the display rather than annotating it.
 *
 * ## Why the test runs in lon/lat rather than in SVG space
 *
 * The map's forward transform is affine in each axis independently (`x` is linear in
 * longitude, `y` linear in latitude), so a straight segment stays straight and two segments
 * cross in one space exactly when they cross in the other. The answer is therefore identical
 * either way, and lon/lat is the space the caller already holds.
 *
 * ## The exemption is by COORDINATE, not by index (→ PR #71 review CODE71-I1)
 *
 * Two edges that meet at a shared point touch there by construction, and that touch is not a
 * crossing. The first version of this function expressed "meet" as an INDEX relationship —
 * the next edge, plus the wrap-around pair — and that was wrong in a way the area tool
 * reaches on its own contract. Measured on the shipped code: an explicitly CLOSED ring
 * `[A,B,C,A]` returned `true`, and so did any ring with a repeated vertex (`[A,A,B,C]`,
 * `[A,B,B,C]`, `[A,B,C,C]`). `ringAreaKm2`'s docblock invites exactly those closed rings, so
 * the two functions in this module disagreed about the same input.
 *
 * Comparing coordinates fixes both classes at once and removes the index bookkeeping that
 * made it fragile: an index-based skip can be collapsed to a single condition and stay green
 * on a whole test file, which is how the same review found it a second time.
 *
 * ## Degenerate edges
 *
 * A zero-length edge — the repeated vertex above — is skipped rather than tested. It has no
 * direction, so every orientation test against it is collinear and every comparison degrades
 * to "do these bounding boxes touch". A duplicated point is a click the reader made twice,
 * not a shape that crosses itself.
 *
 * ## What it does not catch, stated accurately and verified
 *
 * Any two edges meeting at a shared point are exempt, so a ring that returns through a point
 * it already used (`[A,B,A,C]`) reads as non-intersecting. That is the intended semantics and
 * it is asserted: the area of such a spike is legitimately near zero, and refusing to show a
 * number for it would be the same defect as refusing one for a closed ring. Note this is a
 * BEHAVIOUR CHANGE from the first version, which reported that shape as self-intersecting —
 * the index-based rule caught it by accident while getting closed rings wrong.
 */
export function ringSelfIntersects(points: readonly GeoPoint[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    if (!a1 || !a2 || samePoint(a1, a2)) continue;
    for (let j = i + 1; j < n; j++) {
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (!b1 || !b2 || samePoint(b1, b2)) continue;
      // Edges meeting at a shared point touch there by construction; that is not a crossing.
      if (sharesEndpoint(a1, a2, b1, b2)) continue;
      if (segmentsCross(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** Exact coordinate equality — these points come from the same clicks, never from arithmetic. */
function samePoint(a: GeoPoint, b: GeoPoint): boolean {
  return a.lon === b.lon && a.lat === b.lat;
}

/** Whether two segments meet at any endpoint. */
function sharesEndpoint(a1: GeoPoint, a2: GeoPoint, b1: GeoPoint, b2: GeoPoint): boolean {
  return samePoint(a1, b1) || samePoint(a1, b2) || samePoint(a2, b1) || samePoint(a2, b2);
}

/** Sign of the cross product of `ab × ac`: >0 counter-clockwise, <0 clockwise, 0 collinear. */
function orientation(a: GeoPoint, b: GeoPoint, c: GeoPoint): number {
  const value = (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

/** Whether collinear point `c` lies within segment `ab`'s bounding box. */
function withinSegment(a: GeoPoint, b: GeoPoint, c: GeoPoint): boolean {
  return (
    Math.min(a.lon, b.lon) <= c.lon &&
    c.lon <= Math.max(a.lon, b.lon) &&
    Math.min(a.lat, b.lat) <= c.lat &&
    c.lat <= Math.max(a.lat, b.lat)
  );
}

/** Proper or collinear-overlapping intersection of two segments. */
function segmentsCross(a1: GeoPoint, a2: GeoPoint, b1: GeoPoint, b2: GeoPoint): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && withinSegment(a1, a2, b1)) return true;
  if (o2 === 0 && withinSegment(a1, a2, b2)) return true;
  if (o3 === 0 && withinSegment(b1, b2, a1)) return true;
  if (o4 === 0 && withinSegment(b1, b2, a2)) return true;
  return false;
}

// ---------------------------------------------------------------------------------------
// Scale bar
// ---------------------------------------------------------------------------------------

/** A scale bar: the round distance it represents, and how wide to draw it. */
export interface ScaleBar {
  /** The round number of kilometres the bar stands for (1-2-5 family). */
  readonly km: number;
  /** The bar's on-screen width in CSS pixels. */
  readonly px: number;
}

/** The 1-2-5 mantissas, tried largest first. */
const NICE_MANTISSAS = [5, 2, 1] as const;

/** Smallest view width, in km, that can carry a bar worth labelling. */
const MIN_USABLE_VIEW_KM = 0.001;

/**
 * The scale bar for the CURRENT view (SPEC §6.4).
 *
 * The bar snaps to a round distance and its pixel width follows — never the other way round.
 * A bar of fixed pixel width labelled "37 km" is a ruler with no readable graduations; a bar
 * labelled "50 km" that happens to be 143 px wide is one a reader can actually use.
 *
 * `centerLatitude` is a REQUIRED parameter rather than a defaulted one, and that is the whole
 * point of the signature: see {@link kmPerMapUnitAt} for the 9 % band a fixed constant would
 * put the reader inside.
 *
 * Returns `null` for a view that cannot produce a usable bar, so the caller draws nothing
 * rather than a bar of `NaN` or a bar labelled `1e-17 km`. "Usable" is a measured floor, not
 * a sign check (→ PR #71 review CODE71-M7 / TEST71-M5): `Math.abs(latitude) > 90` let exactly
 * ±90 through, where `kmPerMapUnitAt` is ~1e-16 and the bar became a label no reader could
 * use. The earlier docblock also promised a "target so small it rounds away" branch that the
 * code did not have — probed at `viewWidthUnits = 1e-300` it still returned a bar. Both are
 * now the same one-metre floor on `totalKm`.
 */
export function scaleBarKm(
  viewWidthUnits: number,
  renderedWidthPx: number,
  centerLatitude: number,
  maxFraction = 0.25,
): ScaleBar | null {
  if (!Number.isFinite(viewWidthUnits) || viewWidthUnits <= 0) return null;
  if (!Number.isFinite(renderedWidthPx) || renderedWidthPx <= 0) return null;
  if (!Number.isFinite(centerLatitude) || Math.abs(centerLatitude) > 90) return null;
  if (!Number.isFinite(maxFraction) || maxFraction <= 0) return null;

  const totalKm = viewWidthUnits * kmPerMapUnitAt(centerLatitude);
  // One metre across the whole view is far below any real map and safely above the ~1e-16
  // that a pole latitude produces; below it there is no bar worth labelling.
  if (!(totalKm >= MIN_USABLE_VIEW_KM)) return null;

  const targetKm = totalKm * maxFraction;
  const exponent = Math.floor(Math.log10(targetKm));
  const base = 10 ** exponent;
  let km = base;
  for (const mantissa of NICE_MANTISSAS) {
    if (mantissa * base <= targetKm) {
      km = mantissa * base;
      break;
    }
  }
  if (!Number.isFinite(km) || km <= 0) return null;

  return { km, px: (km / totalKm) * renderedWidthPx };
}

// ---------------------------------------------------------------------------------------
// Precision
// ---------------------------------------------------------------------------------------

/**
 * How many decimals a distance in kilometres may be shown with (SPEC §6.1 + §6.6).
 *
 * TWO RULES MEET HERE, and the stricter one wins. §6.1 is about magnitude: under 10 km a
 * whole number is too coarse to be useful. §6.6 is about EARNED precision: a value read off
 * two map clicks cannot claim more resolution than a click carries, and a click carries one
 * CSS pixel.
 *
 * The pixel is why the caller passes `kmPerPixel` rather than a zoom level. At 1× on a
 * 1000 px desktop stage one pixel is ~1.7 km; on a 360 px phone the same 1× pixel is ~4.7 km.
 * A rule written against zoom alone would show a phone user a tenth of a kilometre it cannot
 * possibly know.
 */
export function kmDecimalsFor(kmPerPixel: number, distanceKm: number): 0 | 1 {
  const magnitudeAllows = Number.isFinite(distanceKm) && Math.abs(distanceKm) < 10;
  const uncertaintyAllows = Number.isFinite(kmPerPixel) && kmPerPixel < 1;
  return magnitudeAllows && uncertaintyAllows ? 1 : 0;
}

// ---------------------------------------------------------------------------------------
// Degrees / minutes / seconds
// ---------------------------------------------------------------------------------------

/** Which axis a value belongs to — decides whether the cardinal is N/S or E/W. */
export type LatLonAxis = "lat" | "lon";

/**
 * A compass direction as a KEY, never as a letter.
 *
 * The letters differ per locale (`K/G/D/B` in Turkish, `N/S/E/W` in English) and live in
 * `messages/*.json`. A module that returned "K" would have hard-coded Turkish into a pure
 * calculation.
 */
export type CardinalKey = "north" | "south" | "east" | "west";

/**
 * The four localized letters, supplied by the caller from the message bundle.
 *
 * **Each value must be exactly ONE character** (→ PR #71 review CODE71-M6). {@link parseLatLon}
 * recognises a direction by comparing the input's last character against these values, so a
 * bundle carrying "Kuzey"/"North" would match nothing and turn EVERY typed DMS coordinate into
 * `unreadable` — a total, silent failure of the keyboard path, which SPEC §10.1 makes the
 * PRIMARY input path rather than a convenience. The type cannot express the constraint, so it
 * is stated here and pinned by a test.
 */
export type CardinalLetters = Readonly<Record<CardinalKey, string>>;

/** A coordinate in degrees, minutes and seconds, plus its direction. */
export interface DmsParts {
  /** Whole degrees, always non-negative — the sign is carried by {@link cardinal}. */
  readonly degrees: number;
  /** Whole minutes, 0–59. */
  readonly minutes: number;
  /** Seconds, 0 to under 60; fractional when `secondsDecimals` > 0. */
  readonly seconds: number;
  readonly cardinal: CardinalKey;
}

/**
 * Decimal degrees into DMS parts — OUR precision format, not the curriculum's (SPEC §6.2).
 *
 * **The earlier claim here ("the form the curriculum uses") was measured false and is
 * corrected** (→ `QUESTIONS.md` AK-26, NOVA 2026-08-19). Across the 71 pages of MEB/EBA
 * Coğrafya 9's first unit the word `saniye` appears zero times and no degree-minute string
 * occurs; what the book actually prints is a whole degree plus a direction letter (`30° K`).
 * So DMS is the resolution WE choose to offer, and only the direction letters are
 * curriculum-verified. No reader-facing copy may give this notation curriculum standing.
 *
 * ROUNDING IS DONE HERE, NOT AT DISPLAY TIME, and that is what stops the classic `60"` bug.
 * Rounding 39.99999° to whole seconds naively yields `39°59'60"`, which is not a coordinate;
 * carrying the overflow into minutes and then into degrees is only correct if it happens
 * BEFORE the parts are split apart. A component that rounded the seconds itself could not do
 * it at all.
 */
export function toDmsParts(value: number, axis: LatLonAxis, secondsDecimals = 0): DmsParts {
  const negative = value < 0;
  const cardinal: CardinalKey =
    axis === "lat" ? (negative ? "south" : "north") : negative ? "west" : "east";

  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  let minutes = Math.floor((absolute - degrees) * 60);
  const factor = 10 ** secondsDecimals;
  let seconds = Math.round(((absolute - degrees) * 60 - minutes) * 60 * factor) / factor;

  if (seconds >= 60) {
    seconds -= 60;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes -= 60;
    degrees += 1;
  }

  return { degrees, minutes, seconds, cardinal };
}

/**
 * DMS parts back to signed decimal degrees — the inverse that PROVES {@link toDmsParts}.
 *
 * It has no production consumer today and that is deliberate rather than an oversight
 * (→ PR #71 review CODE71-M5): the tool's two directions are a click becoming a coordinate
 * (`unprojectMapPoint` + `toDmsParts`) and typed text becoming a point (`parseLatLon`),
 * neither of which needs parts-to-degrees. What it buys is a round-trip assertion that can
 * fail — without it, `toDmsParts` could only be checked against a restatement of its own
 * arithmetic, which is the tautology `spherical-area.ts` warns about. Kept exported for that
 * reason, named here so the next reader does not delete it as dead code.
 */
export function dmsToDegrees(parts: DmsParts): number {
  const magnitude = parts.degrees + parts.minutes / 60 + parts.seconds / 3600;
  return parts.cardinal === "south" || parts.cardinal === "west" ? -magnitude : magnitude;
}

// ---------------------------------------------------------------------------------------
// Parsing typed input
// ---------------------------------------------------------------------------------------

/** Why a typed coordinate could not be read. Each maps to one message key (§22: problem + fix). */
export type ParseFailureReason =
  "empty" | "unreadable" | "latitudeOutOfRange" | "longitudeOutOfRange";

export type ParseLatLonResult =
  | { readonly ok: true; readonly point: GeoPoint }
  | { readonly ok: false; readonly reason: ParseFailureReason };

/** Decimal degrees, with either separator: `39.92` or `39,92`, optionally signed. */
const DECIMAL_PATTERN = /^([+-]?)(\d+(?:[.,]\d+)?)$/;
/** DMS with optional minutes and seconds: `39°`, `39°55'`, `39°55'12"`, `39°55'12.5"`. */
const DMS_PATTERN =
  /^([+-]?)(\d+(?:[.,]\d+)?)\s*°\s*(?:(\d+(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*["″]\s*)?$/;

function toNumber(text: string | undefined): number {
  if (text === undefined || text === "") return 0;
  return Number(text.replace(",", "."));
}

/**
 * Reads one half of a typed coordinate: a magnitude, and a sign carried either by a leading
 * `-` or by a trailing cardinal letter. Returns `null` when the text is not a coordinate.
 */
function parseComponent(
  rawText: string,
  letters: CardinalLetters,
): { magnitude: number; cardinal: CardinalKey | null } | null {
  let text = rawText.trim();
  if (text === "") return null;

  let cardinal: CardinalKey | null = null;
  const tail = text.slice(-1).toUpperCase();
  for (const key of ["north", "south", "east", "west"] as const) {
    if (letters[key].toUpperCase() === tail) {
      cardinal = key;
      text = text.slice(0, -1).trim();
      break;
    }
  }

  const dms = DMS_PATTERN.exec(text);
  const decimal = dms ? null : DECIMAL_PATTERN.exec(text);
  if (!dms && !decimal) return null;

  let sign = 1;
  let magnitude: number;
  if (dms) {
    sign = dms[1] === "-" ? -1 : 1;
    const degrees = toNumber(dms[2]);
    const minutes = toNumber(dms[3]);
    const seconds = toNumber(dms[4]);
    // MALFORMED DMS IS REJECTED, NOT NORMALISED (→ PR #71 review CODE71-M2). `39°75'00"K`
    // used to come back as a confident 40.25 and `39.5°30'` as 40.0 — a wrong coordinate
    // presented as a right one, which is worse than the `unreadable` path §6.2 designs for.
    // A sub-degree component at or past 60 is not a coordinate, and a FRACTIONAL degree
    // combined with minutes or seconds states the same quantity twice.
    if (minutes >= 60 || seconds >= 60) return null;
    if (!Number.isInteger(degrees) && (dms[3] !== undefined || dms[4] !== undefined)) return null;
    if (!Number.isInteger(minutes) && dms[4] !== undefined) return null;
    magnitude = degrees + minutes / 60 + seconds / 3600;
  } else if (decimal) {
    sign = decimal[1] === "-" ? -1 : 1;
    magnitude = toNumber(decimal[2]);
  } else {
    return null;
  }
  if (!Number.isFinite(magnitude)) return null;

  // A leading minus AND a cardinal is contradictory input ("-39K"); the explicit letter wins
  // and the sign is folded into it, because a reader who typed a direction meant it.
  if (cardinal === null && sign < 0) return { magnitude: -magnitude, cardinal: null };
  return { magnitude, cardinal };
}

/**
 * Splits typed input into its two halves.
 *
 * THE HARD CASE IS THE COMMA, because Turkish writes decimals with it while SPEC §6.2 also
 * accepts it as the separator BETWEEN the two numbers. `39,92 32,85` and `39.92,32.85` are
 * both valid and mean the same pair, so the same character has two jobs.
 *
 * The rule that separates them without guessing: **a decimal comma always has a digit on
 * both sides.** So a comma with whitespace beside it cannot be one, and is normalised away
 * first; after that, whitespace decides. When the input has whitespace it is the separator
 * and every surviving comma is decimal; only in its absence does a comma split the pair.
 *
 * DELIBERATE LIMIT: each half must be one whitespace-free token, which is exactly the form
 * SPEC §6.2 specifies (`39°55'12"K`, not `39° 55' 12" K`). Spaced-out DMS returns
 * `unreadable` rather than being guessed at — the failure path shows the accepted forms, and
 * a parser that guesses at a coordinate is worse than one that asks.
 */
function splitHalves(input: string): [string, string] | null {
  // A comma touching whitespace is a pair separator, never a decimal point.
  const text = input
    .trim()
    .replace(/\s*,\s+|\s+,\s*/g, " ")
    .trim();
  const parts = /\s/.test(text) ? text.split(/\s+/) : text.split(",");
  if (parts.length !== 2) return null;
  const [first, second] = parts;
  if (first === undefined || second === undefined) return null;
  if (first.trim() === "" || second.trim() === "") return null;
  return [first, second];
}

/**
 * Reads a typed coordinate pair (SPEC §6.2), in decimal degrees or DMS.
 *
 * THIS IS THE PRIMARY INPUT PATH, not a convenience. Every tool has to be usable end to end
 * from the keyboard (SPEC §10.1, WCAG 2.1.1); clicking the map is the enhancement. So a
 * parser that only accepted the format the tool itself prints would fail the accessibility
 * floor rather than merely being inconvenient.
 *
 * Order is latitude then longitude when no cardinals are given, which is the order every
 * source the curriculum uses prints them in. When cardinals ARE given they decide, so a
 * reader who types longitude first still gets the point they meant.
 *
 * An out-of-frame but VALID coordinate is accepted: Türkiye's frame is not the world, and
 * §6.2 answers a point outside it with a neutral note rather than an error.
 */
export function parseLatLon(input: string, letters: CardinalLetters): ParseLatLonResult {
  if (input.trim() === "") return { ok: false, reason: "empty" };

  const halves = splitHalves(input);
  if (!halves) return { ok: false, reason: "unreadable" };

  const first = parseComponent(halves[0], letters);
  const second = parseComponent(halves[1], letters);
  if (!first || !second) return { ok: false, reason: "unreadable" };

  // EITHER half's cardinal settles the order (→ PR #71 review CODE71-M1). Consulting only the
  // first meant `"32.85 39.92K"` was rejected as unreadable although it is unambiguous: the
  // second half says north, so the first can only be longitude. The docblock above promised
  // that a reader who types longitude first still gets the point they meant, and with one
  // letter present that promise now holds whichever half carries it.
  const isLongitude = (cardinal: CardinalKey | null) => cardinal === "east" || cardinal === "west";
  const isLatitude = (cardinal: CardinalKey | null) => cardinal === "north" || cardinal === "south";
  const firstIsLongitude = isLongitude(first.cardinal) || isLatitude(second.cardinal);
  const latSide = firstIsLongitude ? second : first;
  const lonSide = firstIsLongitude ? first : second;

  // A pair naming the same axis twice ("39K 32K") is not a coordinate.
  const latIsLatitude = latSide.cardinal === null || isLatitude(latSide.cardinal);
  const lonIsLongitude = lonSide.cardinal === null || isLongitude(lonSide.cardinal);
  if (!latIsLatitude || !lonIsLongitude) return { ok: false, reason: "unreadable" };

  const lat = latSide.cardinal === "south" ? -latSide.magnitude : latSide.magnitude;
  const lon = lonSide.cardinal === "west" ? -lonSide.magnitude : lonSide.magnitude;

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
    return { ok: false, reason: "latitudeOutOfRange" };
  }
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) {
    return { ok: false, reason: "longitudeOutOfRange" };
  }
  return { ok: true, point: { lon, lat } };
}
