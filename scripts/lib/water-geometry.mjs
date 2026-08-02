// @ts-check
/**
 * Geometry helpers shared by the inland-water fetch (network) and generate (offline) steps.
 *
 * They live in one module because both steps must agree on what a "ring" is and what a
 * body's area IS: the fetch step measures the area that decides the threshold ladder, and
 * the generate step re-checks it. Two implementations of the same formula would eventually
 * disagree, and the disagreement would show up as a lake mysteriously crossing a rung.
 */

/** Mean Earth radius (IUGG), metres. */
const EARTH_RADIUS_M = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;

/** @typedef {[number, number]} LonLat */

/**
 * Spherical area of a lon/lat ring, in km² (unsigned).
 *
 * The planar shoelace formula would be wrong here by ~30 % at Türkiye's latitudes because a
 * degree of longitude is not a degree of latitude. This is the standard spherical-excess
 * form (the one turf.js uses); at these sizes it agrees with published figures to well
 * inside the tolerance a drawing threshold needs.
 *
 * @param {LonLat[]} ring
 */
export function measureRingAreaKm2(ring) {
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

/**
 * Stitch an Overpass relation's `outer` / `inner` members into closed rings.
 *
 * A multipolygon relation stores its boundary as a bag of unordered way fragments, some of
 * them reversed; only the assembled ring is a ring. Fragments are joined end-to-end, and an
 * unclosed result THROWS — a silently dropped fragment is a lake with a bite out of it, and
 * that is exactly the class of defect this layer exists to remove.
 *
 * @param {{ type?: string, role?: string, geometry?: { lon: number, lat: number }[] }[]} members
 * @param {string} label Feature id, for the error message.
 * @returns {{ outer: LonLat[][], inner: LonLat[][] }}
 */
export function stitchRings(members, label) {
  /** @type {{ outer: LonLat[][], inner: LonLat[][] }} */
  const pieces = { outer: [], inner: [] };
  for (const member of members) {
    if (member.type !== "way" || !Array.isArray(member.geometry)) continue;
    const role = member.role === "inner" ? "inner" : "outer";
    pieces[role].push(member.geometry.map((point) => /** @type {LonLat} */ ([point.lon, point.lat])));
  }

  /** @type {{ outer: LonLat[][], inner: LonLat[][] }} */
  const rings = { outer: [], inner: [] };
  for (const role of /** @type {const} */ (["outer", "inner"])) {
    const fragments = pieces[role].filter((fragment) => fragment.length >= 2);
    const used = new Array(fragments.length).fill(false);
    for (let i = 0; i < fragments.length; i++) {
      if (used[i]) continue;
      const first = fragments[i];
      if (!first) continue;
      used[i] = true;
      const ring = first.slice();
      while (!isClosed(ring)) {
        const tail = ring[ring.length - 1];
        let joined = false;
        for (let j = 0; j < fragments.length; j++) {
          if (used[j]) continue;
          const fragment = fragments[j];
          if (!fragment) continue;
          const head = fragment[0];
          const end = fragment[fragment.length - 1];
          if (samePoint(head, tail)) {
            ring.push(...fragment.slice(1));
          } else if (samePoint(end, tail)) {
            ring.push(...fragment.slice(0, -1).reverse());
          } else {
            continue;
          }
          used[j] = true;
          joined = true;
          break;
        }
        if (!joined) {
          throw new Error(
            `${label}: ${role} ring will not close (${ring.length} points, ` +
              `${used.filter((u) => !u).length} fragments left). Refusing to draw a partial body.`,
          );
        }
      }
      rings[role].push(ring);
    }
  }
  return rings;
}

/** @param {LonLat[]} ring */
function isClosed(ring) {
  return ring.length >= 4 && samePoint(ring[0], ring[ring.length - 1]);
}

/**
 * @param {LonLat | undefined} a
 * @param {LonLat | undefined} b
 */
function samePoint(a, b) {
  return a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1];
}

