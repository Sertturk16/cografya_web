// @ts-check
/**
 * Windowed reader for the JRC Global Surface Water (GSW) v1.5 GeoTIFF granules.
 *
 * The geographic half of the P7 raster step (plan §4.1 steps 1–5). It turns a lon/lat box
 * into a binary water mask that `jrc-morphology.mjs` can work on, and it is the ONLY place
 * that knows about granule tiling, scanline decoding and GSW value coding.
 *
 * ## Why a dependency and not a hand-written TIFF reader (→ DEC 2026-08-03c, Q1 = a)
 *
 * A GSW granule is 40 000 × 40 000 uint8, LZW-compressed, stored one scanline per strip.
 * Hand-rolling that decoder is ~300 lines of bit-twiddling whose failure mode is not a
 * crash but a PLAUSIBLE BUT WRONG lake — the exact defect class this wave exists to
 * remove. `geotiff` is a devDependency: CI installs it and never runs it, because the
 * raster step is manual and needs 505 MB of input that is never committed.
 *
 * ## Memory
 *
 * A granule is 1,6 Gpx; it is never held in RAM. `readRasters({ window })` decodes only
 * the strips the window touches, so cost scales with the window (measured: a 100 × 100 px
 * window from a cold handle decodes in ~40 ms). Windows that straddle granule boundaries
 * are mosaicked here rather than by the caller.
 *
 * ## Value coding (Data Users Guide v2024_v.5, quoted in the P7 NOVA brief §B.1)
 *
 * - `occurrence`: 0–100 (% of observations that were water), **255 = no data**;
 * - `extent`: 1 = water observed at least once, **255 = no data**.
 *
 * Thresholding is always `>= T`, NEVER `== 100`: `occurrence_40E_40N` contains a single
 * undocumented pixel valued 101 (brief §B.1 note 3 / errata E7). `255` is excluded FIRST,
 * so "no data" can never be counted as water by a high threshold.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fromFile } from "geotiff";

/** Pixel size in degrees (≈ 30 m at the equator). */
export const PIXEL_SIZE_DEG = 0.00025;
/** Granule edge length in degrees. */
export const GRANULE_SPAN_DEG = 10;
/** Granule edge length in pixels (`GRANULE_SPAN_DEG / PIXEL_SIZE_DEG`). */
export const GRANULE_PX = 40000;
/** GSW "no data" code — shared by every layer. */
export const NO_DATA = 255;
/** Tolerance when checking a granule's declared origin against its nominal one, in degrees. */
const ORIGIN_TOLERANCE_DEG = 1e-6;

/** @typedef {{ minLon: number, minLat: number, maxLon: number, maxLat: number }} LonLatBox */
/**
 * @typedef {object} RasterWindow
 * @property {Uint8Array} values Row-major raw layer values; `255` where no granule covered.
 * @property {number} width
 * @property {number} height
 * @property {number} originLon Longitude of the window's LEFT edge (corner, not centre).
 * @property {number} originLat Latitude of the window's TOP edge (corner, not centre).
 * @property {number} pixelSizeDeg
 * @property {string[]} granules Granule keys actually read, in read order.
 */

/** Open granule handles, keyed by absolute path — a granule is opened at most once per run. */
const openImages = new Map();

/**
 * Granule key such as `30E_40N`, from the granule's WEST longitude and NORTH latitude.
 *
 * @param {number} lonWest
 * @param {number} latNorth
 */
export function granuleKey(lonWest, latNorth) {
  const lon = `${Math.abs(lonWest)}${lonWest < 0 ? "W" : "E"}`;
  const lat = `${Math.abs(latNorth)}${latNorth < 0 ? "S" : "N"}`;
  return `${lon}_${lat}`;
}

/**
 * Granule file name for a layer and key, e.g. `occurrence_30E_40N_v1_5_2024.tif`. The same
 * string is the tail of the download URL, so the fetch step and the read step cannot drift
 * apart.
 *
 * @param {string} layer `occurrence` | `extent` | …
 * @param {string} key
 */
export function granuleFileName(layer, key) {
  return `${layer}_${key}_v1_5_2024.tif`;
}

/**
 * Global pixel grid indices. The GSW grid is the whole planet at `PIXEL_SIZE_DEG`, with
 * column 0 starting at lon −180 and row 0 starting at lat +90, so a granule is just an
 * aligned 40 000 × 40 000 block of it. Working in global indices keeps granule seams exact
 * — deriving them from each file's float origin (which reads back as 30.000000000000142)
 * would eventually be off by a pixel.
 *
 * @param {number} lon
 */
function globalColumn(lon) {
  return (lon + 180) / PIXEL_SIZE_DEG;
}

