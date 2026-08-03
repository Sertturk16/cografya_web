// @ts-check
/**
 * Binary raster morphology for the JRC Global Surface Water (GSW) pipeline — the pure,
 * synthetically testable core of steps 5–8 of the P7 recipe (P7 plan §4.1):
 *
 *   threshold → connected components (seed selection) → morphological closing (r = 300 m)
 *   → interior hole filling → boundary tracing (marching squares) → rings
 *
 * Everything here works on a plain binary mask in RASTER pixel space and knows nothing
 * about GeoTIFF, lon/lat or GeoJSON. That separation is deliberate: the geographic half
 * (`jrc-raster.mjs`) needs a 505 MB download to exercise and therefore has NO CI gate,
 * while this half — where the shape of a lake is actually decided — is fully covered by
 * synthetic unit tests (`lib/map/jrc-morphology.test.ts`). The defect class this wave
 * exists to kill is "a plausible but WRONG lake"; a hand-rolled morphology operator that
 * is subtly off is precisely that defect, so the operators below are exact rather than
 * approximate (see the EDT note on `dilate`).
 *
 * ## Coordinate conventions (both matter to the caller)
 *
 * - PIXEL space: `(x, y)`, `x ∈ [0, width)`, `y ∈ [0, height)`, `data[y * width + x]`.
 *   `y` increases DOWNWARD, matching a north-up GeoTIFF scanline order.
 * - CORNER space (what `traceRings` returns): `(cx, cy)`, `cx ∈ [0, width]`,
 *   `cy ∈ [0, height]`. Corner `(cx, cy)` is the top-left corner of pixel `(cx, cy)`, so
 *   `lon = originLon + cx * pixelSize` and `lat = originLat - cy * pixelSize` exactly.
 *
 * ## Connectivity pairing (4-foreground / 8-background) — a deliberate choice
 *
 * Foreground (water) components are **4-connected**: two pixels touching only at a corner
 * are separate bodies. Background flood fill in `fillInteriorHoles` is **8-connected**.
 * That pairing is the Jordan-consistent one in digital topology. Using 4/4 would create
 * the classic paradox where a diagonal chain of water pixels does not connect as water yet
 * still "encloses" background — and hole filling would then flood a basin whose shoreline
 * is not actually closed. With 4/8 a region is filled only when a genuinely 4-connected
 * shoreline surrounds it.
 *
 * ## Window edges
 *
 * Everything outside the mask is treated as BACKGROUND (dry) by every operator, including
 * `erode`. A body that reaches the window border is therefore shaved by closing. The
 * caller must read its window with a margin larger than the closing radius and check
 * `touchesBorder()` — silence here would be a lake with a straight artificial edge.
 */

/** @typedef {{ width: number, height: number, data: Uint8Array }} Mask */
/** @typedef {[number, number]} Point */
/** @typedef {{ x0: number, y0: number, x1: number, y1: number }} PixelBox Inclusive pixel bounds. */
/** @typedef {{ labels: Int32Array, count: number, sizes: number[] }} Labelling */

/**
 * Allocate an all-background mask.
 *
 * @param {number} width
 * @param {number} height
 * @returns {Mask}
 */
export function createMask(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`createMask: width/height must be positive integers, got ${width}×${height}`);
  }
  return { width, height, data: new Uint8Array(width * height) };
}

/**
 * Build a mask from row strings — `#` / `1` are water, everything else is dry.
 *
 * Exported for tests and for eyeballing a small window during debugging: index arithmetic
 * inline in a test is unreadable, and an unreadable morphology test is a test nobody can
 * check. It is not used by the production pipeline.
 *
 * @param {string[]} rows Equal-length row strings, top row first.
 * @returns {Mask}
 */
