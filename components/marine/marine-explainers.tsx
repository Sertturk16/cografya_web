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
 * Shared `name` on every `<details>` below — a real HTML disclosure GROUP: opening one closes
 * every other `<details>` that shares this string (the `name` attribute, WHATWG HTML §4.11.1,
 * shipped in Chromium 120 / Firefox 118 / Safari 17.2). There is only one accordion on this
 * page, so one constant group name is enough; a second accordion elsewhere would need its own.
 */
const FAQ_ACCORDION_GROUP = "deniz-faq";

/**
 * The permanent explainer blocks (SPEC-ADDENDUM §7.12, B11's original seven, plus the
 * owner-approved eighth) — the half of `/deniz` that stays useful whether or not a number is
 * on screen.
 *
 * WHY THEY ARE `<h3>` UNDER ONE `<h2>` SINCE W2a. They used to be sibling `<h2>`s, from when
 * they were the page's subject. They are not any more: the subject is the sea state, and
 * these are the layer that explains it. A document outline should say that out loud, and
 * equal-weight headings say the opposite — that the page is several articles with a table on
 * top.
 *
 * ACCORDION, SINCE deniz-notlar.txt madde 8 (owner-directed, → reversing this file's own
 * earlier "never a `<details>`" rule). The earlier rule's reasoning — "collapsing an
 * explainer hides the thing a reader came for" — was written when the block SET was the
 * page's only content; it no longer holds now that the page opens with the map and four value
 * tables (W2a) and these eight blocks sit below as a genuinely secondary, supporting layer.
 * With eight full-paragraph answers always open, the page's own owner-reported symptom
 * (deniz-notlar.txt madde 9: "sayfa aşırı uzun ve tekrarlı hissettiriyor") is real, and a
 * closed-by-default accordion is the direct fix: eight short questions replace eight long
 * paragraphs in the first view, and a reader who wants one answer gets it without scrolling
 * past the other seven.
 *
 * NATIVE `<details>`/`<summary>` rather than a client component with `useState`, for three
 * reasons, in order of weight. (1) **No-JS reality.** This page's substance is the seven
 * hand-written Turkish narrative blocks (`app/[locale]/deniz/page.tsx`'s own docblock) —
 * exactly the content this whole surface exists to keep reachable. A JS-only accordion would
 * make every answer permanently unreachable to a reader with JavaScript disabled or broken
 * (SSR still ships the closed markup, so a CRAWLER reads everything regardless — the risk is
 * to a HUMAN, not to SEO). `<details>` needs no script at all: the content is always in the
 * DOM and always togglable, with or without JS. (2) **Single-open "for free."** The `name`
 * attribute gives the classic accordion behaviour (opening one closes the rest) as a browser
 * primitive — no open/close state to own, no risk of two panels drifting out of sync. Support
 * is broad enough by now (all three engines shipped it in late 2023) that the ONLY graceful
 * degradation on an older engine is more than one panel able to stay open at once — still
 * closed-by-default, still fully operable, never broken. (3) **A11y for free.** `<summary>`
 * carries an implicit toggle-button role with a native `aria-expanded` that the browser keeps
 * in sync with the `open` state, is keyboard-operable (Enter/Space) with no `tabIndex`/
 * `onKeyDown` to hand-wire, and needs no `aria-controls` wiring — this is exactly the
 * "check a11y implications: keyboard operability, aria-expanded, focus management" bar this
 * task named, met by the platform rather than by bespoke code. The question stays a REAL
 * `<h3>` inside `<summary>` (not summary's own plain text), so a reader navigating by heading
 * still finds all eight questions in the document outline exactly as before — the pattern is
 * the one Scott O'Hara's `<details>`-accordion guidance and this repo's own "boring, proven
 * patterns over clever ones" persona rule both point to.
 *
 * There is deliberately still NO `FAQPage` JSON-LD built from these blocks: Google restricts
 * FAQ rich results to authoritative government and health sites, so the markup would win this
 * page no SERP surface while committing us to keeping a second byte-identical copy of every
 * answer forever. The blocks are visible content (closed markup is still real HTML, read by
 * every crawler) and stand on their own.
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
          <details key={explainer.id} className={styles.explainer} name={FAQ_ACCORDION_GROUP}>
            <summary className={styles.explainerSummary}>
              <h3 id={blockId} className={styles.explainerHeading}>
                {explainer.question}
              </h3>
            </summary>
            <p className={styles.explainerBody}>{explainer.answer}</p>
          </details>
        );
      })}
    </section>
  );
}
