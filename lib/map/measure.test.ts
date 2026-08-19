import { describe, expect, it } from "vitest";
import {
  type CardinalLetters,
  type GeoPoint,
  dmsToDegrees,
  haversineKm,
  kmDecimalsFor,
  kmPerMapUnitAt,
  parseLatLon,
  polylineLengthKm,
  ringAreaKm2,
  ringPerimeterKm,
  ringSelfIntersects,
  scaleBarKm,
  toDmsParts,
  unprojectMapPoint,
} from "./measure";
import { projectToMapPoint } from "./projection";
import { ringAreaKm2 as ringAreaFromTuples } from "./spherical-area";
import { MAP_PROJECTION } from "./tr-provinces.generated";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Not one assertion here is a fact about the world:
 * no province's coordinates, no real distance between two cities. `expect(distance(ankara,
 * izmir)).toBe(330)` is the shape this file deliberately does not contain (CBS-P2 SPEC §14) —
 * that is a claim about geography, it belongs to the api and the provenance ledger, and a
 * test is the wrong place to assert it.
 *
 * What IS pinned is the module's own contract: the projection inverse round-trips, distance
 * is symmetric and obeys the triangle inequality, area ignores winding, the scale bar reacts
 * to latitude, and typed coordinates parse in both the notations the curriculum uses.
 */

/** Turkish direction letters, as `messages/tr.json` will carry them. */
const TR: CardinalLetters = { north: "K", south: "G", east: "D", west: "B" };
/** English direction letters, as `messages/en.json` will carry them. */
const EN: CardinalLetters = { north: "N", south: "S", east: "E", west: "W" };

/** The projection's own reference latitude, recovered from the emitted constant. */
const REFERENCE_LATITUDE = (Math.acos(MAP_PROJECTION.cosLat) * 180) / Math.PI;

describe("unprojectMapPoint", () => {
  it("round-trips with projectToMapPoint", () => {
    // Synthetic coordinates expressed relative to the emitted frame, so this stays true
    // after a legitimate snapshot refresh re-frames the map.
    const samples: GeoPoint[] = [
      { lon: MAP_PROJECTION.minLon + 1, lat: MAP_PROJECTION.maxLat - 1 },
      { lon: MAP_PROJECTION.minLon + 12, lat: MAP_PROJECTION.maxLat - 4 },
      { lon: MAP_PROJECTION.minLon + 18.5, lat: MAP_PROJECTION.maxLat - 6.2 },
    ];
    for (const sample of samples) {
      const back = unprojectMapPoint(projectToMapPoint(sample.lon, sample.lat));
      expect(back.lon).toBeCloseTo(sample.lon, 10);
      expect(back.lat).toBeCloseTo(sample.lat, 10);
    }
  });

  it("maps the padding inset back to the projection's north-west reference corner", () => {
    const corner = unprojectMapPoint({ x: MAP_PROJECTION.padding, y: MAP_PROJECTION.padding });
    expect(corner.lon).toBeCloseTo(MAP_PROJECTION.minLon, 10);
    expect(corner.lat).toBeCloseTo(MAP_PROJECTION.maxLat, 10);
  });

  it("does NOT clamp to the map frame", () => {
    // A point the reader places outside the drawn landmass is a real coordinate, and the
    // coordinate tool says so in words rather than moving it (SPEC §6.2).
    const outside = unprojectMapPoint({ x: -500, y: -500 });
    expect(outside.lon).toBeLessThan(MAP_PROJECTION.minLon);
    expect(outside.lat).toBeGreaterThan(MAP_PROJECTION.maxLat);
  });
});

describe("kmPerMapUnitAt", () => {
  it("shrinks as latitude rises", () => {
    expect(kmPerMapUnitAt(42)).toBeLessThan(kmPerMapUnitAt(36));
  });

  it("reproduces the scale deviation SPEC §6.4 measured at the frame's edges", () => {
    // THE REASON THE SCALE BAR TAKES A LATITUDE. The map carries one fixed cos(reference)
    // correction, so a bar computed from that constant is wrong by this much at the edges —
    // a ~9 % band, in an instrument whose whole job is to be trusted.
    const reference = kmPerMapUnitAt(REFERENCE_LATITUDE);
    expect(kmPerMapUnitAt(35.8) / reference - 1).toBeCloseTo(0.043, 3);
    expect(kmPerMapUnitAt(42.2) / reference - 1).toBeCloseTo(-0.047, 3);
  });

  it("agrees with haversine about how long a degree is — one Earth, not two", () => {
    // At the reference latitude one svg unit is (km per degree / scale), so scaling it back
    // up must land on the length of one degree of latitude. If the area module's radius and
    // this module's radius ever diverge, this is what fails.
    const degreeFromProjection = kmPerMapUnitAt(REFERENCE_LATITUDE) * MAP_PROJECTION.scale;
    const degreeFromHaversine = haversineKm({ lon: 0, lat: 0 }, { lon: 0, lat: 1 });
    expect(degreeFromProjection).toBeCloseTo(degreeFromHaversine, 9);
  });
});

describe("haversineKm", () => {
  const a: GeoPoint = { lon: 32, lat: 39 };
  const b: GeoPoint = { lon: 35, lat: 41 };
  const c: GeoPoint = { lon: 28, lat: 37 };

  it("is symmetric", () => {
    expect(haversineKm(a, b)).toBe(haversineKm(b, a));
  });

  it("is zero for a point against itself", () => {
    // Two clicks on the same spot are a legal gesture and must read 0 km, not an error
    // (SPEC §6.1).
    expect(haversineKm(a, a)).toBe(0);
  });

  it("obeys the triangle inequality", () => {
    expect(haversineKm(a, c)).toBeLessThanOrEqual(haversineKm(a, b) + haversineKm(b, c));
  });

  it("grows with separation", () => {
    expect(haversineKm(a, { lon: 32, lat: 41 })).toBeGreaterThan(
      haversineKm(a, { lon: 32, lat: 40 }),
    );
  });
});

describe("polylineLengthKm", () => {
  const p1: GeoPoint = { lon: 30, lat: 38 };
  const p2: GeoPoint = { lon: 32, lat: 39 };
  const p3: GeoPoint = { lon: 35, lat: 40 };

  it("equals the single leg for a two-point line", () => {
    expect(polylineLengthKm([p1, p2])).toBe(haversineKm(p1, p2));
  });

  it("is zero for an empty or single-point line", () => {
    // Asked on every click while the reader is still placing the second point.
    expect(polylineLengthKm([])).toBe(0);
    expect(polylineLengthKm([p1])).toBe(0);
  });

  it("sums consecutive legs", () => {
    expect(polylineLengthKm([p1, p2, p3])).toBeCloseTo(
      haversineKm(p1, p2) + haversineKm(p2, p3),
      10,
    );
  });

  it("never shrinks when a point is appended", () => {
    expect(polylineLengthKm([p1, p2, p3])).toBeGreaterThanOrEqual(polylineLengthKm([p1, p2]));
  });
});

describe("ringPerimeterKm", () => {
  const ring: GeoPoint[] = [
    { lon: 30, lat: 38 },
    { lon: 31, lat: 38 },
    { lon: 31, lat: 39 },
  ];

  it("adds the closing leg to the open length", () => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (!first || !last) return;
    expect(ringPerimeterKm(ring)).toBeCloseTo(
      polylineLengthKm(ring) + haversineKm(last, first),
      10,
    );
  });

  it("is zero below three points, matching ringAreaKm2", () => {
    // The two numbers sit side by side in the result panel and must not disagree about
    // whether a shape exists yet (SPEC §6.3).
    const two = ring.slice(0, 2);
    expect(ringPerimeterKm(two)).toBe(0);
    expect(ringAreaKm2(two)).toBe(0);
  });
});

describe("ringAreaKm2 — the adapter over the shared formula", () => {
  const ring: GeoPoint[] = [
    { lon: 32, lat: 39 },
    { lon: 33, lat: 39 },
    { lon: 33, lat: 40 },
    { lon: 32, lat: 40 },
  ];

  it("delegates to the tuple implementation rather than reimplementing it", () => {
    expect(ringAreaKm2(ring)).toBe(
      ringAreaFromTuples([
        [32, 39],
        [33, 39],
        [33, 40],
        [32, 40],
      ]),
    );
  });

  it("reads the named fields, so a transposed ring is a different shape", () => {
    // The guard on the one conversion in this module: if the adapter emitted [lat, lon] the
    // two results would be identical for a square and wrong everywhere else.
    const transposed: GeoPoint[] = ring.map((point) => ({ lon: point.lat, lat: point.lon }));
    expect(ringAreaKm2(transposed)).not.toBe(ringAreaKm2(ring));
  });

  it("ignores winding direction", () => {
    expect(ringAreaKm2([...ring].reverse())).toBe(ringAreaKm2(ring));
  });
});

describe("ringSelfIntersects", () => {
  it("is false for a simple quadrilateral", () => {
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 32, lat: 38 },
        { lon: 32, lat: 40 },
        { lon: 30, lat: 40 },
      ]),
    ).toBe(false);
  });

  it("is true for a bow-tie", () => {
    // The case the area tool must refuse to put a number on: the lobes cancel by winding, so
    // the formula happily returns something close to the DIFFERENCE of the two halves.
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 32, lat: 40 },
        { lon: 32, lat: 38 },
        { lon: 30, lat: 40 },
      ]),
    ).toBe(true);
  });

  it("is false for a triangle, whose edges all share vertices", () => {
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 32, lat: 38 },
        { lon: 31, lat: 40 },
      ]),
    ).toBe(false);
  });

  it("is false below four points", () => {
    expect(ringSelfIntersects([])).toBe(false);
    expect(ringSelfIntersects([{ lon: 30, lat: 38 }])).toBe(false);
  });

  it("does not fire on three collinear vertices along one side", () => {
    // A legitimate shape: the reader clicked twice along a straight edge. Treating a
    // collinear touch between ADJACENT edges as a crossing would reject it.
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 31, lat: 38 },
        { lon: 32, lat: 38 },
        { lon: 32, lat: 40 },
        { lon: 30, lat: 40 },
      ]),
    ).toBe(false);
  });
});

describe("scaleBarKm", () => {
  it("snaps to the 1-2-5 family", () => {
    for (const width of [200, 400, 800, 1000]) {
      for (const view of [1000, 500, 120, 40, 8]) {
        const bar = scaleBarKm(view, width, 39);
        expect(bar).not.toBeNull();
        if (!bar) continue;
        const mantissa = bar.km / 10 ** Math.floor(Math.log10(bar.km));
        expect([1, 2, 5]).toContain(Math.round(mantissa));
      }
    }
  });

  it("keeps its pixel width proportional to the distance it claims", () => {
    const view = 500;
    const widthPx = 800;
    const bar = scaleBarKm(view, widthPx, 39);
    expect(bar).not.toBeNull();
    if (!bar) return;
    const totalKm = view * kmPerMapUnitAt(39);
    expect(bar.px).toBeCloseTo((bar.km / totalKm) * widthPx, 8);
  });

  it("stays inside the fraction of the view it is allowed", () => {
    const bar = scaleBarKm(500, 800, 39, 0.25);
    expect(bar).not.toBeNull();
    if (!bar) return;
    expect(bar.px).toBeLessThanOrEqual(800 * 0.25);
  });

  it("responds to the centre latitude — the SPEC §6.4 contract", () => {
    // Same view, two latitudes: the bar cannot be identical, or it is being computed from
    // the fixed projection constant instead of from where the reader is looking.
    const south = scaleBarKm(500, 800, 35.8);
    const north = scaleBarKm(500, 800, 42.2);
    expect(south).not.toBeNull();
    expect(north).not.toBeNull();
    if (!south || !north) return;
    expect(south.px === north.px && south.km === north.km).toBe(false);
  });

  it("returns null rather than a bar of NaN for unusable input", () => {
    expect(scaleBarKm(0, 800, 39)).toBeNull();
    expect(scaleBarKm(500, 0, 39)).toBeNull();
    expect(scaleBarKm(Number.NaN, 800, 39)).toBeNull();
    expect(scaleBarKm(500, 800, 91)).toBeNull();
  });
});

describe("kmDecimalsFor", () => {
  it("refuses a decimal the click cannot support", () => {
    // 1× on a phone: one pixel is kilometres wide, so a tenth of a kilometre is invented
    // precision even though the distance is short (SPEC §6.6).
    expect(kmDecimalsFor(4.7, 3)).toBe(0);
  });

  it("allows one decimal when the pixel is fine AND the distance is short", () => {
    expect(kmDecimalsFor(0.13, 3)).toBe(1);
  });

  it("drops the decimal once the distance is large enough not to need it", () => {
    expect(kmDecimalsFor(0.13, 340)).toBe(0);
  });

  it("is defensive about non-finite input", () => {
    expect(kmDecimalsFor(Number.NaN, 3)).toBe(0);
    expect(kmDecimalsFor(0.13, Number.NaN)).toBe(0);
  });
});

describe("toDmsParts / dmsToDegrees", () => {
  it("round-trips at fine seconds precision", () => {
    for (const value of [39.9208, -12.5, 0.25, 179.999]) {
      const axis = Math.abs(value) > 90 ? "lon" : "lat";
      expect(dmsToDegrees(toDmsParts(value, axis, 6))).toBeCloseTo(value, 8);
    }
  });

  it("carries a 60-second rounding overflow instead of printing 60", () => {
    // The classic DMS bug. Rounding here rather than at display time is the only place the
    // carry can be done correctly.
    const parts = toDmsParts(39.999999, "lat");
    expect(parts.seconds).toBeLessThan(60);
    expect(parts.minutes).toBeLessThan(60);
    expect(parts.degrees).toBe(40);
    expect(parts.minutes).toBe(0);
    expect(parts.seconds).toBe(0);
  });

  it("names the cardinal by axis and sign, never as a letter", () => {
    expect(toDmsParts(39, "lat").cardinal).toBe("north");
    expect(toDmsParts(-39, "lat").cardinal).toBe("south");
    expect(toDmsParts(32, "lon").cardinal).toBe("east");
    expect(toDmsParts(-32, "lon").cardinal).toBe("west");
  });

  it("keeps degrees non-negative, with the sign carried by the cardinal", () => {
    const parts = toDmsParts(-12.5, "lat");
    expect(parts.degrees).toBeGreaterThanOrEqual(0);
    expect(dmsToDegrees(parts)).toBeCloseTo(-12.5, 10);
  });
});

describe("parseLatLon", () => {
  it("reads decimal degrees separated by a comma and a space", () => {
    const result = parseLatLon("39.92, 32.85", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 10);
    expect(result.point.lon).toBeCloseTo(32.85, 10);
  });

  it("reads decimal degrees separated by a comma alone", () => {
    const result = parseLatLon("39.92,32.85", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 10);
  });

  it("reads Turkish decimal commas when whitespace is the separator", () => {
    // The ambiguity this parser exists to resolve: the same character is the decimal point
    // here and the pair separator above.
    const result = parseLatLon("39,92 32,85", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 10);
    expect(result.point.lon).toBeCloseTo(32.85, 10);
  });

  it("reads DMS with Turkish direction letters", () => {
    const result = parseLatLon(`39°55'12"K 32°51'00"D`, TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 4);
    expect(result.point.lon).toBeCloseTo(32.85, 4);
  });

  it("reads DMS with English direction letters", () => {
    const result = parseLatLon(`39°55'12"N 32°51'00"E`, EN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 4);
  });

  it("lets explicit cardinals decide the order", () => {
    // Longitude typed first still means what the reader meant.
    const result = parseLatLon("32.85D 39.92K", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 10);
    expect(result.point.lon).toBeCloseTo(32.85, 10);
  });

  it("reads southern and western coordinates from their letters", () => {
    const result = parseLatLon("12.5G 40.25B", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(-12.5, 10);
    expect(result.point.lon).toBeCloseTo(-40.25, 10);
  });

  it("reads a signed pair with no letters at all", () => {
    const result = parseLatLon("-39.92,-32.85", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(-39.92, 10);
    expect(result.point.lon).toBeCloseTo(-32.85, 10);
  });

  it("accepts a valid coordinate outside the map's frame", () => {
    // Türkiye's frame is not the world. §6.2 answers this with a neutral note on the page,
    // not with a parse error.
    const result = parseLatLon("-33.9, 151.2", TR);
    expect(result.ok).toBe(true);
  });

  it("names each failure so the message can say problem and fix", () => {
    expect(parseLatLon("   ", TR)).toStrictEqual({ ok: false, reason: "empty" });
    expect(parseLatLon("kuzeye doğru", TR)).toStrictEqual({ ok: false, reason: "unreadable" });
    expect(parseLatLon("91, 32", TR)).toStrictEqual({ ok: false, reason: "latitudeOutOfRange" });
    expect(parseLatLon("39, 181", TR)).toStrictEqual({ ok: false, reason: "longitudeOutOfRange" });
  });

  it("rejects a pair that names the same axis twice", () => {
    expect(parseLatLon("39K 32K", TR)).toStrictEqual({ ok: false, reason: "unreadable" });
  });

  it("rejects spaced-out DMS rather than guessing at it", () => {
    // A documented limit, not an oversight: SPEC §6.2's accepted form has no internal
    // spaces, and a parser that guesses at a coordinate is worse than one that asks.
    expect(parseLatLon(`39° 55' 12" K 32° 51' 00" D`, TR)).toStrictEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});