/** Perpendicular distance from `p` to segment `a`→`b`. */
function perpDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Douglas–Peucker on a CLOSED ring, with the tolerance expressed in PROJECTED svg units.
 *
 * Two details that a naive call gets wrong:
 *   - a closed ring has no natural endpoints, so classic DP anchored on `[0, n-1]` would
 *     pin the arbitrary start vertex and could collapse the half of the ring furthest from
 *     it. The ring is split at its two most distant vertices and each half simplified,
 *     which makes the result independent of where the source happened to start;
 *   - the tolerance must be applied in the space the reader SEES. Simplifying in degrees
 *     would be ~1.29× stricter east-west than north-south at these latitudes.
 *
 * The returned ring is a SUBSET of the input vertices (original coordinates, unmodified) and
 * is closed (first vertex repeated last).
 *
 * @param {LonLat[]} ring Closed ring (first === last) or open ring.
 * @param {number} epsilon Tolerance in projected svg units.
 * @param {(lonLat: LonLat) => [number, number]} project
 * @returns {LonLat[]} Closed, simplified ring.
 */
export function simplifyRing(ring, epsilon, project) {
  const open = isClosed(ring) ? ring.slice(0, -1) : ring.slice();
  if (open.length < 4) return closeRing(open);

  const projected = open.map((point) => project(point));
  // Split at the vertex pair that is furthest apart, so neither anchor is an artefact of
  // the source's start index.
  let anchorA = 0;
  let anchorB = 0;
  let best = -1;
  const first = projected[0];
  if (!first) return closeRing(open);
  for (let i = 1; i < projected.length; i++) {
    const point = projected[i];
    if (!point) continue;
    const d = Math.hypot(point[0] - first[0], point[1] - first[1]);
    if (d > best) {
      best = d;
      anchorB = i;
    }
  }
  const far = projected[anchorB];
  if (!far) return closeRing(open);
  best = -1;
  for (let i = 0; i < projected.length; i++) {
    const point = projected[i];
    if (!point) continue;
    const d = Math.hypot(point[0] - far[0], point[1] - far[1]);
    if (d > best) {
      best = d;
      anchorA = i;
    }
  }
  if (anchorA === anchorB) return closeRing(open);

  const lo = Math.min(anchorA, anchorB);
  const hi = Math.max(anchorA, anchorB);
  const keep = new Array(open.length).fill(false);
  keep[lo] = true;
  keep[hi] = true;
  // Two open arcs: lo→hi, and hi→…→wrap→…→lo.
  markKept(projected, lo, hi, epsilon, keep, false);
  markKept(projected, hi, lo + open.length, epsilon, keep, true);

  const simplified = open.filter((_, i) => keep[i]);
  if (simplified.length < 3) return closeRing(open);
  return closeRing(simplified);
}

/**
 * Iterative Douglas–Peucker over an arc, optionally wrapping past the end of the array.
 * Indices are virtual: `i % n` addresses the real vertex.
 */
function markKept(projected, start, end, epsilon, keep, wrap) {
  const n = projected.length;
  const at = (i) => projected[wrap ? i % n : i];
  const stack = [[start, end]];
  while (stack.length) {
    const frame = stack.pop();
    if (!frame) break;
    const [from, to] = frame;
    if (to - from < 2) continue;
    const a = at(from);
    const b = at(to);
    if (!a || !b) continue;
    let maxDist = 0;
    let index = -1;
    for (let i = from + 1; i < to; i++) {
      const p = at(i);
      if (!p) continue;
      const d = perpDistance(p, a, b);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilon && index !== -1) {
      keep[index % n] = true;
      stack.push([from, index], [index, to]);
    }
  }
}

/** @param {LonLat[]} ring */
function closeRing(ring) {
  const out = ring.slice();
  const head = out[0];
  const tail = out[out.length - 1];
  if (head && tail && !samePoint(head, tail)) out.push([head[0], head[1]]);
  return out;
}
