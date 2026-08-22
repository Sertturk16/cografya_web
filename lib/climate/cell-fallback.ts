/**
 * The A-1 declared cell fallback — the five coastal provinces whose administrative point
 * falls in a SEA cell of the ERA5-Land grid, and whose published climate normals are
 * therefore read from the nearest LAND cell instead.
 *
 * ## Why this lives in the web repo and not in the contract (A-5, ruled)
 *
 * `SPEC.md` §13 left A-5 open — a per-province contract field, or static web copy — and it
 * was ruled **static web copy**. The five shifts are fixed properties of a fixed dataset
 * version (ERA5-Land 1991-2020 on a fixed grid): opening a cross-repo contract surface that
 * stands empty on 76 of 81 provinces buys nothing that this table does not already give.
 *
 * ## The staleness risk, and why it is accepted rather than merely noted
 *
 * The cost of the ruling is that one fact now lives in two repos. What makes that
 * acceptable is that going stale here is LOUD, not silent: the api re-derives the
 * assignment on every load run and compares it against its own closed list, and a sixth
 * province — or any shift beyond 25 km — ABORTS the run (`SPEC.md` §4.1-4). So the failure
 * mode is a stopped pipeline that reaches a human, not a page quietly publishing a stale
 * distance. `MAX_DECLARED_SHIFT_KM` below mirrors that ceiling so this copy cannot drift
 * past it either.
 *
 * ## Where the numbers come from — and where they do NOT
 *
 * VERBATIM from the ledger's production-run table:
 * `provenance/legacy/data-provenance-pre-split-2026-08-06.md` §0b, routed from
 * `provenance/integrations.md` (C3S / Copernicus ERA5-Land row). They are stored EXACTLY as
 * the ledger records them, never pre-rounded, so this file can be diffed against the ledger
 * and against the api manifest without a conversion step in between. Nothing here may be
 * written from memory, from `SPEC.md`, or from a summary.
 *
 * Sinop's ledger row carries two measurements — 13,19 km from the production run and 13,20
 * from the probe. The production run is the one that produced the served values, so it is
 * the one stored; the probe figure is a cross-check and is deliberately not carried here.
 */

/**
 * The api's own abort ceiling for a declared shift (`SPEC.md` §4.1-4). Not a display value
 * and not interpolated into any string — it exists so `cell-fallback.test.ts` can assert
 * that this copy stays inside the bound the api enforces on the other side.
 */
export const MAX_DECLARED_SHIFT_KM = 25;

/**
 * Plaka kodu → distance in kilometres between the province's administrative point and the
 * land cell its values are read from.
 *
 * The list is CLOSED. A sixth entry is not a new row to add here: it means the upstream
 * assignment changed, which stops the api's load run, and the ledger is what settles what
 * the new set is.
 */
export const CELL_FALLBACK_KM: Readonly<Record<string, number>> = Object.freeze({
  "07": 7.55, // Antalya
  "33": 10.45, // Mersin
  "52": 7.42, // Ordu
  "57": 13.19, // Sinop
  "61": 11.34, // Trabzon
});

/**
 * Rounds a stored distance to the ONE decimal a reader sees (→ Atlas ruling, this task).
 *
 * Two decimals would promise ten-metre precision for a value sampled from a ~0,1° cell that
 * is itself tens of kilometres across — the exact false-precision this project rejects. One
 * decimal still separates the five provinces from each other.
 *
 * ## Why this is an explicit step and not left to the formatter
 *
 * MEASURED, not assumed: on a half-way input the three obvious routes disagree. For 7,55 km
 * `toFixed(1)` answers `7.5` (it rounds the exact binary double, which sits just below the
 * midpoint) while `Intl.NumberFormat` answers `7,6`, and the same split appears at 10,45.
 * Handing the raw value to the formatter would therefore make the published digit depend on
 * which ICU the runtime carries. Rounding here first, and letting the formatter do nothing
 * but place the locale's decimal separator, makes the output the same everywhere.
 *
 * `Math.round(km * 10) / 10` is correct for every input in `CELL_FALLBACK_KM` because each
 * is written to at most two decimals — measured: `7.55 * 10` is exactly `75.5`, so the
 * multiplication lands ON the midpoint and `Math.round` takes it half-up, matching what a
 * reader would do with the written number. That precondition is not an assumption either:
 * `cell-fallback.test.ts` asserts every stored value has at most two decimals, so an entry
 * that would break the rounding fails a test instead of shipping a wrong digit.
 */
export function roundKmToOneDecimal(km: number): number {
  return Math.round(km * 10) / 10;
}

/**
 * The reader-facing distance for a province, or `null` when that province has no declared
 * shift — which is the case for 76 of 81 and is NOT a missing value: those provinces are
 * read from the cell their own administrative point falls in, which is what
 * `Climate.notice.readingPoint` already says on every page. They render no extra line
 * (never an "eksik veri" placeholder, `CONTENT-STYLE.md` §22).
 *
 * Returns the ROUNDED value; the caller formats it for the active locale and never rounds
 * again. Callers must not read `CELL_FALLBACK_KM` directly for display — that is what would
 * put a two-decimal figure on a page.
 */
export function cellFallbackDisplayKm(plateCode: string): number | null {
  const km = CELL_FALLBACK_KM[plateCode];
  return km === undefined ? null : roundKmToOneDecimal(km);
}
