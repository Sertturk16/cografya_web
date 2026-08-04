/**
 * Which meta description a hub page publishes, given how many entities it actually lists.
 *
 * ## Why this is a lib function and not an inline ternary (PR #44 review TA-2)
 *
 * The hub descriptions interpolate a live entity count ("Türkiye'nin 81 iline…"), which
 * `SEO-POLICY.md` §A2.2 encourages — but only while the count is true. When the resilient
 * api fetch degrades to an empty list, the page renders no entities, and a description
 * still promising them would be §B2.6 (promising content the page does not have). The
 * count-less variant exists for exactly that case.
 *
 * That decision is indexable-metadata logic, so it belongs where the node-only vitest
 * config can actually exercise it, next to `province-description.ts` and
 * `country-description.ts` — not inline in a Server Component that no test can reach, in
 * four copies across two files (review CR-M2).
 *
 * ## Why it takes resolved strings rather than the translator
 *
 * next-intl's `t` is generically typed over the message catalogue's key union, so a
 * structurally-typed `(key, values) => string` parameter cannot accept it without widening
 * that contract. Passing the two already-resolved strings keeps this function free of
 * next-intl entirely — pure, trivially testable, and impossible to call with a key that
 * does not exist. The unused `t()` call on the branch not taken is a discarded string, not
 * a fetch or a render.
 */
export function pickHubDescription(withCount: string, fallback: string, count: number): string {
  return count > 0 ? withCount : fallback;
}
