/**
 * The seven permanent explainer blocks of `/deniz` (SPEC-ADDENDUM §7.12, B11) — and the
 * ONE place their message keys are listed.
 *
 * Why a shared builder instead of two lists: the visible blocks and the `FAQPage` JSON-LD
 * must carry character-for-character identical text. Google's FAQPage documentation
 * requires the marked-up content to be visible on the page, and `SEO-POLICY.md` §B5 5.7
 * treats structured data that is not on the page as a spam signal, not a bonus (it is why
 * DEC 2026-07-30r removed the FAQ markup from `/oyun` together with its visible FAQ). If
 * the renderer and the markup builder each read their own keys, that guarantee lasts
 * exactly until someone edits one of them. Both call THIS function, so the two
 * representations are the same strings by construction, not by discipline.
 *
 * The blocks are Turkish-only and are not rendered on `/en/sea` at all — machine
 * translation is barred (`SEO-POLICY.md` §B14), so the EN page carries no FAQ markup either.
 */

/** The minimal shape of a next-intl translator this module needs. */
export type MarineTranslator = (key: string) => string;

/** One explainer: a question heading and its single-paragraph answer. */
export interface MarineExplainer {
  /** The message key pair this entry was built from (stable React key / test handle). */
  id: string;
  question: string;
  answer: string;
}

/**
 * The block order, as message-key pairs in the `Deniz` namespace.
 *
 * Order is editorial and deliberate: definitions first (what the numbers mean), then the
 * model's limits (resolution, per-sea models, the Marmara wave gap), then what a reference
 * point is. A block is a SINGLE paragraph by requirement — the JSON-LD answer is plain
 * text, so a two-paragraph block could not be reproduced identically.
 */
export const MARINE_EXPLAINER_KEYS = [
  { id: "waveHeight", question: "q1", answer: "a1" },
  { id: "windHeight", question: "q2", answer: "a2" },
  { id: "seaSurfaceTemperature", question: "q3", answer: "a3" },
  { id: "resolution", question: "q4", answer: "a4" },
  { id: "regionalModels", question: "q5", answer: "a5" },
  { id: "marmaraWaves", question: "q6", answer: "a6" },
  { id: "referencePoint", question: "q7", answer: "a7" },
] as const;

/**
 * Resolves the explainer blocks through a `Deniz`-namespace translator.
 *
 * Call it once per render and pass the result to BOTH the visible section and
 * `faqPageJsonLd` — never call it twice with different translators.
 */
export function buildMarineExplainers(t: MarineTranslator): MarineExplainer[] {
  return MARINE_EXPLAINER_KEYS.map((entry) => ({
    id: entry.id,
    question: t(entry.question),
    answer: t(entry.answer),
  }));
}
