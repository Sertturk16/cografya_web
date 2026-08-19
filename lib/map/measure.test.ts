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
  ringCrossesAntimeridian,
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
 * to latitude, and typed coordinates parse in both notations the tool offers. (Not "the notations the
 * curriculum uses" — that phrasing was measured false, → AK-26: the curriculum prints whole
 * degrees plus a direction letter and never seconds.)
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
    // Precision 2, not 3 (→ PR #71 review TEST71-M3). The quantity is a pure function of the
    // GENERATED `MAP_PROJECTION.cosLat`, and at precision 3 the southern figure had already
    // consumed 59 % of its tolerance: a legitimate ODbL snapshot refresh moving the reference
    // latitude by ~0.02° would turn this red on a file nobody edited. SPEC §6.4's published
    // figures stay as the assertion; only the band widens.
    expect(kmPerMapUnitAt(35.8) / reference - 1).toBeCloseTo(0.043, 2);
    expect(kmPerMapUnitAt(42.2) / reference - 1).toBeCloseTo(-0.047, 2);
    // The SIGNS and the ordering carry the contract and stay exact.
    expect(kmPerMapUnitAt(35.8)).toBeGreaterThan(reference);
    expect(kmPerMapUnitAt(42.2)).toBeLessThan(reference);
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

  it("exceeds the open path it closes, and no side reaches half of it", () => {
    // AN INDEPENDENT PROPERTY, not a restatement of the body (→ PR #71 review TEST71-M2). The
    // previous assertion compared the result against `polylineLengthKm(ring) +
    // haversineKm(last, first)` — measure.ts's own expression verbatim — so both sides moved
    // together under any rewrite and it could only ever prove internal consistency.
    const perimeter = ringPerimeterKm(ring);
    // A PINNED VALUE ALONGSIDE THE PROPERTY (→ PR #71 round-2 review CODE71R2-M1). The
    // properties alone survive three mutations the tautology they replaced caught — a wrong
    // closing pair, and a doubled closing leg, both still satisfy them. Captured, not derived.
    expect(perimeter).toBeCloseTo(340.01450922591584, 9);
    expect(perimeter).toBeGreaterThan(polylineLengthKm(ring));
    for (let i = 0; i < ring.length; i++) {
      const from = ring[i];
      const to = ring[(i + 1) % ring.length];
      if (!from || !to) continue;
      // Triangle inequality on a closed ring: no single side can reach half the perimeter,
      // or the shape could not close.
      expect(haversineKm(from, to)).toBeLessThan(perimeter / 2);
    }
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

describe("ringAreaKm2 — the antimeridian guard", () => {
  const seamRing: GeoPoint[] = [
    { lon: 179.5, lat: 39 },
    { lon: -179.5, lat: 39 },
    { lon: -179.5, lat: 40 },
    { lon: 179.5, lat: 40 },
  ];

  it("refuses a ring that crosses the seam instead of returning 359x the truth", () => {
    // ROUND 1 SHIPPED A SENTENCE INSTEAD OF A GUARD (→ PR #71 round-2 review CODE71R2-I2). It
    // claimed Faz-1's tools "cannot reach the seam"; SPEC §6 makes typed coordinate entry the
    // primary path and §6.2 accepts a coordinate outside the Türkiye frame, so the input can
    // reach it even though the drawn map cannot. `null` is what carries the obligation to the
    // caller through the type system.
    expect(ringCrossesAntimeridian(seamRing)).toBe(true);
    expect(ringAreaKm2(seamRing)).toBeNull();
  });

  it("does not fire on a ring inside one longitude branch", () => {
    // The control: the guard must not refuse the rings the tool actually measures.
    const turkishRing: GeoPoint[] = [
      { lon: 32, lat: 39 },
      { lon: 33, lat: 39 },
      { lon: 33, lat: 40 },
      { lon: 32, lat: 40 },
    ];
    expect(ringCrossesAntimeridian(turkishRing)).toBe(false);
    expect(ringAreaKm2(turkishRing)).toBe(9540.512136366135);
  });

  it("does not fire on a wide ring that stays on one branch", () => {
    // A 170-degree span is legal; only a STEP wider than 180 is the seam.
    expect(
      ringCrossesAntimeridian([
        { lon: -85, lat: 10 },
        { lon: 85, lat: 10 },
        { lon: 85, lat: 20 },
        { lon: -85, lat: 20 },
      ]),
    ).toBe(false);
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

  it("is false for an explicitly CLOSED ring", () => {
    // The regression that made the exemption coordinate-based (→ PR #71 review CODE71-I1).
    // `ringAreaKm2`'s docblock invites closed rings and the generators pass them, so an
    // index-based adjacency rule made two functions in this module disagree about one input:
    // the area tool would have refused a legitimate polygon.
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 32, lat: 38 },
        { lon: 32, lat: 40 },
        { lon: 30, lat: 38 },
      ]),
    ).toBe(false);
  });

  it("is false for a ring with a duplicated vertex, wherever it sits", () => {
    // A repeated point is a click the reader made twice. Each position is listed because the
    // old index-based rule failed on all three and a single case would not have shown it.
    const a = { lon: 30, lat: 38 };
    const b = { lon: 32, lat: 38 };
    const c = { lon: 32, lat: 40 };
    expect(ringSelfIntersects([a, a, b, c])).toBe(false);
    expect(ringSelfIntersects([a, b, b, c])).toBe(false);
    expect(ringSelfIntersects([a, b, c, c])).toBe(false);
  });

  it("catches a crossing between edges that are far apart in the ring", () => {
    // THE MUTATION-KILLING CASE (→ PR #71 review CODE71-I1, reviewer-supplied). Under the old
    // two-condition index skip, collapsing both conditions to `j === n - 1` left every other
    // assertion in this file green; this ring flips, because the crossing is between edge 2
    // and the closing edge 4.
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 34, lat: 38 },
        { lon: 34, lat: 42 },
        { lon: 28, lat: 40 },
        { lon: 30, lat: 44 },
      ]),
    ).toBe(true);
  });

  it("flags a ring that returns through a point it already used", () => {
    // FLIPPED BACK, DELIBERATELY (→ PR #71 round-2 review CODE71R2-I1). Round 1 declared this
    // shape simple because "its area is legitimately near zero" — but nothing in a ring's
    // structure separates it from a figure-eight whose lobes are large, which is what the
    // reviewer's 350-of-351 sweep showed. A vertex revisited at a non-adjacent position means
    // the outline touches itself, and SPEC §6.3's answer to that is no number.
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 32, lat: 38 },
        { lon: 30, lat: 38 },
        { lon: 31, lat: 40 },
      ]),
    ).toBe(true);
  });

  it("flags a figure-eight pinched at one shared vertex", () => {
    // THE CASE THE ROUND-1 FIX BROKE. Reported simple, so the area tool served the
    // winding-cancelled difference of the two lobes: 1 109.59 km² for lobes totalling
    // 75 757.72 km², understated 68× with a correct-looking perimeter beside it.
    expect(
      ringSelfIntersects([
        { lon: 31, lat: 40 },
        { lon: 33, lat: 38 },
        { lon: 29, lat: 38 },
        { lon: 31, lat: 40 },
        { lon: 33, lat: 42 },
        { lon: 29, lat: 42 },
      ]),
    ).toBe(true);
  });

  it("flags the worst case the random ring sweep found", () => {
    // From the reviewer's 300 000-ring harness: of the 351 self-touching rings the round-1
    // rule called simple, 350 showed an area differing from their lobe sum by more than 1 %.
    // This is the extreme member (10 103.9 km² shown against 28 624.4 km² actual), kept as a
    // sample of that class rather than as a second copy of the shape above.
    expect(
      ringSelfIntersects([
        { lon: 33, lat: 41 },
        { lon: 37, lat: 39 },
        { lon: 29, lat: 42 },
        { lon: 33, lat: 41 },
        { lon: 37, lat: 42 },
        { lon: 35, lat: 42 },
      ]),
    ).toBe(true);
  });

  it("still flags a bow-tie written in explicitly closed form", () => {
    // Normalisation must drop the repeated closing vertex WITHOUT swallowing the crossing.
    expect(
      ringSelfIntersects([
        { lon: 30, lat: 38 },
        { lon: 32, lat: 40 },
        { lon: 32, lat: 38 },
        { lon: 30, lat: 40 },
        { lon: 30, lat: 38 },
      ]),
    ).toBe(true);
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

  it("scales its pixel width with the rendered width, at a constant km", () => {
    // A PROPERTY, not the body (→ PR #71 review TEST71-M2). The previous assertion recomputed
    // `(bar.km / totalKm) * widthPx`, which is measure.ts's own expression, so it passed under
    // any consistent rewrite. Doubling the rendered width must double the bar while the round
    // distance it claims is unchanged — the same view, drawn twice as wide.
    const narrow = scaleBarKm(500, 800, 39);
    const wide = scaleBarKm(500, 1600, 39);
    expect(narrow).not.toBeNull();
    expect(wide).not.toBeNull();
    if (!narrow || !wide) return;
    expect(wide.km).toBe(narrow.km);
    expect(wide.px).toBeCloseTo(narrow.px * 2, 8);
    // Linearity alone survives `px` being scaled by any constant; one captured value closes it.
    expect(narrow.px).toBeCloseTo(190.8648808850294, 9);
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

  it("returns null at exactly the poles", () => {
    // ±90 passed the old `Math.abs(latitude) > 90` guard and produced a bar labelled ~1e-17 km
    // (→ PR #71 review CODE71-M7). Unreachable from the Türkiye frame; the guard's own stated
    // intent is what it missed.
    expect(scaleBarKm(500, 800, 90)).toBeNull();
    expect(scaleBarKm(500, 800, -90)).toBeNull();
  });

  it("returns null just above the pole, where the label would be centimetres", () => {
    // The round-1 floor sat on the VIEW, so this still produced a bar labelled 0.0002 km
    // (→ PR #71 round-2 review CODE71R2-M2). The floor is on the label now.
    expect(scaleBarKm(500, 800, 89.9999)).toBeNull();
    expect(scaleBarKm(0.0006, 800, 39)).toBeNull();
  });

  it("returns null for a view too small to carry a bar", () => {
    // The docblock promised this branch before the code had it (→ PR #71 review TEST71-M5):
    // probed at 1e-300 the old version still returned `{ km: 2e-301 }`.
    expect(scaleBarKm(1e-300, 800, 39)).toBeNull();
  });

  it("rejects an unusable maxFraction", () => {
    expect(scaleBarKm(500, 800, 39, 0)).toBeNull();
    expect(scaleBarKm(500, 800, 39, Number.NaN)).toBeNull();
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

  it("pins both thresholds the contract names", () => {
    // SPEC §6.1's cut is "< 10 km" and §6.6's is "kmPerPixel < 1"; neither boundary was
    // exercised, so a `<` -> `<=` slip at either passed every assertion
    // (→ PR #71 review TEST71-M1). A 10 km leg rendering as "10,0 km" is the visible failure.
    expect(kmDecimalsFor(0.13, 10)).toBe(0);
    expect(kmDecimalsFor(0.13, 9.999)).toBe(1);
    expect(kmDecimalsFor(1, 3)).toBe(0);
    expect(kmDecimalsFor(0.999, 3)).toBe(1);
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

  it("lets a cardinal on EITHER half settle the order", () => {
    // Consulting only the first half rejected this as unreadable although it is unambiguous:
    // the second says north, so the first can only be longitude (→ PR #71 review CODE71-M1).
    const result = parseLatLon("32.85 39.92K", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 10);
    expect(result.point.lon).toBeCloseTo(32.85, 10);
  });

  it("lets a cardinal on the FIRST half settle the order too", () => {
    // CODE71-M1's fix changed behaviour in two directions and round 1 pinned only one
    // (→ PR #71 round-2 review R2TEST71-M8).
    const result = parseLatLon("39.92K 32.85", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 10);
    expect(result.point.lon).toBeCloseTo(32.85, 10);
  });

  it("lets the direction letter win over a leading minus, as documented", () => {
    // The documented precedence had no test, so a future edit reversing it would change a
    // coordinate tool's answer with CI green (→ PR #71 review TEST71-M4).
    const result = parseLatLon("-39.92K 32.85D", TR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.point.lat).toBeCloseTo(39.92, 10);
  });

  it("rejects a single token with no second half", () => {
    expect(parseLatLon("39.92", TR)).toStrictEqual({ ok: false, reason: "unreadable" });
  });

  it("rejects malformed DMS instead of normalising it into a confident wrong answer", () => {
    // `39°75'00"K` used to parse as 40.25 and `39.5°30'` as 40.0 — a wrong coordinate
    // presented as a right one, which is worse than the unreadable path §6.2 designs for
    // (→ PR #71 review CODE71-M2).
    expect(parseLatLon(`39°75'00"K 32°51'00"D`, TR)).toStrictEqual({
      ok: false,
      reason: "unreadable",
    });
    expect(parseLatLon(`39°30'75"K 32°51'00"D`, TR)).toStrictEqual({
      ok: false,
      reason: "unreadable",
    });
    expect(parseLatLon(`39.5°30' 32°51'00"D`, TR)).toStrictEqual({
      ok: false,
      reason: "unreadable",
    });
    // The third guard line, unpinned in round 1: a fractional MINUTE combined with seconds
    // states the same quantity twice (→ PR #71 round-2 review R2TEST71-M4).
    expect(parseLatLon(`39°30.5'12"K 32°51'00"D`, TR)).toStrictEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("still accepts a fractional FINAL component", () => {
    // The rejection above must not swallow legitimate precision: fractional seconds, and a
    // bare fractional degree with no sub-components, are both valid.
    expect(parseLatLon(`39°55'12.5"K 32°51'00"D`, TR).ok).toBe(true);
    expect(parseLatLon("39.92 32.85", TR).ok).toBe(true);
  });

  it("depends on every cardinal letter being exactly one character", () => {
    // The contract `CardinalLetters` cannot express (→ PR #71 review CODE71-M6). A bundle
    // carrying words instead of letters silently turns EVERY typed DMS coordinate into
    // `unreadable`, which is a total failure of the primary keyboard path — so the
    // requirement is pinned rather than left to the docblock.
    const words: CardinalLetters = {
      north: "Kuzey",
      south: "Guney",
      east: "Dogu",
      west: "Bati",
    };
    expect(parseLatLon(`39°55'12"K 32°51'00"D`, words).ok).toBe(false);
    for (const letter of Object.values(TR)) expect(letter).toHaveLength(1);
    for (const letter of Object.values(EN)) expect(letter).toHaveLength(1);
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
