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
 * is derived from it rather than from a scan.
 *
 * **The authority is the RULING, not the seed docblock that quotes it.** DEC 2026-07-13 names
 * qualifying families itself — France/French Guiana, Russia/Kaliningrad AND
 * Azerbaijan/Nakhchivan — while the seed docblock above gives only the first two, as examples
 * ("e.g."). Deriving the set from the examples silently dropped Nakhchivan; that omission
 * shipped and was caught in review (`SOV72-I1`/`CR72-I1`). The lesson is recorded here because
 * the trap is not obvious: an illustrative list read as an exhaustive one produces a table
 * that looks measured and is short by a family.
 *
 * **THIS DOCBLOCK STATES NO FAMILY COUNT, ON PURPOSE (→ `SOV72R2-I1`).** It carried one twice —
 * "three families", then "four" — and both were false at the very commit they cited: the first
 * missed Nakhchivan, the second missed Angola/Cabinda. A count is a measurement that rots the
 * moment the corpus grows, while reading as verified fact; the table below is the only
 * enumeration, and any check derives its expectation from the table's own content rather than
 * from a number written here. What IS durable is the METHOD, so that is what is recorded:
 *
 *   1. take DEC 2026-07-13's test — a fully constitutionally-integrated territory
 *      (DROM-equivalent / oblast / autonomous republic / province);
 *   2. for each seeded pair, ask whether the ENTIRE shared border runs through such a
 *      territory rather than through the neighbour's mainland;
 *   3. search the corpus by CONTENT for that condition — `eksklav|exclave|enklav|enclave`
 *      across the seed and the base-data source of record — never by continent mismatch,
 *      which misses Kaliningrad (both ends in Europe) and TR↔AZ (both ends in Asia), and
 *      never by a name the family is merely expected to carry.
 *   4. Discard the enclave STATES that sweep also returns: San Marino and Vatikan inside
 *      Italy, Lesotho inside South Africa. Those are sovereign neighbours in their own right,
 *      not exclave-mediated borders; Oecusse (TL↔ID) and Musandam (OM↔AE) are discarded too,
 *      because both pairs also touch on the mainland.
 *
 * Last run of that method: 2026-08-19 against `cografya_api` `dev @ ba4ce94`, all 199 seeded
 * rows plus `Owner's Inbox/dunya-haritasi-base-data/*.md`. Gibraltar (ES↔GB) and Hans Island
 * (DK↔CA) are absent from the corpus by DEC 2026-07-13's own correction and need no entry.
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
 * None is coined here — each ROOT is the form a project source already prints, so the card and
 * the page's narrative read the same name (the discipline `neighbor-country-names.ts` follows,
 * for the same reason). Some are the source string verbatim; some take its bare root without
 * the generic, because `CONTENT-STYLE.md` §22 caps a card title at four words and the
 * parenthetical only has to answer "which piece". Verified field by field at `dev @ ba4ce94`:
 *
 * | Label | Source | Relation |
 * | --- | --- | --- |
 * | `Fransız Guyanası` | FR `introTr`, SR `hydrographyNoteTr` | verbatim |
 * | `Kaliningrad` | LT `introTr` "Kaliningrad Oblastı", PL `introTr` "Kaliningrad eksklavı" | bare root |
 * | `Nahçıvan` | AZ `introTr` "Nahçıvan Özerk Cumhuriyeti" | bare root |
 * | `Ceuta ve Melilla` | ES `introTr`, MA `landformNoteTr` | verbatim |
 * | `Cabinda` | base-data `africa.md:458`/`:526` (Turkish prose) | verbatim |
 *
 * The last row is sourced from the base-data record rather than the seed, because the seed
 * prose never names it — that gap is exactly what made its first spelling wrong (see the
 * `CABINDA` entry below). A label whose only source is the base-data document is legitimate
 * but weaker, and worth saying out loud rather than letting the table imply seed backing.
 *
 * (The SR citation is `hydrographyNoteTr` — "…doğuda Fransız Guyanası ile sınırı çizen
 * Marowijne (Maroni) Nehri…". An earlier draft of this docblock said `landformNoteTr`, which
 * does not contain the phrase; corrected per `SOV72-M1`.)
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

/**
 * Which of the two label templates the pair takes.
 *
 * - `"identify"` → `"{name} ({territory})"`. The default. The parenthetical simply names the
 *   piece of the neighbour the border touches.
 * - `"through"` → `"{name} ({territory} üzerinden)"` / `"… (via …)"`. States the border
 *   MECHANISM and attributes nothing. Required where the territory is claimed by the very
 *   country whose page is being rendered (→ DEC 2026-08-19k, owner-ruled).
 */
type ViaWording = "identify" | "through";

interface ViaTerritory {
  readonly tr: string;
  readonly en: string;
  readonly wording: ViaWording;
}

