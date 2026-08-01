/**
 * The 43 non-country shapes on the `/dunya` map, as hover-card content.
 *
 * ## Why this is a static module and not api data
 *
 * These entities have **no api row and no detail page** — territory detail pages are a
 * separate, spec-first initiative that has not been spec'd (→ DEC 2026-07-26 K2). Modelling
 * them api-side today would mean an `entityType` split on `Country`, a migration, a new DTO
 * and a codegen round across two repos for 43 rows of frozen editorial copy that nothing
 * else consumes (teshis.md §5 Seçenek 3, explicitly not recommended). So the content lives
 * here: hand-authored, typed, server-only, and read by `WorldMapSection` exactly like the
 * generated shape table next to it.
 *
 * It is deliberately NOT in `messages/{tr,en}.json` either. `NextIntlClientProvider` in the
 * locale layout inherits the WHOLE catalogue and serialises it into the client payload of
 * every page, so 43 territory labels there would ship on the home page, the game and every
 * province page. This module is imported by a server component only: its strings reach the
 * browser once, as the `data-*` of the `/dunya` map, and nowhere else. UI chrome (the stat
 * labels) stays in the message catalogue where it belongs.
 *
 * ## Content authority — do not edit the copy here
 *
 * The card's second line is a LABEL, not a sentence. The one-line status sentences this
 * module shipped in its first three commits were retired wholesale (→ DEC 2026-08-01m):
 * every COUNTRY card on the same map carries a 1–2 word continent name in that slot, and a
 * 90-character sentence broke the parity. The context those sentences carried moves to the
 * territory detail pages (→ DEC 2026-08-01j) — never back into a longer label.
 *
 * Every `labelTr` is byte-for-byte the approved label in
 * `Owner's Inbox/dunya-territory-kartlari/kart-etiketleri.md` (NOVA, derived from the
 * independently fact-checked brief; owner-approved → DEC 2026-08-01n). Six of them are
 * **verbatim and binding** (EH, Somaliland, Siachen, FK, GS, IO — item 1 of that ruling):
 * each is a sovereignty judgement, not a description — "Egemenliği Tartışmalı Toprak" on
 * FK/GS deliberately names the dispute CLASS rather than one side's frame, and Siachen names
 * an unresolved status without naming a controlling party. They are never paraphrased,
 * trimmed or "improved" in code. Changing any label here requires a content round, not a
 * commit. `territories.test.ts` pins the structural invariants (≤3 words, no sentence
 * punctuation, shape-key existence, no `/dunya/turkiye`, no interval figures).
 *
 * ## Why there is no `labelEn`
 *
 * The labels exist in Turkish only. An English column was drafted with them but is a
 * SEPARATE approval item (→ DEC 2026-08-01n item 3): six of the labels are verbatim-locked
 * sovereignty texts whose English wording cannot be picked inside a frontend PR. Until that
 * round lands, the EN map renders the brief's own "Varyant A" (stat-only) card: name + ISO
 * badge + figures, all of which are locale-safe (numbers and proper nouns). No Turkish label
 * ever appears on `/en/dunya`.
 */

/**
 * One numeric card figure. Sources disagree for some territories, so the shape carries the
 * uncertainty instead of hiding it — but ONE figure always reaches the card:
 *
 * - `exact` — one figure, pinned to a Tier-1 source.
 * - `approx` — the source itself publishes the figure as an approximation (a rounded or
 *   converted value), so the card prints it as one. Rendered with a leading `≈` visually and
 *   with the WORD "yaklaşık"/"approximately" in the accessible name (screen readers do not
 *   speak U+2248). Collapsing such a figure to `exact` silently promotes a rounded number
 *   into a pinned one — the drift this member exists to prevent (→ DEC 2026-08-01g item 3:
 *   Somaliland's ≈176.000 and Chagos's ≈60; → DEC 2026-08-01l: Antarktika's ≈14.200.000).
 * - `none` — the fact IS "there is none" (no permanent population). Rendered as words.
 * - `unknown` — not publishable: no independent confirmation, or the only available figure
 *   carries a caveat a 258px card cannot honestly carry. The row is omitted entirely
 *   (never a placeholder dash).
 *
 * There is deliberately **no interval member**. The module shipped one (`range`, rendered
 * "63.300–63.778") for seven figures; DEC 2026-08-01l retired intervals from every card
 * surface — a card shows ONE value, chosen by a deterministic source ladder, with the
 * variance recorded in the provenance file instead. The member is REMOVED rather than left
 * unused so the ruling is structural: a future edit cannot reintroduce an interval and still
 * typecheck. (`≈` is not an interval and is unaffected — same ruling, explicit.)
 */
