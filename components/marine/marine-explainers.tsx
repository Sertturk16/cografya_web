import type { MarineExplainer } from "@/lib/marine/explainers";
import styles from "./marine.module.css";

interface MarineExplainersProps {
  /** Built ONCE by the page via `buildMarineExplainers` and shared with the FAQ JSON-LD. */
  explainers: MarineExplainer[];
}

/**
 * The seven permanent explainer blocks (SPEC-ADDENDUM §7.12, B11) — the half of `/deniz`
 * that stays useful whether or not a number is on screen.
 *
 * The strings arrive already resolved, from the same `buildMarineExplainers()` call that
 * feeds the page's `FAQPage` JSON-LD, so the marked-up answer and the rendered paragraph
 * are literally the same string (`lib/marine/explainers.ts` explains why that matters).
 *
 * Each block is a QUESTION heading plus ONE paragraph — never a `<details>`. Google's FAQ
 * guidance wants the content visible, and collapsing an explainer behind a disclosure only
 * hides the thing a reader came for.
 */
export function MarineExplainers({ explainers }: MarineExplainersProps) {
  return (
    <>
      {explainers.map((explainer) => {
        const headingId = `deniz-explainer-${explainer.id}`;
        return (
          <section key={explainer.id} className="section" aria-labelledby={headingId}>
            <h2 id={headingId} className={styles.explainerHeading}>
              {explainer.question}
            </h2>
            <p className={styles.explainerBody}>{explainer.answer}</p>
          </section>
        );
      })}
    </>
  );
}
