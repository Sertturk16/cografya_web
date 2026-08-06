import type {
  Continent,
  CountryMapSummary,
  GeographicRegion,
  ProvinceMapSummary,
} from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";
import { territoryFor } from "@/lib/map/territories";

/**
 * The homepage's "Bugün keşfet" province / country cards: a DAY-SEEDED deterministic draw
 * from what the api actually publishes (→ DEC 2026-08-05a).
 *
 * ## Why seeded, and emphatically not random
 *
 * The first shape here was a curated slug list (Rize/İstanbul/Mersin + Brezilya/Japonya/Çad).
 * The owner retired it: six hand-picked entities never change, so the page never rewards a
 * second visit, and the editorial cost grows with the corpus. The replacement uses NO
 * `Math.random` anywhere in this module, deliberately:
 *
 * - the page is ISR-rendered, so a random draw would freeze one arbitrary set into the HTML
 *   for a whole revalidate window anyway, and then jump unpredictably between windows;
 * - a heading that says "BUGÜN keşfet" has to be TRUE. Seeded on the calendar day it is:
 *   every render of the same Istanbul day yields the same six cards, and the next day yields
 *   a different six. What the reader sees and what the heading claims agree.
 * - and it stays testable — the whole mechanism is a pure function of (pool, locale, instant).
 *
 * ## The soft-404 guarantee is now structural, not an intersection
 *
 * The curated list needed an intersection against the published set, because a hand-written
 * slug could name an entity the api does not publish (`ENGINEERING.md` §4 #6). Here the draw
 * is taken FROM the published payload itself, so every card is by construction a published
 * entity: an unresolvable link is not merely filtered out, it is unconstructible. The href is
 * still built from the LOCALE's own slug, never the other locale's.
 */

/**
 * Europe/Istanbul calendar day as `YYYY-MM-DD` — the seed, and the only reason this module
 * knows about time at all.
 *
 * The zone is PINNED rather than read from the host: a server in UTC and a server in Istanbul
 * must not disagree about which day it is, or two machines would serve different cards under
 * the same heading. The instant is INJECTED (the page passes `new Date()`) so every function
 * below stays pure and every test can pin a day.
 *
 * `en-GB` is chosen only for its unambiguous Gregorian parts; the parts are re-assembled by
 * hand, so no locale's date FORMAT can leak into the seed.
 */
