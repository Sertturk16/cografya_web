// @ts-check
/**
 * MANUAL, NETWORK step: derive `data/tr-inland-water-jrc.geojson` from the JRC Global
 * Surface Water (GSW) v1.5 rasters.
 *
 * Run by hand — `node scripts/fetch-tr-jrc-water.mjs` — and COMMIT the result. Exactly the
 * contract `scripts/fetch-tr-inland-water.mjs` (the OSM side) already carries, and for the
 * same reasons: it is deliberately NOT a `package.json` script, CI must never reach the
 * network, and nobody should run it by tab-completing `pnpm generate:`. The offline half of
 * the pipeline is `scripts/generate-tr-inland-water.mjs`, which reads BOTH data files and
 * emits the single committed artifact.
 *
 * ## Why a script instead of a README paragraph
 *
 * The recipe is the provenance. A paragraph can drift from what was actually run; an
 * executable cannot. Here that is not a preference but a requirement: the parameters
 * interact strongly and the output is very sensitive to them. Measured on Tuz Gölü with THIS
 * pipeline, same body, same layer, only the closing radius changed: 300 m → 1 292.6 km²,
 * 450 m → 1 341.8, 600 m → 1 374.9. A number that moves 6 % on one constant has to live in
 * code, next to the reason.
 *
 * ## What this file is NOT allowed to do (licence separation, → DEC 2026-08-01r-1)
 *
 * The output is a SECOND, SEPARATELY LICENSED data file. It is never merged with the ODbL
 * OSM snapshot, and it never copies a field out of it: the names and Wikidata QIDs in the
 * registry below are typed by hand (a lake's name is common knowledge, QIDs are CC0), the
 * identity boxes are pinned by measurement, and the geometry comes from the raster. Merging the
 * two databases would pull the combined derivative under ODbL's share-alike; rendering both
 * into one SVG is a *produced work* and does not. The structural half of that rule is
 * asserted in `lib/map/tr-inland-water-jrc.test.ts`.
 *
 * ## The recipe, end to end
 *
 * ```
 * granule (cached, SHA-256 pinned)
 *   → window read                       jrc-raster.mjs
 *   → threshold occurrence >= 10 %      ← never `== 100`; 255 (no data) removed first
 *   → 4-connected component labelling
 *   → IDENTITY TEST from the registry   ← the one step that needs a human
 *   → morphological closing, r = 300 m  ← bridges the dry salt-crust seams
 *   → interior hole filling             ← a dried lake bed is part of the lake
 *   → `extent` cross-check              ← catches a plausible-but-wrong raster decode
 *   → boundary tracing (marching squares)
 *   → Douglas–Peucker at 0.05 svg units ← the OSM snapshot's own SNAPSHOT_EPSILON
 *   → data/tr-inland-water-jrc.geojson
 * ```
 *
 * The RING CULL is not here: which rings are big enough to draw is a drawing decision and
 * belongs to the generator (`MIN_RING_AREA_UNITS2`), exactly like `MIN_AREA_KM2`. This file
 * is the faithful record of what the recipe produced.
 */
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  closeGranules,
  cornerToLonLat,
  granuleFileName,
  readExtentMask,
  readOccurrenceMask,
} from "./lib/jrc-raster.mjs";
import {
  closeMask,
  countSet,
  fillInteriorHoles,
  labelComponents,
  maskFromLabels,
  ringSignedArea,
  selectBodyComponents,
  touchesBorder,
  traceRings,
} from "./lib/jrc-morphology.mjs";
import { projectToFrame } from "./lib/tr-frame.mjs";
import { measureRingAreaKm2, simplifyRing } from "./lib/water-geometry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE_DIR = join(ROOT, ".jrc-cache");
const OUT = process.env.JRC_OUT ?? join(ROOT, "data", "tr-inland-water-jrc.geojson");

// --- Pinned recipe ------------------------------------------------------------------

/** Dataset edition. Part of the citation, and the reason the granule checksums are pinned. */
const GSW_VERSION = "v1.5 (1984–2024)";

/**
 * Occurrence threshold, in per cent of valid observations.
 *
 * **10 %.** The band that lands closest to the published nominal figures for this class is
 * 1–10 % (measured, P7 brief §B.2: Akşehir published ~353 km² ↔ 337 at ≥ 1 %; Eber ~125 ↔
 * 112 at ≥ 5 %). Anything at or above 50 % DESTROYS the seasonal class outright — Eber falls
 * to 9.4 km², Tersakan to 5.1 — which is the same evidence that kept the dams and permanent
 * lakes on OSM (Ilısu: 286.0 → 22.2 km² at ≥ 50 %, → DEC 2026-08-02q §D).
 *
 * The threshold alone is not what hits the target; the TRIPLE (threshold + closing + hole
 * fill) is. Do not retune one of the three in isolation.
 */
const OCCURRENCE_THRESHOLD = readNumberEnv("JRC_OCCURRENCE_THRESHOLD", 10);

/**
 * Morphological closing radius, quoted in NOMINAL metres. **300 m = 10 px.**
 *
 * The ruled values land on whole pixels with no ambiguity (300 / 450 / 600 m = 10 / 15 /
 * 20 px), which is the only reason this one may stay in metres — see `NOMINAL_PIXEL_SIZE_M`
 * for why every other distance in this file is pinned in pixels. On the ground 10 px is
 * ~218 m east-west and ~278 m north-south at these latitudes, not 300 m in both.
 *
 * What it buys: the dry salt-crust seams that split Tuz Gölü into three OSM fragments are
 * bridged, without inflating the shoreline.
 *
 * **What raising it costs — MEASURED with this pipeline, after Hirfanlı was removed from
 * Tuz (→ DEC 2026-08-04d):**
 *
 *   300 m (10 px)   Tuz 1 292.6 km²   −21.3 % against the 1 642 km² ÇŞB reference
 *   450 m (15 px)   Tuz 1 341.8 km²   −18.3 %
 *   600 m (20 px)   Tuz 1 374.9 km²   −16.3 %
 *
 * **The radius does not close that gap** — even at 600 m the body is 16 % under the
 * reference, so this constant is not the lever anyone should reach for to chase it. Earlier
 * revisions of this docblock claimed "600 m → ~2 105 km² (+25 %), well past the reference";
 * that figure predates the Hirfanlı correction and is withdrawn.
 *
 * **Reach is up to 2 × this radius, not this radius** — dilation grows both banks of a seam.
 * At 10 px the bridging ceiling is therefore 20 px. That correction is documented on
 * `closeMask()` and pinned by `lib/map/jrc-morphology.test.ts`; the P7 plan's §11 T1 prose
 * said otherwise and was wrong. The physical parameter is unchanged.
 */
