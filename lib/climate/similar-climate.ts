/**
 * "Benzer iklimli iller" selection (PLAN §2): the same-Köppen-class cross-link block on a
 * province page. Pure and DOM-free so the filter/sort/slice invariants are unit-testable
 * without pulling in a page render.
 *
 * Behaviour (unchanged from the original inline logic in the province page): among the
 * published provinces (those present in the list — each has a page), keep those sharing the
 * current province's Köppen code, exclude the current province itself, order by plate code
 * NUMERICALLY (so "09" precedes "10", never a lexicographic sort), and cap at `max`.
 *
 * NOTE ON RECIPROCITY: this plate-order top-`max` cap yields mutual links only for Köppen
 * classes with ≤ `max + 1` published members. For a larger class the cap is NOT symmetric
 * (a high-plate province can link a low-plate one that does not link back). Real Turkish
 * class sizes make that the common case (e.g. Csa ≈ 44), so the "plaka sıralı, maks 5" rule
 * is under owner review as a PLAN-locked item — this function preserves the current locked
 * behaviour exactly; any new selection rule replaces the body here and reuses this test.
 */
export function selectSimilarClimateProvinces<
  T extends { plateCode: string; climateKoppen: string | null },
>(all: readonly T[], current: { plateCode: string; climateKoppen: string | null }, max = 5): T[] {
  if (current.climateKoppen === null) return [];
  const koppen = current.climateKoppen;
  // `.filter()` returns a fresh array, so the in-place `.sort()` never mutates `all`.
  return all
    .filter((p) => p.climateKoppen === koppen && p.plateCode !== current.plateCode)
    .sort((a, b) => Number(a.plateCode) - Number(b.plateCode))
    .slice(0, max);
}
