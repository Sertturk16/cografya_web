/**
 * §19 section-heading entity name: the province OR country name as it must appear in a
 * content section <h2>, for a given locale and grammatical case. Pure and DOM-free —
 * unit-tested in plain Node like the other `lib/text` helpers.
 *
 * Three responsibilities are extracted here so ALL are unit-guarded (not only curl-checked
 * point-in-time):
 * 1. **The locale gate.** TR applies the Turkish grammatical suffix (via the tested pure
 *    `turkishGenitive`/`turkishLocative`); every non-TR locale returns the BARE name, so an
 *    English heading reads "… of {name}" and a Turkish suffix is NEVER applied to it. This
 *    is the exact class that regressed in PR #16 (an EN heading slipped into a Turkish
 *    suffix); centralising + testing it is the standing guard.
 * 2. **The per-section case assignment** (`PROVINCE_HEADING_CASE` / `COUNTRY_HEADING_CASE`).
 *    Which of the §19 sections uses the genitive ("X'in Y'si") vs the locative ("X'te Y") is
 *    single-sourced here and page.tsx reads it, so a wrong case (e.g. climate slipping to
 *    genitive) regresses a test rather than a live H2.
 * 3. **The message key per country section, in both forms** (`COUNTRY_HEADING_KEY`) — the
 *    entity-named heading and the plain one, so the totality guard can pin all ten keys in
 *    both catalogues (next-intl does not fail the build on a missing key).
 */
import type { Locale } from "@/i18n/routing";
import { turkishGenitive, turkishLocative } from "./turkish-suffix";

export type HeadingCase = "genitive" | "locative";

/** The content sections whose <h2> carries the province name (§19 + the locator block). */
export type ProvinceHeadingSlot =
  "location" | "landform" | "hydrography" | "neighbors" | "climate" | "settlement" | "economy";

/** The content sections whose <h2> carries the country name (§19 + the locator block). */
export type CountryHeadingSlot = "location" | "landform" | "climate" | "hydrography" | "neighbors";

/**
 * Grammatical case per §19 section, so the page reads as VARIED prose instead of
 * "X'in Y'si" six times. Genitive drives the "X'in Y'si" headings, locative the "X'te Y"
 * ones. `neighbors` is deliberately genitive: the locative "X'te Komşu İller" would mean
 * "the neighbouring provinces located IN X" — the wrong sense (→ closing-summary §2).
 */
export const PROVINCE_HEADING_CASE = {
  // "Van'ın Konumu" — the locator block asks "where is it", which is a property OF the
  // province, so genitive. The locative "Van'da Konum" would mean "a location inside Van".
  location: "genitive",
  landform: "genitive",
  hydrography: "genitive",
  neighbors: "genitive",
  climate: "locative",
  settlement: "locative",
  economy: "locative",
} as const satisfies Record<ProvinceHeadingSlot, HeadingCase>;

/**
 * Grammatical case per §19 section on the COUNTRY page. The three slots it shares with the
 * province page keep the province's assignment on purpose — the slot→case mapping is one
 * platform-wide convention, so "X'in Hidrografyası" never means one thing on `/turkiye` and
 * another on `/dunya`.
 *
 * The result is 3 genitive + 1 locative, not the province's 3 + 3. That is deliberate: of
 * the four country sections only `climate` has a natural locative reading, and manufacturing
 * more locatives would ship awkward Turkish to buy down a NOT-level checklist item
 * (SEO-POLICY §B3.5 — heading-skeleton variety). Naturalness wins; the entity name is in
 * every heading either way, which is the UYARI-level item (§B3.4) this map exists to close.
 *
 * There WAS a fifth slot, `independence`, and its removal is a ruling rather than a cleanup
 * (→ DEC 2026-08-17e h.2): the section it titled carried a single sentence on 173 of 199
 * country rows, and `CONTENT-STYLE.md` §19's section threshold bars opening an H2 for a body
 * shorter than two sentences. The fact now renders as a "Temel Bilgiler" row, which needs a
 * plain label and no grammatical case — so the slot has no remaining reader.
 */
export const COUNTRY_HEADING_CASE = {
  // Same reading as the province page's `location` slot — one platform-wide assignment per
  // slot, so "X'in Konumu" never means one thing on /turkiye and another on /dunya.
  location: "genitive",
  landform: "genitive",
  hydrography: "genitive",
  neighbors: "genitive",
  climate: "locative",
} as const satisfies Record<CountryHeadingSlot, HeadingCase>;

/**
 * The i18n message key for each country section heading, in BOTH forms:
 *
 * - `named` — the §19 entity-named heading ("{name} Komşu Ülkeleri" / "Neighbouring
 *   Countries of {name}"), used on ordinary rows. Interpolates `{name}`.
 * - `plain` — the bare section label ("Komşu Ülkeler" / "Neighbouring Countries"), used on
 *   special-status rows (`lib/geo/sovereignty.ts` owns that decision and its rationale).
 *   Takes no parameter.
 *
 * Both forms are listed here rather than derived by string concatenation so the catalogue
 * totality test can enumerate every key that can reach `t()` — the same guard the
 * meta-description keys got, for the same reason: next-intl logs `console.error` on a
 * missing/typo'd key and ships the dotted key string into a live <h2> with CI green.
 */
export const COUNTRY_HEADING_KEY = {
  location: { named: "locationHeading", plain: "locationHeadingPlain" },
  landform: { named: "landformHeading", plain: "landformHeadingPlain" },
  climate: { named: "climateHeading", plain: "climateHeadingPlain" },
  hydrography: { named: "hydrographyHeading", plain: "hydrographyHeadingPlain" },
  neighbors: { named: "neighborsHeading", plain: "neighborsHeadingPlain" },
} as const satisfies Record<CountryHeadingSlot, { named: string; plain: string }>;

/**
 * The entity name (province OR country) as it should appear in a §19 heading. TR → the
 * Turkish grammatical suffix; any other locale → the bare name (English headings, never a
 * Turkish-suffixed proper noun). Combine with the section's i18n message (TR: "{name} ..."
 * with the suffix baked in; EN: "... of {name}").
 */
export function headingName(locale: Locale, name: string, headingCase: HeadingCase): string {
  if (locale !== "tr") return name;
  return headingCase === "genitive" ? turkishGenitive(name) : turkishLocative(name);
}
