import type { MarineExplainer } from "@/lib/marine/explainers";
import styles from "./marine.module.css";

interface MarineExplainersProps {
  /** Resolved by the page via `buildMarineExplainers`; empty in a locale without the copy. */
  explainers: MarineExplainer[];
  /** The wrapper heading's text and the id its `<section>` is labelled by. */
  heading: string;
  headingId: string;
}

/**
 * The seven permanent explainer blocks (SPEC-ADDENDUM §7.12, B11) — the half of `/deniz` that
 * stays useful whether or not a number is on screen.
 *
 * WHY THEY ARE `<h3>` UNDER ONE `<h2>` SINCE W2a. They used to be seven sibling `<h2>`s, from
 * when they were the page's subject. They are not any more: the subject is the sea state, and
 * these are the layer that explains it. A document outline should say that out loud, and seven
 * equal-weight headings say the opposite — that the page is seven articles with a table on
 * top.
 *
 * The cost is a nominal one, and it is worth naming: seven question-shaped `<h2>`s become
 * `<h3>`s and one generic `<h2>` ("Sık sorulan sorular") appears, which `CONTENT-STYLE.md` §19
 * would frown at. §19 was written for TEMPLATED entity pages — two hundred provinces sharing
 * one skeleton — not for a single hand-written hub, the questions keep every keyword they
 * carried, and the reversal is one character wide if FENER disagrees.
 *
 * Each block is a QUESTION heading plus ONE paragraph — never a `<details>`. Collapsing an
 * explainer hides the thing a reader came for.
 *
 * There is deliberately still NO `FAQPage` JSON-LD built from these blocks: Google restricts
 * FAQ rich results to authoritative government and health sites, so the markup would win this
 * page no SERP surface while committing us to keeping a second byte-identical copy of seven
 * answers forever. The blocks are visible content and stand on their own.
 */
export function MarineExplainers({ explainers, heading, headingId }: MarineExplainersProps) {
  // No wrapper heading over nothing: `/en/sea` renders no blocks at all (the
  // machine-translation ban), and an empty "Sık sorulan sorular" section there would be a
  // heading with no content under it.
  if (explainers.length === 0) return null;

  return (
    <section className="section" aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      {explainers.map((explainer) => {
        const blockId = `deniz-explainer-${explainer.id}`;
        return (
          <section key={explainer.id} className={styles.explainer} aria-labelledby={blockId}>
            <h3 id={blockId} className={styles.explainerHeading}>
              {explainer.question}
            </h3>
            <p className={styles.explainerBody}>{explainer.answer}</p>
          </section>
        );
      })}
    </section>
  );
}
