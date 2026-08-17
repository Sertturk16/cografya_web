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
  durationSeconds: number;
}) {
  const t = useTranslations("BookDetail");
  // A zero or negative duration is unreachable through the contract (its minimum is 1) and would
  // divide every tick to Infinity. Rendering nothing is the honest answer: the rows below still
  // carry all six questions.
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

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
