// @ts-check
/**
 * The PINNED Türkiye map frame — one coordinate space, shared by every generator that
 * draws into `MAP_VIEWBOX`.
 *
 * ## Why this module exists (the trap it closes)
 *
 * `generate-map-paths.mjs` used to DERIVE the projection from the province snapshot's own
 * bounding box: it scanned `data/tr-il-boundaries.geojson`, took its min/max lon/lat, and
 * emitted the resulting constants as `MAP_PROJECTION`. That is self-consistent as long as
 * there is exactly ONE generator. It stops being self-consistent the moment a SECOND
 * artifact has to land in the same space (the inland-water layer, and later rivers): each
 * generator would re-derive the frame from ITS OWN source, and a refreshed province
 * snapshot whose bbox moved by a hundred metres would silently shift the provinces
 * underneath a water layer that had not moved. Nothing would fail; the lakes would just
 * stop lining up with their shores.
 *
 * So the frame is PINNED here, as explicit constants, and every generator consumes it.
 * The values are the exact doubles the derived version produced on the committed
 * 2026-07-10 province snapshot — copied at full round-trip precision, so
 * `pnpm generate:map:check` reproduces `lib/map/tr-provinces.generated.ts` byte for byte.
 *
 * ## The safety net is INVERTED, not removed
 *
 * Pinning alone would trade a silent shift for a silent MISFIT: a new source could extend
 * past the frame and be clipped without a word. So `assertInsideFrame()` throws the moment
 * a projected point leaves the `[0, VIEW_WIDTH] × [0, VIEW_HEIGHT]` box, and
 * `assertFrameMatchesBounds()` throws when a source's own bbox no longer agrees with the
 * pinned numbers. A snapshot refresh that genuinely needs a new frame is therefore a loud,
 * deliberate act: re-derive, update the constants HERE, regenerate every artifact in the
 * same commit, and eyeball the samples.
 *
 * Ownership: created by the inland-water layer (P6, → DEC 2026-08-02k md. 1) because it
 * landed first; the province re-source work consumes it.
 */

/**
 * Frame constants, pinned. `minLon` / `maxLat` are the north-west anchor of the
 * equirectangular projection; `cosLat` is the x-correction at the reference latitude;
 * `scale` converts corrected degrees to svg units; `padding` is the inset that keeps
 * edge strokes off the viewBox border.
 *
 * DO NOT recompute these at runtime. Changing a digit here moves every map on the site.
 */
export const TR_FRAME = Object.freeze({
  minLon: 25.665136337280273,
  maxLat: 42.1054115295413,
  cosLat: 0.7775805256021876,
  scale: 66.28554617603106,
  padding: 6,
  viewWidth: 1000,
  viewHeight: 429,
});

/** The `viewBox` string every TR-frame artifact and surface shares. */
export const TR_VIEWBOX = `0 0 ${TR_FRAME.viewWidth} ${TR_FRAME.viewHeight}`;

/**
 * The WIDER static context frame (`turkiye-yenileme` PR-B, plan §5.2) — pinned, in the same
 * svg-unit coordinate space `projectToFrame()` already produces, so a context shape and a
 * province shape are co-registered STRUCTURALLY rather than by a second assertion. `TR_FRAME`
 * itself is NOT touched: this is a second, independent frame that a context-only generator
 * reads, never a replacement for the frame every existing consumer (nine `MAP_VIEWBOX`
 * readers, → plan §2) still uses unchanged.
 *
 * The four numbers are measured, not chosen by eye — plan §5.2's own table records what each
 * edge had to clear: all 81 provinces, the whole of Cyprus and Northern Cyprus, the whole of
 * Armenia (incl. the Nakhchivan exclave), and the Greek mainland's east coast. Phase 2 may
 * adjust them only if a rendered frame shows the balance is wrong, on two conditions: every
 * row of that table still holds, and the new numbers are recorded here with the measurement
 * that produced them (plan §5.2's own instruction).
 */
export const TR_CONTEXT_FRAME = Object.freeze({
  minX: -150,
  minY: -60,
  width: 1270,
  height: 580,
});

/** The `viewBox` string the context artifact and `TurkeyMapSection`'s widened `<svg>` share. */
export const TR_CONTEXT_VIEWBOX = `${TR_CONTEXT_FRAME.minX} ${TR_CONTEXT_FRAME.minY} ${TR_CONTEXT_FRAME.width} ${TR_CONTEXT_FRAME.height}`;

/**
 * Throw if a projected point falls outside the pinned CONTEXT frame — the same inverted
 * safety net `assertInsideFrame()` gives `TR_FRAME`, mirrored for the wider frame (plan
 * §5.3 step 5). Unlike `TR_FRAME`, whose box starts at the origin, `TR_CONTEXT_FRAME` has a
 * negative `minX`/`minY`, so the bound check reads off the frame's own fields rather than
 * against a `[0, viewWidth]` literal.
 *
 * @param {[number, number][]} points Projected points, in svg units.
 * @param {{ label: string, tolerance?: number }} options
 * @returns {{ maxOvershoot: number }} Largest distance any point sat outside the box.
 */
