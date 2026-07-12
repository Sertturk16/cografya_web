/**
 * Turkish display names for countries that appear as a neighbour of a seeded country but
 * do NOT (yet) have their own `/dunya/{slug}` page.
 *
 * WHY THIS EXISTS. The country detail page's "Komşu Ülkeler" block renders every neighbour
 * from the api's `neighborIsoCodes`. A neighbour that IS seeded resolves to a live country
 * (name + slug → a real link) straight from the api. A neighbour that is NOT yet seeded has
 * no api record at all, but the brief still wants it shown — as PLAIN TEXT, not a link, and
 * not omitted (unlike the province map, which omits unseeded neighbours). That plain-text
 * label needs a name from somewhere, and inventing one client-side is forbidden
 * (CONVENTIONS §4/§6 — nothing sourceless ships). So this is a small, committed, authoritative
 * reference table: the ISO 3166-1 alpha-2 → official Turkish exonym, scoped to exactly the
 * codes that occur as an unseeded neighbour of one of the 8 pilot countries.
 *
 * SOURCE. The forms are the official Turkish country names (T.C. Dışişleri Bakanlığı list,
 * the source of record locked for country names → DEC 2026-07-13), and are transcribed to
 * match verbatim the usage in NOVA's independently fact-checked pilot seed prose
 * (`cografya_api` `country.seed-data.ts` intro/landform notes) — so the neighbour label and
 * the seeded countries' own prose read the same name.
 *
 * LIFECYCLE. This is a stopgap keyed to the current seed. As more countries are seeded, each
 * entry here is naturally superseded by the api's own record (a seeded neighbour becomes a
 * link, never reading from this table). A cleaner long-term fix — the api returning neighbour
 * display names directly on the contract — is a tracked follow-up; until then this table
 * stays the single, sourced place for unseeded-neighbour labels. An unknown code resolves to
 * `null` and the caller omits it rather than rendering a broken/blank chip.
 */
const NEIGHBOR_COUNTRY_NAMES_TR: Readonly<Record<string, string>> = {
  AF: "Afganistan",
  AL: "Arnavutluk",
  IL: "İsrail",
  JO: "Ürdün",
  KW: "Kuveyt",
  LB: "Lübnan",
  MK: "Kuzey Makedonya",
  PK: "Pakistan",
  RO: "Romanya",
  RS: "Sırbistan",
  RU: "Rusya",
  SA: "Suudi Arabistan",
  TM: "Türkmenistan",
  TR: "Türkiye",
};

/** Official Turkish name for an unseeded neighbour ISO code, or `null` if unknown. */
export function neighborCountryNameTr(isoCode: string): string | null {
  return NEIGHBOR_COUNTRY_NAMES_TR[isoCode] ?? null;
}
