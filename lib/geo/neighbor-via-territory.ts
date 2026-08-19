/**
 * The territory through which two countries share a land border, when that territory is NOT
 * the neighbour's mainland — so the "Komşu Ülkeler" card can say WHY it names that country.
 *
 * ## The reader problem (→ DEC 2026-08-19e md.1, owner-ruled)
 *
 * `/dunya/brezilya` listed a bare "Fransa" card among ten South American neighbours, two
 * paragraphs under an intro that says Brazil borders every South American country except
 * Chile and Ecuador. The card is CORRECT — the border is real — but nothing on the page says
 * it runs through French Guiana, so it reads as a data fault. The ruling: the explanation goes
 * in the card label, as a single parenthetical, and the prose is left alone.
 *
 * ## Which pairs qualify — the api's own rule, not a guess
 *
 * The seed docblock in `cografya_api/src/database/seeds/countries/europe-oceania.countries.ts`
 * ("NEIGHBOUR RECIPROCITY (corrected, → DEC 2026-07-13 'CORRECTION: Gibraltar')") defines
 * exactly which non-mainland borders propagate into `neighborIsoCodes` at all:
 *
 * > the exclave-inclusive rule applies ONLY to a fully constitutionally-integrated territory
 * > (DROM-equivalent / oblast / autonomous republic) — e.g. France↔Brazil via French Guiana
 * > (a DROM) and Russia↔Lithuania/Poland via Kaliningrad (an oblast) DO count. Gibraltar is a
 * > British Overseas Territory (NOT integrated UK territory), so the ES↔GB land border at
 * > La Línea does NOT propagate to either state's list […]
 *
 * So the set of qualifying pairs is closed by the same rule that created them, and this table
 * is derived from it rather than from a scan. **A continent-mismatch scan is the wrong query
 * and finds only two of the three families** — Kaliningrad has both ends in Europe, and a
 * sweep keyed on "the neighbour is on another continent" silently misses it. Measured against
 * all 199 seeded rows at `cografya_api` `dev @ ba4ce94`, the rule yields three families; the
 * FORWARD direction of each is below. Gibraltar (ES↔GB) and Hans Island (DK↔CA) are absent
 * from the corpus by that same correction, so they need no entry here.
 *
 * ## Direction — forward only, deliberately (→ Atlas ruling on this plan's S2)
 *
 * An entry is keyed `host → neighbour` and explains the NEIGHBOUR's territory. The reverse
 * direction (`/dunya/fransa` naming Brazil) is a real instance of the same confusion but NOT
 * the same construction: "Brezilya (Fransız Guyanası)" reads as though Brazil *were* French
 * Guiana. It is a recorded non-goal here and travels as its own item.
 *
 * ## Where the names come from
 *
 * None of the three is coined here — each is the form the seeded corpus already prints in its
 * own prose, so the card and the page's narrative read the same name (the discipline
 * `neighbor-country-names.ts` follows, for the same reason). Verified at `dev @ ba4ce94`:
 *
 * - **Fransız Guyanası** — FR `introTr` ("…Güney Amerika'daki Fransız Guyanası…") and SR
 *   `landformNoteTr` ("…doğuda Fransız Guyanası ile sınırı çizen…").
 * - **Kaliningrad** — LT `introTr` ("…Rusya'nın Kaliningrad Oblastı ile komşudur.") and PL
 *   ("…Rusya'nın Kaliningrad eksklavı bulunur."). The bare root is used, not the generic:
 *   the parenthetical answers "which piece of Russia", and `CONTENT-STYLE.md` §22 caps a card
 *   title at four words.
 * - **Ceuta ve Melilla** — ES `introTr` ("…Afrika kıyısındaki Ceuta ve Melilla eksklavları
 *   üzerinden Fas'la da kara sınırı paylaşır.") and MA `landformNoteTr`.
 *
 * The EN forms are the territories' own English names; `French Guiana` and `Kaliningrad` are
 * the api docblock's own spelling. Names are never translated per locale beyond this pair.
 *
 * ## What this must never do
 *
 * It decorates a LABEL and nothing else. `neighborIsoCodes` is the published render order
 * (AS-6c): this module cannot reorder it, cannot drop a code, and cannot add one. An ISO pair
 * with no entry returns `null` and the card renders exactly as it does today.
 */
import type { Locale } from "@/i18n/routing";

interface ViaTerritory {
  readonly tr: string;
  readonly en: string;
}

const FRENCH_GUIANA: ViaTerritory = { tr: "Fransız Guyanası", en: "French Guiana" };
const KALININGRAD: ViaTerritory = { tr: "Kaliningrad", en: "Kaliningrad" };
const CEUTA_MELILLA: ViaTerritory = { tr: "Ceuta ve Melilla", en: "Ceuta and Melilla" };

/** `host ISO → neighbour ISO → the neighbour's territory that carries the shared border`. */
export const NEIGHBOR_VIA_TERRITORY: Readonly<
  Record<string, Readonly<Record<string, ViaTerritory>>>
> = {
  // DROM — French Guiana borders Brazil (Oyapock/Maroni) and Suriname.
  BR: { FR: FRENCH_GUIANA },
  SR: { FR: FRENCH_GUIANA },
  // Oblast — the Kaliningrad exclave borders Lithuania and Poland, not the Russian mainland.
  LT: { RU: KALININGRAD },
  PL: { RU: KALININGRAD },
  // Autonomous cities — Spain's only land border with Morocco runs at Ceuta and Melilla.
  MA: { ES: CEUTA_MELILLA },
};

/**
 * The territory to name in `hostIso`'s card for `neighborIso`, or `null` when the two share
 * an ordinary mainland border (every pair but the five above).
 */
export function neighborViaTerritory(
  hostIso: string,
  neighborIso: string,
  locale: Locale,
): string | null {
  // `Object.hasOwn` rather than a bare index, and it is not defensive noise: both arguments
  // arrive as `string` from api data, so `"constructor"` walks the prototype chain and
  // `NEIGHBOR_VIA_TERRITORY.BR["constructor"]` resolves to a FUNCTION. `noUncheckedIndexedAccess`
  // types that away at compile time but cannot see it at runtime — the value is not
  // `undefined`, so an `=== undefined` guard passes it through and `.tr` yields `undefined`,
  // i.e. a `string`-typed return that is not a string. Caught by this module's own test.
  if (!Object.hasOwn(NEIGHBOR_VIA_TERRITORY, hostIso)) return null;
  const byNeighbor = NEIGHBOR_VIA_TERRITORY[hostIso];
  if (byNeighbor === undefined || !Object.hasOwn(byNeighbor, neighborIso)) return null;
  const territory = byNeighbor[neighborIso];
  if (territory === undefined) return null;
  return locale === "en" ? territory.en : territory.tr;
}
