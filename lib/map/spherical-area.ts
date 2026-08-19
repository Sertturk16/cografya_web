/**
 * Spherical area of a lon/lat ring — the ONE implementation, shared by the browser and by
 * the build-time generators.
 *
 * ## Why this file has no imports, and must never gain one
 *
 * Three build scripts consume it (`scripts/fetch-tr-inland-water.mjs`,
 * `scripts/generate-tr-inland-water.mjs`, `scripts/fetch-tr-jrc-water.mjs`, all through
 * `scripts/lib/water-geometry.mjs`). Those run under plain `node`, with no bundler and no
 * `tsconfig` path mapping, so they reach this module by relative path and rely on Node 24's
 * native type stripping to load it. That works for **erasable** TypeScript only, and a `@/…`
 * alias import would not resolve at all. Keeping the module a leaf — zero imports, no
 * `enum`, no `namespace`, no parameter properties — is what keeps the generators running.
 *
 * ## Why it is a MOVE rather than a copy (CBS-P2 SPEC §5.2)
 *
 * The formula was already in production inside `water-geometry.mjs`, deciding which lakes
 * cross a drawing threshold. The measurement tools need the same answer for a shape the user
 * draws. Two implementations of one formula eventually disagree, and the disagreement would
 * surface as a lake mysteriously changing rung on one side and a wrong area on the other. So
 * the body moved HERE and `water-geometry.mjs` re-exports it under its original name; its
 * three consumers are untouched.
 *
 * ## What guards the move, and what does NOT (measured, → PR-A)
 *
 * CI's `Inland water artifact drift` step (`pnpm generate:water:check`) guards the WIRING:
 * break the specifier in `water-geometry.mjs` and it exits 1. It does **not** guard the
 * arithmetic. Changing `EARTH_RADIUS_M` below by 30 % left the regenerated artifact
 * byte-identical and the gate green, because the offline generator spends this function only
 * on a console diagnostic (`generate-tr-inland-water.mjs:499`); the threshold ladder it
 * really drives sits in the NETWORK fetch step, which CI never runs.
 *
 * **Therefore `spherical-area.test.ts` is the only guard on these numbers.** Its pinned
 * vectors were captured from the pre-move implementation, so they fail if this body ever
 * stops agreeing with the one the water artifacts were built from. Do not "simplify" them
 * into a recomputation of the formula under test — that is the one edit that would make the
 * file pass while proving nothing.
 *
 * ## SUPPORTED DOMAIN — the ring must not cross the antimeridian (→ PR #71 review CODE71-I2)
 *
 * The sum below runs over longitude DIFFERENCES, so a step from +179.5° to −179.5° reads as a
 * 359° sweep instead of a 1° one. Measured: a 1°×1° ring straddling ±180° returns
 * 3 425 043.86 km² against a true ~9 540 km², a factor of 359, **silently**. There is no
 * signal and no `NaN`; the number simply comes back wrong.
 *
 * This is not a regression — the body is byte-identical to the `.mjs` it moved from, and the
 * three generator consumers only ever feed it Türkiye rings. What changed is the AUDIENCE:
 * the same commit exported it to browser code whose typed-coordinate path accepts the whole
 * world. The drawn MAP cannot reach the seam; the TYPED input path can (SPEC §6 makes it the
 * primary path and §6.2 accepts out-of-frame coordinates), so the browser-facing adapter
 * `measure.ts` → `ringAreaKm2` GUARDS it and returns `null` rather than a number. This tuple
 * export is deliberately left unguarded: its three callers are build generators feeding
 * Türkiye rings, and a signature change here would ripple into scripts outside this module's
 * business (→ PR #71 round-2 review CODE71R2-I2).
 *
 * **`SPEC.md` §6.5(a) claimed the opposite and has been corrected in place**: the claim is
 * true for haversine (verified to 14 digits across the seam) and false for this formula.
 *
 * ## Why spherical rather than planar
 *
 * The planar shoelace formula is wrong by tens of percent at Türkiye's latitudes, because a
 * degree of longitude is not a degree of latitude. This is the standard spherical-excess
 * form (the one turf.js uses).
 */

/**
 * Mean Earth radius (IUGG), metres.
 *
 * Exported because `lib/map/measure.ts` needs the same figure for haversine distance, and a
 * measuring tool that computed area on one Earth and distance on another would be quietly
 * inconsistent. It lives HERE, in the leaf the generators load, so there is exactly one copy.
 */
export const EARTH_RADIUS_M = 6371008.8;

const DEG_TO_RAD = Math.PI / 180;

/** A `[longitude, latitude]` pair in decimal degrees — the GeoJSON coordinate order. */
export type LonLat = readonly [number, number];

/**
 * Unsigned spherical area of a lon/lat ring, in km².
 *
 * Winding-independent by construction (the result is passed through `Math.abs`), so a
 * clockwise ring and its counter-clockwise twin return the same number and the sign never
 * leaks to a caller. A ring of fewer than three points has no area and returns 0 rather than
 * throwing — the drawing tools ask for the area of an incomplete polygon on every click.
 *
 * The ring is treated as implicitly closed: the last vertex is a neighbour of the first, so
 * callers may pass either an open ring or an explicitly closed one. The generators pass
 * closed rings and the drawing tools pass open ones. A repeated final vertex contributes a
 * term that is zero in exact arithmetic, so the two forms agree to floating-point noise —
 * they are NOT guaranteed bit-identical, and `spherical-area.test.ts` compares them with a
 * tolerance rather than with `toBe` for that reason.
 *
 * The arithmetic below is deliberately byte-identical to the implementation this replaced,
 * including the multiplication order. Reassociating the products is mathematically neutral
 * and numerically is NOT: it would change the last bits of the result and turn the artifact
 * drift gate red on a file nobody edited.
 */
export function ringAreaKm2(ring: readonly LonLat[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const lower = ring[(i - 1 + n) % n];
    const middle = ring[i];
    const upper = ring[(i + 1) % n];
    if (!lower || !middle || !upper) continue;
    total += (upper[0] - lower[0]) * DEG_TO_RAD * Math.sin(middle[1] * DEG_TO_RAD);
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2) / 1e6;
}
