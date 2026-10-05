/**
 * "İklimi Benzeyen İller" selection: the same-curriculum-climate cross-link block on a province
 * page. Pure and DOM-free so the filter/rank/slice invariants are unit-testable without pulling
 * in a page render.
 *
 * Selection rule: among the published provinces (those present in the list — each has a page)
 * that share the current province's curriculum climate name (`climateCurriculumNameTr`, the
 * eight MEB Coğrafya 9 climate types) and are not the current province itself, keep the `max`
 * NEAREST by annual mean temperature — ranked on `|sibling.climateAnnualMeanTempC −
 * ownAnnualMeanTempC|` quantized to integer tenths (the api's one-decimal precision), ascending,
 * with plate code (NUMERIC, so "09" precedes "10") as the tie-break — then cap at `max`.
 * Quantizing to tenths is load-bearing for the tie-break: on raw doubles two
 * opposite-side-equidistant siblings differ by float noise (~1e-15) and never reach the
 * plate-order branch (PR #20 C1).
 *
 * Why the curriculum name and not the Köppen code: a Köppen class is far wider than a curriculum
 * climate type (Csa spans provinces of all eight types, Cfa mixes Karadeniz with İç Anadolu), so
 * grouping by it showed a student "similar" provinces their textbook puts in another climate.
 * Provinces on a curriculum boundary are grouped under their own seeded name like any other.
 * Nearest-by-temperature (over a plate-order-first cut) keeps each province's block distinct
 * and the internal link graph even.
 *
 * Two edge cases, both explicit (never silent):
 *  - A sibling whose `climateAnnualMeanTempC` is null is EXCLUDED from the ranked result —
 *    it cannot be ranked by temperature and could not render the "il adı + °C" anchor either.
 *  - When the CURRENT province has a curriculum climate name but no annual mean (series null, so
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
    climateCurriculumNameTr: string | null;
    climateAnnualMeanTempC: number | null;
  },
>(
  all: readonly T[],
  current: { plateCode: string; climateCurriculumNameTr: string | null },
  ownAnnualMeanTempC: number | null,
  max = 5,
): T[] {
  if (current.climateCurriculumNameTr === null) return [];
  const climateName = current.climateCurriculumNameTr;
  // `.filter()` returns a fresh array, so the in-place `.sort()` below never mutates `all`.
  const sameClass = all.filter(
    (p) => p.climateCurriculumNameTr === climateName && p.plateCode !== current.plateCode,
  );

  const byPlate = (a: T, b: T) => Number(a.plateCode) - Number(b.plateCode);

  // Own annual mean unknown (curriculum name set, no publishable series): cannot rank by
  // temperature → documented plate-order fallback, not a silent empty.
  if (ownAnnualMeanTempC === null) {
    return sameClass.sort(byPlate).slice(0, max);
  }

  // Rank on the ABSOLUTE distance quantized to integer tenths, NOT on the raw double
  // difference. The api serves annual means at exactly one decimal (`roundTo1` at
  // serialization), so tenths is the true precision of the data. Comparing raw doubles is
  // wrong for the tie-break: two siblings equidistant on OPPOSITE sides of `own` (own ± d)
  // produce floats like ±3.55e-15 apart, so `delta !== 0` was true and the plate-order
  // tie-break silently never fired for that shape — which at the top-5 cap boundary of a
  // large group could flip block MEMBERSHIP, not just order.
  // Rounding `|diff| * 10` collapses those spurious deltas to an exact integer tie so the
  // plate-order tie-break fires as specified (PR #20 C1).
  const tenths = (t: number) => Math.round(Math.abs(t - ownAnnualMeanTempC) * 10);
  return sameClass
    .filter((p): p is T & { climateAnnualMeanTempC: number } => p.climateAnnualMeanTempC !== null)
    .sort((a, b) => {
      const delta = tenths(a.climateAnnualMeanTempC) - tenths(b.climateAnnualMeanTempC);
      return delta !== 0 ? delta : byPlate(a, b);
    })
    .slice(0, max);
}