export function maskFromRows(rows) {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error("maskFromRows: empty input");
  const mask = createMask(width, height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (row === undefined || row.length !== width) {
      throw new Error(`maskFromRows: row ${y} is ${row?.length ?? 0} wide, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const cell = row[x];
      mask.data[y * width + x] = cell === "#" || cell === "1" ? 1 : 0;
    }
  }
  return mask;
}

/**
 * Render a mask back to row strings (`#` water, `.` dry). Debug/test counterpart of
 * `maskFromRows`; a failing morphology assertion is unreadable without it.
 *
 * @param {Mask} mask
 * @returns {string[]}
 */
export function maskToRows(mask) {
  const rows = [];
  for (let y = 0; y < mask.height; y++) {
    let row = "";
    for (let x = 0; x < mask.width; x++) row += mask.data[y * mask.width + x] ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

/**
 * Number of water pixels.
 *
 * @param {Mask} mask
 */
export function countSet(mask) {
  let total = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) total++;
  return total;
}

/**
 * True when any water pixel sits within `marginPx` of the window edge — i.e. the body may be
 * clipped and every measurement derived from it is a lower bound.
 *
 * **Use a margin, not the default 0.** Measured during the Tuz Gölü smoke run: a window whose
 * east edge was one pixel clear of the water passed `marginPx = 0` while still cutting ~9 km²
 * off the north-eastern lobe, because the lobe simply continued past the requested box. "Does
 * not touch the border" is not the same as "is not clipped"; only a real clearance —
 * comfortably more than the closing radius — says the body ended on its own.
 *
 * @param {Mask} mask
 * @param {number} [marginPx] Clearance to demand from every edge. 0 = the outermost ring only.
 */
export function touchesBorder(mask, marginPx = 0) {
  const { width, height, data } = mask;
  const band = Math.max(0, Math.floor(marginPx));
  for (let y = 0; y < height; y++) {
    const row = y * width;
    if (y <= band || y >= height - 1 - band) {
      for (let x = 0; x < width; x++) if (data[row + x]) return true;
      continue;
    }
    for (let x = 0; x <= band && x < width; x++) if (data[row + x]) return true;
    for (let x = Math.max(0, width - 1 - band); x < width; x++) if (data[row + x]) return true;
  }
  return false;
}

// --- distance transform -------------------------------------------------------------

/**
 * Lower envelope of parabolas — the 1D half of the exact squared Euclidean distance
 * transform (Felzenszwalb & Huttenlocher, "Distance Transforms of Sampled Functions").
 * Linear time; `d` receives the transform of `f`, `v`/`z` are caller-owned scratch.
 *
 * @param {Float64Array} f Costs (0 at a source sample, huge elsewhere).
 * @param {number} n
 * @param {Float64Array} d Output.
 * @param {Int32Array} v Scratch, length ≥ n.
 * @param {Float64Array} z Scratch, length ≥ n + 1.
 */
function lowerEnvelope(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    const fq = f[q] ?? 0;
    let s = 0;
    for (;;) {
      // `?? 0` throughout: every index here is provably in range, but
      // `noUncheckedIndexedAccess` types a typed-array read as `number | undefined`.
      const vk = v[k] ?? 0;
      s = (fq + q * q - ((f[vk] ?? 0) + vk * vk)) / (2 * q - 2 * vk);
      if (s > (z[k] ?? -Infinity) || k === 0) break;
      k--;
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while ((z[k + 1] ?? Infinity) < q) k++;
    const vk = v[k] ?? 0;
    d[q] = (q - vk) * (q - vk) + (f[vk] ?? 0);
  }
}

/** Sentinel "no source in this line" cost. Larger than any squared distance a window can hold. */
const FAR = 1e15;

/**
 * Exact squared Euclidean distance from every pixel to the nearest pixel whose value is
 * `target`, in pixel units. Separable two-pass EDT, O(width × height).
 *
 * @param {Mask} mask
 * @param {0 | 1} target
 * @param {boolean} outsideIsTarget When true, the (virtual) area outside the mask counts as
 *   a source — used by `erode`, where "outside the window is dry" must shave the border.
 * @returns {Float64Array} Squared distances, row-major.
 */
function distanceSqTo(mask, target, outsideIsTarget) {
  const { width, height, data } = mask;
  const span = Math.max(width, height);
  const buffer = new Float64Array(width * height);
  const f = new Float64Array(span);
  const d = new Float64Array(span);
  const v = new Int32Array(span);
  const z = new Float64Array(span + 1);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = (data[y * width + x] ?? 0) === target ? 0 : FAR;
    lowerEnvelope(f, height, d, v, z);
    for (let y = 0; y < height; y++) buffer[y * width + x] = d[y] ?? FAR;
  }
  for (let y = 0; y < height; y++) {
    const base = y * width;
    for (let x = 0; x < width; x++) f[x] = buffer[base + x] ?? FAR;
    lowerEnvelope(f, width, d, v, z);
    for (let x = 0; x < width; x++) buffer[base + x] = d[x] ?? FAR;
  }

  if (outsideIsTarget) {
    // The nearest virtual source outside the window is at x = -1, x = width,
    // y = -1 or y = height; an axis-aligned halo, so the distance is exact.
    for (let y = 0; y < height; y++) {
      const dyTop = y + 1;
      const dyBottom = height - y;
      for (let x = 0; x < width; x++) {
        const border = Math.min(x + 1, width - x, dyTop, dyBottom);
        const i = y * width + x;
        buffer[i] = Math.min(buffer[i] ?? FAR, border * border);
      }
    }
  }
  return buffer;
}

// --- morphology ---------------------------------------------------------------------

/**
 * Dilate with a EUCLIDEAN DISK of `radiusPx`: a pixel is water in the result when some
 * water pixel lies within `radiusPx` of it.
 *
 * Implemented through the exact distance transform rather than by convolving a rasterised
 * kernel. Reason: a rasterised disk is an approximation of a disk, and at r = 10 px the
 * approximation error is a whole pixel of shoreline in places — invisible in a unit test
 * that only checks "it got bigger", visible on a 1 680 km² lake. Exactness is also what
 * makes the closing threshold in the tests a crisp number instead of a fudge factor.
 *
 * @param {Mask} mask
 * @param {number} radiusPx
 * @returns {Mask}
 */
export function dilate(mask, radiusPx) {
  if (!(radiusPx >= 0)) throw new Error(`dilate: radiusPx must be ≥ 0, got ${radiusPx}`);
  if (radiusPx === 0) return { ...mask, data: mask.data.slice() };
  const distance = distanceSqTo(mask, 1, false);
  const limit = radiusPx * radiusPx;
  const out = createMask(mask.width, mask.height);
  for (let i = 0; i < out.data.length; i++) out.data[i] = (distance[i] ?? FAR) <= limit ? 1 : 0;
  return out;
}

/**
 * Erode with a EUCLIDEAN DISK of `radiusPx`: a pixel survives only when EVERY pixel within
 * `radiusPx` of it is water. Outside the window counts as dry (see the module header), so
 * a body reaching the border is shaved.
 *
 * @param {Mask} mask
 * @param {number} radiusPx
 * @returns {Mask}
 */
export function erode(mask, radiusPx) {
  if (!(radiusPx >= 0)) throw new Error(`erode: radiusPx must be ≥ 0, got ${radiusPx}`);
  if (radiusPx === 0) return { ...mask, data: mask.data.slice() };
  const distance = distanceSqTo(mask, 0, true);
  const limit = radiusPx * radiusPx;
  const out = createMask(mask.width, mask.height);
  for (let i = 0; i < out.data.length; i++) out.data[i] = (distance[i] ?? 0) > limit ? 1 : 0;
  return out;
}

/**
 * Morphological CLOSING with a disk of `radiusPx` — dilate, then erode.
 *
 * What it does physically: it bridges the dry salt-crust seams that split Tuz Gölü into
 * three OSM fragments, without inflating the shoreline (the erode undoes the dilate
 * everywhere the dilate was not needed).
 *
 * **Bridging reach is up to 2 × radiusPx, not radiusPx.** Dilation grows BOTH banks of a
 * seam by `radiusPx`, so a channel narrower than `2 · radiusPx` gets bridged; nothing wider
 * ever does. At the pinned recipe value (r = 10 px = 300 m at 30 m pixels) that is a ceiling
 * of 600 m. The P7 plan's §11 T1 prose ("300 m bridged / 400 m NOT bridged") states the
 * reach as `radiusPx`; that is the one number in the plan this module contradicts, and the
 * contradiction is asserted in `lib/map/jrc-morphology.test.ts` rather than papered over.
 * The physical parameter itself is unchanged — r = 10 px is exactly what reproduces the
 * research measurement (verified end to end on Tuz Gölü, +0,2 %).
 *
 * 2 × radiusPx is a CEILING, not a promise: where the two banks face each other along a
 * short front the bridge that dilation builds is thin enough for the erosion half to pinch
 * it off again. Measured on the synthetic case in the unit tests: a 570 m seam bridges
 * across a 60 px contact front and stays open across a 20 px one. Do not "fix" a stubborn
 * seam by enlarging the radius — at 600 m the recipe inflates Tuz Gölü by ~25 %.
 *
 * @param {Mask} mask
 * @param {number} radiusPx
 * @returns {Mask}
 */
export function closeMask(mask, radiusPx) {
  return erode(dilate(mask, radiusPx), radiusPx);
}

/**
 * Fill background regions that are fully enclosed by water — a dried lake bed is part of
 * the lake (P7 plan §4.1 step 7). A bay that opens to the outside is NOT filled, because
 * its background is reachable from the window border.
 *
 * Background reachability is 8-connected; see the connectivity note in the module header.
 *
 * @param {Mask} mask
 * @returns {Mask}
 */
export function fillInteriorHoles(mask) {
  const { width, height, data } = mask;
  const outside = new Uint8Array(width * height);
  /** @type {number[]} */
  const stack = [];
  const push = (/** @type {number} */ x, /** @type {number} */ y) => {
    const i = y * width + x;
    if (data[i] || outside[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop();
    if (i === undefined) break;
    const x = i % width;
    const y = (i - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
        push(nx, ny);
      }
    }
  }

  const out = createMask(width, height);
  for (let i = 0; i < out.data.length; i++) out.data[i] = data[i] || !outside[i] ? 1 : 0;
  return out;
}

// --- connected components -----------------------------------------------------------

/**
 * Label 4-connected water components. Label 0 is background; labels run 1..count.
 *
 * Iterative flood fill with an explicit stack — a recursive version blows the call stack
 * on a real window (Tuz Gölü at 30 m is millions of pixels in one component).
 *
 * @param {Mask} mask
 * @returns {Labelling}
 */
export function labelComponents(mask) {
  const { width, height, data } = mask;
  const labels = new Int32Array(width * height);
  /** @type {number[]} */
  const sizes = [0];
  /** @type {number[]} */
  const stack = [];
  let next = 0;
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || labels[start]) continue;
    next++;
    let size = 0;
    labels[start] = next;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop();
      if (i === undefined) break;
      size++;
      const x = i % width;
      const y = (i - x) / width;
      if (x > 0) visit(i - 1);
      if (x + 1 < width) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y + 1 < height) visit(i + width);
    }
    sizes.push(size);
  }
  return { labels, count: next, sizes };

  /** @param {number} j */
  function visit(j) {
    if (!data[j] || labels[j]) return;
    labels[j] = next;
    stack.push(j);
  }
}

/**
 * Components with at least one pixel inside `box`, largest first.
 *
 * This is the seed rule of P7 plan §4.1 step 6: the caller pins a lon/lat seed box per
 * body in the registry, converts it to pixels, and takes the component(s) it hits. Tuz
 * Gölü is why the seed cannot be the OSM polygon — that polygon misses the 148,9 km²
 * north-eastern arm entirely.
 *
 * @param {Labelling} labelling
 * @param {number} width
 * @param {PixelBox} box
 * @returns {{ label: number, size: number }[]}
 */
export function componentsIntersecting(labelling, width, box) {
  const hit = new Set();
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const label = labelling.labels[y * width + x] ?? 0;
      if (label > 0) hit.add(label);
    }
  }
  return [...hit]
    .map((label) => ({ label, size: labelling.sizes[label] ?? 0 }))
    .sort((a, b) => b.size - a.size);
}

