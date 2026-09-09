/**
 * The permanent explainer blocks of `/deniz` — five core plus three added since
 * (SPEC-ADDENDUM §7.12, B11's original seven, plus the owner-approved eighth,
 * "dataFreshness") — and the ONE place their message keys are listed.
 *
 * Why a module instead of inline `t()` calls in the JSX: the block SET is a requirement (B11
 * named the original seven), the block ORDER is editorial, and both are properties of the
 * content rather than of the markup that happens to render it. Declared once here, they can
 * be asserted (`explainers.test.ts`) and reused by any future consumer without a second
 * hand-maintained list of keys drifting away from the first.
 *
 * There is deliberately NO `FAQPage` JSON-LD built from these blocks. Google has restricted
 * FAQ rich results to authoritative government and health sites since 2023, so the markup
 * would win this page no SERP surface while committing us to keeping a second copy of the
 * same answers byte-identical forever. The blocks are visible content and stand on their
 * own.
 *
 * The blocks are Turkish-only and are not rendered on `/en/sea` at all — machine
 * translation is barred (`SEO-POLICY.md` §B14).
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
 * point is. A block is a SINGLE paragraph by requirement — one question, one answer, no
 * sub-structure to get lost when the copy is revised.
 *
 * EIGHTH BLOCK ADDED AT POSITION 6 (deniz-notlar.txt madde 5 / deniz-yeni.txt madde 6,
 * owner-approved copy). It answers the reader-facing side of the "why not poll/socket for a
 * live number" question the removed per-row "Geçerlilik anı" repetition used to gesture at
 * without explaining, and it sits right after `q5`/`a5` (why the four seas do not update at
 * the same time) because both answers are about the SAME fact — each provider's own
 * publication cadence — read from two different angles.
 *
 * The message key is `q8`/`a8`, not a renumbered `q6`/`a6`, DELIBERATELY: the two existing
 * entries that move down a slot (`marmaraWaves`, `referencePoint`) keep their own message
 * keys and byte-identical copy untouched — only this ARRAY's order encodes the "6→7, 7→8"
 * shift the owner asked for. Renumbering the JSON keys to match would touch two live strings
 * for no reason beyond cosmetics, and risk a copy-paste slip in text nobody asked to change.
 */
export const MARINE_EXPLAINER_KEYS = [
  { id: "waveHeight", question: "q1", answer: "a1" },
  { id: "windHeight", question: "q2", answer: "a2" },
  { id: "seaSurfaceTemperature", question: "q3", answer: "a3" },
  { id: "resolution", question: "q4", answer: "a4" },
  { id: "regionalModels", question: "q5", answer: "a5" },
  { id: "dataFreshness", question: "q8", answer: "a8" },
  { id: "marmaraWaves", question: "q6", answer: "a6" },
  { id: "referencePoint", question: "q7", answer: "a7" },
] as const;

/**
 * Resolves the explainer blocks through a `Deniz`-namespace translator.
 *
 * Pure: the same translator always yields the same blocks in the same order, so every
 * consumer of the result renders the same strings.
 */
export function buildMarineExplainers(t: MarineTranslator): MarineExplainer[] {
  return MARINE_EXPLAINER_KEYS.map((entry) => ({
    id: entry.id,
    question: t(entry.question),
    answer: t(entry.answer),
  }));
}
