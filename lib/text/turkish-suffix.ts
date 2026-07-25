/**
 * Turkish grammatical-case suffixation for PROPER NOUNS (province + country names), used to build
 * §19 section headings ("Antalya'nın İklimi", "Muş'ta Hidrografya"). Pure and DOM-free —
 * unit-tested in plain Node (no jsdom) like the other `lib` string helpers.
 *
 * Two cases are exposed because §19 wants heading STRUCTURE to vary across a page — the
 * genitive form drives "X'in Y'si" headings, the locative form drives "X'te Y" headings.
 * Only these two are implemented (accusative/dative are unused → not added; YAGNI).
 *
 * Proper-noun rules applied:
 * - **Apostrophe** before the suffix (TÜİK/TDK convention for proper nouns: "İzmir'in").
 * - **4-way vowel harmony** for the genitive vowel; **2-way** (back/front) for the locative.
 * - **Buffer -n-** in the genitive after a vowel-final name ("Antalya'nın").
 * - **Consonant voicing** picks locative d/t ("Muş'ta" vs "Van'da").
 * - **No final-consonant mutation** (k→ğ, p→b, …): proper nouns keep their base form after
 *   the apostrophe ("Sinop'un", "Zonguldak'ın" — never "Sinob…"/"Zonguldağ…"). This is
 *   exactly why the apostrophe rule also simplifies the code: we never mutate the stem.
 * - **3rd-person-possessive compounds** (Kocaeli/Kırklareli/Tunceli; "… Cumhuriyeti",
 *   "… Adaları", "Ekvator Ginesi", "Fildişi Sahili") take the pronominal buffer -n- in the
 *   LOCATIVE ("Kocaeli'nde", "Kongo Cumhuriyeti'nde"); the genitive buffer already handles
 *   them via the generic vowel-final rule. See `PRONOMINAL_BUFFER_HEADS`.
 * - **Palatal ("ince") final l** in loanwords (Nepal, Senegal): written with a back vowel
 *   but suffixed with the FRONT forms in standard Turkish. See `PALATAL_L_WORDS`.
 *
 * Verified exhaustively against the two live corpora — the 81 province names and the 196
 * country names (`turkish-suffix.test.ts` covers the structural classes,
 * `turkish-suffix.countries.test.ts` asserts the genitive AND locative of every single
 * country name). The axes that would regress silently and corrupt a §19 heading: 4-/2-way
 * vowel harmony, dotted/dotless İ-I, ç/ş/ğ finals, voiceless-final t/d, vowel- vs
 * consonant-final stems, the genitive buffer, no stem mutation, the possessive-compound
 * locative buffer, palatal final l, multi-word/hyphenated/parenthesised names, and plural
 * (-lar/-ler) names that must NOT take the buffer.
 *
 * It is scoped to the proper nouns of THIS corpus — NOT a general Turkish morphology engine.
 * Both exception sets are closed, explicit lists rather than heuristics, because neither
 * distinction is recoverable from the spelling: most names ending in -i are ordinary proper
 * nouns with no possessive (Şili, Mali, Fiji, Haiti, Cibuti, Burundi, Malavi, Somali,
 * Brunei, Kiribati, Esvatini), and palatal l is a matter of pronunciation, not orthography.
 */

// Every Turkish vowel, both cases (dotted İ + dotless I distinguished). Used to find the
// last vowel (drives harmony) and to detect a vowel-final stem (drives the genitive buffer).
const VOWELS = "aAeEıIiİoOöÖuUüÜ";

// Voiceless consonants (fıstıkçı şahap): a voiceless final consonant takes the locative "t".
const VOICELESS = "çÇfFhHkKpPsSşŞtT";

/**
 * Final WORDS that mark a 3rd-person-possessive compound (belirtisiz isim tamlaması). The
 * head noun already carries the possessive -(s)I, so a case suffix needs the PRONOMINAL
 * buffer -n- before it: "Kongo Cumhuriyeti'nde", never "Kongo Cumhuriyeti'de".
 *
 * A closed list, matched on the name's LAST whitespace-delimited word — deliberately not a
 * heuristic on a final -i/-ı/-u/-ü, which would corrupt every ordinary proper noun ending
 * that way (Şili, Mali, Fiji, Haiti…). It also, correctly, does NOT fire on plural names
 * (Komorlar, Bahamalar, Maldivler, Filipinler, Seyşeller, Grenadinler): -lar/-ler is a
 * plural, not a possessive, so those keep the plain locative. And because the match is on
 * the LAST word, "Çin Cumhuriyeti (Tayvan)" correctly does not take the buffer — its final
 * token is the parenthesised "(Tayvan)", which governs the suffix.
 */
const PRONOMINAL_BUFFER_HEADS = new Set([
  "Cumhuriyeti", // Orta Afrika / Kongo / Kongo Demokratik / Dominik / Kıbrıs / KKTC
  "Devletleri", // Amerika Birleşik Devletleri, Mikronezya Federe Devletleri
  "Emirlikleri", // Birleşik Arap Emirlikleri
  "Adaları", // Solomon Adaları, Marşal Adaları
  "Ginesi", // Ekvator Ginesi
  "Sahili", // Fildişi Sahili
]);

