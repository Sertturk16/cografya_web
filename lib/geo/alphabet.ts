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
 * Buckets are grown from the sorted sequence rather than keyed into a map: under a correct
 * collator equal initials are always contiguous, so if a letter ever DID reappear later it
 * would produce a second visible bucket instead of being silently folded back into the
 * first. `alphabet.test.ts` pins the one-bucket-per-letter invariant, so that shape fails
 * loudly in CI rather than quietly reordering the page.
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
    if (current !== undefined && current.letter === entry.letter) {
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
