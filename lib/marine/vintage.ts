import type { MarineValue } from "@/lib/api/types";
import { parseModelInstant } from "./model-run";

/**
 * The künye of a set of displayed values: which model instant they belong to, and which
 * model run they came out of — GROUPED BY PROVIDER, because a single row of this table can
 * legitimately mix two.
 *
 * Wind comes from ECMWF, sea temperature from CMEMS, and the Marmara's wave height from a
 * different provider than the wave height in the Aegean next to it. The contract carries
 * `source` per FIELD for exactly that reason (mixing sources silently is banned), so a
 * single page-wide "last updated" line would be a small lie every time the two providers
 * were an hour apart. One line per provider is the honest shape, and the grouping is read
 * off the data — there is no provider table in this file.
 *
 * TWO RULES, both inherited from W1a and both load-bearing:
 *
 * 1. **Absolute UTC only.** "2 hours ago" is computed once and then cached by ISR into being
 *    wrong; an absolute instant only ever gets older. Formatting goes through
 *    `MODEL_INSTANT_FORMAT`, whose `timeZone: "UTC"` is pinned by test.
 * 2. **Null is omitted, never filled.** CMEMS publishes no run time per value, so its line
 *    simply has no run clause. No "bilinmiyor", no fabricated date, no "yakında".
 *
 * WHY THE OLDEST INSTANT WINS INSIDE A GROUP. The hub's line summarises 30 points at once,
 * and those 30 need not share a model instant. A künye may never claim the values are
 * fresher than the stalest one it covers, so the group reports its OLDEST `validAtUtc` and
 * its OLDEST `modelRunAtUtc`. When they all agree — the normal case, since the api assembles
 * the overview from one cache pass — the rule collapses to the exact instant, so this costs
 * nothing in the common case and cannot overstate freshness in the uncommon one.
 */

/** The contract's provider enum, minus the `null` an unsourced value carries. */
export type MarineSource = NonNullable<MarineValue["source"]>;

export interface MarineVintageGroup {
  /** The provider these values came from; drives the `Marine.source.*` label. */
  source: MarineSource;
  /** Oldest model instant across the group, or `null` when none is parseable. */
  validAt: Date | null;
  /** Oldest model run across the group, or `null` (CMEMS publishes none). */
  modelRunAt: Date | null;
}

/**
 * Groups the künye of every value that is actually ON SCREEN.
 *
 * Only `status === "ok"` values count: a künye annotates numbers a reader can see, and the
 * timestamps attached to a `no_data` field describe a value nobody is being shown. A value
 * with no `source` is skipped for the same reason — we will not attribute a number to a
 * provider the payload did not name.
 *
 * Group ORDER is first-appearance order in the payload, which makes the output deterministic
 * without inventing a provider ranking the api never stated.
 *
 * Returns `[]` when nothing qualifies; the caller then renders no künye line at all, rather
 * than an empty one.
 */
export function buildMarineVintage(values: readonly MarineValue[]): MarineVintageGroup[] {
  const groups = new Map<MarineSource, MarineVintageGroup>();

  for (const value of values) {
    if (value.status !== "ok" || value.source === null) continue;

    const validAt = parseModelInstant(value.validAtUtc);
    const modelRunAt = parseModelInstant(value.modelRunAtUtc);
    if (validAt === null && modelRunAt === null) continue;

    const existing = groups.get(value.source);
    if (existing === undefined) {
      groups.set(value.source, { source: value.source, validAt, modelRunAt });
      continue;
    }

    existing.validAt = older(existing.validAt, validAt);
    existing.modelRunAt = older(existing.modelRunAt, modelRunAt);
  }

  return [...groups.values()];
}

/**
 * The single instant one ROW may honestly claim: the oldest `validAtUtc` across everything
 * visible in it.
 *
 * A row can mix providers, so it can mix instants. The per-provider lines below the table
 * carry the full künye; the row cell needs one number, and the only one it can state without
 * overstating is the oldest.
 */
export function oldestValidAt(values: readonly MarineValue[]): Date | null {
  let oldest: Date | null = null;
  for (const group of buildMarineVintage(values)) oldest = older(oldest, group.validAt);
  return oldest;
}

/**
 * The largest in-cell grid offset among a row's visible values, or `null` when none reports
 * one (the O3 follow-up, now readable from data rather than from a hardcoded resolution).
 *
 * The MAXIMUM, phrased as a bound ("at most X km"), because the row's values come from
 * different grids: the largest offset is the only figure that is true of all of them at
 * once. The contract is explicit that this is an in-cell offset, never a search distance —
 * it cannot warn that data is far away, so the copy must not read like a warning.
 */
export function maxGridDistanceKm(values: readonly MarineValue[]): number | null {
  let largest: number | null = null;

  for (const value of values) {
    if (value.status !== "ok" || value.distanceKm === null) continue;
    if (!Number.isFinite(value.distanceKm)) continue;
    if (largest === null || value.distanceKm > largest) largest = value.distanceKm;
  }

  return largest;
}

/** The earlier of two instants; a present instant always beats an absent one. */
function older(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b;
  if (b === null) return a;
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * Flattens an overview-shaped block into the five values whose künye it carries.
 *
 * Direction values are included deliberately: their bearing is what the arrow is drawn from,
 * so they are as much "on screen" as the magnitude beside them, and on the wind pair the
 * bearing is the SERVER-DERIVED field — precisely the one whose run time is worth stating.
 */
export function marineBlockValues(block: {
  seaSurfaceTemperature: MarineValue;
  waveHeight: MarineValue;
  waveDirection: MarineValue;
  windSpeed10m: MarineValue;
  windDirection10m: MarineValue;
}): MarineValue[] {
  return [
    block.seaSurfaceTemperature,
    block.waveHeight,
    block.waveDirection,
    block.windSpeed10m,
    block.windDirection10m,
  ];
}