const CLOSING_RADIUS_M = readNumberEnv("JRC_CLOSING_RADIUS_M", 300);

/**
 * Fill background regions fully enclosed by water.
 *
 * A dried lake bed is part of the lake: at 30 m the interior of a salt pan is a lace of
 * "never observed as water" pixels, and leaving them out would draw Tuz Gölü as a doily.
 * A bay that opens to the coast is NOT filled — see `fillInteriorHoles`.
 */
const FILL_INTERIOR_HOLES = true;

/**
 * Douglas–Peucker tolerance for this snapshot, in svg units of the pinned TR frame.
 *
 * **0.05 — the identical value the OSM snapshot uses** (`SNAPSHOT_EPSILON` in
 * `fetch-tr-inland-water.mjs`), so both data files arrive at the generator at the same
 * fidelity and neither is privileged. It is 2.4×–10× finer than any tolerance the generator
 * then applies, so this reduction is invisible at drawing resolution.
 */
const SNAPSHOT_EPSILON_UNITS = readNumberEnv("JRC_SNAPSHOT_EPSILON", 0.05);

/** Grid pitch, degrees. Mirrors `PIXEL_SIZE_DEG`. */
const PIXEL_SIZE_DEG = 0.00025;

/**
 * NOMINAL ground size of one pixel, metres — the "30 m" in "GSW is a 30 m product".
 *
 * **It is nominal, not true, and the difference matters.** GSW's grid is 0.00025° of ARC,
 * not 30 m of ground. A pixel is `0.00025 × 111 195 ≈ 27.8 m` north-south everywhere, and
 * `27.8 × cos(lat)` east-west — **21.8 m at Türkiye's lake latitudes**. So a structuring
 * element of `r` pixels covers `r × 21.8 m` east-west and `r × 27.8 m` north-south: on the
 * ground it is an ELLIPSE, and quoting it as "r × 30 m" overstates it by up to 27 %.
 *
 * This module therefore works in PIXELS and says so (see `IDENTITY_NEIGHBOUR_PX` and
 * `CLOSING_RADIUS_PX`); metres appear only as reported ground footprints, computed per
 * window latitude by `pixelGroundSizeM()`. → DEC 2026-08-04g §2.
 *
 * The alternative — an axis-true metric, i.e. a weighted distance transform so that a
 * "300 m" radius really is 300 m on both axes — is deliberately NOT taken here: it would
 * change the geometry of all nine bodies and invalidate the closing-radius frames the owner
 * is about to rule on. It stays available as a follow-up if ground-true radii are ever
 * wanted; what is not acceptable is a docblock that claims a precision the code lacks.
 */
const NOMINAL_PIXEL_SIZE_M = 30;

/**
 * How the identity test turns raster components into a body.
 *
 * - `with-fragments` — the main body PLUS every component within `IDENTITY_NEIGHBOUR_PX` of it.
 * - `main-only`      — the main body alone.
 *
 * **This is a PRODUCT decision, not an engineering one, and it is not settled here.** The
 * two rules do not differ in accuracy, they differ in what a lake IS: whether a salt lake's
 * detached seasonal pans, a kilometre or two off the main pan and dry most years, are part of
 * "the lake" on a school map. Both are defensible cartography.
 *
 * Most of the difference never reaches the map — the generator's ring cull removes everything
 * under ~0.985 km² — so what the owner actually judges is the handful of satellite pans that
 * survive the cull. The owner picks a PICTURE, not a parameter (→ DEC 2026-08-02q §C), so
 * both are rendered for the sample gate and this constant carries the default they are judged
 * against.
 *
 * (Earlier names: `all-touching-seed` / `largest-only`. Renamed with the selection rule
 * itself — "every component touching the seed box" is no longer what the first one does, and
 * a constant whose name describes the superseded behaviour is worse than no constant.)
 */
const COMPONENT_RULE = readEnumEnv("JRC_COMPONENT_RULE", ["with-fragments", "main-only"]);

/**
 * How far from the main body a detached component may sit and still be the same lake,
 * **in pixels**.
 *
 * **67 px — the ruled 2 km (ATLAS, → DEC 2026-08-04d) expressed in the unit the algorithm
 * actually works in.** At Türkiye's lake latitudes that footprint is ~1 460 m east-west and
 * ~1 860 m north-south, NOT 2 000 m in both directions; the ruling's intent (separate Tuz
 * Gölü from Hirfanlı Baraj Gölü, measured 8.63 km apart) survives that with a 4× margin.
 *
 * ## Why pixels and not metres (→ DEC 2026-08-04g §2)
 *
 * This constant was `2000` metres and each registry entry could override it in metres. That
 * unit is a lie the code cannot honour: `Math.round(m / 30)` makes every value from 135 m to
 * 164 m the same structuring element, and the true ground footprint is anisotropic anyway.
 * The lie had a consequence — a documented "150 m keeps Yay Gölü and Çöl Gölü apart" was in
 * fact 5 px, and 5 px MERGES them. Pinning the integer the algorithm consumes removes the
 * class: there is nothing left to round.
 *
 * ## Why a distance at all, and why it is not transitive
 *
 * Tuz and Hirfanlı overlap in BOTH latitude and longitude, so no rectangle can separate
 * them — selection had to stop being geography-by-rectangle and become identity. Everything
 * is measured from the MAIN body only, never chained, so a line of pans cannot walk the
 * selection across the countryside one hop at a time.
 *
 * ## A registry entry may lower it, and one does
 *
 * Measured with this pipeline at the pinned threshold, sweeping ONE PIXEL AT A TIME:
 *
 *   Tuz Gölü   own eastern strip (112 km²) joins at **35 px**
 *              Hirfanlı (250 km²) and Tersakan still OUT at 80 px — the default clears both
 *   Yay Gölü   Çöl Gölü (25.9 km²) joins at **5 px**, stays separate at **4 px**
 *
 * So no single radius serves both: Tuz needs ≥ 35 px to keep its own arm, and 5 px merges
 * two separately named lakes at Sultan Sazlığı. 67 px is the ruled default and the eight
 * bodies it fits; the ninth says so out loud instead of quietly moving everyone's constant.
 *
 * Every figure above is a ONE-PIXEL sweep, not a sampled ladder. The 210 m that stood here
 * before was a rung of a coarse [3, 7, 17, 34, 50, 67] px probe reported as if it were a
 * measurement, and it is what let the Yay/Çöl merge through (→ DEC 2026-08-04g).
 */