/**
 * Mask containing exactly the listed components.
 *
 * @param {Labelling} labelling
 * @param {number} width
 * @param {number} height
 * @param {Iterable<number>} labels
 * @returns {Mask}
 */
export function maskFromLabels(labelling, width, height, labels) {
  const wanted = new Set(labels);
  const out = createMask(width, height);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = wanted.has(labelling.labels[i] ?? 0) ? 1 : 0;
  }
  return out;
}

// --- boundary tracing ---------------------------------------------------------------

/** Direction codes: 0 = +x, 1 = +y, 2 = −x, 3 = −y (y downward). */
const STEP = /** @type {const} */ ([
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]);

/**
 * Trace the boundary of every water region as closed rings of CORNER coordinates.
 *
 * Method: each water pixel contributes one directed unit edge for every side whose
 * neighbour is dry, oriented so the water is always on the RIGHT of travel. Those edges
 * form closed loops; the loops are the rings. This is the marching-squares result computed
 * on the edge set rather than through a 16-case lookup table — same rings, no table to
 * mistype, and the saddle case is resolved explicitly instead of by convention:
 *
 *   at a corner where two loops meet (water on two diagonally opposite pixels, dry on the
 *   other two), the incoming edge continues into the outgoing edge with the LARGER cross
 *   product, i.e. it turns towards its own water. That keeps the two 4-connected
 *   components' boundaries separate, which is exactly what `labelComponents` already says
 *   about them.
 *
 * Consequences worth knowing:
 *   - every returned ring is closed (first vertex repeated last) and does not intersect
 *     itself; a single component pinched to a corner yields TWO rings rather than one
 *     self-touching one;
 *   - collinear runs are collapsed, so a rectangle comes back as 4 distinct vertices, not
 *     one per pixel. This is lossless — no vertex that changes the shape is dropped. Any
 *     further reduction (Douglas–Peucker) is the caller's step;
 *   - outer rings have POSITIVE signed area (see `ringSignedArea`), holes negative. After
 *     `fillInteriorHoles` there should be no holes; a negative ring is a signal, not noise.
 *
 * @param {Mask} mask
 * @returns {Point[][]} Rings in corner coordinates, `0 ≤ cx ≤ width`, `0 ≤ cy ≤ height`.
 */
