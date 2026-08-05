/**
 * Should the country page print a separate "Bölge" (UN M49 subregion) card?
 *
 * ## The defect (UX tour B28)
 *
 * Brezilya rendered "Kıta: Güney Amerika" and "Bölge: Güney Amerika" side by side. In M49 a
 * continent-level region and its subregion legitimately coincide for a whole class of
 * countries, and two adjacent cards showing one value reads as a rendering fault rather than
 * as two facts that happen to agree.
 *
 * ## Exact equality, deliberately (→ PR #47 review CR-M1)
 *
 * The two sides come from DIFFERENT vocabularies: `continent` is the localized value of the
 * `Continents` message catalogue, `subregion` is the api's `unSubregionTr` field. Both are
 * canonical Turkish names from controlled lists, so their spelling already agrees — and this
 * comparison stays a raw `!==` on purpose.
 *
 * Folding case, trimming or normalizing diacritics here would make the function start
 * suppressing cards for pairs that are NOT the same place, and a hidden fact is a worse
 * failure than a duplicated one. The one thing that CAN break this is a catalogue edit
 * (renaming `Continents.GUNEY_AMERIKA` to something the api does not use), which is why the
 * coupling is pinned in `subregion.test.ts` rather than left to a comment.
 */
export function showsSubregionCard(
  continent: string,
  subregion: string | null,
): subregion is string {
  return subregion !== null && subregion !== continent;
}
