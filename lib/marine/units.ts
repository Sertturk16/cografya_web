import type { MarineValue } from "@/lib/api/types";

/**
 * The one unit conversion this surface performs (owner ruling A6, 2026-08-02): wind speed is
 * published in m/s and shown as **m/s first, km/h in parentheses**.
 *
 * WHY THIS IS NOT A SECOND SOURCE OF FACT. Everything else on `/deniz` that could be
 * computed is instead read from the api, on the principle that a geographic or provider fact
 * must live in exactly one place. A unit conversion is not a fact: `1 m/s = 3.6 km/h` is the
 * definition of the two units, exact in binary-free decimal terms, and it introduces no
 * second opinion about the wind — the same number, said twice. The api's canonical unit stays
 * m/s and stays first; km/h is a reading aid for the majority of readers who have a feel for
 * road speeds and none for metres per second.
 *
 * It is gated on the UNIT, never on the column: a value is converted because it is measured
 * in m/s, not because it happens to sit in the wind cell. If the contract ever moves a
 * quantity to m/s, it gets the parenthetical for free; if wind ever moves off m/s, the
 * parenthetical vanishes rather than silently converting the wrong quantity.
 */

/**
 * Canonical unit → `Marine.unit.*` message key, exhaustive by TYPE.
 *
 * A `Record<Union, …>` rather than a template key (`t(`unit.${unit}`)`): a template compiles
 * whatever the union does, so a unit added to the contract would ship a missing-key crash
 * into an indexable table cell. This map fails at `tsc` instead. It also gives the
 * message-key guard something to DERIVE its expectations from, so a new unit cannot reach
 * production without its symbol.
 *
 * `tsc` only guards the units the COMMITTED spec knows about: between an api deploy and the
 * web regenerating types the payload can carry one this map has never heard of, so callers
 * read the lookup into a `string | undefined` local and fall back rather than rendering the
 * namespace name into a cell.
 */
export const MARINE_UNIT_KEY: Record<MarineValue["unit"], string> = {
  m: "unit.m",
  celsius: "unit.celsius",
  degree_true: "unit.degree_true",
  meter_per_second: "unit.meter_per_second",
};

/**
 * Decimal places per unit.
 *
 * One decimal for the physical quantities: the source grids do not support a second, and a
 * wave height printed as 0.83 m claims a precision the model never produced. Zero for
 * bearings — a tenth of a degree on a 0.25° grid is noise, and the compass name beside it
 * already carries the reading. Pinned here rather than inline so the choice is one
 * reviewable decision instead of a magic number repeated in every cell.
 */
export const MARINE_VALUE_FRACTION_DIGITS: Record<MarineValue["unit"], number> = {
  m: 1,
  celsius: 1,
  degree_true: 0,
  meter_per_second: 1,
};

/** The km/h companion is a rough reading aid; a decimal on it would be false precision. */
export const KMH_FRACTION_DIGITS = 0;

/** Exact by definition — 1 m/s is 3600 m per hour, i.e. 3.6 km/h. */
const KMH_PER_METER_PER_SECOND = 3.6;

/** m/s → km/h. Non-finite input yields `null` rather than a `NaN` in an indexable cell. */
export function metersPerSecondToKmh(metersPerSecond: number): number | null {
  if (!Number.isFinite(metersPerSecond)) return null;
  return metersPerSecond * KMH_PER_METER_PER_SECOND;
}

/**
 * The km/h companion for a value, or `null` when there should not be one.
 *
 * `null` for every unit but `meter_per_second` — a temperature and a wave height have no
 * km/h reading, and returning something for them would be nonsense a caller has to remember
 * to suppress.
 */
export function kmhCompanion(value: number, unit: MarineValue["unit"]): number | null {
  return unit === "meter_per_second" ? metersPerSecondToKmh(value) : null;
}