export function traceRings(mask) {
  const { width, height, data } = mask;
  const stride = width + 1;
  /** @type {Map<number, number[]>} corner index → outgoing direction codes (≤ 2) */
  const outgoing = new Map();
  const water = (/** @type {number} */ x, /** @type {number} */ y) =>
    x >= 0 && y >= 0 && x < width && y < height && (data[y * width + x] ?? 0) === 1;
  const add = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ dir) => {
    const key = cy * stride + cx;
    const list = outgoing.get(key);
    if (list) list.push(dir);
    else outgoing.set(key, [dir]);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!water(x, y)) continue;
      if (!water(x, y - 1)) add(x, y, 0); // top edge, travelling +x
      if (!water(x + 1, y)) add(x + 1, y, 1); // right edge, +y
      if (!water(x, y + 1)) add(x + 1, y + 1, 2); // bottom edge, −x
      if (!water(x - 1, y)) add(x, y + 1, 3); // left edge, −y
    }
  }

  /** @type {Point[][]} */
  const rings = [];
  for (const [startKey, startDirs] of outgoing) {
    while (startDirs.length > 0) {
      const firstDir = startDirs.shift();
      if (firstDir === undefined) break;
      const startX = startKey % stride;
      const startY = (startKey - startX) / stride;
      /** @type {Point[]} */
      const ring = [[startX, startY]];
      let cx = startX;
      let cy = startY;
      let dir = firstDir;
      for (let guard = 0; ; guard++) {
        if (guard > 4 * width * height + 4) {
          throw new Error("traceRings: boundary walk did not close — edge set is inconsistent.");
        }
        const step = STEP[dir];
        if (!step) throw new Error(`traceRings: bad direction ${dir}`);
        cx += step[0];
        cy += step[1];
        if (cx === startX && cy === startY) break;
        ring.push([cx, cy]);
        const key = cy * stride + cx;
        const options = outgoing.get(key);
        if (!options || options.length === 0) {
          throw new Error(`traceRings: dead end at corner (${cx}, ${cy}) — edge set is broken.`);
        }
        let choice = 0;
        if (options.length > 1) {
          // Saddle: prefer the sharper turn towards this loop's own water.
          let bestCross = -Infinity;
          for (let i = 0; i < options.length; i++) {
            const candidate = STEP[options[i] ?? 0];
            if (!candidate) continue;
            const cross = step[0] * candidate[1] - step[1] * candidate[0];
            if (cross > bestCross) {
              bestCross = cross;
              choice = i;
            }
          }
        }
        const taken = options.splice(choice, 1)[0];
        if (taken === undefined) throw new Error("traceRings: lost an edge while splicing.");
        dir = taken;
      }
      const collapsed = collapseCollinear(ring);
      collapsed.push([collapsed[0]?.[0] ?? startX, collapsed[0]?.[1] ?? startY]);
      rings.push(collapsed);
    }
  }
  return rings;
}

/**
 * Drop vertices that lie in the middle of a straight run, including across the wrap point.
 * Lossless for an axis-aligned staircase.
 *
 * @param {Point[]} ring Open ring (first vertex not repeated).
 * @returns {Point[]}
 */
function collapseCollinear(ring) {
  const n = ring.length;
  /** @type {Point[]} */
  const out = [];
  for (let i = 0; i < n; i++) {
    const previous = ring[(i - 1 + n) % n];
    const current = ring[i];
    const next = ring[(i + 1) % n];
    if (!previous || !current || !next) continue;
    const ax = current[0] - previous[0];
    const ay = current[1] - previous[1];
    const bx = next[0] - current[0];
    const by = next[1] - current[1];
    if (ax * by - ay * bx !== 0) out.push(current);
  }
  return out;
}

/**
 * Shoelace signed area of a ring, in square pixels. Positive for an outer boundary,
 * negative for a hole (raster convention: x right, y DOWN).
 *
 * @param {Point[]} ring Closed or open ring.
 * @returns {number}
 */
export function ringSignedArea(ring) {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    if (!a || !b) continue;
    total += a[0] * b[1] - b[0] * a[1];
  }
  return total / 2;
}
