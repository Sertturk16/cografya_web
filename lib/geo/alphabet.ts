/**
 * Alphabetical bucketing for the hub index sections (`/turkiye#iller`, `/dunya#ulkeler`,
 * → DEC 2026-08-04i §2). Pure and DOM-free so the ordering/bucketing invariants are
 * unit-testable without rendering a page.
 *
 * ## Why a collator is load-bearing, not a nicety
 *
 * A naive `Array.sort()` compares UTF-16 code units, which puts every Turkish letter
 * outside ASCII (`ç ğ ı ö ş ü`) AFTER `z`. Measured against the real 81-province set,
 * **67 of 81 provinces land in a different position** under naive sort than under
 * `Intl.Collator("tr")` — e.g. "Ağrı" is thrown past "Aydın" instead of sitting between
 * "Afyonkarahisar" and "Aksaray". So the collator is what makes this list correct, not
 * merely tidy.
 *
 * ## `collationLocale` is the language of the NAMES, not of the page
 *
 * Province labels are Turkish in BOTH locales (the api's `ProvinceListItem` carries no
 * `nameEn`), so the province index collates with `"tr"` even on `/en/turkiye`. Country
 * labels are per-locale (`nameTr` / `nameEn`), so the country index collates with the
 * page locale. Passing the page locale unconditionally would sort Turkish names with
 * English rules on the English hub. The caller therefore states the collation locale
 * explicitly rather than this module guessing it.
 *
 * ## Bucket ids are positional, deliberately
 *
 * An id derived from the letter itself would COLLIDE in Turkish: `I` and `İ` are separate
 * letters with separate buckets, but both fold to ASCII `i` (`SEO-POLICY.md` §B4's binding
 * transliteration table), so `#iller-i` would exist twice on one page — an invalid document
 * and a broken jump target. The bucket's position is collision-free by construction. These
 * ids are same-page scroll anchors only: they are not URLs, carry no SEO surface, and are
 * regenerated with the page.
 *
 * ## "Same letter" is a COLLATION question, not a string comparison (PR #44 review CR-I1)
 *
 * Whether two initials belong in one bucket depends on the language, so it is answered by a
 * second collator at `sensitivity: "base"` (primary strength — "is this the same letter?")
 * rather than by `===`. The difference is not academic:
 *
 * - **Turkish** makes `ç ğ ı ö ş ü` PRIMARY differences, so base strength still separates
 *   every one of them, `I`/`İ` included (verified: all six pairs compare non-zero).
 * - **English** makes them SECONDARY, so `Intl.Collator("en")` sorts "Åland Islands" INTO
 *   the A-run while `toLocaleUpperCase("en")` still yields a distinct "Å". Under `===`
 *   merging that produced `[A][Å][A…]` — one letter split across two non-adjacent buckets,
 *   two "A" chips and two "A" headings, with positional ids keeping the DOM valid so it
 *   would have shipped silently the day such a country was seeded.
 *
 * At base strength both collapse into a single bucket labelled by its FIRST member's
 * initial, which is the correct answer in each language from one rule.
 */

/** One initial-letter group of an alphabetical index. */
export interface AlphabetBucket<T> {
  /** The display letter, uppercased with the collation locale's rules (`i` → `İ` in tr). */
  readonly letter: string;
  /** Unique same-page anchor id for this group (see the positional-id note above). */
  readonly id: string;
  /** The group's members, in collation order. */
  readonly items: readonly T[];
}

/**
 * Sorts `items` by their name under `collationLocale` and groups them into contiguous
 * initial-letter buckets, in that same collation order.
 *
 * Buckets are grown from the sorted sequence rather than keyed into a map, so a letter that
 * somehow reappeared out of sequence would produce a second VISIBLE bucket instead of being
 * silently folded back into the first. `alphabet.test.ts` pins the no-duplicate-letter
 * invariant in both locales, so that shape fails loudly in CI rather than quietly shipping.
 *
 * Note the trim asymmetry: the sort key and the initial come from the TRIMMED name, while
 * the caller's original item — and therefore the rendered link text — is passed through
 * untouched. Trimming here is a defensive floor for a contract that already promises clean
 * required strings, so it must not silently rewrite what the page displays.
 *
 * The input array is never mutated (`flatMap` produces the working copy that gets sorted).
 */
export function bucketByInitial<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  collationLocale: string,
  idPrefix: string,
): AlphabetBucket<T>[] {
  const collator = new Intl.Collator(collationLocale);
  // Primary strength: "is this the same LETTER in this language?" — see the docblock.
  const sameLetter = new Intl.Collator(collationLocale, { sensitivity: "base" });

  const entries = items.flatMap((item) => {
    const name = nameOf(item).trim();
    const first = Array.from(name)[0];
    // A blank name has no initial, no sort key and no usable link text; rendering it would
    // produce an empty anchor, which fails both the a11y floor (ENGINEERING §5) and
    // `SEO-POLICY.md` §B8.3 anchor-text. Unreachable under the OpenAPI contract, where the
    // name fields are required strings — this is a defensive floor, not an expected branch.
    if (first === undefined) return [];
    return [{ item, name, letter: first.toLocaleUpperCase(collationLocale) }];
  });

  entries.sort((a, b) => collator.compare(a.name, b.name));

  const buckets: { letter: string; id: string; items: T[] }[] = [];
  for (const entry of entries) {
    const current = buckets[buckets.length - 1];
    if (current !== undefined && sameLetter.compare(current.letter, entry.letter) === 0) {
      current.items.push(entry.item);
    } else {
      buckets.push({
        letter: entry.letter,
        id: `${idPrefix}-${buckets.length}`,
        items: [entry.item],
      });
    }
  }

  return buckets;
}

/**
 * The bucketed items back as one flat list, in exactly the order the page renders them.
 *
 * This is the single source of the hub's `ItemList` JSON-LD and of the entity count in its
 * meta description, so neither can drift from the visible list (`SEO-POLICY.md` §B5.7, and
 * PR #44 review CR-M1 — the count previously came from the raw api list instead).
 */
export function flattenBuckets<T>(buckets: readonly AlphabetBucket<T>[]): T[] {
  return buckets.flatMap((bucket) => [...bucket.items]);
}