const IDENTITY_NEIGHBOUR_PX = readNumberEnv("JRC_IDENTITY_NEIGHBOUR_PX", 67);

/**
 * When `JRC_IDENTITY_NEIGHBOUR_PX` is set EXPLICITLY it also overrides the per-body values,
 * so a single run can render "what would this class look like at one reach" for the owner.
 * Unset in CI and in the committed run, where each body's own pin governs.
 */
const NEIGHBOUR_PX_FORCED = (process.env.JRC_IDENTITY_NEIGHBOUR_PX ?? "") !== "";

// --- Granules -----------------------------------------------------------------------

/** GSW download root. The layer and file name are appended; see `granuleFileName`. */
const DOWNLOAD_ROOT = "https://storage.googleapis.com/water-world/download2024/VER1-5";

/**
 * The six granules that tile Türkiye's bounding box (lon 25.7–44.9 / lat 35.8–42.1), for
 * both layers this recipe reads. **505.0 MB total (481.6 MiB), one-time.**
 *
 * The SHA-256 of every granule is PINNED here, not merely recorded in the cache: the
 * download URL has no version in its path beyond `VER1-5`, so a silent republication would
 * otherwise change our lakes with nothing in the diff. A mismatch throws. The same digests
 * are copied into the output's `metadata`, so a reader can tell which bytes produced the
 * geometry without owning the 505 MB.
 *
 * Only the two `*_40N` granules are actually touched by today's nine bodies; the set is
 * pinned for the whole country because that is the download the recipe describes, and a
 * tenth body north of 40°N must not silently read an unverified file.
 */
const GRANULES = {
  occurrence_20E_40N: {
    bytes: 75147916,
    sha256: "0c1bc09f08317d9b893a6858e0fc9a26628fed322c0eb97b0ab0d1b04924f937",
  },
  occurrence_30E_40N: {
    bytes: 47164728,
    sha256: "dc41507f8e22a9d36da5793f9f9ff9ceba222ff8abe7d618b37e03c93d62f9df",
  },
  occurrence_40E_40N: {
    bytes: 64804658,
    sha256: "30db9dbcae93d6b297b87584aa358729d0aef4a43ec5bd298fbf2e5810333e50",
  },
  occurrence_20E_50N: {
    bytes: 48496064,
    sha256: "6a1163a9563219c3d147f6e7f1cf274b9e64cddf45465b6ef6dc4f15a7c3b83b",
  },
  occurrence_30E_50N: {
    bytes: 60514280,
    sha256: "f128ac90c5698a48c19df7cf29141a0294d38bdfeb534b602525d8c5b62e0f25",
  },
  occurrence_40E_50N: {
    bytes: 94913980,
    sha256: "725266cdc5058b7c9de80834cd4506c0f110d69c93b9ff72373e2fdea5241975",
  },
  extent_20E_40N: {
    bytes: 15647932,
    sha256: "de73cd84bf3e330063dd61d9e96915848e904db976d7f3bf1879e228bb00ff37",
  },
  extent_30E_40N: {
    bytes: 17016654,
    sha256: "e9c4efc9d4bccf2a7e753d4eeea25e2f35d2ac575a5276e33b28e2410072b7dc",
  },
  extent_40E_40N: {
    bytes: 22138790,
    sha256: "ce9f8c1cffd21ee687bbe29d5be61a379e86a36f1155484781b0f5c179ed1d61",
  },
  extent_20E_50N: {
    bytes: 18546944,
    sha256: "67c7285fc41719b578fd677b620483f5d205c18bccd7c41b427af47a2ade7f2c",
  },
  extent_30E_50N: {
    bytes: 18040066,
    sha256: "b252ee4abab6aadc7f72ff9544052d5f8cdc9971cb68317e7a0b32e10d5dbe18",
  },
  extent_40E_50N: {
    bytes: 22610010,
    sha256: "7e3be46611a8aac49213ddc966e9837814d6c129925a7fda41affe7de2eac5bc",
  },
};

// --- The registry -------------------------------------------------------------------