export type TerritoryFigure =
  | { readonly kind: "exact"; readonly value: number }
  | { readonly kind: "approx"; readonly value: number }
  | { readonly kind: "none" }
  | { readonly kind: "unknown" };

/** One non-country shape's hover-card content. */
export interface Territory {
  /**
   * Join key into `COUNTRY_SHAPES` (`world-countries.generated.ts`). Uppercase ISO 3166-1
   * alpha-2 where one exists, or the generator's synthetic `x-…` key for the two Natural
   * Earth entities that have no ISO at all.
   */
  readonly iso: string;
  /**
   * Pill badge text. Present only for real ISO codes — Somaliland and the Siachen Glacier
   * have none, and inventing one would assert a status nobody granted. The card already
   * renders without a badge.
   */
  readonly badge?: string;
  readonly nameTr: string;
  readonly nameEn: string;
  /**
   * TR card label — the second line of the card, in continent-name parity with the country
   * cards (max 3 words, no verb, no punctuation → DEC 2026-08-01m/n). NOT a sentence and
   * never edited in code; see the module note.
   */
  readonly labelTr: string;
  readonly population: TerritoryFigure;
  readonly areaKm2: TerritoryFigure;
  /**
   * Administrative centre, as the source brief's own centre column spells it. Normally a
   * bare proper noun, so ONE field serves both locales. Omitted where there is none
   * (city-regions, uninhabited territories) and for the six contested entities, whose
   * centre field was never owner-ruled — DEC 2026-08-01 left Batı Sahra's centre question
   * explicitly unanswered, so none of the six shows one.
   *
   * Two of the brief's 31 centre cells carry a qualifier ("Brades (fiili)",
   * "Saipan (Capital Hill)"); both are restored here rather than silently stripped.
   */
  readonly centre?: string;
  /**
   * EN override, used ONLY when `centre` carries a Turkish-language qualifier — the module
   * guarantees no Turkish ever reaches `/en/dunya`, and authoring an English hedge is
   * content work this repo does not own. Everywhere else the proper noun serves both
   * locales and this stays absent.
   */
  readonly centreEn?: string;
}

/**
 * All 43 shapes, in the reading order of the source brief (by administering state, then the
 * two special cases, then the six contested entities). Order is presentational only — the
 * map renders in `COUNTRY_SHAPES` order and looks entries up by ISO.
 */