/**
 * Names whose final "l" is the palatal ("ince") l of a loanword: spelled after a BACK vowel
 * but suffixed with the FRONT forms in standard Turkish ("Nepal'in" / "Nepal'de", never
 * "Nepal'ın" / "Nepal'da"). Vowel harmony cannot derive this from the spelling — the
 * distinction is phonological — so it is an explicit closed list, matched on the last word.
 * These two are the only members in the live 196-country + 81-province corpus; İsrail needs
 * no exception because its last vowel is already front.
 */
const PALATAL_L_WORDS = new Set(["Nepal", "Senegal"]);

/**
 * The name's last whitespace-delimited word (the token that governs the suffix). Splits on
 * ANY whitespace run, not just the ASCII space: a name pasted into the seed with a
 * non-breaking space (U+00A0) would otherwise be one opaque token, silently missing both
 * closed-list lookups and rendering "Kongo Cumhuriyeti'de". No live name contains one today —
 * this keeps the code and its own documentation in agreement.
 */
function lastWord(name: string): string {
  return name.split(/\s+/).at(-1) ?? name;
}

/**
 * True when a case suffix must be preceded by the pronominal buffer -n-: the province
 * "-eli" compounds (Kocaeli/Kırklareli/Tunceli) and the izafet head nouns above. Both are
 * the same phenomenon — a stem that already ends in a 3rd-person possessive suffix.
 * `-li` derivationals (Denizli → "Denizli'de") do NOT match the -eli pattern, because the
 * character before "li" is not "e".
 */
function needsPronominalBuffer(name: string): boolean {
  return /eli$/.test(name) || PRONOMINAL_BUFFER_HEADS.has(lastWord(name));
}

/** The last vowel in the name, or null if there is none (guards a degenerate input). */
function lastVowel(name: string): string | null {
  for (let i = name.length - 1; i >= 0; i--) {
    const ch = name[i];
    if (ch !== undefined && VOWELS.includes(ch)) return ch;
  }
  return null;
}

/** The 4-way genitive/possessive vowel (ı/i/u/ü) for a given last vowel. */
function genitiveVowel(vowel: string): "ı" | "i" | "u" | "ü" {
  if ("aAıI".includes(vowel)) return "ı";
  if ("eEiİ".includes(vowel)) return "i";
  if ("oOuU".includes(vowel)) return "u";
  return "ü"; // öÖüÜ
}

/** True when the last vowel is a back vowel (a/ı/o/u), which takes the back locative "a". */
function isBackVowel(vowel: string): boolean {
  return "aAıIoOuU".includes(vowel);
}

/**
 * Genitive ("ilgi hâli") of a proper noun: `name` + `'` + `-(n)Xn`.
 * e.g. `turkishGenitive("Antalya")` → "Antalya'nın", `"İzmir"` → "İzmir'in",
 * `"Muş"` → "Muş'un". Combine with a possessive-marked head noun for "X'in Y'si"
 * headings ("Antalya'nın İklimi").
 */
export function turkishGenitive(name: string): string {
  if (name.length === 0) return name;
  const vowel = lastVowel(name);
  // Palatal final l overrides harmony ("Nepal'in"). Otherwise: no vowel at all (never a real
  // place name) → default to the front "in" form.
  const harmonyVowel = PALATAL_L_WORDS.has(lastWord(name))
    ? "i"
    : vowel === null
      ? "i"
      : genitiveVowel(vowel);
  const lastChar = name[name.length - 1];
  const buffer = lastChar !== undefined && VOWELS.includes(lastChar) ? "n" : "";
  return `${name}'${buffer}${harmonyVowel}n`;
}

/**
 * Locative ("bulunma hâli") of a proper noun: `name` + `'` + `-DA`.
 * e.g. `turkishLocative("Antalya")` → "Antalya'da", `"Muş"` → "Muş'ta",
 * `"İzmir"` → "İzmir'de". Combine with a bare head noun for "X'te Y" headings
 * ("Muş'ta Hidrografya").
 */
export function turkishLocative(name: string): string {
  if (name.length === 0) return name;
  const vowel = lastVowel(name);
  // Palatal final l overrides harmony ("Nepal'de", not "Nepal'da").
  const harmonyVowel = PALATAL_L_WORDS.has(lastWord(name))
    ? "e"
    : vowel === null || isBackVowel(vowel)
      ? "a"
      : "e";
  // 3rd-person-possessive compounds (Kocaeli, "… Cumhuriyeti", "… Adaları", …) require the
  // pronominal buffer -n- before the locative suffix → "Kocaeli'nde", "Solomon Adaları'nda"
  // (TDK). The buffer is voiced, so the suffix consonant is always d (never t).
  if (needsPronominalBuffer(name)) {
    return `${name}'nd${harmonyVowel}`;
  }
  const lastChar = name[name.length - 1];
  const consonant = lastChar !== undefined && VOICELESS.includes(lastChar) ? "t" : "d";
  return `${name}'${consonant}${harmonyVowel}`;
}
