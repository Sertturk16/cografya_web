/**
 * Special-status (contested / non-standard recognition) country rows — the ONE place the
 * platform decides "is this row special-status?", so the two SEO surfaces that care cannot
 * drift apart.
 *
 * The api marks exactly these rows with a non-null `sovereigntyNoteTr`; the contract's own
 * field description is the definition: *"Yalnızca tanınma statüsü tartışmalı/standart-dışı
 * ülkeler için doldurulur; sıradan ülkelerde null"* (`CountryDetailDto`). Six rows carry it
 * today (Kıbrıs Cumhuriyeti, KKTC, İsrail, Filistin, Çin Cumhuriyeti (Tayvan), Kosova →
 * DEC 2026-07-13). Reading the marker rather than hard-coding ISO codes means a future
 * seeded row is covered the day it lands.
 *
 * What the marker changes on the page, and why:
 *
 * 1. **Section headings** (`/dunya/[slug]`): a special-status row keeps the PLAIN section
 *    heading ("Komşu Ülkeler") instead of the entity-named one ("Filistin'in Komşu
 *    Ülkeleri"). The entity-named H2 exists precisely to make each section independently
 *    extractable (SEO-POLICY §B3.4) — which is also what turns a neutral section marker
 *    into a standalone possessive assertion, on exactly the pages whose balancing text
 *    (`sovereigntyNoteTr` itself) is rendered nowhere yet. Cost of the plain form: a §B3.4
 *    **UYARI**-tier item on 6 of 196 pages. That is the cheaper side of the trade.
 * 2. **Meta description** (`lib/seo/country-description.ts`): a special-status row is routed
 *    to ONE fixed, non-copula skeleton instead of the ISO-code-keyed variant rotation, so a
 *    politically load-bearing sentence is never selected by a checksum over an internal
 *    identifier (KKTC's `QN` is a self-assigned code, → DEC 2026-07-13).
 *
 * This module encodes NO list of countries and resolves NO sovereignty question: it reads
 * the api's own marker and only decides how ASSERTIVELY the page chrome is worded.
 * Rendering `sovereigntyNoteTr` itself is a separate, tracked task.
 */
export function isSpecialStatusRow(sovereigntyNoteTr: string | null): boolean {
  return sovereigntyNoteTr !== null;
}