/**
 * The nine bodies whose geometry comes from GSW, hand-curated (→ DEC 2026-08-02q §D + §G).
 *
 * ## The identity test (→ DEC 2026-08-04d), and why it replaced the seed box
 *
 * A window is read wide, thresholded, and split into 4-connected components — thousands of
 * them, because a salt-flat plain at 30 m is speckled with ephemeral pans. Deciding which of
 * those components ARE the lake was originally "every component touching a hand-pinned seed
 * box". That rule drew Hirfanlı Baraj Gölü as part of Tuz Gölü: the reservoir's own
 * 264.4 km² component reaches into any box wide enough to hold Tuz, because the two overlap
 * in BOTH latitude and longitude. No rectangle can separate them.
 *
 * So selection is now an identity question with two parts:
 *
 * 1. **`identity`** — a small box pinned in the CORE of the body, and the component covering
 *    it is the main body. Each one sits at the deepest interior point of its own component
 *    (measured: the shallowest of the nine is 1.65 km of clearance, the box half-width is
 *    under 450 m), so it survives a threshold change rather than falling on a dry pixel.
 * 2. **`IDENTITY_NEIGHBOUR_PX`** — components within that many pixels of the main body join
 *    it; anything further away is a different lake, whatever box it happens to fall in.
 *
 * NOVA proposed using our OSM polygon for Tuz as the identity filter. This build does NOT:
 * the JRC file must not be a derivative of the ODbL database, and "we only used it to choose
 * which pixels to keep" is exactly the argument the separation exists to avoid having to make
 * (→ DEC 2026-08-01r-1, asserted by `lib/map/tr-inland-water-jrc.test.ts`). A hand-typed core
 * box is an assertion of identity by a human, which is what the ruling asked for, and it
 * carries no licence at all.
 *
 * ## The window is still WIDE, and that is not an oversight
 *
 * Narrowing the window to solve a selection problem produces a CLIPPING defect instead:
 * outside the window is dry, so closing shaves any body that reaches the edge. Measured
 * during the Tuz smoke run, a window whose east edge was one pixel clear of the water still
 * cut ~9 km² off a lobe while a zero-margin `touchesBorder` check stayed silent. Every window
 * below is therefore at least 2 × the closing radius clear of its finished body, and the run
 * asserts it. Window = "where to look"; identity = "what counts".
 *
 * ## `expectedKm2` is a REPORT LINE, not a test
 *
 * It is the P7 brief's independently measured figure. The script prints its own measurement
 * next to it with the deviation, and never compares them against a threshold: a fact literal
 * does not belong in an assertion (team rule), and a lake that legitimately changes must not
 * turn a pipeline red. A human reads the column.
 *
 * @type {{ id: string, name: string, wikidata: string | null,
 *   identity: { minLon: number, maxLon: number, minLat: number, maxLat: number },
 *   window: { minLon: number, maxLon: number, minLat: number, maxLat: number },
 *   neighbourPx?: number, expectedKm2: number, note: string }[]}
 */