/** @param {number} lat */
function globalRow(lat) {
  return (90 - lat) / PIXEL_SIZE_DEG;
}

/**
 * Snap a lon/lat box outward onto the global pixel grid.
 *
 * @param {LonLatBox} box
 * @returns {{ gx0: number, gy0: number, width: number, height: number, originLon: number, originLat: number }}
 */
export function pixelWindowForBox(box) {
  if (!(box.minLon < box.maxLon) || !(box.minLat < box.maxLat)) {
    throw new Error(
      `pixelWindowForBox: degenerate box ${JSON.stringify(box)} — min must be strictly below max.`,
    );
  }
  const gx0 = Math.floor(globalColumn(box.minLon));
  const gx1 = Math.ceil(globalColumn(box.maxLon)); // exclusive
  const gy0 = Math.floor(globalRow(box.maxLat));
  const gy1 = Math.ceil(globalRow(box.minLat)); // exclusive
  return {
    gx0,
    gy0,
    width: gx1 - gx0,
    height: gy1 - gy0,
    originLon: -180 + gx0 * PIXEL_SIZE_DEG,
    originLat: 90 - gy0 * PIXEL_SIZE_DEG,
  };
}

/**
 * Longitude/latitude of a CORNER coordinate as returned by `traceRings` — corner `(0, 0)`
 * is the top-left of the window's first pixel, so the mapping is exact, not centre-shifted.
 *
 * @param {{ originLon: number, originLat: number, pixelSizeDeg: number }} window
 * @param {number} cx
 * @param {number} cy
 * @returns {[number, number]} `[lon, lat]`
 */
export function cornerToLonLat(window, cx, cy) {
  return [window.originLon + cx * window.pixelSizeDeg, window.originLat - cy * window.pixelSizeDeg];
}

/**
 * @param {string} cacheDir
 * @param {string} layer
 * @param {string} key
 */
async function getImage(cacheDir, layer, key) {
  const path = join(cacheDir, granuleFileName(layer, key));
  const cached = openImages.get(path);
  if (cached) return cached;
  if (!existsSync(path)) {
    throw new Error(
      `Missing GSW granule ${path}. Download it into the cache first — this step never ` +
        `fetches implicitly, because a silently absent granule reads back as a lake with a ` +
        `straight edge.`,
    );
  }
  const tiff = await fromFile(path);
  const image = await tiff.getImage();
  if (image.getWidth() !== GRANULE_PX || image.getHeight() !== GRANULE_PX) {
    throw new Error(
      `${path}: expected ${GRANULE_PX}² pixels, got ${image.getWidth()}×${image.getHeight()}.`,
    );
  }
  const [originLon, originLat] = image.getOrigin();
  const nominalLon =
    -180 + Math.floor(globalColumn(originLon ?? 0) / GRANULE_PX) * GRANULE_SPAN_DEG;
  const nominalLat = 90 - Math.floor(globalRow(originLat ?? 0) / GRANULE_PX) * GRANULE_SPAN_DEG;
  if (granuleKey(nominalLon, nominalLat) !== key) {
    throw new Error(
      `${path}: georeference says ${granuleKey(nominalLon, nominalLat)} but the file name ` +
        `says ${key}. Refusing to read a mislabelled granule.`,
    );
  }
  if (
    Math.abs((originLon ?? 0) - nominalLon) > ORIGIN_TOLERANCE_DEG ||
    Math.abs((originLat ?? 0) - nominalLat) > ORIGIN_TOLERANCE_DEG
  ) {
    throw new Error(`${path}: origin ${originLon}, ${originLat} is off its nominal corner.`);
  }
  const resolution = image.getResolution();
  if (
    Math.abs(Math.abs(resolution[0] ?? 0) - PIXEL_SIZE_DEG) > 1e-12 ||
    Math.abs(Math.abs(resolution[1] ?? 0) - PIXEL_SIZE_DEG) > 1e-12
  ) {
    throw new Error(
      `${path}: pixel size ${resolution[0]}, ${resolution[1]} is not ±${PIXEL_SIZE_DEG}.`,
    );
  }
  openImages.set(path, image);
  return image;
}

/**
 * Read one layer over a lon/lat box, mosaicking across granules.
 *
 * Pixels no granule covered stay `NO_DATA`; that cannot happen for a box inside the six
 * Türkiye granules, and a missing FILE throws rather than leaving a hole.
 *
 * @param {{ cacheDir: string, layer: string, box: LonLatBox }} options
 * @returns {Promise<RasterWindow>}
 */
