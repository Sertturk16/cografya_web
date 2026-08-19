// @ts-check
/**
 * Geometry helpers shared by the inland-water fetch (network) and generate (offline) steps.
 *
 * They live in one module because both steps must agree on what a "ring" is and what a
 * body's area IS: the fetch step measures the area that decides the threshold ladder, and
 * the generate step re-checks it. Two implementations of the same formula would eventually
 * disagree, and the disagreement would show up as a lake mysteriously crossing a rung.
 */

import { perpDistance } from "./map-topology.mjs";

/*
 * Spherical ring area — re-exported under this module's original name.
 *
 * A PLAIN block comment, not a JSDoc one (→ PR #71 review CODE71-M8): JSDoc attached to a
 * re-export statement does not travel to the re-exported symbol, so none of this would have
 * surfaced on hover at the three call sites anyway. It is file-level prose and now says so.
 *
 * THE BODY MOVED to `lib/map/spherical-area.ts` (CBS-P2 SPEC §5.2), and it moved rather
 * than being copied: the browser's measurement tools need the same answer this module has
 * been giving the water generators, and two implementations of one formula eventually
 * disagree. There the disagreement would read as a lake changing rung on one side and a
 * wrong area on the other, with nothing failing.
 *
 * NOTHING ABOUT THIS MODULE'S CONTRACT CHANGED. The three consumers
 * (`fetch-tr-inland-water.mjs`, `generate-tr-inland-water.mjs`, `fetch-tr-jrc-water.mjs`)
 * still import `measureRingAreaKm2` from here, with the same signature and the same numbers.
 *
 * WHAT `pnpm generate:water:check` ACTUALLY PROVES ABOUT THAT, MEASURED RATHER THAN ASSUMED.
 * It proves the WIRING: with the specifier below deliberately broken the gate exits 1, so a
 * module this offline generator cannot load can never reach `dev`. It does NOT prove the
 * ARITHMETIC — the Earth radius was temporarily changed by 30 % and the regenerated artifact
 * came back BYTE-IDENTICAL, gate still green. The reason is visible at
 * `generate-tr-inland-water.mjs:499`: in the offline step this function feeds `sourceArea`,
 * which is aggregated only into the console's area-loss report and never into the emitted
 * file. The threshold ladder it does drive lives in the NETWORK fetch step, which CI
 * deliberately never runs.
 *
 * So the arithmetic is guarded by `lib/map/spherical-area.test.ts` alone, and that test is
 * load-bearing rather than decorative. This paragraph exists because the first version of it
 * claimed the gate covered both halves, and a positive control disproved it.
 *
 * TWO THINGS ABOUT THE SPECIFIER ARE LOAD-BEARING. The `.ts` extension is explicit because
 * node resolves this itself and strips the types natively (Node 24); there is no bundler in
 * this path. And the target is deliberately a LEAF with zero imports — an `@/…` alias would
 * not resolve under plain node, and a transitive dependency would drag the whole app's
 * module graph into a build script.
 *
 * TWO KNOWN, ACCEPTED SIDE EFFECTS OF THAT SPECIFIER — recorded so neither is diagnosed a
 * second time (→ PR #71 review CODE71-M9 / CODE71-M10):
 *
 *  1. This file carries `// @ts-check`, and an editor honouring it reports TS5097 ("an import
 *     path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled")
 *     on the line below. It reaches NO gate: tsconfig's `include` covers `.ts|.tsx|.mts` and
 *     not `.mjs`, so `pnpm typecheck` never sees this file. `// @ts-check` is KEPT rather than
 *     dropped — this module still does real ring stitching and simplification, and trading all
 *     of that checking for one editor squiggle is the worse deal.
 *  2. Importing this module prints a `[MODULE_TYPELESS_PACKAGE_JSON]` warning on stderr, because
 *     the package has no `"type"` field and node must re-parse the `.ts` target as ESM. The
 *     generators still exit 0 and `generate:water:check` is unaffected. Both remedies — adding
 *     `"type": "module"` to `package.json`, or a `--no-warnings` flag on every generate script —
 *     cost more than the line of stderr they remove.
 */
export { ringAreaKm2 as measureRingAreaKm2 } from "../../lib/map/spherical-area.ts";

/** @typedef {[number, number]} LonLat */

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
    pieces[role].push(
      member.geometry.map((point) => /** @type {LonLat} */ ([point.lon, point.lat])),
    );
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

/**
 * Douglas–Peucker on a CLOSED ring, with the tolerance expressed in PROJECTED svg units.
 *
 * Two details that a naive call gets wrong:
 *   - a closed ring has no natural endpoints, so classic DP anchored on `[0, n-1]` would
 *     pin the arbitrary start vertex and could collapse the half of the ring furthest from
 *     it. The ring is split at two mutually distant vertices — a two-pass farthest-point
 *     heuristic (2-approximation of the ring's diameter), NOT the exact diameter — and
 *     each half simplified, which makes the result independent of where the source
 *     happened to start;
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
  // Split at a mutually distant vertex pair, so neither anchor is an artefact of the
  // source's start index. Two passes: the vertex furthest from `projected[0]` (anchorB),
  // then the vertex furthest from that (anchorA). This is the standard farthest-point
  // 2-approximation — it does not guarantee the true diameter, and does not need to:
  // only start-index independence matters here.
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
  markKept(projected, lo, hi, epsilon, keep);
  markKept(projected, hi, lo + open.length, epsilon, keep);

  const simplified = open.filter((_, i) => keep[i]);
  if (simplified.length < 3) return closeRing(open);
  return closeRing(simplified);
}

/**
 * Iterative Douglas–Peucker over an arc, which may run past the end of the array and wrap.
 * Indices are VIRTUAL: `i % n` addresses the real vertex, and it is applied unconditionally
 * because for the non-wrapping arc every index is already `< n`, so `i % n === i`. (There
 * used to be a `wrap` flag selecting between the two; it could never change an outcome.)
 */
function markKept(projected, start, end, epsilon, keep) {
  const n = projected.length;
  const at = (i) => projected[i % n];
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