const REGISTRY = [
  {
    id: "gsw-01",
    name: "Tuz Gölü",
    wikidata: "Q211823",
    // Main body measured at 1 037-1 042 km² / lon 33.0967-33.5452 / lat 38.4335-39.1295; the
    // core box below sits >12 km inside it. Its own eastern seasonal strip (111.7 km²,
    // lon 33.5222-33.6697) is adjacent and joins through the 2 km rule and the closing.
    //
    // WHAT IS DELIBERATELY NOT HERE: the 264.4 km² component to the north-east
    // (lon 33.4502-34.1025, lat 39.0035-39.2728). It is **Hirfanlı Baraj Gölü** plus the
    // upstream Kızılırmak channel, not Tuz Gölü — established four independent ways and ruled
    // by Atlas (→ DEC 2026-08-04d): it is a separate component 8.63 km away at this threshold,
    // 99.2 % of the OSM Hirfanlı polygon falls inside it, DSİ's official 263.00 km² matches it
    // to 0.5 %, and 73 % of its pixels are occurrence ≥ 90 % (a permanent reservoir) where Tuz
    // has none at all. Drawing it here would put the same reservoir on the map twice, since
    // Hirfanlı is already drawn from OSM as `r1028112` — and it would break the hybrid ruling
    // that dams stay on OSM (→ DEC 2026-08-02q §D).
    //
    // The 2 km rule is what keeps it out, not a box: Tuz and Hirfanlı overlap in both latitude
    // and longitude, so no rectangle separates them.
    identity: { minLon: 33.352, maxLon: 33.36, minLat: 38.741, maxLat: 38.749 },
    // Deliberately far wider than the body: the window must see the neighbours in order to
    // reject them, and narrowing it to "solve" selection is what produces a clipped lobe.
    window: { minLon: 33.0, maxLon: 34.2, minLat: 38.33, maxLat: 39.37 },
    // NOVA's lobe-free re-measurement at r = 300 m. The earlier 1 679.6 counted Hirfanlı as
    // Tuz and is withdrawn (→ DEC 2026-08-04d).
    expectedKm2: 1478.3,
    note: "reference figure 1 642 km² (ÇŞB spring maximum) — see the closing-radius note",
  },
  {
    id: "gsw-02",
    name: "Akşehir Gölü",
    wikidata: "Q617319",
    // 190.4 km² / lon 31.2992–31.5005 / lat 38.4342–38.5977. West edge 31.30 clears Eber,
    // whose own water stops at 31.2607 — the two share a basin and are one lake in wet years.
    identity: { minLon: 31.408, maxLon: 31.416, minLat: 38.495, maxLat: 38.503 },
    window: { minLon: 31.24, maxLon: 31.57, minLat: 38.38, maxLat: 38.66 },
    expectedKm2: 193.2,
    note: "",
  },
  {
    id: "gsw-03",
    name: "Eber Gölü",
    wikidata: "Q1284379",
    // 91.9 km² / lon 31.0760–31.2607 / lat 38.6062–38.7127.
    identity: { minLon: 31.217, maxLon: 31.225, minLat: 38.64, maxLat: 38.648 },
    window: { minLon: 31.01, maxLon: 31.33, minLat: 38.54, maxLat: 38.78 },
    expectedKm2: 104.0,
    note: "",
  },
  {
    id: "gsw-04",
    name: "Tersakan Gölü",
    wikidata: "Q6161851",
    // 40.6 km² / lon 33.0198–33.1215 / lat 38.5515–38.6482. SHRINKS against today's OSM
    // outline (51.3 km²) — GSW is not a magnifying glass, it is a 41-year statistic.
    identity: { minLon: 33.081, maxLon: 33.089, minLat: 38.581, maxLat: 38.589 },
    window: { minLon: 32.96, maxLon: 33.19, minLat: 38.49, maxLat: 38.71 },
    expectedKm2: 50.7,
    note: "shrinks vs OSM",
  },
  {
    id: "gsw-05",
    name: "Marmara Gölü",
    wikidata: "Q1093090",
    // 59.4 km² / lon 27.9343–28.0908 / lat 38.5910–38.6590.
    identity: { minLon: 28.041, maxLon: 28.049, minLat: 38.616, maxLat: 38.624 },
    window: { minLon: 27.87, maxLon: 28.16, minLat: 38.53, maxLat: 38.73 },
    expectedKm2: 61.1,
    note: "",
  },
  {
    id: "gsw-06",
    name: "Karamık Gölü",
    wikidata: "Q6151136",
    // 34.0 km² / lon 30.7800–30.8900 / lat 38.3945–38.4700. SHRINKS against OSM (40.0) and
    // stays just above the 30 km² drawing rung — the one body in this wave where the recipe
    // and the rung are within a few km² of each other.
    identity: { minLon: 30.838, maxLon: 30.846, minLat: 38.428, maxLat: 38.436 },
    window: { minLon: 30.71, maxLon: 30.96, minLat: 38.33, maxLat: 38.54 },
    expectedKm2: 37.2,
    note: "shrinks vs OSM; just above the rung",
  },
  {
    id: "gsw-07",
    name: "Seyfe Gölü",
    wikidata: "Q3383191",
    // 48.7 km² / lon 34.3548–34.4935 / lat 39.1635–39.2578. A Ramsar site that today's map
    // does not draw at all: the OSM outline is 21.8 km², below the 30 km² rung.
    identity: { minLon: 34.381, maxLon: 34.389, minLat: 39.206, maxLat: 39.214 },
    window: { minLon: 34.29, maxLon: 34.56, minLat: 39.1, maxLat: 39.32 },
    expectedKm2: 54.1,
    note: "Ramsar; newly drawn",
  },
  {
    id: "gsw-08",
    name: "Acıgöl",
    wikidata: "Q2820091",
    // 134.9 km² / lon 29.7085–29.9725 / lat 37.7762–37.8912. **The 134.9 ↔ ~41.5 km²
    // discrepancy (P7 brief errata E1) is OPEN and is an owner call at the sample gate**: the
    // interior of our OSM polygon averages occurrence 99, i.e. that 18.6 km² is a permanent
    // core (probably the sodium-sulphate works), while GSW's basin is three times the
    // published figure. If the owner rejects the basin the cost is nil — this entry is
    // removed and the OSM core stays below the rung, so nothing is drawn either way.
    // `w19325134` is a DIFFERENT Acıgöl (1.04 km², Konya) and is not touched.
    identity: { minLon: 29.91, maxLon: 29.918, minLat: 37.842, maxLat: 37.85 },
    window: { minLon: 29.64, maxLon: 30.04, minLat: 37.71, maxLat: 37.96 },
    expectedKm2: 147.1,
    note: "E1 discrepancy open — owner decides at the sample gate",
  },
  {
    id: "gsw-09",
    name: "Yay Gölü",
    // Not pinned: the QID for this body was not verified, and half a scheme is worse than
    // none. The artifact key is `gsw-09` either way (→ DEC 2026-08-03c, Q8).
    wikidata: null,
    // 42.6 km² core / lon 35.2282–35.3340 / lat 38.2970–38.3970, plus the satellite pans in
    // the same basin. No OSM counterpart in our snapshot, so nothing is superseded — this is
    // a body the map has never drawn (→ DEC 2026-08-02q §G md. 1, owner-ruled DRAWN).
    // The core box sits in the northern body on purpose: Çöl Gölü, the southern open water of
    // the same Sultan Sazlığı complex (25.9 km², up to lat 38.3147), is a DIFFERENT body. It
    // is ~1.8 km from Yay's main component, so the 2 km rule alone would not separate them —
    // it is excluded because it is its own lake with its own name, and the run's report prints
    // the largest rejected component so that judgement stays visible instead of implicit.
    identity: { minLon: 35.258, maxLon: 35.266, minLat: 38.327, maxLat: 38.335 },
    // Widened after the clearance check caught the first window shaving this body.
    window: { minLon: 35.08, maxLon: 35.52, minLat: 38.16, maxLat: 38.52 },
    // PROVISIONAL, AWAITING A RULING — and the numbers below are a one-pixel sweep, not a
    // sampled ladder (the previous "210 m" here was a probe rung, and it was wrong; the
    // pipeline shipped the two lakes MERGED while this comment claimed they were apart,
    // → DEC 2026-08-04g).
    //
    // Çöl Gölü — the southern open water of the same Sultan Sazlığı complex, measured
    // 25.9 km² — joins this body at **5 px** and stays separate at **4 px**. The ruled 67 px
    // default therefore draws the two separately named lakes as ONE 84.8 km² body.
    //
    // 4 px ships: 45.18 km², one ring, still clear of the 30 km² rung. That is NOT "the main
    // component alone" — at 4 px the body is its main component plus 94 sub-pixel-scale pans
    // hugging its own shore (95 of the window's 1 072 components), which the closing then
    // merges into one outline. Çöl Gölü is the nearest thing it excludes. The conservative
    // choice, not the settled one: drawing two named lakes as one is the defect class
    // DEC 2026-08-04d exists to kill, so the pipeline keeps them apart until someone decides.
    //
    // The decision is NOT engineering: DEC 2026-08-02q §G ruled "Yay Gölü is drawn" from a
    // brief defining Yay as "the open-water core of Sultan Sazlığı", and whether that core is
    // one pan or two is a geography call. Both hands are one integer apart and BOTH are in
    // the sample set (`30-yay-separated` / `30-yay-merged`).
    neighbourPx: 4,
    expectedKm2: 56.3,
    note: "no OSM counterpart; shown to the owner separately",
  },
];

// --- Helpers ------------------------------------------------------------------------

/** @param {string} name @param {number} fallback */
function readNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number, got ${JSON.stringify(raw)}`);
  }
  return value;
}

/** @param {string} name @param {readonly string[]} allowed */
function readEnumEnv(name, allowed) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return allowed[0] ?? "";
  if (!allowed.includes(raw)) {
    throw new Error(`${name} must be one of ${allowed.join(" | ")}, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/**
 * Round to the GSW grid's exact decimal representation.
 *
 * Every coordinate this script emits is a PIXEL CORNER, i.e. an exact multiple of
 * 0.00025°, which needs at most five decimals. `originLon + cx * 0.00025` accumulates
 * binary error (33.450249999999996), so the value is snapped back to the grid's own decimal
 * form. This is a lossless re-spelling of a grid coordinate, not a reduction in precision.
 *
 * @param {number} value
 */
function snapToGrid(value) {
  return Number(value.toFixed(5));
}

/**
 * True ground size of one pixel at a latitude, in metres.
 *
 * @param {number} latDeg
 * @returns {{ ew: number, ns: number }}
 */
