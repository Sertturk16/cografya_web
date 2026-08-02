// @ts-check
/**
 * Shared build-time SVG path `d` EMISSION for the map generators.
 *
 * The generators used to write absolute commands — `M123.4 56.7L123.9 57.1L124.3 57.6…` —
 * where every vertex costs a full pair of world-scale coordinates. Consecutive vertices of
 * a simplified outline are a fraction of a unit apart, so almost all of those digits encode
 * a position we already knew. Switching to a relative `l` run with implicit repetition
 * (`M123.4 56.7l.5.4.4.5…`) spends bytes on the DELTA instead, and the delta is one to two
 * digits. Measured on the world artifact: **−26% raw**, with the identical rendered outline.
 *
 * ## The trap this module exists to avoid
 *
 * The naive implementation — `dx = round(x[i] - x[i-1])` — DRIFTS. Each rounding error is
 * carried into the next segment instead of being corrected, so the error random-walks along
 * the ring and a long coastline ends up visibly displaced from where the absolute encoding
 * put it (and, worse, two neighbours drift apart from each other — undoing exactly what
 * `map-topology.mjs` just fixed).
 *
 * The fix, and the whole reason this is a module rather than three inline lines: the cursor
 * is tracked in the SAME quantised space the consumer will reconstruct, and every delta is
 * measured from the EMITTED cursor rather than from the previous true vertex. All
 * arithmetic is done in integer units of 10^-`decimals`, so the tracked cursor is exactly
 * the number an SVG parser accumulates — not a float that merely approximates it. Absolute
 * error per vertex is therefore bounded by half a quantum (0.05 units at 1 decimal),
 * exactly as it was under absolute encoding, and it never accumulates.
 */

/** @typedef {[number, number]} Point */

/**
 * Format an integer count of quanta as the shortest legal SVG number.
 * `123` @1dp → `"12.3"`, `50` → `"5"`, `-4` → `"-.4"`.
 * @param {number} units @param {number} scale @param {number} decimals
 */
function formatUnits(units, scale, decimals) {
  const negative = units < 0;
  const abs = Math.abs(units);
  const whole = Math.floor(abs / scale);
  const frac = abs % scale;
  let text;
  if (frac === 0) {
    text = String(whole);
  } else {
    const fracText = String(frac).padStart(decimals, "0").replace(/0+$/, "");
    // Drop the redundant leading zero: ".4" is one byte cheaper than "0.4" and parses the
    // same (SVG path numbers allow an omitted integer part).
    text = whole === 0 ? `.${fracText}` : `${whole}.${fracText}`;
  }
  return negative ? `-${text}` : text;
}

/**
 * Encode closed subpaths as one SVG path `d` string.
 *
 * Each subpath is an OPEN vertex list (no repeated closing vertex — `Z` closes it, and
 * re-stating the first vertex before `Z` is pure waste). Subpaths after the first start
 * with a relative `m`: after `Z` the SVG cursor sits on the current subpath's start point,
 * so the hop to the next subpath is itself a delta.
 *
 * Vertices that collapse onto the cursor after quantisation emit nothing — they are
 * duplicates at the artifact's own precision and drawing them changes no pixel. (A subpath
 * that collapses this far was already invisible under absolute encoding; deciding whether
 * such a shape should exist at all is the caller's job, not the encoder's.)
 *
 * @param {Point[][]} subpaths
 * @param {{ decimals?: number }} [options]
 * @returns {string}
 */
export function encodePath(subpaths, options = {}) {
  const decimals = options.decimals ?? 1;
  const scale = 10 ** decimals;
  /** Quantise a projected coordinate to integer units — the shared space cursor and vertex
   *  both live in, which is what makes the delta exact. */
  const q = (/** @type {number} */ v) => Math.round(v * scale);

  let out = "";
  /** Last number token written, or `null` right after a command letter. Drives separators. */
  let previous = /** @type {string | null} */ (null);
  /** @param {string} token */
  const write = (token) => {
    // A leading "-" is self-delimiting, so the separator can go. Everything else needs one.
    if (previous !== null && !token.startsWith("-")) out += " ";
    out += token;
    previous = token;
  };
  /** @param {string} letter */
  const command = (letter) => {
    out += letter;
    previous = null;
  };

  let cursorX = 0;
  let cursorY = 0;
  let first = true;

  for (const points of subpaths) {
    if (points.length === 0) continue;
    const [startX, startY] = points[0];
    const sx = q(startX);
    const sy = q(startY);
    if (first) {
      command("M");
      write(formatUnits(sx, scale, decimals));
      write(formatUnits(sy, scale, decimals));
      first = false;
    } else {
      command("m");
      write(formatUnits(sx - cursorX, scale, decimals));
      write(formatUnits(sy - cursorY, scale, decimals));
    }
    cursorX = sx;
    cursorY = sy;

    let open = false; // has the `l` run been started for this subpath?
    for (let i = 1; i < points.length; i++) {
      const nx = q(points[i][0]);
      const ny = q(points[i][1]);
      const dx = nx - cursorX;
      const dy = ny - cursorY;
      if (dx === 0 && dy === 0) continue;
      if (!open) {
        command("l");
        open = true;
      }
      write(formatUnits(dx, scale, decimals));
      write(formatUnits(dy, scale, decimals));
      cursorX = nx;
      cursorY = ny;
    }

    command("Z");
    // `Z` returns the cursor to the subpath's start point (SVG 1.1 §8.3.1), so the next
    // subpath's `m` must be measured from THERE, not from the last vertex drawn.
    cursorX = sx;
    cursorY = sy;
  }

  return out;
}
