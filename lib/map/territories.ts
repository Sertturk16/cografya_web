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
 * every page, so 43 status sentences there would ship on the home page, the game and every
 * province page. This module is imported by a server component only: its strings reach the
 * browser once, as the `data-*` of the `/dunya` map, and nowhere else. UI chrome (the stat
 * labels) stays in the message catalogue where it belongs.
 *
 * ## Content authority — do not edit the copy here
 *
 * Every `statusTr` is byte-for-byte the sentence in
 * `Owner's Inbox/dunya-territory-kartlari/brief.md` (NOVA, independently fact-checked
 * 2026-08-01). The six contested entities (EH, Somaliland, Siachen, FK, GS, IO) carry the
 * owner-approved **verbatim** text from that brief's "🔴 ONAY METİNLERİ" section and are
 * **binding** (→ DEC 2026-08-01b): they are never paraphrased, trimmed or "improved" in
 * code. Changing any sentence here requires a new content round, not a commit.
 * `territories.test.ts` pins the invariants (character cap, shape-key existence, no
 * `/dunya/turkiye`).
 *
 * ## Why there is no `statusEn`
 *
 * The status sentences exist in Turkish only. Producing English ones is content authorship
 * on a sovereignty-sensitive surface — six of them are verbatim-locked and six more are
 * owner-approved sensitive phrasings (→ DEC 2026-08-01) — so it needs its own content +
 * approval round, not a translation inside a frontend PR. Until then the EN map renders the
 * brief's own "Varyant A" (stat-only) card: name + ISO badge + figures, all of which are
 * locale-safe (numbers and proper nouns). No Turkish sentence ever appears on `/en/dunya`.
 */

/**
 * One numeric card figure. Sources disagree for some territories, so the shape carries the
 * uncertainty instead of hiding it:
 *
 * - `exact` — one figure, pinned to a Tier-1 source.
 * - `range` — the brief's own published interval, shown as an interval (the platform's
 *   established treatment for a figure that is real but not pinned to a single source —
 *   `data-provenance.md`, Burdur summit precedent).
 * - `none` — the fact IS "there is none" (no permanent population). Rendered as words.
 * - `unknown` — not publishable: no independent confirmation, or the only available figure
 *   carries a caveat a 258px card cannot honestly carry. The row is omitted entirely
 *   (never a placeholder dash).
 */