function pixelGroundSizeM(latDeg) {
  const ns = PIXEL_SIZE_DEG * 111194.9;
  return { ew: ns * Math.cos((latDeg * Math.PI) / 180), ns };
}

/**
 * Nominal metres → whole pixels, for reading a legacy metre-quoted parameter.
 *
 * **Every use of this rounds**, and rounding is what turned a documented 150 m into the
 * 5-pixel radius that merged two lakes (→ DEC 2026-08-04g): 135 m and 164 m are the SAME
 * structuring element. Parameters whose value sits near a pixel boundary are pinned in
 * pixels instead; this helper survives only for the closing radius, whose ruled values
 * (300 / 450 / 600 m) land exactly on 10 / 15 / 20 px with no ambiguity.
 *
 * @param {number} metres
 */
function nominalMetresToPixels(metres) {
  return Math.round(metres / NOMINAL_PIXEL_SIZE_M);
}

/**
 * Convert a lon/lat box to inclusive pixel bounds inside an already-read window.
 *
 * THROWS rather than clamping when the box is not fully inside the window. A clamped
 * identity box is a registry error wearing a disguise: the caller would silently test a
 * different, smaller region than the one written down, and the body it identifies could
 * change with the window. There is no legitimate reason for a core box — pinned at the
 * deepest interior point of its own body — to hang over the edge of its own window.
 *
 * @param {{ originLon: number, originLat: number, pixelSizeDeg: number, width: number, height: number }} window
 * @param {{ minLon: number, maxLon: number, minLat: number, maxLat: number }} box
 * @param {string} label For the error message.
 * @returns {PixelBoxLocal}
 */
function boxToPixels(window, box, label) {
  const x0 = Math.floor((box.minLon - window.originLon) / window.pixelSizeDeg);
  const x1 = Math.ceil((box.maxLon - window.originLon) / window.pixelSizeDeg) - 1;
  const y0 = Math.floor((window.originLat - box.maxLat) / window.pixelSizeDeg);
  const y1 = Math.ceil((window.originLat - box.minLat) / window.pixelSizeDeg) - 1;
  if (x0 < 0 || y0 < 0 || x1 > window.width - 1 || y1 > window.height - 1 || x0 > x1 || y0 > y1) {
    throw new Error(
      `${label}: the identity box ${JSON.stringify(box)} is not fully inside its window. ` +
        `Clamping it would quietly test a different region than the registry records — ` +
        `widen \`window\` or move \`identity\`.`,
    );
  }
  return { x0, y0, x1, y1 };
}

/** @typedef {{ x0: number, y0: number, x1: number, y1: number }} PixelBoxLocal */

/** @param {string} path */
function sha256OfFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Ensure every pinned granule is present and byte-identical to its pin.
 *
 * Downloads what is missing (the 505 MB is one-time and cached in a gitignored directory)
 * and verifies EVERYTHING, cached or fresh. A mismatch throws rather than warns: "the source
 * republished under the same URL" must not be able to change the map quietly.
 */
async function ensureGranules() {
  mkdirSync(CACHE_DIR, { recursive: true });
  /** @type {Record<string, { bytes: number, sha256: string }>} */
  const verified = {};
  for (const [key, pin] of Object.entries(GRANULES)) {
    const separator = key.indexOf("_");
    const layer = key.slice(0, separator);
    const granule = key.slice(separator + 1);
    const file = granuleFileName(layer, granule);
    const path = join(CACHE_DIR, file);

    if (!existsSync(path) || statSync(path).size !== pin.bytes) {
      const url = `${DOWNLOAD_ROOT}/${layer}/${file}`;
      process.stdout.write(`  ↓ ${file} (${(pin.bytes / 1e6).toFixed(1)} MB) … `);
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error(`${url}: HTTP ${response.status}`);
      }
      await pipeline(
        Readable.fromWeb(/** @type {import("node:stream/web").ReadableStream} */ (response.body)),
        createWriteStream(path),
      );
      process.stdout.write("done\n");
    }

    const digest = sha256OfFile(path);
    if (digest !== pin.sha256) {
      throw new Error(
        `${file}: SHA-256 ${digest} does not match the pinned ${pin.sha256}. The recipe is ` +
          `pinned to GSW ${GSW_VERSION}; refusing to derive geometry from bytes nobody has ` +
          `reviewed. Delete the cached file to re-download, or update the pin deliberately.`,
      );
    }
    verified[file] = { bytes: pin.bytes, sha256: pin.sha256 };
  }
  return verified;
}

// --- Pipeline -----------------------------------------------------------------------

/**
 * Run the recipe for one registry entry.
 *
 * @param {(typeof REGISTRY)[number]} entry
 */
