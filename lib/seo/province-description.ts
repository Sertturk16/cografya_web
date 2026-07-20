/**
 * Deterministic meta-description variant selection for province pages.
 *
 * Three skeleton-distinct description variants (PLAN §2 / SEO-POLICY §B10 — they must
 * differ in STRUCTURE, not just interpolated numbers) are rotated across the corpus by
 * `plateCode % 3`. The choice is **deterministic, never random**: a random pick would
 * change the emitted `<meta>` from build to build for the same URL, which is SEO churn
 * (a stable page must present a stable description). Keying on the immutable plate code
 * makes each province's variant fixed forever.
 */
export type ProvinceDescriptionVariant = 0 | 1 | 2;

/**
 * The variant index for a province, from its plate code. Plate codes are the api's
 * 2-digit zero-padded numeric strings ("01".."81"); a non-numeric/blank value falls
 * back to variant 0 rather than throwing (the description is best-effort chrome, never
 * a reason to 500 a page). The `((n % 3) + 3) % 3` form is defensive against a
 * hypothetical negative input — plate codes are never negative, but the modulo stays
 * correct if that ever changes.
 */
export function provinceDescriptionVariant(plateCode: string): ProvinceDescriptionVariant {
  const n = Number.parseInt(plateCode, 10);
  if (!Number.isFinite(n)) return 0;
  return (((n % 3) + 3) % 3) as ProvinceDescriptionVariant;
}

/** The three climate-tier description message keys, indexed by variant. */
export const CLIMATE_DESCRIPTION_KEY: Record<ProvinceDescriptionVariant, string> = {
  0: "metaDescriptionClimate0",
  1: "metaDescriptionClimate1",
  2: "metaDescriptionClimate2",
};
