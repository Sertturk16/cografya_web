import { describe, expect, it } from "vitest";
import { turkishGenitive, turkishLocative } from "./turkish-suffix";

/**
 * EXHAUSTIVE grammar table for the live country corpus (196 rows, `cografya_api`
 * `src/database/seeds/{countries/*.countries.ts, country.seed-data.ts}` @ dev `dabd700`).
 *
 * Why a whole table rather than the class-representative style of `turkish-suffix.test.ts`:
 * the §19 heading helper first shipped for 81 PROVINCE names, and the one exception class it
 * missed (`-eli` → "Kocaeli'nde") was invisible to a representative sample precisely because
 * nobody had enumerated the real inputs. The country corpus adds several classes provinces
 * have none of — possessive compounds ("… Cumhuriyeti", "… Adaları"), palatal final l
 * (Nepal/Senegal), parenthesised names, hyphenated and multi-word names, plurals in
 * -lar/-ler — so this file enumerates every real name and pins BOTH cases. Fifteen genuine
 * defects were found this way and fixed in `turkish-suffix.ts`; the table is what keeps them
 * fixed.
 *
 * This is a STRUCTURE test, not a fact-check (CONVENTIONS §2): for a proper noun the
 * correctly suffixed form IS the pure function's contract. It asserts nothing about
 * geography, population or any other datum.
 *
 * SNAPSHOT, NOT A MIRROR: the list is a point-in-time copy of the seeded names, kept here so
 * the grammar helper can be verified offline against real inputs. It does not claim to stay
 * in sync with the api. If a country is added or renamed, add the row — the value of the
 * file is coverage of every SHAPE the corpus contains, and a new shape is exactly what needs
 * a new row.
 */
const COUNTRY_SUFFIX_TABLE: ReadonlyArray<
  readonly [name: string, genitive: string, locative: string]
