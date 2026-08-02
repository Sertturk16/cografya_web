// @ts-check
/**
 * Shared build-time TOPOLOGY extraction for the map generators.
 *
 * ## The problem this exists to solve
 *
 * The world generator used to simplify every ring INDEPENDENTLY (and the Türkiye generator
 * still does — adopting this module there is the wave's P2 item, not a shipped fact):
 * Douglas-Peucker ran once per country, so the shared border between two neighbours was
 * decided TWICE, from two different starting frames. DP is not local — which vertices survive
 * depends on the whole polyline the segment sits in — so two neighbours routinely keep a
 * different subset of the very same source vertices. Wherever they disagree the two
 * outlines stop coinciding and a sliver of background shows through the border.
 *
 * Measured on the committed Natural Earth snapshot before this module existed:
 * **19,258 source vertices are shared by two or more rings, and 1,198 of them (6.2%) were
 * decided asymmetrically.** Every one of those is a potential visible crack.
 *
 * ## What this module does
 *
 * Classic TopoJSON-style arc extraction, kept dependency-free in the style of the rest of
 * these generators:
 *
 * 1. **Node indexing** — every ring vertex gets a canonical key (see `snapTolerance`).
 * 2. **Arc extraction** — a ring is cut into arcs at its JUNCTIONS: a vertex whose global
 *    edge degree is not 2 (a tripoint, or a point two rings merely touch at), or a vertex
 *    where the set of rings owning the incoming edge differs from the set owning the
 *    outgoing one (the two ends of a shared border chain).
 * 3. **Deduplication** — an arc traversed by two rings (forwards by one, backwards by the
 *    other) is stored ONCE.
 * 4. **One DP pass per unique arc.** Because DP always keeps an arc's two endpoints, and
 *    the junctions ARE those endpoints, every ring that uses the arc receives the identical
 *    vertex list. Two extra keep-rules apply here:
 *    - **Source ring starts survive.** A junction-free loop is rotated to a canonical start
 *      for dedup, which silently dropped the anchor the old per-ring DP had at the source
 *      ring's own first vertex — small islands lost 20–45% of their painted area to that
 *      missing anchor (Bahrain collapsed to a triangle; PR #35 review I2). Every
 *      junction-free loop's source start vertex is therefore force-kept, for all owners of
 *      the arc, so the guarantee stays symmetric.
 *    - **Preserved rings never collapse.** A ring flagged `preserve` (an enclave HOLE — see
 *      the typedef) whose shared arc would simplify below a drawable polygon is re-simplified
 *      at progressively finer epsilon until at least 3 distinct vertices survive. Applied to
 *      the ARC, so the coincident enclave outline re-emerges with the hole and the two keep
 *      painting the same polyline (PR #35 review I5 — the Artsvashen/Barak residue of the
 *      Lesotho defect).
 * 5. **Reassembly** back into per-ring point arrays.
 *
 * The result: a shared border is simplified once and both neighbours draw the SAME
 * polyline. `stats.asymmetricSharedNodes` re-measures this on the output and the callers
 * print it — the guarantee is verified every run, not assumed.
 *
 * ## What this module deliberately does NOT do
 *
 * It does not clip, merge or repair polygons, and it does not invent shared vertices where
 * the source has none. Two neighbours whose source geometry does not actually coincide
 * (the `/turkiye` case — see the wave plan §1.3) still will not coincide afterwards; that
 * is a source-data problem and topology cannot manufacture the missing agreement.
 */

/** @typedef {[number, number]} Point */
/**
 * @typedef {object} TopologyRing
 * @property {Point[]} points Projected ring vertices. A repeated closing vertex is optional
 *   — it is normalised away, and the OUTPUT is likewise open (the caller closes with `Z`).
 * @property {number} epsilon Douglas-Peucker tolerance this ring asks for, in projected
 *   units. An arc shared by several rings is simplified at the FINEST (smallest) epsilon of
 *   its owners, so a deliberately coarse backdrop tolerance can never degrade a neighbour.
 * @property {boolean} [preserve] This ring must never collapse below a drawable polygon
 *   (3 distinct vertices) as long as its geometry coincides with at least one other ring.
 *   Meant for enclave HOLES: a hole by definition encloses another ring's landmass, so the
 *   epsilon that is fine for a coastline is the wrong tolerance for it — dropping the hole
 *   while the host survives repaints the host over the enclave (the Lesotho failure mode).
 *   The floor applies only to arcs with ≥ 2 owners: a hole whose enclave never entered the
 *   topology (a marker-fallback micro-state) has nothing to draw into the opening, so
 *   preserving it would punch a window to the background instead.
 */

