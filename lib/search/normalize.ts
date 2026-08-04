/**
 * Search-side text folding — the one place a query and an entity name are made comparable.
 *
 * ## The rule it implements
 *
 * The output alphabet is the SAME one `SEO-POLICY.md` §B4 pins for slugs (`ç→c · ğ→g ·
 * ı→i · İ→i · ö→o · ş→s · ü→u`, lowercase ASCII), so a folded name and the entity's own
 * slug land in the same space. Verified against the live seed: folding every province name
 * reproduces its slug for 81/81, and 195/196 countries — the single exception is
 * `Çin Cumhuriyeti (Tayvan)`, whose slug is the editorial `tayvan`.
 *
 * ## Why the general Unicode step, not just a Turkish table
 *
 * A hand-written Turkish map would leave `Côte d'Ivoire`, `Åland` and `Ćuprija` unfoldable,
 * and the country corpus is a world corpus. Five of the six Turkish letters DECOMPOSE under
 * NFD (`ç ğ ö ş ü` are base + combining mark), so stripping combining marks handles them and
 * every other DECOMPOSABLE accent in one rule. Dotless `ı` is the exception — it has no
 * decomposition — so it is mapped explicitly, before the NFD pass.
 *
 * The scope of that claim is exactly "decomposable accents" (review M5). Latin letters that
 * do NOT decompose — `ø đ ł æ œ ß þ` — and non-Latin scripts survive to the final step and
 * become word separators rather than ASCII equivalents. None appears in today's TR/EN
 * corpus; a name that needs one would need its own transliteration entry here.
 *
 * ## Order is load-bearing
 *
 * Turkish lowercasing runs FIRST so `İ`→`i` and `I`→`ı` follow Turkish rules rather than
 * English ones (`"ISTANBUL"` must reach the same string as `"İstanbul"`); the explicit `ı→i`
 * map then runs before NFD, because after lowercasing an English `I` has become `ı` too.
 * Turkish casing is applied regardless of the page locale: it is strictly more permissive
 * here, and every path through it ends in the same ASCII alphabet.
 */

/**
 * Folds a name or a query into the comparable form: lowercase ASCII letters and digits,
 * single-spaced. Punctuation, hyphens and parentheses become separators, so
 * `"Çin Cumhuriyeti (Tayvan)"` folds to `"cin cumhuriyeti tayvan"` and a reader typing
 * `tayvan` still finds it.
 *
 * Idempotent: folding a folded string returns it unchanged.
 */
export function foldForSearch(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