> = [
  ["Cezayir", "Cezayir'in", "Cezayir'de"],
  ["Mısır", "Mısır'ın", "Mısır'da"],
  ["Libya", "Libya'nın", "Libya'da"],
  ["Fas", "Fas'ın", "Fas'ta"],
  ["Sudan", "Sudan'ın", "Sudan'da"],
  ["Tunus", "Tunus'un", "Tunus'ta"],
  ["Benin", "Benin'in", "Benin'de"],
  ["Burkina Faso", "Burkina Faso'nun", "Burkina Faso'da"],
  ["Cabo Verde", "Cabo Verde'nin", "Cabo Verde'de"],
  ["Fildişi Sahili", "Fildişi Sahili'nin", "Fildişi Sahili'nde"],
  ["Gambiya", "Gambiya'nın", "Gambiya'da"],
  ["Gana", "Gana'nın", "Gana'da"],
  ["Gine", "Gine'nin", "Gine'de"],
  ["Gine-Bissau", "Gine-Bissau'nun", "Gine-Bissau'da"],
  ["Liberya", "Liberya'nın", "Liberya'da"],
  ["Mali", "Mali'nin", "Mali'de"],
  ["Moritanya", "Moritanya'nın", "Moritanya'da"],
  ["Nijer", "Nijer'in", "Nijer'de"],
  ["Nijerya", "Nijerya'nın", "Nijerya'da"],
  ["Senegal", "Senegal'in", "Senegal'de"],
  ["Sierra Leone", "Sierra Leone'nin", "Sierra Leone'de"],
  ["Togo", "Togo'nun", "Togo'da"],
  ["Angola", "Angola'nın", "Angola'da"],
  ["Çad", "Çad'ın", "Çad'da"],
  ["Kamerun", "Kamerun'un", "Kamerun'da"],
  ["Orta Afrika Cumhuriyeti", "Orta Afrika Cumhuriyeti'nin", "Orta Afrika Cumhuriyeti'nde"],
  ["Kongo Cumhuriyeti", "Kongo Cumhuriyeti'nin", "Kongo Cumhuriyeti'nde"],
  [
    "Kongo Demokratik Cumhuriyeti",
    "Kongo Demokratik Cumhuriyeti'nin",
    "Kongo Demokratik Cumhuriyeti'nde",
  ],
  ["Ekvator Ginesi", "Ekvator Ginesi'nin", "Ekvator Ginesi'nde"],
  ["Gabon", "Gabon'un", "Gabon'da"],
  ["Sao Tome ve Principe", "Sao Tome ve Principe'nin", "Sao Tome ve Principe'de"],
  ["Botsvana", "Botsvana'nın", "Botsvana'da"],
  ["Esvatini", "Esvatini'nin", "Esvatini'de"],
  ["Lesotho", "Lesotho'nun", "Lesotho'da"],
  ["Namibya", "Namibya'nın", "Namibya'da"],
  ["Güney Afrika", "Güney Afrika'nın", "Güney Afrika'da"],
  ["Burundi", "Burundi'nin", "Burundi'de"],
  ["Komorlar", "Komorlar'ın", "Komorlar'da"],
  ["Cibuti", "Cibuti'nin", "Cibuti'de"],
  ["Eritre", "Eritre'nin", "Eritre'de"],
  ["Etiyopya", "Etiyopya'nın", "Etiyopya'da"],
  ["Kenya", "Kenya'nın", "Kenya'da"],
  ["Madagaskar", "Madagaskar'ın", "Madagaskar'da"],
  ["Malavi", "Malavi'nin", "Malavi'de"],
  ["Mauritius", "Mauritius'un", "Mauritius'ta"],
  ["Mozambik", "Mozambik'in", "Mozambik'te"],
  ["Ruanda", "Ruanda'nın", "Ruanda'da"],
  ["Seyşeller", "Seyşeller'in", "Seyşeller'de"],
  ["Somali", "Somali'nin", "Somali'de"],
  ["Güney Sudan", "Güney Sudan'ın", "Güney Sudan'da"],
  ["Tanzanya", "Tanzanya'nın", "Tanzanya'da"],
  ["Uganda", "Uganda'nın", "Uganda'da"],
  ["Zambiya", "Zambiya'nın", "Zambiya'da"],
  ["Zimbabve", "Zimbabve'nin", "Zimbabve'de"],
  ["Kanada", "Kanada'nın", "Kanada'da"],
  [
    "Amerika Birleşik Devletleri",
    "Amerika Birleşik Devletleri'nin",
    "Amerika Birleşik Devletleri'nde",
  ],
  ["Meksika", "Meksika'nın", "Meksika'da"],
  ["Belize", "Belize'nin", "Belize'de"],
  ["Kosta Rika", "Kosta Rika'nın", "Kosta Rika'da"],
  ["El Salvador", "El Salvador'un", "El Salvador'da"],
  ["Guatemala", "Guatemala'nın", "Guatemala'da"],
  ["Honduras", "Honduras'ın", "Honduras'ta"],
  ["Nikaragua", "Nikaragua'nın", "Nikaragua'da"],
  ["Panama", "Panama'nın", "Panama'da"],
  ["Antigua ve Barbuda", "Antigua ve Barbuda'nın", "Antigua ve Barbuda'da"],
  ["Bahamalar", "Bahamalar'ın", "Bahamalar'da"],
  ["Barbados", "Barbados'un", "Barbados'ta"],
  ["Küba", "Küba'nın", "Küba'da"],
  ["Dominika", "Dominika'nın", "Dominika'da"],
  ["Dominik Cumhuriyeti", "Dominik Cumhuriyeti'nin", "Dominik Cumhuriyeti'nde"],
  ["Grenada", "Grenada'nın", "Grenada'da"],
  ["Haiti", "Haiti'nin", "Haiti'de"],
  ["Jamaika", "Jamaika'nın", "Jamaika'da"],
  ["Saint Kitts ve Nevis", "Saint Kitts ve Nevis'in", "Saint Kitts ve Nevis'te"],
  ["Saint Lucia", "Saint Lucia'nın", "Saint Lucia'da"],
  [
    "Saint Vincent ve Grenadinler",
    "Saint Vincent ve Grenadinler'in",
    "Saint Vincent ve Grenadinler'de",
  ],
  ["Trinidad ve Tobago", "Trinidad ve Tobago'nun", "Trinidad ve Tobago'da"],
  ["Arjantin", "Arjantin'in", "Arjantin'de"],
  ["Bolivya", "Bolivya'nın", "Bolivya'da"],
  ["Brezilya", "Brezilya'nın", "Brezilya'da"],
  ["Şili", "Şili'nin", "Şili'de"],
  ["Kolombiya", "Kolombiya'nın", "Kolombiya'da"],
  ["Ekvador", "Ekvador'un", "Ekvador'da"],
  ["Guyana", "Guyana'nın", "Guyana'da"],
  ["Paraguay", "Paraguay'ın", "Paraguay'da"],
  ["Peru", "Peru'nun", "Peru'da"],
  ["Surinam", "Surinam'ın", "Surinam'da"],
  ["Uruguay", "Uruguay'ın", "Uruguay'da"],
  ["Venezuela", "Venezuela'nın", "Venezuela'da"],
  ["Çin", "Çin'in", "Çin'de"],
  ["Japonya", "Japonya'nın", "Japonya'da"],
  ["Moğolistan", "Moğolistan'ın", "Moğolistan'da"],
  ["Güney Kore", "Güney Kore'nin", "Güney Kore'de"],
  ["Kuzey Kore", "Kuzey Kore'nin", "Kuzey Kore'de"],
  ["Kazakistan", "Kazakistan'ın", "Kazakistan'da"],
  ["Kırgızistan", "Kırgızistan'ın", "Kırgızistan'da"],
  ["Tacikistan", "Tacikistan'ın", "Tacikistan'da"],
  ["Türkmenistan", "Türkmenistan'ın", "Türkmenistan'da"],
  ["Özbekistan", "Özbekistan'ın", "Özbekistan'da"],
  ["Brunei", "Brunei'nin", "Brunei'de"],
  ["Kamboçya", "Kamboçya'nın", "Kamboçya'da"],
  ["Endonezya", "Endonezya'nın", "Endonezya'da"],
  ["Laos", "Laos'un", "Laos'ta"],
  ["Malezya", "Malezya'nın", "Malezya'da"],
  ["Myanmar", "Myanmar'ın", "Myanmar'da"],
  ["Filipinler", "Filipinler'in", "Filipinler'de"],
  ["Singapur", "Singapur'un", "Singapur'da"],
  ["Tayland", "Tayland'ın", "Tayland'da"],
  ["Doğu Timor", "Doğu Timor'un", "Doğu Timor'da"],
  ["Vietnam", "Vietnam'ın", "Vietnam'da"],
  ["Afganistan", "Afganistan'ın", "Afganistan'da"],
  ["Bangladeş", "Bangladeş'in", "Bangladeş'te"],
  ["Bhutan", "Bhutan'ın", "Bhutan'da"],
  ["Hindistan", "Hindistan'ın", "Hindistan'da"],
  ["Maldivler", "Maldivler'in", "Maldivler'de"],
  ["Nepal", "Nepal'in", "Nepal'de"],
  ["Pakistan", "Pakistan'ın", "Pakistan'da"],
  ["Sri Lanka", "Sri Lanka'nın", "Sri Lanka'da"],
  ["Bahreyn", "Bahreyn'in", "Bahreyn'de"],
  ["Ürdün", "Ürdün'ün", "Ürdün'de"],
  ["Kuveyt", "Kuveyt'in", "Kuveyt'te"],
  ["Lübnan", "Lübnan'ın", "Lübnan'da"],
  ["Umman", "Umman'ın", "Umman'da"],
  ["Katar", "Katar'ın", "Katar'da"],
  ["Suudi Arabistan", "Suudi Arabistan'ın", "Suudi Arabistan'da"],
  ["Birleşik Arap Emirlikleri", "Birleşik Arap Emirlikleri'nin", "Birleşik Arap Emirlikleri'nde"],
  ["Yemen", "Yemen'in", "Yemen'de"],
  ["Danimarka", "Danimarka'nın", "Danimarka'da"],
  ["Estonya", "Estonya'nın", "Estonya'da"],
  ["Finlandiya", "Finlandiya'nın", "Finlandiya'da"],
  ["İzlanda", "İzlanda'nın", "İzlanda'da"],
  ["İrlanda", "İrlanda'nın", "İrlanda'da"],
  ["Letonya", "Letonya'nın", "Letonya'da"],
  ["Litvanya", "Litvanya'nın", "Litvanya'da"],
  ["Norveç", "Norveç'in", "Norveç'te"],
  ["İsveç", "İsveç'in", "İsveç'te"],
  ["Birleşik Krallık", "Birleşik Krallık'ın", "Birleşik Krallık'ta"],
  ["Avusturya", "Avusturya'nın", "Avusturya'da"],
  ["Almanya", "Almanya'nın", "Almanya'da"],
  ["Belçika", "Belçika'nın", "Belçika'da"],
  ["Fransa", "Fransa'nın", "Fransa'da"],
  ["Lihtenştayn", "Lihtenştayn'ın", "Lihtenştayn'da"],
  ["Lüksemburg", "Lüksemburg'un", "Lüksemburg'da"],
  ["Monako", "Monako'nun", "Monako'da"],
  ["Hollanda", "Hollanda'nın", "Hollanda'da"],
  ["İsviçre", "İsviçre'nin", "İsviçre'de"],
  ["Arnavutluk", "Arnavutluk'un", "Arnavutluk'ta"],
  ["Andorra", "Andorra'nın", "Andorra'da"],
  ["Bosna-Hersek", "Bosna-Hersek'in", "Bosna-Hersek'te"],
  ["Hırvatistan", "Hırvatistan'ın", "Hırvatistan'da"],
  ["İtalya", "İtalya'nın", "İtalya'da"],
  ["Malta", "Malta'nın", "Malta'da"],
  ["Karadağ", "Karadağ'ın", "Karadağ'da"],
  ["Kuzey Makedonya", "Kuzey Makedonya'nın", "Kuzey Makedonya'da"],
  ["Portekiz", "Portekiz'in", "Portekiz'de"],
  ["San Marino", "San Marino'nun", "San Marino'da"],
  ["Sırbistan", "Sırbistan'ın", "Sırbistan'da"],
  ["Slovenya", "Slovenya'nın", "Slovenya'da"],
  ["İspanya", "İspanya'nın", "İspanya'da"],
  ["Belarus", "Belarus'un", "Belarus'ta"],
  ["Çekya", "Çekya'nın", "Çekya'da"],
  ["Macaristan", "Macaristan'ın", "Macaristan'da"],
  ["Moldova", "Moldova'nın", "Moldova'da"],
  ["Polonya", "Polonya'nın", "Polonya'da"],
  ["Romanya", "Romanya'nın", "Romanya'da"],
  ["Rusya", "Rusya'nın", "Rusya'da"],
  ["Slovakya", "Slovakya'nın", "Slovakya'da"],
  ["Ukrayna", "Ukrayna'nın", "Ukrayna'da"],
  ["Avustralya", "Avustralya'nın", "Avustralya'da"],
  ["Yeni Zelanda", "Yeni Zelanda'nın", "Yeni Zelanda'da"],
  ["Fiji", "Fiji'nin", "Fiji'de"],
  ["Papua Yeni Gine", "Papua Yeni Gine'nin", "Papua Yeni Gine'de"],
  ["Solomon Adaları", "Solomon Adaları'nın", "Solomon Adaları'nda"],
  ["Vanuatu", "Vanuatu'nun", "Vanuatu'da"],
  ["Kiribati", "Kiribati'nin", "Kiribati'de"],
  ["Marşal Adaları", "Marşal Adaları'nın", "Marşal Adaları'nda"],
  [
    "Mikronezya Federe Devletleri",
    "Mikronezya Federe Devletleri'nin",
    "Mikronezya Federe Devletleri'nde",
  ],
  ["Nauru", "Nauru'nun", "Nauru'da"],
  ["Palau", "Palau'nun", "Palau'da"],
  ["Samoa", "Samoa'nın", "Samoa'da"],
  ["Tonga", "Tonga'nın", "Tonga'da"],
  ["Tuvalu", "Tuvalu'nun", "Tuvalu'da"],
  ["Güney Kıbrıs Rum Yönetimi", "Güney Kıbrıs Rum Yönetimi'nin", "Güney Kıbrıs Rum Yönetimi'nde"],
  [
    "Kuzey Kıbrıs Türk Cumhuriyeti",
    "Kuzey Kıbrıs Türk Cumhuriyeti'nin",
    "Kuzey Kıbrıs Türk Cumhuriyeti'nde",
  ],
  ["İsrail", "İsrail'in", "İsrail'de"],
  ["Filistin", "Filistin'in", "Filistin'de"],
  ["Çin Cumhuriyeti (Tayvan)", "Çin Cumhuriyeti (Tayvan)'ın", "Çin Cumhuriyeti (Tayvan)'da"],
  ["Kosova", "Kosova'nın", "Kosova'da"],
  ["Yunanistan", "Yunanistan'ın", "Yunanistan'da"],
  ["Bulgaristan", "Bulgaristan'ın", "Bulgaristan'da"],
  ["Gürcistan", "Gürcistan'ın", "Gürcistan'da"],
  ["Ermenistan", "Ermenistan'ın", "Ermenistan'da"],
  ["Azerbaycan", "Azerbaycan'ın", "Azerbaycan'da"],
  ["İran", "İran'ın", "İran'da"],
  ["Irak", "Irak'ın", "Irak'ta"],
  ["Suriye", "Suriye'nin", "Suriye'de"],
];