/**
 * Absolute shoelace area of an OPEN ring (no repeated closing vertex).
 *
 * Exported because it is a planar primitive every generator in this folder needs, and this
 * module is already their shared simplification home (`simplify()` lives here). It was
 * re-implemented a third time in the inland-water generator before that was noticed
 * (PR #39, code-simplifier) — import it, do not write a fourth.
 */
export function loopArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

/**
 * Minimum fraction of a loop's TRUE enclosed area its simplified form must keep. DP measures
 * perpendicular DISTANCE, which for a ring whose whole extent is near the tolerance says
 * nothing about the AREA the survivors enclose — a small island can legally collapse to a
 * thin triangle holding a fraction of its paint (Bahrain kept 55% under the plain pass,
 * PR #35 review I2). Loops failing the bar are re-simplified at progressively finer epsilon;
 * large rings are unaffected (their DP area error is orders of magnitude inside the bar).
 */
const LOOP_AREA_RATIO = 0.8;

/**
 * Perpendicular distance from point `p` to the segment `a`→`b`.
 *
 * Exported for the same reason as `loopArea` above: this was byte-for-byte identical in
 * `generate-map-paths.mjs` and `water-geometry.mjs` as well — three copies of the one
 * function every Douglas-Peucker pass in this repo is built on (PR #39, code-simplifier).
 */
