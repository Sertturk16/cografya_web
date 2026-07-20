/**
 * Turkish grammatical-case suffixation for PROPER NOUNS (province names), used to build
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
 *
 * Covers all 81 province names (dotted/dotless İ-I, ç/ş/ğ, vowel- and consonant-final).
 */

// Every Turkish vowel, both cases (dotted İ + dotless I distinguished). Used to find the
// last vowel (drives harmony) and to detect a vowel-final stem (drives the genitive buffer).
const VOWELS = "aAeEıIiİoOöÖuUüÜ";

// Voiceless consonants (fıstıkçı şahap): a voiceless final consonant takes the locative "t".
const VOICELESS = "çÇfFhHkKpPsSşŞtT";

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
  // No vowel at all (never a real province) → default to the front "in" form.
  const harmonyVowel = vowel === null ? "i" : genitiveVowel(vowel);
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
  const harmonyVowel = vowel === null || isBackVowel(vowel) ? "a" : "e";
  const lastChar = name[name.length - 1];
  const consonant = lastChar !== undefined && VOICELESS.includes(lastChar) ? "t" : "d";
  return `${name}'${consonant}${harmonyVowel}`;
}
