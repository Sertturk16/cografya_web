import type { MarineExplainer } from "@/lib/marine/explainers";
import styles from "./marine.module.css";

interface MarineExplainersProps {
  /** Resolved by the page via `buildMarineExplainers`; empty in a locale without the copy. */
  explainers: MarineExplainer[];
}

/**
 * The seven permanent explainer blocks (SPEC-ADDENDUM §7.12, B11) — the half of `/deniz`
 * that stays useful whether or not a number is on screen.
 *
 * The strings arrive already resolved from `buildMarineExplainers()`, which is the one place
 * the block set and its order are declared (`lib/marine/explainers.ts`).
 *
 * Each block is a QUESTION heading plus ONE paragraph — never a `<details>`. Collapsing an
 * explainer behind a disclosure hides the thing a reader came for, and this page has no
 * numbers to compete with it for space.
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
