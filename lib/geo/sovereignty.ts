import type { Locale } from "@/i18n/routing";

/**
 * Special-status (contested / non-standard recognition) country rows — the ONE place the
 * platform decides "is this row special-status?", so the SEO and rendering surfaces that
 * care cannot drift apart.
 *
 * The api marks exactly these rows with a non-null `sovereigntyNoteTr`; the contract's own
 * field description is the definition: *"Yalnızca tanınma statüsü tartışmalı/standart-dışı
 * ülkeler için doldurulur; sıradan ülkelerde null"* (`CountryDetailDto`). Six rows carry it
 * today (Güney Kıbrıs Rum Yönetimi, KKTC, İsrail, Filistin, Çin Cumhuriyeti (Tayvan), Kosova →
 * DEC 2026-07-13; name → DEC 2026-08-30b). Reading the marker rather than hard-coding ISO
 * codes means a future seeded row is covered the day it lands.
 *
 * What the marker changes on the page, and why:
 *
 * 1. **Section headings** (`/dunya/[slug]`): a special-status row keeps the PLAIN section
 *    heading ("Komşu Ülkeler") instead of the entity-named one ("Filistin'in Komşu
 *    Ülkeleri"). The entity-named H2 exists precisely to make each section independently
 *    extractable (SEO-POLICY §B3.4) — which is also what turns a neutral section marker
 *    into a standalone possessive assertion, on exactly the pages whose balancing text is
 *    the note itself. Cost of the plain form: a §B3.4 **UYARI**-tier item on 6 of 199
 *    pages. That is the cheaper side of the trade. The note's OWN heading takes the same
 *    plain form and for the same reason — it gets no `COUNTRY_HEADING_CASE` slot
 *    (→ DEC 2026-08-08l B1).
 * 2. **Meta description** (`lib/seo/country-description.ts`): a special-status row is routed
 *    to ONE fixed, non-copula skeleton instead of the ISO-code-keyed variant rotation, so a
 *    politically load-bearing sentence is never selected by a checksum over an internal
 *    identifier (KKTC's `QN` is a self-assigned code, → DEC 2026-07-13).
 * 3. **The note section and the flag card** (`showsSovereigntyNote` / `showsCountryFlag`
 *    below): they rise and fall TOGETHER on these rows.
 *
 * This module encodes NO list of countries and resolves NO sovereignty question: it reads
 * the api's own marker and decides only how assertively the page chrome is worded and
 * whether the balanced pair renders.
 */
export function isSpecialStatusRow(sovereigntyNoteTr: string | null): boolean {
  return sovereigntyNoteTr !== null;
}

/**
 * Does `/dunya/[slug]` render the "Egemenlik ve Tanınma" section for this row?
 *
 * TR only. The note is a `…Tr` field with no EN counterpart in the OpenAPI contract — like
 * every other narrative field on the page it is locale-gated rather than machine-translated
 * (`SEO-POLICY.md` §B14 forbids the automatic EN expansion; the six EN notes have to be
 * WRITTEN, tracked as `FU-SOVNOTE-EN`).
 *
 * The membership half deliberately reuses `isSpecialStatusRow` rather than re-testing the
 * field: a second null-check here would be a second definition of "special-status", and the
 * whole point of this module is that the headings, the meta description and this section can
 * never disagree about which rows those are. That also means a hypothetical blank-string note
 * stays consistently "special" across all three consumers instead of being special for two
 * of them and ordinary for the third — the contract admits only `null` or filled, and a
 * divergent third rule invented here would be worse than the state it guards against.
 */
export function showsSovereigntyNote(locale: Locale, sovereigntyNoteTr: string | null): boolean {
  return locale === "tr" && isSpecialStatusRow(sovereigntyNoteTr);
}

/**
 * Does the fact sheet render the flag card for this row?
 *
 * Ordinary rows: always — a flag is data, not narrative, and 193 rows keep it in both
 * locales. **Special-status rows: only when the balancing note renders beside it**
 * (→ DEC 2026-08-08l B2, path (a)).
 *
 * Why the pair is welded, and why it is welded HERE. `DEC 2026-08-08h` ruled that visual
 * equality does not land ahead of textual balance: the flag is a visual sovereignty claim,
 * and on a contested row the note is the text that keeps it honest. That principle is
 * locale-independent — `noindex` does not answer it, because `noindex` is a search-engine
 * property and this is a reader property, and the EN page has readers. So on EN, where the
 * note cannot render, the flag does not render either: the six rows go dark TOGETHER.
 *
 * Symmetric absence is not the state `DEC 2026-08-08c` md.2 condemned. That ruling named an
 * ASYMMETRY (one contested row flagged, its twin not) as "not a neutral silence". This gate
 * closes all special-status rows in the same locale at the same moment, so the contested
 * pair stays in the same state as each other.
 *
 * Expressed through `showsSovereigntyNote` on purpose: the coupling is the requirement, so
 * it is written as a dependency rather than as a second condition that merely happens to
 * agree today. `lib/geo/sovereignty.test.ts` pins that they can never diverge.
 */
export function showsCountryFlag(locale: Locale, sovereigntyNoteTr: string | null): boolean {
  return !isSpecialStatusRow(sovereigntyNoteTr) || showsSovereigntyNote(locale, sovereigntyNoteTr);
}