export function assertInsideContextFrame(points, { label, tolerance = 0 }) {
  const minX = TR_CONTEXT_FRAME.minX;
  const minY = TR_CONTEXT_FRAME.minY;
  const maxX = TR_CONTEXT_FRAME.minX + TR_CONTEXT_FRAME.width;
  const maxY = TR_CONTEXT_FRAME.minY + TR_CONTEXT_FRAME.height;
  let maxOvershoot = 0;
  for (const point of points) {
    const [x, y] = point;
    const overshoot = Math.max(0, minX - x, x - maxX, minY - y, y - maxY);
    if (overshoot > maxOvershoot) maxOvershoot = overshoot;
  }
  if (maxOvershoot > tolerance) {
    throw new Error(
      `${label}: geometry leaves the pinned TR CONTEXT frame by ${maxOvershoot.toFixed(2)} svg ` +
        `units (tolerance ${tolerance}). TR_CONTEXT_FRAME in scripts/lib/tr-frame.mjs is PINNED — ` +
        `either the frame needs widening (plan §5.2, record the measurement that forced it) or ` +
        `this shape should have been clipped before reaching this assertion.`,
    );
  }
  return { maxOvershoot };
}

/**
 * `[lon, lat]` → `[x, y]` in the pinned frame (north up).
 * @param {[number, number] | number[]} lonLat
 * @returns {[number, number]}
 */
export function projectToFrame(lonLat) {
  const lon = lonLat[0];
  const lat = lonLat[1];
  if (typeof lon !== "number" || typeof lat !== "number") {
    throw new Error(`projectToFrame: expected [lon, lat], got ${JSON.stringify(lonLat)}`);
  }
  const x = TR_FRAME.padding + (lon - TR_FRAME.minLon) * TR_FRAME.cosLat * TR_FRAME.scale;
  const y = TR_FRAME.padding + (TR_FRAME.maxLat - lat) * TR_FRAME.scale;
  return [x, y];
}

/**
 * Throw if a projected point falls outside the pinned viewBox.
 *
 * This is the inverted safety net described in the module header: with the frame pinned,
 * "the source grew" can no longer move the frame, so it has to be caught as "the source no
 * longer fits". `tolerance` exists because a layer may legitimately reach a fraction of a
 * unit past the province bbox (a coastal lagoon drawn at full resolution against a
 * simplified coastline); it is a slack, not a licence — callers pass their own and report
 * the measured overshoot.
 *
 * @param {[number, number][]} points Projected points, in svg units.
 * @param {{ label: string, tolerance?: number }} options
 * @returns {{ maxOvershoot: number }} Largest distance any point sat outside the box.
 */
export function assertInsideFrame(points, { label, tolerance = 0 }) {
  let maxOvershoot = 0;
  for (const point of points) {
    const [x, y] = point;
    const overshoot = Math.max(0, -x, x - TR_FRAME.viewWidth, -y, y - TR_FRAME.viewHeight);
    if (overshoot > maxOvershoot) maxOvershoot = overshoot;
  }
  if (maxOvershoot > tolerance) {
    throw new Error(
      `${label}: geometry leaves the pinned TR frame by ${maxOvershoot.toFixed(2)} svg units ` +
        `(tolerance ${tolerance}). The frame in scripts/lib/tr-frame.mjs is PINNED — either ` +
        `the source changed and every artifact must be re-framed together, or this layer is ` +
        `drawing something outside Türkiye.`,
    );
  }
  return { maxOvershoot };
}

/**
 * Throw if a source's own bounding box no longer produces the pinned constants.
 *
 * Only the province snapshot is entitled to define the frame (it is the landmass the frame
 * was fitted to), so only `generate-map-paths.mjs` calls this. It converts "the frame moved
 * silently" into "the generator refuses to run".
 *
 * @param {{ minLon: number, maxLon: number, minLat: number, maxLat: number }} bounds
 */
export function assertFrameMatchesBounds(bounds) {
  const refLat = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(refLat);
  const rawW = (bounds.maxLon - bounds.minLon) * cosLat;
  const rawH = bounds.maxLat - bounds.minLat;
  const scale = (TR_FRAME.viewWidth - 2 * TR_FRAME.padding) / rawW;
  const viewHeight = Math.round(rawH * scale + 2 * TR_FRAME.padding);

  /** @type {[string, number, number][]} */
  const checks = [
    ["minLon", bounds.minLon, TR_FRAME.minLon],
    ["maxLat", bounds.maxLat, TR_FRAME.maxLat],
    ["cosLat", cosLat, TR_FRAME.cosLat],
    ["scale", scale, TR_FRAME.scale],
    ["viewHeight", viewHeight, TR_FRAME.viewHeight],
  ];
  const drift = checks.filter(([, actual, pinned]) => !Object.is(actual, pinned));
  if (drift.length > 0) {
    const detail = drift
      .map(([name, actual, pinned]) => `${name}: source ${actual} ≠ pinned ${pinned}`)
      .join("; ");
    throw new Error(
      `TR frame drift — ${detail}. The frame is PINNED in scripts/lib/tr-frame.mjs and is ` +
        `shared by every TR-frame artifact (provinces, inland water, …). Re-framing is a ` +
        `deliberate act: update TR_FRAME, regenerate ALL artifacts in one commit, and review ` +
        `the rendered samples before merging.`,
    );
  }
}