async function buildBody(entry) {
  const radiusPx = nominalMetresToPixels(CLOSING_RADIUS_M);
  const clearancePx = 2 * radiusPx;

  const { mask, window, noDataPixels } = await readOccurrenceMask({
    cacheDir: CACHE_DIR,
    box: entry.window,
    thresholdPercent: OCCURRENCE_THRESHOLD,
  });
  if (noDataPixels > 0) {
    throw new Error(
      `${entry.id} (${entry.name}): ${noDataPixels} pixels of the window have no GSW data. ` +
        `That means the window reaches past the granule set — re-check the registry.`,
    );
  }

  const labelling = labelComponents(mask);
  // THE IDENTITY TEST (→ DEC 2026-08-04d). The composition itself lives in
  // `jrc-morphology.mjs` and is unit-tested on synthetic masks — it is the step that decides
  // what a lake IS, it has shipped wrong twice, and this pipeline has no CI gate.
  const identityBox = boxToPixels(window, entry.identity, `${entry.id} (${entry.name})`);
  const neighbourPx = NEIGHBOUR_PX_FORCED
    ? IDENTITY_NEIGHBOUR_PX
    : (entry.neighbourPx ?? IDENTITY_NEIGHBOUR_PX);
  const { identity, selected, rejected } = selectBodyComponents(
    labelling,
    mask.width,
    mask.height,
    identityBox,
    { neighbourPx, includeFragments: COMPONENT_RULE === "with-fragments" },
  );
  if (identity.length === 0) {
    throw new Error(
      `${entry.id} (${entry.name}): the identity box contains no water at occurrence ≥ ` +
        `${OCCURRENCE_THRESHOLD} %. A core box that hits nothing is a registry error, not an ` +
        `empty lake — the body would silently vanish from the map. The box is pinned at the ` +
        `deepest interior point of this body precisely so a threshold change cannot do this.`,
    );
  }

  const raw = maskFromLabels(labelling, mask.width, mask.height, selected);
  const rawPixels = countSet(raw);

  // `extent` CROSS-CHECK (P7 plan §4.1 step 10). By construction occurrence > 0 implies
  // extent = 1, so on correctly decoded rasters this is exact — which is precisely what makes
  // it a decoder check: the two layers are separate files, compressed separately, and a strip
  // offset mistake in either would show up here as water that the maximum-extent layer says
  // was never wet. It is the only automated defence this manual step has against the defect
  // class the wave exists to remove, and it runs on the PRE-closing selection: closing and
  // hole filling deliberately add pixels that were never observed as water.
  const extent = await readExtentMask({ cacheDir: CACHE_DIR, box: entry.window });
  if (extent.mask.width !== mask.width || extent.mask.height !== mask.height) {
    throw new Error(`${entry.id}: occurrence and extent windows disagree in size.`);
  }
  let escapees = 0;
  for (let i = 0; i < raw.data.length; i++) {
    if (raw.data[i] && !extent.mask.data[i]) escapees++;
  }
  if (escapees > 0) {
    throw new Error(
      `${entry.id} (${entry.name}): ${escapees} of ${rawPixels} selected pixels lie OUTSIDE ` +
        `the GSW maximum-extent envelope. occurrence > 0 implies extent = 1 in this product, ` +
        `so this cannot happen on correctly decoded rasters — suspect the raster reader, not ` +
        `the lake.`,
    );
  }

  const closed = closeMask(raw, radiusPx);
  const filled = FILL_INTERIOR_HOLES ? fillInteriorHoles(closed) : closed;

  if (touchesBorder(filled, clearancePx)) {
    throw new Error(
      `${entry.id} (${entry.name}): the finished body comes within ${clearancePx} px ` +
        `(~${(clearancePx * pixelGroundSizeM(entry.window.minLat).ew).toFixed(0)} m EW) of the ` +
        `window edge. Outside the window is dry, so ` +
        `closing shaves anything that reaches it — widen \`window\` in the registry. Note ` +
        `this is a CLEARANCE check, not a "touches the border" check: a lobe was measured ` +
        `losing ~9 km² while a zero-margin check stayed silent.`,
    );
  }

  // How much of the DRAWN body was ever observed as water. Not a gate — closing and hole
  // filling are supposed to add dry pixels — but the honest way to say how much of the
  // outline is statistics and how much is morphology.
  let filledPixels = 0;
  let filledInExtent = 0;
  for (let i = 0; i < filled.data.length; i++) {
    if (!filled.data[i]) continue;
    filledPixels++;
    if (extent.mask.data[i]) filledInExtent++;
  }

  const rings = traceRings(filled);
  /** @type {[number, number][][]} */
  const polygons = [];
  let areaKm2 = 0;
  let holes = 0;
  let sourceNodes = 0;
  for (const ring of rings) {
    if (ringSignedArea(ring) <= 0) {
      holes++;
      continue;
    }
    const lonLat = /** @type {[number, number][]} */ (
      ring.map(([cx, cy]) => {
        const [lon, lat] = cornerToLonLat(window, cx, cy);
        return [snapToGrid(lon), snapToGrid(lat)];
      })
    );
    sourceNodes += lonLat.length;
    areaKm2 += measureRingAreaKm2(lonLat);
    const simplified = simplifyRing(lonLat, SNAPSHOT_EPSILON_UNITS, projectToFrame);
    if (simplified.length < 4) continue;
    polygons.push(simplified);
  }
  if (holes > 0) {
    throw new Error(
      `${entry.id} (${entry.name}): ${holes} inner rings survived hole filling. ` +
        `\`fillInteriorHoles\` is supposed to make that impossible.`,
    );
  }
  if (polygons.length === 0) {
    throw new Error(`${entry.id} (${entry.name}): every ring collapsed during simplification.`);
  }

  polygons.sort((a, b) => Math.abs(loopSize(b)) - Math.abs(loopSize(a)));

  return {
    entry,
    areaKm2,
    polygons,
    componentsTotal: labelling.count,
    componentsUsed: selected.length,
    componentsIdentity: identity.length,
    // Pixel area at THIS window's latitude, not the nominal 30 m × 30 m: a 0.00025° pixel is
    // ~27.8 m north-south but only ~21.8 m east-west at 38°N, so the nominal figure overstates
    // a component by nearly half. Reported under BOTH component rules — "what this recipe
    // chose not to take" is exactly as interesting when the answer is "everything".
    largestRejectedKm2:
      ((rejected[0]?.size ?? 0) *
        (window.pixelSizeDeg * 111194.9) ** 2 *
        Math.cos((((entry.window.minLat + entry.window.maxLat) / 2) * Math.PI) / 180)) /
      1e6,
    rawPixels,
    extentCoveragePct: filledPixels > 0 ? (filledInExtent / filledPixels) * 100 : 100,
    sourceNodes,
    nodes: polygons.reduce((sum, ring) => sum + ring.length, 0),
    windowPx: `${mask.width}×${mask.height}`,
  };
}

/** Planar loop area in degrees² — ordering only, never a measurement. @param {[number, number][]} ring */
function loopSize(ring) {
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    total += a[0] * b[1] - b[0] * a[1];
  }
  return total / 2;
}

// --- Run ----------------------------------------------------------------------------