const FRENCH_GUIANA: ViaTerritory = {
  tr: "Fransız Guyanası",
  en: "French Guiana",
  wording: "identify",
};
const KALININGRAD: ViaTerritory = { tr: "Kaliningrad", en: "Kaliningrad", wording: "identify" };
const NAHCIVAN: ViaTerritory = { tr: "Nahçıvan", en: "Nakhchivan", wording: "identify" };
/**
 * Angola's Cabinda province — the whole CG↔AO border is its, the Angolan mainland being cut
 * off by the DR Congo corridor. Verified in the base-data source of record, not inferred:
 * `Owner's Inbox/dunya-haritasi-base-data/africa.md:458` records it as a "Doğrulanmış eksklav
 * vakası … (Sovereign Limits + çapraz kaynak ile doğrulandı)" and `:526` states the CG side
 * ("Angola'ya sınır Cabinda eksklavı üzerinden").
 *
 * IDENTIFY form, ruled (→ AK-29a). The `"through"` carve exists for a territory claimed by the
 * very state whose page renders the card; no state claims Cabinda, so using the mechanism
 * wording here would IMPLY a dispute that does not exist — the carve has to stay narrow to
 * keep meaning anything.
 *
 * TR SPELLING — the corpus form won, and the round trip is worth recording. The first ruling
 * (AK-29) set the TR label to `Kabinda`. That form appears NOWHERE in
 * `cografya_api/src/database/seeds/` (measured; the same sweep returns the other four labels),
 * while every Turkish mention in `Owner's Inbox/dunya-haritasi-base-data/africa.md` spells it
 * `Cabinda`. It shipped once, flagged rather than quietly adopted, and AK-29a corrected it:
 * the `K-` form had come from the question's own wording, not from any project source. So this
 * label now satisfies the same rule as the other four — it repeats a form a project source
 * already prints — and TR and EN coincide because the name is not translated.
 */
const CABINDA: ViaTerritory = { tr: "Cabinda", en: "Cabinda", wording: "identify" };
/**
 * The one `"through"` entry, and the reason the discriminator exists at all (→ DEC
 * 2026-08-19k, owner-ruled; raised as `SOV72-C1` and adversarially validated).
 *
 * Morocco claims Ceuta and Melilla. On `/dunya/fas` — the claimant's OWN page — the
 * `"identify"` form ("İspanya (Ceuta ve Melilla)") reads as an attribution: it locates the two
 * cities inside Spain, in a standalone extractable card label, on a page whose `MA` row has no
 * `sovereigntyNoteTr` and therefore renders no balancing text. `"through"` says where the
 * border runs and stops there, which is the whole job the parenthetical was ruled to do.
 *
 * This is the precedent form for any future contested-territory neighbour pair: the wording is
 * a property of the PAIR, not of the renderer, so a new entry has to choose one and cannot
 * inherit a neutral-looking default by accident.
 */
const CEUTA_MELILLA: ViaTerritory = {
  tr: "Ceuta ve Melilla",
  en: "Ceuta and Melilla",
  wording: "through",
};

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
  // Autonomous republic — the ENTIRE Türkiye-Azerbaijan land border (~17 km) is Nakhchivan's;
  // the api's own row says so ("TR ONLY via the Nahçıvan exclave — EXCLAVE-INCLUSIVE per the
  // locked rule", country.seed-data.ts). AM and IR need no entry: both also touch the mainland.
  TR: { AZ: NAHCIVAN },
  // Province — the Angolan mainland is cut off from Congo-Republic by the DR Congo corridor,
  // so the entire CG↔AO border is Cabinda's.
  CG: { AO: CABINDA },
  // Autonomous cities — see CEUTA_MELILLA above for why this pair alone takes "through".
  MA: { ES: CEUTA_MELILLA },
};

/** The message key each wording maps to, single-sourced so the page cannot pick its own. */
const MESSAGE_KEY = {
  identify: "neighborVia",
  through: "neighborViaThrough",
} as const satisfies Record<ViaWording, string>;

export interface NeighborViaLabel {
  /** `CountryDetail` message key — interpolate with `{ name, territory }`. */
  readonly key: (typeof MESSAGE_KEY)[ViaWording];
  readonly territory: string;
}

/**
 * WHICH message the card prints and with what interpolation, or `null` when the two share an
 * ordinary mainland border (every pair but the six above).
 *
 * Returning a key rather than a finished string is the shape `lib/geo/country-sources.ts`
 * already uses on this same page, for the same two reasons: the choice stays a pure function
 * inside vitest's include glob for `lib` instead of a branch buried in a 500-line async Server
 * Component, and the copy itself stays in `messages/*.json` where the locale catalogues and
 * the content-style gate can see it.
 */
export function neighborViaTerritory(
  hostIso: string,
  neighborIso: string,
  locale: Locale,
): NeighborViaLabel | null {
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
  return {
    key: MESSAGE_KEY[territory.wording],
    territory: locale === "en" ? territory.en : territory.tr,
  };
}