export const TERRITORIES: readonly Territory[] = [
  // ---- Danimarka Krallığı (brief §1.1) ----
  {
    iso: "GL",
    badge: "GL",
    nameTr: "Grönland",
    nameEn: "Greenland",
    labelTr: "Danimarka Özerk Bölgesi",
    population: { kind: "exact", value: 56542 },
    areaKm2: { kind: "exact", value: 2166086 },
    centre: "Nuuk",
  },
  {
    iso: "FO",
    badge: "FO",
    nameTr: "Faroe Adaları",
    nameEn: "Faroe Islands",
    labelTr: "Danimarka Özerk Bölgesi",
    population: { kind: "exact", value: 54684 },
    areaKm2: { kind: "exact", value: 1393 },
    centre: "Tórshavn",
  },

  // ---- Finlandiya (brief §1.2) ----
  {
    iso: "AX",
    badge: "AX",
    nameTr: "Åland",
    nameEn: "Åland Islands",
    labelTr: "Finlandiya Özerk Bölgesi",
    population: { kind: "exact", value: 30836 },
    areaKm2: { kind: "exact", value: 1580 },
    centre: "Mariehamn",
  },

  // ---- Birleşik Krallık — Crown Dependency'ler (brief §1.3) ----
  {
    iso: "IM",
    badge: "IM",
    nameTr: "Man Adası",
    nameEn: "Isle of Man",
    labelTr: "Britanya Taç Bağımlılığı",
    population: { kind: "exact", value: 84975 },
    areaKm2: { kind: "exact", value: 572 },
    centre: "Douglas",
  },
  {
    iso: "JE",
    badge: "JE",
    nameTr: "Jersey",
    nameEn: "Jersey",
    labelTr: "Britanya Taç Bağımlılığı",
    population: { kind: "exact", value: 103944 },
    areaKm2: { kind: "exact", value: 116 },
    centre: "Saint Helier",
  },
  {
    iso: "GG",
    badge: "GG",
    nameTr: "Guernsey",
    nameEn: "Guernsey",
    labelTr: "Britanya Taç Bağımlılığı",
    population: { kind: "exact", value: 64781 },
    areaKm2: { kind: "exact", value: 78 },
    centre: "Saint Peter Port",
  },

  // ---- Birleşik Krallık — Denizaşırı Topraklar (brief §1.4) ----
  {
    iso: "BM",
    badge: "BM",
    nameTr: "Bermuda",
    nameEn: "Bermuda",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 63179 },
    areaKm2: { kind: "exact", value: 54 },
    centre: "Hamilton",
  },
  {
    iso: "KY",
    badge: "KY",
    nameTr: "Cayman Adaları",
    nameEn: "Cayman Islands",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 90577 },
    areaKm2: { kind: "exact", value: 259 },
    centre: "George Town",
  },
  {
    iso: "TC",
    badge: "TC",
    nameTr: "Turks ve Caicos Adaları",
    nameEn: "Turks and Caicos Islands",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 46431 },
    areaKm2: { kind: "exact", value: 948 },
    centre: "Cockburn Town",
  },
  {
    iso: "AI",
    badge: "AI",
    nameTr: "Anguilla",
    nameEn: "Anguilla",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 19416 },
    areaKm2: { kind: "exact", value: 91 },
    centre: "The Valley",
  },
  {
    iso: "MS",
    badge: "MS",
    nameTr: "Montserrat",
    nameEn: "Montserrat",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 5468 },
    areaKm2: { kind: "exact", value: 102 },
    // The brief's qualifier restored: the de-jure capital is still Plymouth, abandoned
    // under the 1995 eruption. EN drops the Turkish hedge and leans on the status-neutral
    // "Administrative centre" label instead.
    centre: "Brades (fiili)",
    centreEn: "Brades",
  },
  {
    iso: "VG",
    badge: "VG",
    nameTr: "Britanya Virjin Adaları",
    nameEn: "British Virgin Islands",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 40102 },
    areaKm2: { kind: "exact", value: 151 },
    centre: "Road Town",
  },
  {
    iso: "PN",
    badge: "PN",
    nameTr: "Pitcairn Adaları",
    nameEn: "Pitcairn Islands",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 50 },
    areaKm2: { kind: "exact", value: 47 },
    centre: "Adamstown",
  },
  {
    // Card title uses the brief's own short form (§4). The full administrative name —
    // "Saint Helena, Ascension and Tristan da Cunha" — covers three island groups
    // administered as one unit; as a TR card heading it would be four times the width of
    // every other title.
    iso: "SH",
    badge: "SH",
    nameTr: "Saint Helena",
    // Full EN name on purpose: the TR short form is the brief's own §4 title, but the EN
    // column there spells the whole thing out, and the card's figures are the THREE island
    // groups' totals. "Saint Helena" alone would load Ascension + Tristan da Cunha onto one
    // island, and neither card carries prose to disambiguate it.
    nameEn: "Saint Helena, Ascension and Tristan da Cunha",
    labelTr: "BK Denizaşırı Toprağı",
    population: { kind: "exact", value: 5651 },
    areaKm2: { kind: "exact", value: 394 },
    centre: "Jamestown",
  },

  // ---- Fransa (brief §1.5) ----
  {
    // Population = INSEE "population totale" (Décret n° 2025-1362), the convention the rest
    // of the French cells on this map already follow (PF's 283.147 is the same one). If that
    // convention ever changes to "population municipale", MF, PF and PM move together.
    iso: "MF",
    badge: "MF",
    nameTr: "Saint-Martin",
    nameEn: "Saint-Martin",
    labelTr: "Fransız Denizaşırı Topluluğu",
    population: { kind: "exact", value: 31620 },
    areaKm2: { kind: "exact", value: 50 },
    centre: "Marigot",
  },
  {
    // Population is the one figure the fact-check could not confirm from ANY independent
    // source (the draft's ≈11.550 stood alone), so it is not published — the Osmaniye
    // precedent in `data-provenance.md`: an unconfirmed value goes null, it does not go out
    // with a hedge.
    iso: "BL",
    badge: "BL",
    nameTr: "Saint-Barthélemy",
    nameEn: "Saint-Barthélemy",
    labelTr: "Fransız Denizaşırı Topluluğu",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 25 },
    centre: "Gustavia",
  },
  {
    iso: "PM",
    badge: "PM",
    nameTr: "Saint-Pierre ve Miquelon",
    nameEn: "Saint Pierre and Miquelon",
    labelTr: "Fransız Denizaşırı Topluluğu",
    population: { kind: "exact", value: 5819 },
    areaKm2: { kind: "exact", value: 242 },
    centre: "Saint-Pierre",
  },
  {
    iso: "WF",
    badge: "WF",
    nameTr: "Wallis ve Futuna",
    nameEn: "Wallis and Futuna",
    labelTr: "Fransız Denizaşırı Topluluğu",
    population: { kind: "exact", value: 11620 },
    areaKm2: { kind: "exact", value: 142 },
    centre: "Mata-Utu",
  },
  {
    iso: "NC",
    badge: "NC",
    nameTr: "Yeni Kaledonya",
    nameEn: "New Caledonia",
    labelTr: "Fransa'ya Bağlı Toprak",
    population: { kind: "exact", value: 264596 },
    areaKm2: { kind: "exact", value: 18567 },
    centre: "Nouméa",
  },
  {
    iso: "PF",
    badge: "PF",
    nameTr: "Fransız Polinezyası",
    nameEn: "French Polynesia",
    labelTr: "Fransız Denizaşırı Topluluğu",
    population: { kind: "exact", value: 283147 },
    areaKm2: { kind: "exact", value: 4167 },
    centre: "Papeete",
  },
  {
    // No centre: the administration sits in metropolitan France / Réunion, not on the
    // territory, so a "Merkez" row would point at somewhere the shape does not contain.
    iso: "TF",
    badge: "TF",
    nameTr: "Fransız Güney ve Antarktika Toprakları",
    nameEn: "French Southern and Antarctic Lands (TAAF)",
    // The label states the administrative relationship ONLY. The Adélie Land claim is
    // deliberately absent: the ruled framing ("not recognised / Treaty-frozen", never "other
    // states object") cannot survive in three words, and every short form of it either
    // measures the claim or invents an opposing party. Deliberate silence is the neutral
    // answer here; the context belongs to the detail page (→ DEC 2026-08-01n, §3.3 of the
    // approved label table).
    labelTr: "Fransız Denizaşırı Toprağı",
    population: { kind: "none" },
    // Area row REMOVED (→ DEC 2026-08-01g item 2). The 439.672 km² total is ~98% Adélie
    // Land, which the drawn shape does not contain and which the Antarctic Treaty freezes:
    // printing it measured a territorial claim into a number. `unknown` is the module's own
    // doctrine for a figure a 258px card cannot carry honestly — the row simply disappears.
    areaKm2: { kind: "unknown" },
  },

  // ---- Hollanda Krallığı (brief §1.6) ----
  {
    iso: "AW",
    badge: "AW",
    nameTr: "Aruba",
    nameEn: "Aruba",
    labelTr: "Hollanda Kurucu Ülkesi",
    population: { kind: "exact", value: 109435 },
    areaKm2: { kind: "exact", value: 180 },
    centre: "Oranjestad",
  },
  {
    iso: "CW",
    badge: "CW",
    nameTr: "Curaçao",
    nameEn: "Curaçao",
    labelTr: "Hollanda Kurucu Ülkesi",
    population: { kind: "exact", value: 156700 },
    areaKm2: { kind: "exact", value: 444 },
    centre: "Willemstad",
  },
  {
    iso: "SX",
    badge: "SX",
    nameTr: "Sint Maarten",
    nameEn: "Sint Maarten",
    labelTr: "Hollanda Kurucu Ülkesi",
    population: { kind: "exact", value: 42449 },
    areaKm2: { kind: "exact", value: 34 },
    centre: "Philipsburg",
  },

  // ---- Amerika Birleşik Devletleri (brief §1.7) ----
  {
    iso: "PR",
    badge: "PR",
    nameTr: "Porto Riko",
    nameEn: "Puerto Rico",
    labelTr: "ABD Dış Toprağı",
    population: { kind: "exact", value: 3184195 },
    areaKm2: { kind: "exact", value: 8868 },
    centre: "San Juan",
  },
  {
    // VI and MP publish the 2020 Island Areas CENSUS count, on the Census Bureau's own
    // instruction that its island-area estimate series has not incorporated the 2020 census
    // (the discarded intervals' upper ends were exactly that stale projection). GU and AS
    // below still carry estimate-vintage figures, so these four cards are knowingly mixed
    // vintage — recorded as a follow-up, not silently averaged away (selection table F2).
    iso: "VI",
    badge: "VI",
    nameTr: "ABD Virjin Adaları",
    nameEn: "United States Virgin Islands",
    labelTr: "ABD Dış Toprağı",
    population: { kind: "exact", value: 87146 },
    areaKm2: { kind: "exact", value: 348 },
    centre: "Charlotte Amalie",
  },
  {
    iso: "GU",
    badge: "GU",
    nameTr: "Guam",
    nameEn: "Guam",
    labelTr: "ABD Dış Toprağı",
    population: { kind: "exact", value: 168399 },
    areaKm2: { kind: "exact", value: 561 },
    centre: "Hagåtña",
  },
  {
    iso: "MP",
    badge: "MP",
    nameTr: "Kuzey Mariana Adaları",
    nameEn: "Northern Mariana Islands",
    labelTr: "ABD Dış Toprağı",
    population: { kind: "exact", value: 47329 },
    areaKm2: { kind: "exact", value: 472 },
    // Brief-exact: "Saipan" is the island, "Capital Hill" the seat of government. Both are
    // proper nouns, so the one field still serves both locales.
    centre: "Saipan (Capital Hill)",
  },
  {
    iso: "AS",
    badge: "AS",
    nameTr: "Amerikan Samoası",
    nameEn: "American Samoa",
    labelTr: "ABD Dış Toprağı",
    population: { kind: "exact", value: 43268 },
    areaKm2: { kind: "exact", value: 224 },
    centre: "Pago Pago",
  },

  // ---- Çin Halk Cumhuriyeti — Özel İdari Bölgeler (brief §1.8) ----
  {
    // No centre row: the territory IS the city.
    iso: "HK",
    badge: "HK",
    nameTr: "Hong Kong",
    nameEn: "Hong Kong",
    labelTr: "Özel İdari Bölge (Çin)",
    population: { kind: "exact", value: 7599000 },
    areaKm2: { kind: "exact", value: 1115 },
  },
  {
    // Land area (32,9 km², DSEC, post-reclamation) — NOT the 119,3 km² land+maritime
    // jurisdiction figure. Every other card on this map is a land area, and an unlabelled
    // 119,3 next to Hong Kong's 1.115 would read as a size comparison that is not true
    // (fact-check note to Vera, 2026-08-01).
    iso: "MO",
    badge: "MO",
    nameTr: "Makao",
    nameEn: "Macau",
    labelTr: "Özel İdari Bölge (Çin)",
    population: { kind: "exact", value: 688900 },
    areaKm2: { kind: "exact", value: 32.9 },
  },

  // ---- Avustralya (brief §1.9) ----
  {
    iso: "NF",
    badge: "NF",
    nameTr: "Norfolk Adası",
    nameEn: "Norfolk Island",
    labelTr: "Avustralya Dış Toprağı",
    population: { kind: "exact", value: 2188 },
    areaKm2: { kind: "exact", value: 36 },
    centre: "Kingston",
  },
  {
    iso: "HM",
    badge: "HM",
    nameTr: "Heard ve McDonald Adaları",
    nameEn: "Heard Island and McDonald Islands",
    // The AAT-volcano clause is gone (→ DEC 2026-08-01g item 1): the sources attach that
    // record to Australia's highest POINT, not to volcanoes, so the clause carried zero
    // correct information — and it measured/attributed territory inside the Antarctic
    // Treaty area, now a standing axis of every territory content review.
    labelTr: "Avustralya Dış Toprağı",
    population: { kind: "none" },
    areaKm2: { kind: "exact", value: 368 },
  },

  // ---- Yeni Zelanda (brief §1.10) ----
  {
    iso: "CK",
    badge: "CK",
    nameTr: "Cook Adaları",
    nameEn: "Cook Islands",
    labelTr: "Serbest Ortaklık Devleti",
    population: { kind: "exact", value: 15040 },
    areaKm2: { kind: "exact", value: 240 },
    centre: "Avarua",
  },
  {
    iso: "NU",
    badge: "NU",
    nameTr: "Niue",
    nameEn: "Niue",
    labelTr: "Serbest Ortaklık Devleti",
    population: { kind: "exact", value: 1822 },
    areaKm2: { kind: "exact", value: 260 },
    centre: "Alofi",
  },

  // ---- Özel iki durum: egemen devlet + kıta (brief §1.11) ----
  {
    // NOT a territory — a sovereign city state, deliberately absent from the 196-country
    // corpus (→ DEC 2026-07-13). Hence the one label on this map that describes what the
    // place IS instead of what it belongs to: an "…'ya bağlı" form would be false here.
    iso: "VA",
    badge: "VA",
    nameTr: "Vatikan",
    nameEn: "Vatican City",
    labelTr: "Egemen Şehir Devleti",
    population: { kind: "exact", value: 882 },
    areaKm2: { kind: "exact", value: 0.49 },
  },
  {
    iso: "AQ",
    badge: "AQ",
    nameTr: "Antarktika",
    nameEn: "Antarctica",
    labelTr: "Tarafsız Kıta",
    population: { kind: "none" },
    // ONE value, not the old 14.000.000–14.200.000 interval (→ DEC 2026-08-01l). Antarctica
    // has no statistics office, no census and no UN series, so the source ladder runs to its
    // last rung (CIA World Factbook): 285.000 km² ice-free + 13.915.000 km² ice-covered =
    // 14,2 million, i.e. the ice-shelf-inclusive convention. The figure is rounded at source,
    // so it keeps the ≈ — an approximation is not an interval.
    areaKm2: { kind: "approx", value: 14200000 },
  },

  // ---- 🔴 Owner-approved VERBATIM labels (→ DEC 2026-08-01n item 1) ----
  // Six sovereignty-sensitive entities. Their labels are byte-locked by the owner and their
  // reasoning lives in the approved label table (§2) — the short form is that each names a
  // status CLASS and never a party.
  // These six also carry NO population row. None of their population figures was owner-ruled
  // and each needs a caveat a 258px card cannot carry honestly: Batı Sahra's figure excludes
  // the Tindouf refugee population, Somaliland's is flagged [KAYNAK DOĞRULANAMADI], Siachen
  // has only military personnel, and Chagos's zero is the result of the 1960s removal of its
  // population. The label cannot state such a caveat either (3 words), so the row stays off
  // until a ruling says otherwise. Areas are plain, uncontested figures and are shown.
  {
    iso: "EH",
    badge: "EH",
    nameTr: "Batı Sahra",
    nameEn: "Western Sahara",
    labelTr: "Özyönetimi Olmayan Toprak",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 272000 },
  },
  {
    iso: "x-somaliland",
    nameTr: "Somaliland",
    nameEn: "Somaliland",
    labelTr: "Statüsü Tartışmalı Bölge",
    population: { kind: "unknown" },
    // ≈, not exact (→ DEC 2026-08-01g item 3): the brief's figure is a rounded conversion
    // from 68.000 sq mi. It was collapsed to a pinned number in the first round; the card
    // now carries the approximation the source actually published.
    areaKm2: { kind: "approx", value: 176000 },
  },
  {
    iso: "x-siachen-glacier",
    nameTr: "Siachen Buzulu",
    nameEn: "Siachen Glacier",
    labelTr: "Statüsü Çözülmemiş Bölge",
    population: { kind: "unknown" },
    areaKm2: { kind: "unknown" },
  },
  {
    // Title fixed by DEC 2026-08-01 to the UN's own usage; the EN name is that same usage
    // in English.
    iso: "FK",
    badge: "FK",
    nameTr: "Falkland Adaları (Malvinas)",
    nameEn: "Falkland Islands (Malvinas)",
    labelTr: "Egemenliği Tartışmalı Toprak",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 12170 },
  },
  {
    iso: "GS",
    badge: "GS",
    nameTr: "Güney Georgia ve Güney Sandwich Adaları",
    nameEn: "South Georgia and the South Sandwich Islands",
    labelTr: "Egemenliği Tartışmalı Toprak",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 3903 },
  },
  {
    // The brief's own name cell carries both names; the primary-name question was never
    // owner-ruled (the rulings covered the card text only), so neither name is dropped.
    // WATCH ITEM: the label describes a transfer IN PROGRESS. When the Mauritius agreement
    // enters into force it stops being true and needs a new ruling (tracked with Atlas).
    iso: "IO",
    badge: "IO",
    nameTr: "Britanya Hint Okyanusu Toprakları (Chagos)",
    nameEn: "British Indian Ocean Territory (Chagos)",
    labelTr: "Devir Sürecindeki Toprak",
    population: { kind: "unknown" },
    // ≈, not exact — the same collapse as Somaliland, corrected together (→ DEC 2026-08-01g
    // item 3). The brief publishes ≈60 km² of LAND across the archipelago.
    areaKm2: { kind: "approx", value: 60 },
  },
];

