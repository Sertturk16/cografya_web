/**
 * §19 section-heading entity name: the province name as it must appear in a content
 * section <h2>, for a given locale and grammatical case. Pure and DOM-free — unit-tested
 * in plain Node like the other `lib/text` helpers.
 *
 * Two responsibilities are extracted here so BOTH are unit-guarded (not only curl-checked
 * point-in-time):
 * 1. **The locale gate.** TR applies the Turkish grammatical suffix (via the tested pure
 *    `turkishGenitive`/`turkishLocative`); every non-TR locale returns the BARE name, so an
 *    English heading reads "… of {name}" and a Turkish suffix is NEVER applied to it. This
 *    is the exact class that regressed in PR #16 (an EN heading slipped into a Turkish
 *    suffix); centralising + testing it is the standing guard.
 * 2. **The per-section case assignment** (`PROVINCE_HEADING_CASE`). Which of the six §19
 *    sections uses the genitive ("X'in Y'si") vs the locative ("X'te Y") is single-sourced
 *    here (3 + 3) and page.tsx reads it, so a wrong case (e.g. climate slipping to genitive)
 *    regresses a test rather than a live H2.
 */
import type { Locale } from "@/i18n/routing";
import { turkishGenitive, turkishLocative } from "./turkish-suffix";

export type HeadingCase = "genitive" | "locative";

/** The six §19 content sections whose <h2> carries the province name. */
export type ProvinceHeadingSlot =
  "landform" | "hydrography" | "neighbors" | "climate" | "settlement" | "economy";

/** The five §19 content sections whose <h2> carries the country name. */
export type CountryHeadingSlot =
  "landform" | "climate" | "hydrography" | "independence" | "neighbors";

/**
 * Grammatical case per §19 section, so the page reads as VARIED prose instead of
 * "X'in Y'si" six times. Genitive drives the "X'in Y'si" headings, locative the "X'te Y"
 * ones. `neighbors` is deliberately genitive: the locative "X'te Komşu İller" would mean
 * "the neighbouring provinces located IN X" — the wrong sense (→ closing-summary §2).
 */
export const PROVINCE_HEADING_CASE = {
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
 * `independence` is the only new slot and is genitive: "Şili'nin Bağımsızlığı" is the
 * natural reading, whereas the locative "Şili'de Bağımsızlık" would describe independence
 * happening *inside* the country rather than the country's own independence.
 *
 * The result is 4 genitive + 1 locative, not the province's 3 + 3. That is deliberate: of
 * the five country sections only `climate` has a natural locative reading, and manufacturing
 * more locatives would ship awkward Turkish to buy down a NOT-level checklist item
 * (SEO-POLICY §B3.5 — heading-skeleton variety). Naturalness wins; the entity name is in
 * every heading either way, which is the UYARI-level item (§B3.4) this map exists to close.
 */
export const COUNTRY_HEADING_CASE = {
  landform: "genitive",
  hydrography: "genitive",
  neighbors: "genitive",
  independence: "genitive",
  climate: "locative",
} as const satisfies Record<CountryHeadingSlot, HeadingCase>;

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
