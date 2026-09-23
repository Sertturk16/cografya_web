/** Türkiye has 81 provinces; a sum over fewer is not the country's population. */
const PROVINCE_COUNT = 81;

interface ProvincePopulationRow {
  readonly plateCode: string;
  readonly population: number | null;
  readonly populationYear: number | null;
}

/**
 * Türkiye's population as the sum of its 81 provinces' TÜİK figures, with their shared year.
 *
 * Derived rather than typed so the home page never goes stale (it read "85+ Milyon" long after
 * TÜİK passed 86 million) and always agrees with the province pages it links to. `null` means
 * "do not print a number": a degraded fetch, a province without a figure, or provinces from
 * different years would each produce a total that is not the country's population.
 */
export function nationalPopulation(
  rows: readonly ProvincePopulationRow[],
): { total: number; year: number } | null {
  if (rows.length !== PROVINCE_COUNT) return null;
  const year = rows[0]?.populationYear ?? null;
  if (year === null) return null;
  let total = 0;
  for (const row of rows) {
    if (row.population === null || row.populationYear !== year) return null;
    total += row.population;
  }
  return { total, year };
}