console.log(`fetch-tr-jrc-water → ${OUT}
  dataset          : JRC Global Surface Water ${GSW_VERSION}
  recipe           : occurrence ≥ ${OCCURRENCE_THRESHOLD} % · closing r=${nominalMetresToPixels(CLOSING_RADIUS_M)} px (nominal ${CLOSING_RADIUS_M} m) · fill holes ${FILL_INTERIOR_HOLES} · ε=${SNAPSHOT_EPSILON_UNITS} svg units
  identity test    : core box + components within ${IDENTITY_NEIGHBOUR_PX} px of the main body
  pixel on ground  : ${pixelGroundSizeM(38.5).ew.toFixed(1)} m EW × ${pixelGroundSizeM(38.5).ns.toFixed(1)} m NS at 38.5°N — NOT the nominal ${NOMINAL_PIXEL_SIZE_M} m
  component rule   : ${COMPONENT_RULE}
`);

const granules = await ensureGranules();
console.log(`  granules verified: ${Object.keys(granules).length} · SHA-256 pinned\n`);

const results = [];
for (const entry of REGISTRY) {
  const started = Date.now();
  results.push({ ...(await buildBody(entry)), ms: Date.now() - started });
}
await closeGranules();

const features = results.map((result) => ({
  type: "Feature",
  properties: {
    id: result.entry.id,
    name: result.entry.name,
    wikidata: result.entry.wikidata,
    areaKm2: Number(result.areaKm2.toFixed(4)),
    rings: result.polygons.length,
    nodes: result.nodes,
    identity: result.entry.identity,
    window: result.entry.window,
    identityNeighbourPx: NEIGHBOUR_PX_FORCED
      ? IDENTITY_NEIGHBOUR_PX
      : (result.entry.neighbourPx ?? IDENTITY_NEIGHBOUR_PX),
    componentsIdentity: result.componentsIdentity,
    componentsTotal: result.componentsTotal,
    componentsUsed: result.componentsUsed,
    extentCoveragePct: Number(result.extentCoveragePct.toFixed(2)),
  },
  geometry: {
    type: "MultiPolygon",
    coordinates: result.polygons.map((ring) => [ring]),
  },
}));

const output = {
  type: "FeatureCollection",
  metadata: {
    source: `JRC Global Surface Water ${GSW_VERSION}`,
    attribution: "Source: EC JRC/Google",
    citation:
      "Jean-Francois Pekel, Andrew Cottam, Noel Gorelick, Alan S. Belward, " +
      "High-resolution mapping of global surface water and its long-term changes. " +
      "Nature 540, 418-422 (2016). https://doi.org/10.1038/nature20584",
    licence: "Copernicus / EC JRC open data — free reuse with attribution and citation",
    note:
      "NEVER merge this file with data/tr-inland-water.geojson (ODbL). Separate source, " +
      "separate licence, separate file; they meet only as pixels in one rendered SVG " +
      "(DEC 2026-08-01r-1).",
    generatedAt: new Date().toISOString(),
    recipe: {
      occurrenceThresholdPercent: OCCURRENCE_THRESHOLD,
      closingRadiusM: CLOSING_RADIUS_M,
      closingRadiusPx: nominalMetresToPixels(CLOSING_RADIUS_M),
      fillInteriorHoles: FILL_INTERIOR_HOLES,
      componentRule: COMPONENT_RULE,
      identityNeighbourPx: IDENTITY_NEIGHBOUR_PX,
      snapshotEpsilonSvgUnits: SNAPSHOT_EPSILON_UNITS,
      pixelSizeDeg: PIXEL_SIZE_DEG,
    },
    granules,
    reduction:
      "Douglas–Peucker vertex SUBSET in the pinned TR frame. Every coordinate is an exact " +
      "GSW pixel-corner value; areaKm2 is measured on the traced rings before reduction.",
  },
  features,
};

// Serialised the same way as the ODbL snapshot (`fetch-tr-inland-water.mjs`): the metadata
// block is pretty-printed so the provenance header is readable in a diff, while each feature
// is ONE line. Two data files that arrive at the same generator should not be laid out
// differently, and `JSON.stringify(…, null, 1)` would put every coordinate on its own line.
writeFileSync(
  OUT,
  [
    "{",
    '"type": "FeatureCollection",',
    `"metadata": ${JSON.stringify(output.metadata, null, 2)},`,
    '"features": [',
    output.features.map((feature) => JSON.stringify(feature)).join(",\n"),
    "]",
    "}",
    "",
  ].join("\n"),
  "utf8",
);

// --- Report -------------------------------------------------------------------------

const bytes = statSync(OUT).size;
console.log(
  `  ${"id".padEnd(7)}${"name".padEnd(15)}${"km²".padStart(9)}${"expected".padStart(10)}` +
    `${"Δ".padStart(8)}${"rings".padStart(7)}${"nodes".padStart(7)}${"used/all".padStart(10)}` +
    `${"extent%".padStart(9)}${"window".padStart(12)}`,
);
for (const result of results) {
  const delta = ((result.areaKm2 - result.entry.expectedKm2) / result.entry.expectedKm2) * 100;
  console.log(
    `  ${result.entry.id.padEnd(7)}${result.entry.name.padEnd(15)}` +
      `${result.areaKm2.toFixed(1).padStart(9)}${result.entry.expectedKm2.toFixed(1).padStart(10)}` +
      `${`${delta >= 0 ? "+" : ""}${delta.toFixed(1)} %`.padStart(8)}` +
      `${String(result.polygons.length).padStart(7)}${String(result.nodes).padStart(7)}` +
      `${`${result.componentsUsed}/${result.componentsTotal}`.padStart(10)}` +
      `${result.extentCoveragePct.toFixed(1).padStart(9)}${result.windowPx.padStart(12)}` +
      `${result.largestRejectedKm2 > 0 ? `  largest rejected ${result.largestRejectedKm2.toFixed(1)} km²` : ""}`,
  );
}
console.log(`
  total            : ${results.reduce((sum, r) => sum + r.areaKm2, 0).toFixed(1)} km² · ${results.reduce((sum, r) => sum + r.polygons.length, 0)} rings · ${results.reduce((sum, r) => sum + r.nodes, 0)} nodes
  reduction        : ${results.reduce((sum, r) => sum + r.sourceNodes, 0)} traced nodes → ${results.reduce((sum, r) => sum + r.nodes, 0)} kept at ε=${SNAPSHOT_EPSILON_UNITS}
  file             : ${(bytes / 1024).toFixed(1)} kB
  Δ vs expected    : a REPORT column, never a gate — a fact literal is not an assertion.
`);