/** Lookup by shape key, built once at module load. */
const BY_ISO: ReadonlyMap<string, Territory> = new Map(TERRITORIES.map((t) => [t.iso, t]));

/** The territory for a map shape key, or `undefined` if the shape is not one. */
export function territoryFor(iso: string): Territory | undefined {
  return BY_ISO.get(iso);
}

/** Locale-resolved administrative centre, or `undefined` where there is none. */
export function centreFor(territory: Territory, locale: "tr" | "en"): string | undefined {
  return locale === "en" ? (territory.centreEn ?? territory.centre) : territory.centre;
}

/**
 * Rendering inputs for {@link figureText}. `noneText` is OPTIONAL by design: "there is
 * none" is a real fact for a population and a meaningless one for an area, so the area
 * call passes no wording and a (forbidden, test-pinned) `none` area drops its row instead
 * of borrowing the population sentence.
 */
export interface FigureTextOptions {
  /** Locale-aware number formatter (next-intl's, injected so this stays pure/testable). */
  readonly formatNumber: (value: number) => string;
  /** Words for a `none` figure — population only. */
  readonly noneText?: string;
  /**
   * Unit suffix appended to numeric output ("km²"). Never appended to `noneText` — "Kalıcı
   * nüfus yok km²" is not a thing.
   */
  readonly unit?: string;
  /**
   * Localized word for "approximately". Supplied ONLY by the accessible-name pass: with it,
   * an `approx` figure reads "yaklaşık 176.000 km²" instead of the visual "≈176.000 km²".
   * Screen readers do not announce U+2248 at all, so without it the spoken card presents a
   * rounded figure as a pinned one — exactly the drift the `approx` member exists to prevent
   * (review finding sov-r3-m1). The glyph stays purely visual.
   */
  readonly approxWord?: string;
}

