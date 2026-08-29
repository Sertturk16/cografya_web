/**
 * Magnitude → sequential colour-ramp bucket (§5.6, `deprem-sayfalari` plan).
 *
 * DELIBERATELY NOT `DESIGN.md` §6.2's "Earthquake intensity" public-safety scale. This leg
 * publishes MAGNITUDE — a single, place-independent number per event — never intensity, which
 * this contract carries no field for at all (`EarthquakeEventDto` has no `intensity`/`şiddet`
 * field). `GLOSSARY.md` §4 states in bold that the two "asla birbirinin yerine kullanılamaz"
 * and that conflating them misinforms the reader factually, so this module reaches for a NEW,
 * Terra-independent sequential ramp (`--eq-mag-1`…`--eq-mag-5`, `app/globals.css`) rather than
 * the named MMI/ShakeMap palette — `DESIGN.md` §6.1 rule 4's sequential case, single-hue,
 * monotonic lightness, colourblind-safe by construction (verified against a Viénot-Brettel-
 * Mollon-style simulation before ship — see the token block's own docblock for the numbers).
 *
 * Buckets are the round, commonly-used magnitude breakpoints the plan names (§5.6): under 3,
 * 3–3.9, 4–4.9, 5–5.9, 6 and up. Pure and side-effect-free so it is usable identically from a
 * server component (the default SSR view) and the client filter island (§5.5) — neither
 * imports `server-only`.
 */

export type MagnitudeBucket = 1 | 2 | 3 | 4 | 5;

/** Ordered low→high, so the boundary is expressed once and read the same way everywhere. */
const BUCKET_THRESHOLDS: readonly [threshold: number, bucket: MagnitudeBucket][] = [
  [3, 1],
  [4, 2],
  [5, 3],
  [6, 4],
];

/**
 * Which of the five sequential buckets a magnitude falls into.
 *
 * The contract's own floor/ceiling (`EARTHQUAKE_MIN_MAGNITUDE_FLOOR` −1, `…_CEILING` 10,
 * `cografya_api/src/earthquake/dto/earthquake-list-query.dto.ts`) both land inside bucket 1
 * and bucket 5 respectively without a special case: a −1 magnitude is still "under 3", and a
 * 10 magnitude is still "6 and up".
 */
export function magnitudeBucket(magnitude: number): MagnitudeBucket {
  for (const [threshold, bucket] of BUCKET_THRESHOLDS) {
    if (magnitude < threshold) return bucket;
  }
  return 5;
}

/** The `app/globals.css` custom-property name for one bucket, e.g. `"--eq-mag-3"`. */
export function magnitudeBucketToken(bucket: MagnitudeBucket): string {
  return `--eq-mag-${bucket}`;
}

/**
 * Marker radius per bucket, in the map's svg units — larger magnitude draws a physically
 * bigger circle, so the encoding survives with colour removed entirely (`DESIGN.md` §6.1
 * rule 3, "never rely on hue alone"; the same shape-reinforces-colour discipline the climate
 * chart already applies, §6.4). Monotonic, and deliberately modest at the low end: bucket 1 is
 * the most numerous marker on the map by a wide margin (magnitude-2-and-under events dominate
 * the store), so it must stay legible rather than crowding out its neighbours.
 */
export const MAGNITUDE_MARKER_RADIUS: Record<MagnitudeBucket, number> = {
  1: 3.5,
  2: 5,
  3: 6.5,
  4: 8,
  5: 9.5,
};