describe("turkishGenitive/turkishLocative — the full 196-country corpus", () => {
  it("covers every seeded country exactly once", () => {
    expect(COUNTRY_SUFFIX_TABLE).toHaveLength(196);
    expect(new Set(COUNTRY_SUFFIX_TABLE.map(([name]) => name)).size).toBe(196);
  });

  for (const [name, genitive, locative] of COUNTRY_SUFFIX_TABLE) {
    it(`${name} → ${genitive} / ${locative}`, () => {
      expect(turkishGenitive(name)).toBe(genitive);
      expect(turkishLocative(name)).toBe(locative);
    });
  }
});

/**
 * The classes the exhaustive table exists to protect, called out by name so a future reader
 * sees WHY each one is special without diffing 196 rows. Every assertion here is also a row
 * above; the duplication is documentation, and it is the part a reviewer should read.
 */
describe("country-name exception classes (documented subset of the table)", () => {
  it("possessive compounds take the pronominal -n- buffer in the LOCATIVE", () => {
    // These were all wrong before this PR ("Kongo Cumhuriyeti'de"). Genitive was already
    // right via the generic vowel-final buffer, so only the locative regressed.
    expect(turkishLocative("Kongo Cumhuriyeti")).toBe("Kongo Cumhuriyeti'nde");
    expect(turkishLocative("Kuzey Kıbrıs Türk Cumhuriyeti")).toBe(
      "Kuzey Kıbrıs Türk Cumhuriyeti'nde",
    );
    expect(turkishLocative("Amerika Birleşik Devletleri")).toBe("Amerika Birleşik Devletleri'nde");
    expect(turkishLocative("Birleşik Arap Emirlikleri")).toBe("Birleşik Arap Emirlikleri'nde");
    expect(turkishLocative("Solomon Adaları")).toBe("Solomon Adaları'nda"); // back harmony
    expect(turkishLocative("Ekvator Ginesi")).toBe("Ekvator Ginesi'nde");
    expect(turkishLocative("Fildişi Sahili")).toBe("Fildişi Sahili'nde");
    // Same izafet-head class, added with the CY rename (→ DEC 2026-08-30b): before "Yönetimi"
    // joined PRONOMINAL_BUFFER_HEADS this computed "Güney Kıbrıs Rum Yönetimi'de" — the exact
    // "Kongo Cumhuriyeti'de" bug this describe block documents, reproduced on a name the
    // corpus did not carry when that fix originally landed.
    expect(turkishLocative("Güney Kıbrıs Rum Yönetimi")).toBe("Güney Kıbrıs Rum Yönetimi'nde");
  });

  it("plural -lar/-ler names do NOT take the buffer (the class the rule must not over-reach into)", () => {
    expect(turkishLocative("Komorlar")).toBe("Komorlar'da");
    expect(turkishLocative("Bahamalar")).toBe("Bahamalar'da");
    expect(turkishLocative("Maldivler")).toBe("Maldivler'de");
    expect(turkishLocative("Filipinler")).toBe("Filipinler'de");
    expect(turkishLocative("Seyşeller")).toBe("Seyşeller'de");
    expect(turkishLocative("Saint Vincent ve Grenadinler")).toBe("Saint Vincent ve Grenadinler'de");
  });

  it("ordinary -i final proper nouns are NOT possessive compounds", () => {
    // The reason the buffer rule is a closed word list and not an "ends in -i" heuristic.
    expect(turkishLocative("Şili")).toBe("Şili'de");
    expect(turkishLocative("Mali")).toBe("Mali'de");
    expect(turkishLocative("Somali")).toBe("Somali'de");
    expect(turkishLocative("Fiji")).toBe("Fiji'de");
    expect(turkishLocative("Haiti")).toBe("Haiti'de");
    expect(turkishLocative("Kiribati")).toBe("Kiribati'de");
    expect(turkishLocative("Burundi")).toBe("Burundi'de");
    expect(turkishLocative("Esvatini")).toBe("Esvatini'de");
  });

  it("palatal (ince) final l takes FRONT suffixes despite the back vowel", () => {
    // Both cases are affected here, unlike the buffer class.
    expect(turkishGenitive("Nepal")).toBe("Nepal'in");
    expect(turkishLocative("Nepal")).toBe("Nepal'de");
    expect(turkishGenitive("Senegal")).toBe("Senegal'in");
    expect(turkishLocative("Senegal")).toBe("Senegal'de");
    // İsrail needs no exception — its last vowel is already front.
    expect(turkishGenitive("İsrail")).toBe("İsrail'in");
  });

  it("a trailing parenthetical governs the suffix, and takes no buffer", () => {
    // "Çin Cumhuriyeti (Tayvan)" — the LAST token is "(Tayvan)", so harmony/voicing come
    // from "Tayvan" (→ 'ın / 'da) and the "Cumhuriyeti" buffer correctly does not fire.
    // The apostrophe therefore lands after the closing bracket. Pinned deliberately: it is
    // the only no-information-loss option for a sovereignty row whose parenthetical is a
    // load-bearing part of the entity name (→ DEC 2026-07-13), and renaming that entity is
    // an owner decision, not a helper's.
    expect(turkishGenitive("Çin Cumhuriyeti (Tayvan)")).toBe("Çin Cumhuriyeti (Tayvan)'ın");
    expect(turkishLocative("Çin Cumhuriyeti (Tayvan)")).toBe("Çin Cumhuriyeti (Tayvan)'da");
  });

  it("multi-word, hyphenated and foreign-final names follow the last token", () => {
    expect(turkishLocative("Bosna-Hersek")).toBe("Bosna-Hersek'te"); // voiceless k
    expect(turkishGenitive("Gine-Bissau")).toBe("Gine-Bissau'nun"); // vowel-final buffer
    expect(turkishLocative("Burkina Faso")).toBe("Burkina Faso'da");
    expect(turkishLocative("Saint Kitts ve Nevis")).toBe("Saint Kitts ve Nevis'te"); // voiceless s
    expect(turkishGenitive("Palau")).toBe("Palau'nun");
    expect(turkishLocative("Mauritius")).toBe("Mauritius'ta");
  });
});