/**
 * Non-breaking space between a number and its unit. A 258px card cannot fit Antarktika's
 * 7-digit area plus "km²" on one line, and with a normal space the browser orphans the unit
 * onto a line of its own; gluing the unit to its number moves the break to the label/value
 * boundary, which is where the stat row is built to wrap.
 */
const NBSP = "\u00A0";

/**
 * Approximation marker (U+2248 ALMOST EQUAL TO), printed tight against the number: "\u2248176.000".
 * It is the brief's own notation and a locale-neutral one \u2014 the digit grouping around it is
 * still the locale's (`176.000` TR / `176,000` EN), so no Turkish wording can leak onto
 * `/en/dunya`. Its SPOKEN counterpart is {@link FigureTextOptions.approxWord}, which is a
 * message-catalogue string precisely because a word cannot be locale-neutral.
 *
 * TYPOGRAPHY, KNOWN AND ACCEPTED: U+2248 is outside both Google subsets the app loads
 * (`latin` stops the symbol block at U+2212/U+2215; `latin-ext` is U+100–2C5 and friends), so
 * this one character falls through Fraunces to the next family in `--font-heading` — Georgia
 * on macOS/Windows, the platform serif elsewhere. Measured at 1440×900 the difference is a
 * ~2px-wider, slightly heavier symbol next to Fraunces digits; a rendered sample is in the
 * PR's final-sample set. The alternatives were both worse: shipping a `next/font/local` face
 * for ONE glyph puts a whole extra font request in the CWV budget, and swapping the marker
 * for a latin-subset character (`~`) would edit ruled notation (→ DEC 2026-08-01g item 3)
 * on a sovereignty-sensitive card. So the fallback is deliberate, not an oversight.
 */
const APPROX = "\u2248";

/**
 * Renders a territory figure for a card stat row, or `undefined` when there is nothing
 * publishable.
 *
 * `unknown` returns `undefined` ON PURPOSE: the card omits the whole row rather than print
 * a placeholder dash, which is the same honesty rule the country cards follow for a null
 * stat, and the rule the six contested entities depend on (→ the module note above). A
 * future `default:`/`"—"` fallback here would grow a dash row on every one of them, so
 * `territories.test.ts` pins the branch.
 */
export function figureText(
  figure: TerritoryFigure,
  { formatNumber, noneText, unit, approxWord }: FigureTextOptions,
): string | undefined {
  const suffix = unit ? `${NBSP}${unit}` : "";
  switch (figure.kind) {
    case "exact":
      return `${formatNumber(figure.value)}${suffix}`;
    case "approx":
      // Word for the accessible name, glyph for the eye — same figure, same uncertainty.
      return approxWord
        ? `${approxWord} ${formatNumber(figure.value)}${suffix}`
        : `${APPROX}${formatNumber(figure.value)}${suffix}`;
    case "none":
      return noneText;
    case "unknown":
      return undefined;
  }
}
