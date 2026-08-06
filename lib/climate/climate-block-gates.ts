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
 * ## `citeCurriculumSource` (WEB-KOPPEN, plan §5; gate corrected by PR #51 review I4)
 *
 * A fourth, independent boolean added alongside the original three — not a restructuring of
 * the function's shape (plan A-4). It mirrors `citeClassSource`'s own citation-parity
 * invariant ("never cite a source for content not on the page", `page.tsx` L403-411) for the
 * NEW MEB curriculum attribution: the curriculum name is a distinct source family from MGM's
 * Köppen classification (DEC 2026-08-05c item 1), so it earns its own `extraSources` entry —
 * gated on `hasCurriculumName` AND `hasClimateNote`, NOT on `showClass` alone. TWO independent
 * fallbacks can each suppress the MEB name from the rendered value line, and the citation must
 * track BOTH, not just one:
 *   1. `hasCurriculumName === false` — the contract-legal code-only fallback (`plan §3` V-1):
 *      the value line still renders ("Köppen: <code>" only), but nothing MEB-sourced is shown.
 *   2. `hasClimateNote === false` — the pre-existing defense-in-depth fallback (`page.tsx`'s
 *      `climateNoteTr === null` branch, `climateClassOnly`): the MGM class name prints and NO
 *      curriculum-name segment renders at all, even when `hasCurriculumName` is true.
 * PR #51's review round (I4) found the gate checked only (1) — a curriculum name could be
 * cited while the page actually rendered the (1)-independent `climateClassOnly` fallback,
 * attributing a name that was never on the page. `hasClimateNote` closes that gap.
 *
 * ## `showCurriculumNote` (WEB-KOPPEN plan §2/§3/A-1; extracted by PR #51 review — the
 * curriculum-note-asymmetry-untested MINOR)
 *
 * The 15/81-province `climateCurriculumNoteTr` prose block used to be gated by a bare
 * `!== null` check directly in `page.tsx`, which meant nothing could unit-test the 15-have /
 * 66-don't-render-a-placeholder asymmetry (plan §2 V-2). Extracted here for the same reason
 * the original three booleans were: `showClass` already answers "does `climate` exist AND
 * does the section render", so the note block's real condition is that AND the note text
 * itself being present — never independently of the section housing it.
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
  /**
   * Does the api carry the mandatory MGM caveat (`climateNoteTr`) for this province? When
   * false, the value line's defense-in-depth fallback (`climateClassOnly`) takes over and
   * shows NEITHER the curriculum name NOR the Köppen code — so nothing MEB-sourced is on the
   * page regardless of `hasCurriculumName` (PR #51 review I4).
   */
  readonly hasClimateNote: boolean;
  /** Does the api carry a non-null `climateCurriculumNoteTr` (the 15/81 prose note) for this
   *  province? A DIFFERENT field from `hasCurriculumName` above — the name and the note are
   *  independently nullable. */
  readonly hasCurriculumNoteText: boolean;
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
  /** Render the 15/81-province curriculum-note prose block (never an "eksik veri" placeholder
   *  for the other 66 — plan §2 V-2). */
  readonly showCurriculumNote: boolean;
}

export function climateBlockGates(input: ClimateBlockInput): ClimateBlockGates {
  const {
    isTr,
    hasClimateClass,
    hasClimateSeries,
    hasSimilarClimate,
    hasCurriculumName,
    hasClimateNote,
    hasCurriculumNoteText,
  } = input;

  const showSection = isTr && (hasClimateClass || hasClimateSeries || hasSimilarClimate);
  const showClass = showSection && hasClimateClass;

  return {
    showSection,
    showClass,
    // NOT an independent condition — it is `showClass` by definition. Written as a reference
    // rather than as a repeated expression so the two can never drift apart, which is exactly
    // how the base-string version went wrong.
    citeClassSource: showClass,
    // The MEB name segment is cited only when BOTH fallbacks that could suppress it are clear:
    // the value line renders the class line at all (`showClass`), the api actually carries a
    // curriculum name (`hasCurriculumName` — the code-only fallback shows nothing MEB-sourced),
    // AND the mandatory MGM caveat is present (`hasClimateNote` — otherwise the defense-in-depth
    // `climateClassOnly` fallback takes over and shows no curriculum name at all, PR #51 I4).
    citeCurriculumSource: showClass && hasCurriculumName && hasClimateNote,
    // Same shape as `citeClassSource`/`citeCurriculumSource`: derived, not a second place that
    // could drift from the section's own gate. `showClass` already excludes EN and "no class"
    // provinces; the note block's own field is the only thing left to check.
    showCurriculumNote: showClass && hasCurriculumNoteText,
  };
}
