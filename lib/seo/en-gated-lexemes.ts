/**
 * The lexemes ENGLISH country copy may not contain, because the field each one names is
 * `isTr`-gated in `app/[locale]/dunya/[slug]/page.tsx` and is therefore never drawn on an
 * English page (→ PR #54 `CR54-M2`, PR #55 `CR55-M1`).
 *
 * ## Why one module instead of two arrays
 *
 * The repo enforced this invariant twice, in two files, with two lists that had already
 * diverged on the day the second one landed:
 *
 *   · `lib/seo/country-description.test.ts` — the meta-description templates, which must not
 *     PROMISE a section the EN page does not render. `og:description` is emitted on a
 *     `noindex` page too, so the promise reaches a share card even when the page does not
 *     reach an index.
 *   · `lib/geo/country-sources.test.ts` — the `Sources:` sentence, which must not CREDIT the
 *     institution behind a field the EN page does not render.
 *
 * Promise and credit are two failure modes of ONE invariant — *English copy names only what
 * an English reader can see* — so they read one list. Whichever guard fires first, the field
 * is added or removed here once and both follow. Two lists meant the weaker one silently set
 * the bar: the sources ban shipped with four entries where the description ban had ten, so a
 * restored credit naming `climate` or `official language` would have passed.
 *
 * ## What is deliberately NOT here
 *
 * `"continent"`. `country.continent` is a locale-independent enum key printed through the
 * `Continents` namespace with **no gate at all**, so naming it in English copy is EARNED.
 * `CR54-M2` read "continent and region classification" as one credited item and assumed both
 * halves were gated; they are not. Banning it would be the same defect pointing the other
 * way — a rendered field left unnamed — so `"continent"` must never be added.
 *
 * ## The limit of a substring match, in both directions
 *
 * FALSE NEGATIVE — a synonym slips through. "monetary unit", "legal tender", "terrain" and
 * "polity" each name a gated field without tripping anything. (The escapes that look obvious
 * do NOT slip: "form of government" contains `government`, and "the region it sits in"
 * contains `region`.) The guard pins the wording that actually shipped and claims no more
 * than that; the defect class shipped once and survived a full review round, so pinning the
 * shipped wording beats pinning nothing.
 *
 * FALSE POSITIVE — an unrelated compound trips. "intergovernmental" contains `government`
 * (→ PR #55 `CR55-M4`). A trip is a red test carrying this docblock, not a blocked change:
 * the author who needs the word narrows the one entry, in one place.
 *
 * `region` is the live example of that tension (→ PR #55 `SG55-N2`). A future
 * neutrality-motivated rewording of the M49 credit may well want the word, and this entry
 * will stand in front of it. It stays bare anyway, because the wording that actually shipped
 * the defect was "Continent and region classification" — an entry narrowed to `subregion`
 * would let exactly that sentence back in.
 *
 * ## When this list must CHANGE, not be deleted
 *
 * These fields are gated by LOCALE, not by whether they exist. Flipping `EN_CONTENT_READY`
 * (`lib/seo/indexing.ts`) means the api serves the English counterparts AND the `isTr` gates
 * come out; from that moment the English page renders them and both guards above must widen
 * with it. The flip checklist in `indexing.ts` is the entry point, and the tripwire in
 * `country-sources.test.ts` makes the flip fail loudly instead of silently.
 *
 * Template lexemes only, never a geography fact (`CONVENTIONS.md` §2): no country, no
 * institution, no figure appears here. The module is read by guards rather than by shipped
 * code on purpose — the invariant is about COPY, which lives in `messages/*.json`.
 */
export const TR_GATED_FIELD_LEXEMES = [
  "climate",
  "currenc",
  "government",
  "hydrography",
  "independence",
  "landform",
  "official language",
  "physical geography",
  "region",
  "relief",
  "rivers",
] as const;
