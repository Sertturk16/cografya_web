"use client";

import { useTranslations } from "next-intl";
import { formatDuration } from "@/lib/book/duration";
import { questionFragment } from "@/lib/book/video-identity";
import styles from "./book-video.module.css";

/**
 * Where the questions fall inside the video — position as the encoding, the number as the label.
 *
 * ## What it is for
 *
 * Each question's start second is published data, so "question 5 is near the end" is a fact this
 * page already holds and used to spend six list rows to convey badly. Placed along the video's
 * real duration it is readable at a glance, and pressing a tick is the same jump the row below
 * performs.
 *
 * ## Every tick is a REAL link to a REAL target
 *
 * `href` is the question's own fragment, built by the same function that builds the `id` on the
 * index row (`lib/book/video-identity.ts`), from the same `questions` array that renders those
 * rows. A tick pointing at a fragment that does not exist is `SEO-POLICY.md` §B8 8.9's BLOCKER,
 * and deriving both ends from one array is what makes "every href has a target" true by
 * construction rather than by two lists agreeing — the discipline `FENER66-M2` established for
 * the jump strip, applied to the strip this PR adds.
 *
 * The ticks carry no `id`. The ids stay on the index rows, where they have always been, so this
 * strip adds no duplicate id and no second definition of where `#deneme-12-soru-3` points.
 *
 * ## The group label, and why this is the one new string
 *
 * These six links duplicate six links that sit a few hundred pixels below, and a screen-reader
 * user meeting them twice with identical names has no way to know why. The visual answer — the
 * dots' POSITION — is exactly the part that does not survive into the accessibility tree, so the
 * group is named rather than hidden. Hiding it was the alternative and it is worse in both
 * directions: `aria-hidden` over focusable links is its own violation, and dropping the links
 * would leave a row of dots that look pressable and are not.
 *
 * Each tick keeps `questionLabelAria`, the same accessible name the index row carries — the name
 * states a FACT about the question ("question 3 is at 3:24 of the video") rather than promising a
 * behaviour, so it stays true for a reader with no JavaScript, for whom the tick is the plain
 * fragment jump it always was.
 *
 * ## THE CARD IS RENDERED IN EVERY STATE, AND THAT IS A LAYOUT-SHIFT REQUIREMENT
 *
 * `durationSeconds === null` is the `typographic` and `external` states: no provider snapshot, so
 * there is nothing to place the questions against. The ticks are dropped there — but the CARD is
 * not, and the difference is 88px of Cumulative Layout Shift on a page whose stage sits ABOVE
 * thirty index rows (→ PR #70 review `FENER70-I1`, validated).
 *
 * The reachable path is a shared deep link. `#deneme-33-soru-4` renders on the server with the
 * book's FIRST video on the stage; hydration then moves the stage to video 33, and if that video's
 * snapshot has aged out — which the contract calls the normal path, not an error — a card that
 * existed in the first response disappears under a reader who is already looking at the rows below
 * it. `hadRecentInput` is false on that shift, so all of it counts, against a budget of
 * CLS < 0.1 (`ENGINEERING.md` §4 #9, `SEO-POLICY.md` §B11 11.12).
 *
 * THE EMPTY CARD'S HEIGHT IS NOT A NUMBER ANYWHERE. It is the same `.timeline` padding and the
 * same `.timelineBar` — whose 6px height and 38px label lane are fixed and whose ticks are
 * absolutely positioned — so the two states measure identically by construction. A `min-height`
 * holding the same 74px was the other candidate and was refused for the reason this repo refuses
 * every restated measurement: two declarations of one height drift, and the drift is invisible.
 *
 * The empty card carries no `role="group"` and no label, because there is nothing in it to group.
 * An empty labelled group is a name announced over no content, which is worse than the silence.
 *
 * ## Geometry
 *
 * `left` is the only inline style on this surface and it is data, not design: a percentage
 * computed from two published integers. It is clamped because the contract guarantees neither
 * that the first question starts at 0 nor that the last one starts before the end — the measured
 * set of first-question seconds is `{0, 2, 6, 11, 94}` — and a tick at 103% would be drawn
 * outside its own card.
 */
export function BenchTimeline({
  denemeNo,
  questions,
  durationSeconds,
}: {
  denemeNo: number;
  questions: readonly { readonly no: number; readonly second: number }[];
  /** `null` in the two non-rich states — the card still renders, with no ticks in it. */
  durationSeconds: number | null;
}) {
  const t = useTranslations("BookDetail");

  // A zero or negative duration is unreachable through the contract (its minimum is 1) and would
  // divide every tick to Infinity; `null` is the ordinary no-snapshot case. Both land here, and
  // both keep the box.
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return (
      <div className={styles.timeline}>
        <div className={styles.timelineBar} />
      </div>
    );
  }

  return (
    <div className={styles.timeline} role="group" aria-label={t("timelineLabel")}>
      <div className={styles.timelineBar}>
        {questions.map((question) => {
          const ratio = Math.min(1, Math.max(0, question.second / durationSeconds));
          return (
            <a
              key={question.no}
              className={styles.tick}
              style={{ left: `${(ratio * 100).toFixed(2)}%` }}
              href={`#${questionFragment(denemeNo, question.no)}`}
              data-second={question.second}
              aria-label={t("questionLabelAria", {
                no: question.no,
                time: formatDuration(question.second),
              })}
            >
              <span className={styles.tickDot} aria-hidden="true">
                {question.no}
              </span>
              <span className={styles.tickTime} aria-hidden="true">
                {formatDuration(question.second)}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