export async function readWindow({ cacheDir, layer, box }) {
  const { gx0, gy0, width, height, originLon, originLat } = pixelWindowForBox(box);
  const values = new Uint8Array(width * height).fill(NO_DATA);
  /** @type {string[]} */
  const granules = [];

  const colFirst = Math.floor(gx0 / GRANULE_PX);
  const colLast = Math.floor((gx0 + width - 1) / GRANULE_PX);
  const rowFirst = Math.floor(gy0 / GRANULE_PX);
  const rowLast = Math.floor((gy0 + height - 1) / GRANULE_PX);

  for (let row = rowFirst; row <= rowLast; row++) {
    for (let col = colFirst; col <= colLast; col++) {
      const lonWest = -180 + col * GRANULE_SPAN_DEG;
      const latNorth = 90 - row * GRANULE_SPAN_DEG;
      const key = granuleKey(lonWest, latNorth);
      const image = await getImage(cacheDir, layer, key);

      // Overlap of the requested window with this granule, in global indices.
      const gLeft = col * GRANULE_PX;
      const gTop = row * GRANULE_PX;
      const left = Math.max(gx0, gLeft);
      const right = Math.min(gx0 + width, gLeft + GRANULE_PX); // exclusive
      const top = Math.max(gy0, gTop);
      const bottom = Math.min(gy0 + height, gTop + GRANULE_PX); // exclusive
      if (left >= right || top >= bottom) continue;

      const rasters = await image.readRasters({
        window: [left - gLeft, top - gTop, right - gLeft, bottom - gTop],
        samples: [0],
        interleave: false,
      });
      const band = Array.isArray(rasters) ? rasters[0] : rasters;
      if (!band || typeof band === "number") {
        throw new Error(`${key}: readRasters returned no band for layer ${layer}.`);
      }
      const sliceWidth = right - left;
      for (let y = top; y < bottom; y++) {
        const source = (y - top) * sliceWidth;
        const target = (y - gy0) * width + (left - gx0);
        for (let x = 0; x < sliceWidth; x++) {
          values[target + x] = Number(band[source + x] ?? NO_DATA);
        }
      }
      granules.push(key);
    }
  }

  return { values, width, height, originLon, originLat, pixelSizeDeg: PIXEL_SIZE_DEG, granules };
}

/**
 * Read a layer and threshold it into a binary water mask.
 *
 * `255` (no data) is removed BEFORE the comparison, so it is never counted as water no
 * matter how the threshold is set. The comparison is `>= minValue`; see the module header
 * for why `== 100` is forbidden.
 *
 * @param {{ cacheDir: string, layer: string, box: LonLatBox, minValue: number }} options
 * @returns {Promise<{ mask: { width: number, height: number, data: Uint8Array }, window: RasterWindow, noDataPixels: number, waterPixels: number }>}
 */
export async function readMask({ cacheDir, layer, box, minValue }) {
  if (!Number.isFinite(minValue) || minValue < 1) {
    throw new Error(
      `readMask: minValue must be ≥ 1 (got ${minValue}); 0 would make every dry pixel water.`,
    );
  }
  const window = await readWindow({ cacheDir, layer, box });
  const data = new Uint8Array(window.values.length);
  let noDataPixels = 0;
  let waterPixels = 0;
  for (let i = 0; i < window.values.length; i++) {
    const value = window.values[i] ?? NO_DATA;
    if (value === NO_DATA) {
      noDataPixels++;
      continue;
    }
    if (value >= minValue) {
      data[i] = 1;
      waterPixels++;
    }
  }
  return {
    mask: { width: window.width, height: window.height, data },
    window,
    noDataPixels,
    waterPixels,
  };
}

/**
 * `occurrence >= thresholdPercent` water mask.
 *
 * @param {{ cacheDir: string, box: LonLatBox, thresholdPercent: number }} options
 */
export function readOccurrenceMask({ cacheDir, box, thresholdPercent }) {
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 1 || thresholdPercent > 100) {
    throw new Error(`readOccurrenceMask: threshold must be 1..100 %, got ${thresholdPercent}`);
  }
  return readMask({ cacheDir, layer: "occurrence", box, minValue: thresholdPercent });
}

/**
 * Maximum-extent mask (`extent == 1`). Used as the cross-check envelope in P7 plan §4.1
 * step 10: an occurrence-derived body that escapes this envelope means the pipeline
 * invented water.
 *
 * @param {{ cacheDir: string, box: LonLatBox }} options
 */
export function readExtentMask({ cacheDir, box }) {
  return readMask({ cacheDir, layer: "extent", box, minValue: 1 });
}

/** Release every cached granule handle (closes the underlying file descriptors). */
export async function closeGranules() {
  for (const image of openImages.values()) {
    const source = image?.source;
    if (source && typeof source.close === "function") await source.close();
  }
  openImages.clear();
}