const ISTANBUL_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function istanbulDayKey(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = ISTANBUL_DAY.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * FNV-1a (32-bit) over the seed string. A hash, not a cipher: all it owes is that two
 * adjacent day strings land far apart, which it does. `Math.imul` keeps the multiply in
 * 32-bit integer space — a plain `*` would lose the low bits to float64.
 */
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 — a small, well-known seeded PRNG. It is here so the draw below is REPRODUCIBLE
 * from the day string; nothing about its statistical quality matters for choosing three
 * cards. The property that DOES matter is that it never reads a global source of entropy,
 * which is what keeps this module pure.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` distinct members of `pool`, drawn deterministically from `seed`.
 *
 * The pool must arrive in a STABLE order (the callers sort by plaka kodu / ISO code): the
 * draw is a function of position, so if the api ever reordered its response the same day
 * would silently produce different cards.
 *
 * Draw-and-remove rather than "the slice at hash % n": consecutive slices of a sorted pool
 * would put three alphabetically adjacent provinces on the page every day, which reads as a
 * fragment of a list rather than as a discovery.
 */
function dailyDraw<T>(pool: readonly T[], count: number, seed: string): T[] {
  const remaining = [...pool];
  const random = mulberry32(fnv1a32(seed));
  const size = Math.min(count, remaining.length);

  const drawn: T[] = [];
  for (let index = 0; index < size; index += 1) {
    const [item] = remaining.splice(Math.floor(random() * remaining.length), 1);
    // Unreachable — `random()` is [0,1) so the index is always in range — but the repo runs
    // `noUncheckedIndexedAccess`, and stopping is better than pushing an `undefined` card.
    if (item === undefined) break;
    drawn.push(item);
  }
  return drawn;
}

/**
 * Pool ordering — a raw code-point comparison, deliberately NOT `localeCompare`.
 *
 * The draw below is a function of POSITION in the pool, so the sort is part of the seed: two
 * machines that order the pool differently serve different cards under the same "bugün"
 * heading. `localeCompare` with no explicit locale collates in the RUNTIME's default locale,
 * which is ambient state this module otherwise takes care never to read (the same reason the
 * day key pins Europe/Istanbul instead of trusting the host clock). Under a Turkish default
 * collation, for instance, `I` and `İ` do not sort where an English one puts them.
 *
 * Both keys this orders are ASCII by construction — a 2-digit zero-padded plaka kodu and an
 * ISO alpha-2 code — so a code-point comparison is not an approximation of the "right"
 * collation here, it IS the total order, and it cannot be moved by an environment. Cheaper
 * than an `Intl.Collator`, and no locale to forget to pass. (→ PR #46 review CR-FR2-1.)
 */
function byAsciiCode(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** How many cards each row may show. A cap, not a promise — a smaller pool yields fewer. */
export const FEATURED_LIMIT = 3;

/** One province card's data, already localized. Presentation-free: the component only prints. */
export interface FeaturedProvince {
  /** Plaka kodu — the stable React key. */
  readonly plateCode: string;
  /** Display name. Provinces carry no `nameEn`, so this is `nameTr` in both locales. */
  readonly name: string;
  /** Contract enum → the `Regions` i18n namespace. Never a pre-translated string. */
  readonly region: GeographicRegion;
  /** The LOCALE's slug (`slugTr` on tr, `slugEn` on en). */
  readonly slug: string;
  /** The single fact on the card, or `null` — a card with no number prints no number row. */
  readonly population: number | null;
  /** The year that population belongs to, or `null`. */
  readonly populationYear: number | null;
}

/** One country card's data, already localized. */
export interface FeaturedCountry {
  /** ISO alpha-2 — the stable React key. */
  readonly isoCode: string;
  /** Display name in the render locale (`nameTr` / `nameEn`). */
  readonly name: string;
  /** Contract enum → the `Continents` i18n namespace. */
  readonly continent: Continent;
  /** The LOCALE's slug. */
  readonly slug: string;
  /** The single fact on the card, or `null` — same rule as the province card. */
  readonly population: number | null;
  /** The year that population belongs to; the contract publishes none for most countries. */
  readonly populationYear: number | null;
}

/**
 * The card's single fact, as a MESSAGE KEY + its number — or `null` for "print no row".
 *
 * Two decisions live here, and both are the silent-regression kind, which is why they are a
 * tested pure function rather than an inline arrow in the page component (the plan's own rule:
 * all logic goes under `lib/` as a pure function).
 *
 * 1. A `null` population prints NO row rather than a dash — the map hover card's rule, for the
 *    same reason: a placeholder dash reads as a fault where an absence is simply an absence.
 *    Note it is an explicit `=== null` check: a population of 0 is a real number and must
 *    still print, so a truthiness test would be a bug.
 * 2. A `null` year drops the year clause instead of printing an empty parenthesis — which is
 *    the ordinary case for countries, whose contract publishes no `populationYear`.
 *
 * It returns a KEY and not a string, the way `MARINE_UNIT_KEY` does: translation and number
 * formatting need the request's locale, so they stay in the component while the BRANCHING
 * stays here, inside the node-environment test harness.
 */
export type FeaturedFact =
  | { readonly labelKey: "population"; readonly population: number }
  | { readonly labelKey: "populationWithYear"; readonly year: number; readonly population: number };

export function featuredPopulationFact(
  population: number | null,
  year: number | null,
): FeaturedFact | null {
  if (population === null) return null;
  return year === null
    ? { labelKey: "population", population }
    : { labelKey: "populationWithYear", year, population };
}

/**
 * The countries the daily draw may reach: real COUNTRY rows only — dalga-1's territory rows
 * (the AQ/GL class) are held out (→ DEC 2026-08-05a §2).
 *
 * ## Why membership of `TERRITORIES`, and not the `entityType` field (updated — PR #51 review I6)
 *
 * The live api publishes `entityType: "country" | "territory" | "special"` on the country
 * DTOs, and — since the WEB-KOPPEN openapi sync (this repo's PR #51, api #88) — the generated
 * `CountryMapSummaryDto` carries it too: **the field is no longer absent from this repo's
 * committed contract.** (An earlier version of this comment said it was; that claim went stale
 * the moment the sync landed, in the same commit, and is corrected here rather than left to
 * mislead the next reader.)
 *
 * This filter still does NOT read `entityType`. Switching to `entityType === "country"` is a
 * REAL behaviour change (see the VA note below) now that the type exists to make it possible —
 * not a mechanical unlock — so it stays a deliberate, Atlas-coordinated migration
 * (`FU-WEB-ENTITYTYPE`) rather than something a fix round does inline. `lib/map/territories.ts`
 * is the web's own, already owner-ruled register of every non-country shape on the world map,
 * so it answers the same question from a source this repo already owns, with no second list to
 * drift.
 *
 * MEASURED against the live api the day this landed, not assumed: of 199 published rows, the
 * two the api itself types as non-country (AQ, GL) are both in `TERRITORIES`, and not one of
 * the 197 country-typed rows is. So the filter is exactly the api's own answer today, and it
 * stays conservative as dalga-1 continues — every territory it publishes comes from that same
 * 43-shape register.
 *
 * KNOWN IMPERFECTION, recorded rather than hidden: `TERRITORIES` also contains VA (Vatican), a
 * sovereign city-state deliberately absent from the 196-country corpus. Were it ever published
 * as a country row it would be wrongly held out here. The type-level removal guard that used to
 * force a human to look the day `entityType` arrived (PR #46 review CR-FR2-4, a `@ts-expect-
 * error` in `featured.test.ts`) has now done its job and been retired — the field arrived in
 * THIS PR. `featured.test.ts`'s `countryPool` describe block carries its replacement: a
 * synthetic-fixture test that pins today's (deliberately not-yet-migrated) exclusion behaviour,
 * so the day `countryPool` actually starts reading `entityType`, that assertion breaks and a
 * human has to look — the forcing function this docstring used to promise without one.
 */
export function countryPool(countries: readonly CountryMapSummary[]): CountryMapSummary[] {
  return countries.filter((country) => territoryFor(country.isoCode) === undefined);
}

/**
 * Today's provinces — drawn from ALL published provinces (81/81 eligible,
 * → DEC 2026-08-05a §2).
 */
export function pickDailyProvinces(
  summaries: readonly ProvinceMapSummary[],
  locale: Locale,
  instant: Date | string,
  limit: number = FEATURED_LIMIT,
): FeaturedProvince[] {
  const pool = [...summaries].sort((a, b) => byAsciiCode(a.plateCode, b.plateCode));
  const drawn = dailyDraw(pool, limit, `${istanbulDayKey(instant)}:provinces`);

  return drawn.map((province) => ({
    plateCode: province.plateCode,
    name: province.nameTr,
    region: province.region,
    slug: locale === "en" ? province.slugEn : province.slugTr,
    population: province.population,
    populationYear: province.populationYear,
  }));
}

/**
 * Today's countries — drawn from {@link countryPool}, i.e. country rows only.
 *
 * The seed carries a different suffix from the province draw so the two rows are independent:
 * one shared seed would move both grids in lockstep, and on a day whose hash lands low both
 * would show their first-by-key entities together.
 */
export function pickDailyCountries(
  countries: readonly CountryMapSummary[],
  locale: Locale,
  instant: Date | string,
  limit: number = FEATURED_LIMIT,
): FeaturedCountry[] {
  const pool = countryPool(countries).sort((a, b) => byAsciiCode(a.isoCode, b.isoCode));
  const drawn = dailyDraw(pool, limit, `${istanbulDayKey(instant)}:countries`);

  return drawn.map((country) => ({
    isoCode: country.isoCode,
    name: locale === "en" ? country.nameEn : country.nameTr,
    continent: country.continent,
    slug: locale === "en" ? country.slugEn : country.slugTr,
    population: country.population,
    populationYear: country.populationYear,
  }));
}
