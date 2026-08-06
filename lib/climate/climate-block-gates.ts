/**
 * The province page's climate-block gating, as one pure decision (→ PR #47 review TA47-M1;
 * the repo precedent is `featuredPopulationFact` in `lib/home/featured.ts`).
 *
 * Three booleans that USED to be three separate expressions in the page component, where
 * nothing could test them and where the relationship between them lived only in comments.
 * They are not independent — that is the whole reason to compute them together:
 *
 * 1. the İklim `<h2>` renders when the block has ANY content to sit over;
 * 2. the MGM Köppen CLASSIFICATION line renders only inside that section, and only when the
 *    api actually carries a class;
 * 3. the Kaynaklar line cites MGM's classification **iff** (2) rendered.
 *
 * ## The regression class this exists to prevent
 *
 * (3) is the UX-tour B5 defect. The classification used to be welded into the base `sources`
 * sentence, so all ~81 EN province pages claimed "…and the climate classification from MGM"
 * while the entire climate block sits behind the `isTr` gate and renders nothing there — a
 * source cited for content that is not on the page. Deriving the citation from the same value
 * that gates the line makes the two unable to disagree, and pins it in a test rather than in a
 * comment someone can edit around.
 *
 * ## Why the locale gate is IN here
 *
 * The class name (`climateClassTr`) and the mandatory MGM caveat (`climateNoteTr`) are
 * untranslated Turkish, and `CONVENTIONS.md` §6 forbids shipping a bare Köppen code without
 * that caveat. So EN gets no climate block at all until real EN content lands
 * (`EN_CONTENT_READY`, `lib/seo/indexing.ts`). Keeping `isTr` inside this function means the
 * EN suppression is covered by the same tests, instead of being an `&&` a refactor can drop.
 *
 * ## `citeCurriculumSource` (WEB-KOPPEN, plan §5)
 *
 * A fourth, independent boolean added alongside the original three — not a restructuring of
 * the function's shape (plan A-4). It mirrors `citeClassSource`'s own citation-parity
 * invariant ("never cite a source for content not on the page", `page.tsx` L403-411) for the
 * NEW MEB curriculum attribution: the curriculum name is a distinct source family from MGM's
 * Köppen classification (DEC 2026-08-05c item 1), so it earns its own `extraSources` entry —
 * gated on `hasCurriculumName`, NOT on `showClass` alone. The value line still renders when
 * `climateCurriculumNameTr` is null (contract-legal fallback: code-only, `plan §3` V-1), and
 * that fallback shows nothing MEB-sourced, so citing the MEB source there would cite content
 * that is not on the page — exactly the class of bug this whole module exists to prevent.
 */

export interface ClimateBlockInput {
  /** Is this the Turkish locale? EN renders no climate block today. */
  readonly isTr: boolean;
  /** Does the api carry BOTH a class name and a Köppen code for this province? */
  readonly hasClimateClass: boolean;
  /** Is there a publishable ERA5-Land series (the chart + table)? A SEPARATE source. */
  readonly hasClimateSeries: boolean;
  /** Are there same-climate cross-link cards to show? */
  readonly hasSimilarClimate: boolean;
  /** Does the api carry a non-null `climateCurriculumNameTr` for this province? */
  readonly hasCurriculumName: boolean;
}

export interface ClimateBlockGates {
  /** Render the İklim `<h2>` and everything under it. */
  readonly showSection: boolean;
  /** Render the "Akdeniz iklimi (Köppen: Csa)" line and its plain-language sentence. */
  readonly showClass: boolean;
  /** Add `ProvinceDetail.sourcesClimateClass` to the Kaynaklar line. */
  readonly citeClassSource: boolean;
  /** Add `ProvinceDetail.sourcesClimateCurriculum` to the Kaynaklar line (WEB-KOPPEN). */
  readonly citeCurriculumSource: boolean;
}

export function climateBlockGates(input: ClimateBlockInput): ClimateBlockGates {
  const { isTr, hasClimateClass, hasClimateSeries, hasSimilarClimate, hasCurriculumName } = input;

  const showSection = isTr && (hasClimateClass || hasClimateSeries || hasSimilarClimate);
  const showClass = showSection && hasClimateClass;

  return {
    showSection,
    showClass,
    // NOT an independent condition — it is `showClass` by definition. Written as a reference
    // rather than as a repeated expression so the two can never drift apart, which is exactly
    // how the base-string version went wrong.
    citeClassSource: showClass,
    // The MEB name segment renders only when the value line renders AND the api actually
    // carries a curriculum name (the null branch shows the Köppen code alone — nothing
    // MEB-sourced to cite).
    citeCurriculumSource: showClass && hasCurriculumName,
  };
}