export function perpDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Iterative Douglas-Peucker line simplification (an explicit stack, not recursion — some
 * source rings are ~7k vertices deep). The first and last points are ALWAYS kept, which is
 * precisely the property arc-wise simplification relies on. `forcedIndices` names interior
 * vertices that must additionally survive; DP then runs between consecutive anchors, so a
 * forced vertex behaves exactly like an endpoint (this is how a rotated loop keeps the
 * anchor its source ring's start vertex used to provide).
 *
 * @param {Point[]} points
 * @param {number} epsilon
 * @param {number[]} [forcedIndices]
 * @returns {Point[]}
 */
export function simplify(points, epsilon, forcedIndices = []) {
  if (points.length < 3) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const anchors = [0, points.length - 1];
  for (const index of forcedIndices) {
    if (index > 0 && index < points.length - 1 && !keep[index]) {
      keep[index] = true;
      anchors.push(index);
    }
  }
  anchors.sort((a, b) => a - b);
  /** @type {[number, number][]} */
  const stack = [];
  for (let i = 0; i + 1 < anchors.length; i++) stack.push([anchors[i], anchors[i + 1]]);
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const dist = perpDistance(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > epsilon && index !== -1) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Byte that can never occur inside a numeric key — used to join composite keys. Kept as
 *  the ESCAPE form on purpose: a raw NUL here turns the whole module git-binary (undiffable,
 *  unreviewable) and lets any text-normalising tool silently alter arc identity. */
const SEP = "\x00";

/**
 * Extract shared arcs across a whole ring set, simplify each arc exactly once, and hand the
 * rings back in the same order they came in.
 *
 * @param {TopologyRing[]} rings
 * @param {{ snapTolerance?: number }} [options]
 *   `snapTolerance` — projected-unit grid the node keys are quantised onto before matching.
 *   **0 (the default) means exact match**, which is what the Natural Earth Admin-0 snapshot
 *   needs: it was measured to share its border vertices bit-for-bit (19,265 shared edges,
 *   none owned by more than two rings). A source whose neighbours only ALMOST agree needs a
 *   positive tolerance, and then matched vertices are moved onto their shared
 *   representative — that is a geometry edit, so it is opt-in and never silent.
 *
 *   NOTE for callers: output rings may SHARE `Point` array instances (vertices are interned
 *   one representative per node key — that is what makes neighbours bit-identical). Treat
 *   the returned points as immutable; mutating one in place would corrupt every ring that
 *   shares it.
 * @returns {{ rings: Point[][], stats: {
 *   inputRings: number, inputVertices: number, outputVertices: number,
 *   arcs: number, sharedArcs: number, sharedNodes: number, asymmetricSharedNodes: number,
 * } }}
 */
export function buildTopology(rings, options = {}) {
  const snapTolerance = options.snapTolerance ?? 0;
  const snap =
    snapTolerance > 0
      ? /** @param {number} v */ (v) => Math.round(v / snapTolerance) * snapTolerance
      : /** @param {number} v */ (v) => v;
  /** @param {Point} p */
  const keyOf = (p) => `${snap(p[0])}${SEP}${snap(p[1])}`;

  // --- 1. Normalise: snap to the canonical representative, drop consecutive duplicates,
  //        open the ring (no repeated closing vertex). -------------------------------
  /** @type {Map<string, Point>} */
  const representative = new Map();
  /** @type {{ points: Point[], keys: string[], epsilon: number, preserve: boolean }[]} */
  const norm = [];
  let inputVertices = 0;
  for (const ring of rings) {
    /** @type {Point[]} */
    const points = [];
    /** @type {string[]} */
    const keys = [];
    for (const raw of ring.points) {
      const k = keyOf(raw);
      let point = representative.get(k);
      if (!point) {
        point = raw;
        representative.set(k, point);
      }
      if (keys.length > 0 && keys[keys.length - 1] === k) continue; // zero-length edge
      points.push(point);
      keys.push(k);
    }
    while (keys.length > 1 && keys[0] === keys[keys.length - 1]) {
      points.pop();
      keys.pop();
    }
    inputVertices += keys.length;
    norm.push({ points, keys, epsilon: ring.epsilon, preserve: ring.preserve === true });
  }

  // --- 2. Global edge index: who owns each undirected edge, and how many distinct edges
  //        touch each node. ------------------------------------------------------------
  /** @type {Map<string, Set<number>>} edge key → owning ring indices */
  const edgeOwners = new Map();
  /** @type {Map<string, Set<string>>} node key → distinct incident edge keys */
  const incident = new Map();
  /** @type {Map<string, Set<number>>} node key → owning ring indices */
  const nodeOwners = new Map();
  /** @param {string} a @param {string} b */
  const edgeKey = (a, b) => (a < b ? `${a}${SEP}${SEP}${b}` : `${b}${SEP}${SEP}${a}`);

  norm.forEach((ring, ri) => {
    const { keys } = ring;
    const n = keys.length;
    if (n < 3) {
      for (const k of keys) {
        let owners = nodeOwners.get(k);
        if (!owners) nodeOwners.set(k, (owners = new Set()));
        owners.add(ri);
      }
      return; // degenerate ring: no edges to share
    }
    for (let i = 0; i < n; i++) {
      const a = keys[i];
      const b = keys[(i + 1) % n];
      const ek = edgeKey(a, b);
      let owners = edgeOwners.get(ek);
      if (!owners) edgeOwners.set(ek, (owners = new Set()));
      owners.add(ri);
      for (const k of [a, b]) {
        let edges = incident.get(k);
        if (!edges) incident.set(k, (edges = new Set()));
        edges.add(ek);
        let nOwners = nodeOwners.get(k);
        if (!nOwners) nodeOwners.set(k, (nOwners = new Set()));
        nOwners.add(ri);
      }
    }
  });

  /** @type {Map<string, string>} edge key → sorted owner signature */
  const edgeSignature = new Map();
  for (const [ek, owners] of edgeOwners) {
    edgeSignature.set(ek, [...owners].sort((a, b) => a - b).join(","));
  }

  // --- 3. Cut each ring into arcs at its junctions, deduplicating as we go. ----------
  /** @type {Point[][]} */
  const arcPoints = [];
  /** @type {number[]} */
  const arcEpsilon = [];
  /** @type {Set<number>[]} */
  const arcOwners = [];
  /** @type {boolean[]} arc id → some owner ring is `preserve`-flagged */
  const arcPreserve = [];
  /** @type {Map<string, { id: number, reversed: boolean }>} */
  const arcIndex = new Map();
  /** @type {{ id: number, reversed: boolean }[][]} */
  const ringArcs = [];
  /** Node keys that must survive simplification wherever they occur: the source start
   *  vertex of every junction-free loop. Rotating such a loop to its canonical start (for
   *  dedup) removed the DP anchor the source ring's own first vertex used to provide, and
   *  small islands measurably lost painted area to it (PR #35 review I2). Keyed by NODE, not
   *  by arc index, so both owners of a coincident loop keep it — symmetry is preserved.
   *  @type {Set<string>} */
  const forcedKeys = new Set();

  /**
   * Register (or look up) one arc. Both traversal directions are indexed, so the second
   * ring to walk a shared border finds the first ring's arc and reuses its vertex list.
   * @param {Point[]} points @param {string[]} keys @param {number} ri @param {number} epsilon
   * @param {boolean} preserve
   */
  function addArc(points, keys, ri, epsilon, preserve) {
    const forward = keys.join(SEP);
    const backward = keys.slice().reverse().join(SEP);
    const found = arcIndex.get(forward);
    if (found) {
      arcOwners[found.id].add(ri);
      arcEpsilon[found.id] = Math.min(arcEpsilon[found.id], epsilon);
      arcPreserve[found.id] = arcPreserve[found.id] || preserve;
      return found;
    }
    const id = arcPoints.length;
    arcPoints.push(points);
    arcEpsilon.push(epsilon);
    arcOwners.push(new Set([ri]));
    arcPreserve.push(preserve);
    arcIndex.set(forward, { id, reversed: false });
    if (!arcIndex.has(backward)) arcIndex.set(backward, { id, reversed: true });
    return { id, reversed: false };
  }

  norm.forEach((ring, ri) => {
    const { points, keys, epsilon, preserve } = ring;
    const n = keys.length;
    if (n < 3) {
      ringArcs.push([]);
      return;
    }
    /** @type {number[]} */
    const junctions = [];
    for (let i = 0; i < n; i++) {
      const k = keys[i];
      const degree = incident.get(k)?.size ?? 0;
      const incoming = edgeSignature.get(edgeKey(keys[(i - 1 + n) % n], k));
      const outgoing = edgeSignature.get(edgeKey(k, keys[(i + 1) % n]));
      if (degree !== 2 || incoming !== outgoing) junctions.push(i);
    }

    if (junctions.length === 0) {
      // A whole closed loop with nothing to cut it at: either a lone island, or a ring
      // that coincides EXACTLY with another ring for its full length — which is what every
      // enclave in this snapshot looks like (Lesotho's outline is byte-for-byte South
      // Africa's hole). Dedup is rotation-sensitive, so pick a canonical start vertex
      // (the lexicographically smallest key) and both copies land on the same arc — seeding
      // it as the loop's single pseudo-junction makes the general loop below walk exactly
      // the n+1 points the dedicated special case used to build.
      let start = 0;
      for (let i = 1; i < n; i++) if (keys[i] < keys[start]) start = i;
      junctions.push(start);
      // The rotation just discarded the DP anchor at the SOURCE ring's start vertex, which
      // is where the old per-ring pass always anchored. Force-keep it (by node key, so every
      // owner of the shared arc keeps it too) — without this, small islands lose real
      // painted area to the moved anchor (Bahrain −45%, PR #35 review I2).
      forcedKeys.add(keys[0]);
    }
    /** @type {{ id: number, reversed: boolean }[]} */
    const chain = [];
    for (let j = 0; j < junctions.length; j++) {
      const from = junctions[j];
      const to = junctions[(j + 1) % junctions.length];
      const span = (to - from + n) % n || n; // a single junction ⇒ the full loop
      /** @type {Point[]} */
      const arcPts = [];
      /** @type {string[]} */
      const arcKeys = [];
      for (let i = 0; i <= span; i++) {
        const idx = (from + i) % n;
        arcPts.push(points[idx]);
        arcKeys.push(keys[idx]);
      }
      chain.push(addArc(arcPts, arcKeys, ri, epsilon, preserve));
    }
    ringArcs.push(chain);
  });

  // --- 4. One DP pass per unique arc. -----------------------------------------------
  const arcSimplified = arcPoints.map((pts, id) => {
    /** @type {number[]} */
    const forced = [];
    if (forcedKeys.size > 0) {
      for (let i = 1; i < pts.length - 1; i++) {
        if (forcedKeys.has(keyOf(pts[i]))) forced.push(i);
      }
    }
    let out = simplify(pts, arcEpsilon[id], forced);
    const isLoop = pts.length > 1 && keyOf(pts[0]) === keyOf(pts[pts.length - 1]);
    // Area-preservation guard (review I2): a whole-loop arc IS a place — its enclosed area
    // is its painted, clickable footprint — so the simplification must keep a bounded
    // fraction of it. Applied per ARC, so a coincident enclave/hole pair refines together.
    if (isLoop) {
      const trueArea = loopArea(pts.slice(0, -1));
      if (trueArea > 0) {
        let epsilon = arcEpsilon[id];
        while (
          loopArea(out.slice(0, -1)) < LOOP_AREA_RATIO * trueArea &&
          epsilon > Number.EPSILON
        ) {
          epsilon /= 2;
          out = simplify(pts, epsilon, forced);
        }
      }
    }
    // Preservation floor (review I5): a `preserve`-flagged ring — an enclave hole — must not
    // collapse below a drawable polygon while its host ring survives, or the host repaints
    // over the enclave (the Lesotho failure mode, in miniature). Only arcs with ≥ 2 owners
    // qualify: those are exactly the holes whose enclave outline coincides and re-emerges
    // WITH the hole, so both keep painting the same polyline and symmetry is untouched. A
    // single-owner hole (its enclave fell to a marker and never entered the topology) is
    // deliberately left to collapse — preserving it would open a window onto the background.
    if (arcPreserve[id] && arcOwners[id].size >= 2) {
      const minLength = isLoop ? 4 : 3; // a loop arc repeats its start, so 4 pts = 3 distinct
      let epsilon = arcEpsilon[id];
      while (out.length < minLength && epsilon > Number.EPSILON) {
        epsilon /= 2;
        out = simplify(pts, epsilon, forced);
      }
      if (out.length < minLength) out = pts.slice(); // collinear source: keep it verbatim
    }
    return out;
  });

  // --- 5. Reassemble. Every arc contributes all of its points except the last, which is
  //        the next arc's first (and, for the final arc, the ring's own start). --------
  /** @type {Point[][]} */
  const outRings = norm.map((ring, ri) => {
    const chain = ringArcs[ri];
    if (chain.length === 0) return ring.points.slice();
    /** @type {Point[]} */
    const out = [];
    for (const { id, reversed } of chain) {
      const pts = reversed ? arcSimplified[id].slice().reverse() : arcSimplified[id];
      for (let i = 0; i < pts.length - 1; i++) out.push(pts[i]);
    }
    return out;
  });

  // --- 6. Verify, don't assume: re-measure symmetry on the OUTPUT. -------------------
  // Degenerate rings (< 3 distinct vertices) are excluded from the accounting: they carry
  // no edges, skip arc extraction, and paint nothing, so they cannot DISAGREE about a
  // border — counting them would fail the build on data that is not broken and point the
  // error at this module instead of at the source ring (PR #35 review M4; plausible on the
  // OSM/Overpass input P2 feeds this module, even though Natural Earth never trips it).
  const keptPerRing = outRings.map((pts) => new Set(pts.map(keyOf)));
  let sharedNodes = 0;
  let asymmetricSharedNodes = 0;
  for (const [k, owners] of nodeOwners) {
    let realOwners = 0;
    let kept = 0;
    for (const ri of owners) {
      if (norm[ri].keys.length < 3) continue;
      realOwners++;
      if (keptPerRing[ri].has(k)) kept++;
    }
    if (realOwners < 2) continue;
    sharedNodes++;
    if (kept !== 0 && kept !== realOwners) asymmetricSharedNodes++;
  }

  return {
    rings: outRings,
    stats: {
      inputRings: rings.length,
      inputVertices,
      outputVertices: outRings.reduce((sum, pts) => sum + pts.length, 0),
      arcs: arcPoints.length,
      sharedArcs: arcOwners.filter((owners) => owners.size > 1).length,
      sharedNodes,
      asymmetricSharedNodes,
    },
  };
}
