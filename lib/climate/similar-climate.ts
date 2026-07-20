/**
 * "Benzer iklimli iller" selection (PLAN §2): the same-Köppen-class cross-link block on a
 * province page. Pure and DOM-free so the filter/rank/slice invariants are unit-testable
 * without pulling in a page render.
 *
 * Selection rule (→ DEC 2026-07-20b, owner-ruled): among the published provinces (those
 * present in the list — each has a page) that share the current province's Köppen class
 * and are not the current province itself, keep the `max` NEAREST by annual mean
 * temperature — ranked on `|sibling.climateAnnualMeanTempC − ownAnnualMeanTempC|`, ascending,
 * with plate code (NUMERIC, so "09" precedes "10") as the tie-break — then cap at `max`.
 * This replaced the earlier plate-order-first-`max` rule, which degenerated on Türkiye's real
 * class sizes (Csa ≈ 44): the first-5 cut produced ~40 identical blocks and a skewed internal
 * link graph. Nearest-by-temperature makes each province's block distinct and topically tighter.
 *
 * Two edge cases, both explicit (never silent):
 *  - A sibling whose `climateAnnualMeanTempC` is null is EXCLUDED from the ranked result —
 *    it cannot be ranked by temperature and could not render the "il adı + °C" anchor either.
 *  - When the CURRENT province has a Köppen class but no annual mean (series null, so
 *    `ownAnnualMeanTempC` is null), temperature ranking is impossible; the function falls
 *    back to plate-order-first-`max` over the same class rather than returning nothing.
 *
 * NOT RECIPROCAL: nearest-`max` is not a symmetric relation — B being one of A's `max`
 * nearest does not make A one of B's, so a rendered link is not guaranteed to link back.
 * That is intended (and unavoidable for a nearest-N rule); do not add reciprocity claims.
 */
export function selectSimilarClimateProvinces<
  T extends {
    plateCode: string;
    climateKoppen: string | null;
    climateAnnualMeanTempC: number | null;
  },
>(
  all: readonly T[],
  current: { plateCode: string; climateKoppen: string | null },
  ownAnnualMeanTempC: number | null,
  max = 5,
): T[] {
  if (current.climateKoppen === null) return [];
  const koppen = current.climateKoppen;
  // `.filter()` returns a fresh array, so the in-place `.sort()` below never mutates `all`.
  const sameClass = all.filter(
    (p) => p.climateKoppen === koppen && p.plateCode !== current.plateCode,
  );

  const byPlate = (a: T, b: T) => Number(a.plateCode) - Number(b.plateCode);

  // Own annual mean unknown (Köppen set, no publishable series): cannot rank by
  // temperature → documented plate-order fallback (→ DEC 2026-07-20b), not a silent empty.
  if (ownAnnualMeanTempC === null) {
    return sameClass.sort(byPlate).slice(0, max);
  }

  return sameClass
    .filter((p): p is T & { climateAnnualMeanTempC: number } => p.climateAnnualMeanTempC !== null)
    .sort((a, b) => {
      const delta =
        Math.abs(a.climateAnnualMeanTempC - ownAnnualMeanTempC) -
        Math.abs(b.climateAnnualMeanTempC - ownAnnualMeanTempC);
      return delta !== 0 ? delta : byPlate(a, b);
    })
    .slice(0, max);
}