export type TerritoryFigure =
  | { readonly kind: "exact"; readonly value: number }
  | { readonly kind: "range"; readonly min: number; readonly max: number }
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
  /** TR card sentence — see the module note. Never edited in code. */
  readonly statusTr: string;
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
    statusTr: "Danimarka Krallığı'na bağlı, geniş iç özerkliğe sahip ülke",
    population: { kind: "exact", value: 56542 },
    areaKm2: { kind: "exact", value: 2166086 },
    centre: "Nuuk",
  },
  {
    iso: "FO",
    badge: "FO",
    nameTr: "Faroe Adaları",
    nameEn: "Faroe Islands",
    statusTr: "Danimarka Krallığı'na bağlı, kendi kendini yöneten bölge (1948 Home Rule Yasası)",
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
    statusTr:
      "Finlandiya'ya bağlı, 1921 Milletler Cemiyeti kararıyla tescillenmiş, silahsız özerk bölge",
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
    statusTr: "Britanya Tacı'na bağlı özerk bölge (Crown Dependency); BK'nin parçası değildir",
    population: { kind: "exact", value: 84975 },
    areaKm2: { kind: "exact", value: 572 },
    centre: "Douglas",
  },
  {
    iso: "JE",
    badge: "JE",
    nameTr: "Jersey",
    nameEn: "Jersey",
    statusTr: "Britanya Tacı'na bağlı özerk bölge (Crown Dependency)",
    population: { kind: "exact", value: 103944 },
    areaKm2: { kind: "exact", value: 116 },
    centre: "Saint Helier",
  },
  {
    iso: "GG",
    badge: "GG",
    nameTr: "Guernsey",
    nameEn: "Guernsey",
    statusTr: "Britanya Tacı'na bağlı özerk bölge (Crown Dependency)",
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
    statusTr:
      "Birleşik Krallık'a bağlı denizaşırı toprak; en eski ve en kalabalık BK denizaşırı toprağı",
    population: { kind: "range", min: 63300, max: 63778 },
    areaKm2: { kind: "exact", value: 54 },
    centre: "Hamilton",
  },
  {
    iso: "KY",
    badge: "KY",
    nameTr: "Cayman Adaları",
    nameEn: "Cayman Islands",
    statusTr: "Birleşik Krallık'a bağlı denizaşırı toprak",
    population: { kind: "range", min: 91116, max: 91166 },
    areaKm2: { kind: "exact", value: 259 },
    centre: "George Town",
  },
  {
    iso: "TC",
    badge: "TC",
    nameTr: "Turks ve Caicos Adaları",
    nameEn: "Turks and Caicos Islands",
    statusTr: "Birleşik Krallık'a bağlı denizaşırı toprak",
    population: { kind: "exact", value: 46431 },
    areaKm2: { kind: "exact", value: 948 },
    centre: "Cockburn Town",
  },
  {
    iso: "AI",
    badge: "AI",
    nameTr: "Anguilla",
    nameEn: "Anguilla",
    statusTr: "Birleşik Krallık'a bağlı denizaşırı toprak",
    population: { kind: "exact", value: 19416 },
    areaKm2: { kind: "exact", value: 91 },
    centre: "The Valley",
  },
  {
    iso: "MS",
    badge: "MS",
    nameTr: "Montserrat",
    nameEn: "Montserrat",
    statusTr: "Birleşik Krallık'a bağlı toprak; 1995 yanardağı sonrası merkez Brades'e taşındı",
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
    statusTr: "Birleşik Krallık'a bağlı denizaşırı toprak",
    population: { kind: "exact", value: 40102 },
    areaKm2: { kind: "exact", value: 151 },
    centre: "Road Town",
  },
  {
    iso: "PN",
    badge: "PN",
    nameTr: "Pitcairn Adaları",
    nameEn: "Pitcairn Islands",
    statusTr:
      "Birleşik Krallık'a bağlı toprak; dünyanın en az nüfuslu yerleşik topraklarından biri",
    population: { kind: "exact", value: 50 },
    areaKm2: { kind: "exact", value: 47 },
    centre: "Adamstown",
  },
  {
    // Card title uses the brief's own short form (§4). The full administrative name —
    // "Saint Helena, Ascension and Tristan da Cunha" — is what the status sentence
    // describes ("üç ada grubunu tek idari birim olarak kapsar"); as a card heading it
    // would be four times the width of every other title.
    iso: "SH",
    badge: "SH",
    nameTr: "Saint Helena",
    // Full EN name on purpose: the TR short form is the brief's own §4 title, but the EN
    // column there spells the whole thing out, and the card's figures are the THREE island
    // groups' totals. "Saint Helena" alone would load Ascension + Tristan da Cunha onto one
    // island on the stat-only EN card, which has no sentence to disambiguate it.
    nameEn: "Saint Helena, Ascension and Tristan da Cunha",
    statusTr: "Birleşik Krallık'a bağlı toprak; üç ada grubunu tek idari birim olarak kapsar",
    population: { kind: "exact", value: 5651 },
    areaKm2: { kind: "exact", value: 394 },
    centre: "Jamestown",
  },

  // ---- Fransa (brief §1.5) ----
  {
    iso: "MF",
    badge: "MF",
    nameTr: "Saint-Martin",
    nameEn: "Saint-Martin",
    statusTr: "Fransa'ya bağlı topluluk; adayı Hollanda Krallığı'na bağlı Sint Maarten'le paylaşır",
    population: { kind: "range", min: 31500, max: 33093 },
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
    statusTr: "Fransa'ya bağlı denizaşırı topluluk",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 25 },
    centre: "Gustavia",
  },
  {
    iso: "PM",
    badge: "PM",
    nameTr: "Saint-Pierre ve Miquelon",
    nameEn: "Saint Pierre and Miquelon",
    statusTr: "Fransa'ya bağlı denizaşırı topluluk (Kuzey Amerika kıyısında, Kanada açıklarında)",
    population: { kind: "exact", value: 5819 },
    areaKm2: { kind: "exact", value: 242 },
    centre: "Saint-Pierre",
  },
  {
    iso: "WF",
    badge: "WF",
    nameTr: "Wallis ve Futuna",
    nameEn: "Wallis and Futuna",
    statusTr: "Fransa'ya bağlı denizaşırı topluluk",
    population: { kind: "exact", value: 11620 },
    areaKm2: { kind: "exact", value: 142 },
    centre: "Mata-Utu",
  },
  {
    iso: "NC",
    badge: "NC",
    nameTr: "Yeni Kaledonya",
    nameEn: "New Caledonia",
    statusTr:
      "Fransa'ya bağlı; Bougival Anlaşması (Tem 2025) yeni statü öngörüyor, süreç netleşmedi",
    population: { kind: "exact", value: 264596 },
    areaKm2: { kind: "exact", value: 18567 },
    centre: "Nouméa",
  },
  {
    iso: "PF",
    badge: "PF",
    nameTr: "Fransız Polinezyası",
    nameEn: "French Polynesia",
    statusTr: "Fransa'ya bağlı denizaşırı topluluk",
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
    statusTr: "Fransa'ya bağlı, kalıcı nüfusu olmayan toprak; bir kesimi (Adélie) Antarktika'dadır",
    population: { kind: "none" },
    areaKm2: { kind: "exact", value: 439672 },
  },

  // ---- Hollanda Krallığı (brief §1.6) ----
  {
    iso: "AW",
    badge: "AW",
    nameTr: "Aruba",
    nameEn: "Aruba",
    statusTr: "Hollanda Krallığı'nın dört kurucu ülkesinden biri (1986'dan beri)",
    population: { kind: "exact", value: 109435 },
    areaKm2: { kind: "exact", value: 180 },
    centre: "Oranjestad",
  },
  {
    iso: "CW",
    badge: "CW",
    nameTr: "Curaçao",
    nameEn: "Curaçao",
    statusTr: "Hollanda Krallığı'nın dört kurucu ülkesinden biri (2010'dan beri)",
    population: { kind: "exact", value: 156700 },
    areaKm2: { kind: "exact", value: 444 },
    centre: "Willemstad",
  },
  {
    iso: "SX",
    badge: "SX",
    nameTr: "Sint Maarten",
    nameEn: "Sint Maarten",
    statusTr:
      "Hollanda Krallığı'nın kurucu ülkesi (2010); adayı Fransa'ya bağlı Saint-Martin'le paylaşır",
    population: { kind: "range", min: 44404, max: 46738 },
    areaKm2: { kind: "exact", value: 34 },
    centre: "Philipsburg",
  },

  // ---- Amerika Birleşik Devletleri (brief §1.7) ----
  {
    iso: "PR",
    badge: "PR",
    nameTr: "Porto Riko",
    nameEn: "Puerto Rico",
    statusTr:
      "ABD'ye bağlı, ilhak edilmemiş toprak; resmî statüsü Commonwealth (Serbest Birlik Devleti)",
    population: { kind: "exact", value: 3184195 },
    areaKm2: { kind: "exact", value: 8868 },
    centre: "San Juan",
  },
  {
    iso: "VI",
    badge: "VI",
    nameTr: "ABD Virjin Adaları",
    nameEn: "United States Virgin Islands",
    statusTr: "ABD'ye bağlı, ilhak edilmemiş ve örgütlenmiş toprak",
    population: { kind: "range", min: 78500, max: 84905 },
    areaKm2: { kind: "exact", value: 348 },
    centre: "Charlotte Amalie",
  },
  {
    iso: "GU",
    badge: "GU",
    nameTr: "Guam",
    nameEn: "Guam",
    statusTr: "ABD'ye bağlı, ilhak edilmemiş toprak",
    population: { kind: "exact", value: 168399 },
    areaKm2: { kind: "exact", value: 561 },
    centre: "Hagåtña",
  },
  {
    iso: "MP",
    badge: "MP",
    nameTr: "Kuzey Mariana Adaları",
    nameEn: "Northern Mariana Islands",
    statusTr: "ABD ile siyasi birlik içinde, kendi kendini yöneten topluluk (commonwealth)",
    population: { kind: "range", min: 42914, max: 50255 },
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
    statusTr: "ABD'ye bağlı, ilhak edilmemiş ve örgütlenmemiş toprak",
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
    statusTr:
      "Çin Halk Cumhuriyeti'ne bağlı özel idari bölge; 'Bir Ülke, İki Sistem', 1997'den 50 yıl",
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
    statusTr:
      "Çin Halk Cumhuriyeti'ne bağlı özel idari bölge; 'Bir Ülke, İki Sistem', 1999'dan 50 yıl",
    population: { kind: "exact", value: 688900 },
    areaKm2: { kind: "exact", value: 32.9 },
  },

  // ---- Avustralya (brief §1.9) ----
  {
    iso: "NF",
    badge: "NF",
    nameTr: "Norfolk Adası",
    nameEn: "Norfolk Island",
    statusTr: "Avustralya'ya bağlı dış toprak",
    population: { kind: "exact", value: 2188 },
    areaKm2: { kind: "exact", value: 36 },
    centre: "Kingston",
  },
  {
    iso: "HM",
    badge: "HM",
    nameTr: "Heard ve McDonald Adaları",
    nameEn: "Heard Island and McDonald Islands",
    statusTr:
      "Avustralya'ya bağlı, nüfussuz toprak; Antarktika Toprağı dışında ülkenin tek aktif volkanı",
    population: { kind: "none" },
    areaKm2: { kind: "exact", value: 368 },
  },

  // ---- Yeni Zelanda (brief §1.10) ----
  {
    iso: "CK",
    badge: "CK",
    nameTr: "Cook Adaları",
    nameEn: "Cook Islands",
    statusTr: "Yeni Zelanda ile serbest ortaklık ilişkisinde kendi kendini yöneten devlet",
    population: { kind: "exact", value: 15040 },
    areaKm2: { kind: "exact", value: 240 },
    centre: "Avarua",
  },
  {
    iso: "NU",
    badge: "NU",
    nameTr: "Niue",
    nameEn: "Niue",
    statusTr: "Yeni Zelanda ile serbest ortaklık ilişkisinde kendi kendini yöneten devlet",
    population: { kind: "exact", value: 1822 },
    areaKm2: { kind: "exact", value: 260 },
    centre: "Alofi",
  },

  // ---- Özel iki durum: egemen devlet + kıta (brief §1.11) ----
  {
    // NOT a territory — a sovereign city state, deliberately absent from the 196-country
    // corpus (→ DEC 2026-07-13). The sentence is the factual half of the brief's §1.11
    // cell; the rest of that cell is an internal note to the reader of the brief (corpus
    // bookkeeping), which CONTENT-STYLE §22 bars from a user-facing surface.
    iso: "VA",
    badge: "VA",
    nameTr: "Vatikan",
    nameEn: "Vatican City",
    statusTr:
      "Roma'nın içinde yer alan, tam egemen bir şehir devleti; Katolik Kilisesi'nin merkezi",
    population: { kind: "exact", value: 882 },
    areaKm2: { kind: "exact", value: 0.49 },
  },
  {
    iso: "AQ",
    badge: "AQ",
    nameTr: "Antarktika",
    nameEn: "Antarctica",
    statusTr: "1959 Antlaşması'yla yönetilen kıta; 7 ülkenin çakışan toprak iddiası var, tanınmaz",
    population: { kind: "none" },
    areaKm2: { kind: "range", min: 14000000, max: 14200000 },
  },

  // ---- 🔴 Owner-approved verbatim texts (brief §3a, → DEC 2026-08-01b) ----
  // These six carry NO population row. None of their population figures was owner-ruled and
  // each one needs a caveat a 258px card cannot carry honestly: Batı Sahra's figure excludes
  // the Tindouf refugee population, Somaliland's is flagged [KAYNAK DOĞRULANAMADI], Siachen
  // has only military personnel, and Chagos's zero is the result of the 1960s removal of its
  // population. Where the fact matters the approved sentence already states it (Güney
  // Georgia: "kalıcı nüfusu yok"). Areas are plain, uncontested figures and are shown.
  {
    iso: "EH",
    badge: "EH",
    nameTr: "Batı Sahra",
    nameEn: "Western Sahara",
    statusTr:
      "BM'nin özyönetimi olmayan toprak listesinde; toprağı Fas ve Polisario Cephesi paylaşır.",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 272000 },
  },
  {
    iso: "x-somaliland",
    nameTr: "Somaliland",
    nameEn: "Somaliland",
    statusTr:
      "Somali'den 1991'de fiilen ayrılan bölge; 2025'te İsrail tanıdı, Somali itiraz ediyor.",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 176000 },
  },
  {
    iso: "x-siachen-glacier",
    nameTr: "Siachen Buzulu",
    nameEn: "Siachen Glacier",
    statusTr:
      "Hindistan ve Pakistan arasında sınırı kesin çizilmemiş, statüsü çözülmemiş buzul bölgesi.",
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
    statusTr: "Birleşik Krallık'a bağlı, özerk denizaşırı toprak; Arjantin hak iddia ediyor.",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 12170 },
  },
  {
    iso: "GS",
    badge: "GS",
    nameTr: "Güney Georgia ve Güney Sandwich Adaları",
    nameEn: "South Georgia and the South Sandwich Islands",
    statusTr:
      "Birleşik Krallık'a bağlı denizaşırı toprak, kalıcı nüfusu yok; Arjantin hak iddia ediyor.",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 3903 },
  },
  {
    // The brief's own name cell carries both names; the primary-name question was never
    // owner-ruled (DEC 2026-08-01 ruled only the sentence), so neither name is dropped.
    iso: "IO",
    badge: "IO",
    nameTr: "Britanya Hint Okyanusu Toprakları (Chagos)",
    nameEn: "British Indian Ocean Territory (Chagos)",
    statusTr:
      "Birleşik Krallık'a bağlı denizaşırı toprak; Mauritius'a devir anlaşması onay aşamasında.",
    population: { kind: "unknown" },
    areaKm2: { kind: "exact", value: 60 },
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
}

/**
 * Non-breaking space between a number and its unit. A 258px card cannot fit Antarktika's
 * 7-digit area RANGE plus "km²" on one line, and with a normal space the browser orphans the
 * unit onto a line of its own; the break belongs after the range's en dash instead, which is
 * where it lands once the unit is glued to its number.
 */
const NBSP = "\u00A0";

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
  { formatNumber, noneText, unit }: FigureTextOptions,
): string | undefined {
  const suffix = unit ? `${NBSP}${unit}` : "";
  switch (figure.kind) {
    case "exact":
      return `${formatNumber(figure.value)}${suffix}`;
    case "range":
      // En dash, unspaced — a numeric interval, not a sentence dash.
      return `${formatNumber(figure.min)}–${formatNumber(figure.max)}${suffix}`;
    case "none":
      return noneText;
    case "unknown":
      return undefined;
  }
}
