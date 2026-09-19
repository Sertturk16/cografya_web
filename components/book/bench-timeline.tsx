"use client";

import { useTranslations } from "next-intl";
import { formatDuration } from "@/lib/book/duration";
import { tagFragment } from "@/lib/book/video-identity";

/**
 * THE CARD. `book-video.module.css`'s `.timeline`, in bridge tokens (T-033 task 7).
 *
 * `max-w-[560px]` is ONE OF FOUR COPIES OF ONE CAP — `.frame`, `.stageCaption`, this card and
 * `.progressControls` all wore it, and `bench.structure.test.ts` asserts the four as an
 * EQUALITY rather than as four presence checks, because a cap that drifts on one of them is
 * the defect (PR #70 review `CODE70-M2`: an uncapped caption started 84px to the player's
 * left). It was a `components/css-module-fixed-widths.test.ts` census entry until this
 * conversion; the census cannot read a Tailwind class in JSX, so the pin moved to that suite
 * per `lib/test-support/converted-floor.ts`. Hoisted for that reason: the extractor reads a
 * top-level `const NAME = "…";` and hands back `null` for a value left inline — silently.
 *
 * NO `min-h-*` HERE, and the absence is asserted. The empty card's height is the composition
 * of this padding and `TIMELINE_BAR`'s fixed lane, never a second declaration of the same
 * measurement (see this component's docblock).
 *
 * `bg-card` is the bridge for the stylesheet's literal `#fff` — the same value in light mode
 * (`--card` is `#ffffff`) and `#121e21` in dark, where the raw `#fff` painted a white card on
 * a night page at **18.65:1 against `--background`**. `rounded-lg` is `--radius-lg`, which
 * `app/globals.css` defines as `var(--radius)` — the exact value the stylesheet wrote.
 */
const TIMELINE =
  "mx-auto mt-[14px] max-w-[560px] rounded-lg border border-border bg-card px-6 pt-4 pb-3";

/**
 * The rail the ticks are placed along — `.timelineBar`.
 *
 * `h-1.5` (6px) and `mb-[38px]` are the fixed lane that makes the empty card and the full one
 * measure identically; `bench.structure.test.ts` pins both, because losing either turns the
 * card's reserved height back into a number that can drift.
 *
 * MEASURED, AND T-055 OWNS WHAT TO DO ABOUT IT. `bg-muted` on the card this rail sits in
 * measures **1.20:1 light / 1.16:1 dark**, under WCAG 1.4.11's 3:1. That ticket carries both
 * alternatives with their readings (`bg-input` 3.86:1 light / 4.02:1 dark, `bg-border` 1.45 /
 * 1.53) and the reason it is a design decision rather than a defect to fix in passing.
 *
 * THIS IS NOT A PROGRESS BAR, and the distinction is what decides the 1.4.11 question. Nothing
 * here is filled: this component receives `orderNo`, `tags` and `durationSeconds` and nothing
 * else, playback position never reaches it, the saved position is a TEXT line in
 * `video-progress-controls.tsx`, and the scrubber the reader actually drags is YouTube's own,
 * inside the iframe. So there is no filled-vs-unfilled boundary to carry a ratio, and no
 * "extent of the media" being communicated — this is a question-POSITION strip. The nearest
 * real 1.4.11 boundary is the tick dot's 2px `border-primary` where it crosses the rail:
 * **4.26:1 light / 4.29:1 dark**, clearing 3:1. Every tick's information is redundantly
 * textual besides (the number in the dot, the timestamp under it).
 *
 * NOR IS IT THE DEFECT T-033 EXISTS TO REMOVE, and the two are a different class. A frozen raw
 * token is theme-ASYMMETRIC — the same declaration read 18.65:1 on this card in dark and 1.06:1
 * in light — which is how a stage ends up as a white box on a night page. This pair is
 * symmetric by construction: 1.20 light, 1.16 dark, because `--muted` and `--card` move
 * together. The stylesheet's own reading was the same 1.20:1 in BOTH themes (it painted
 * `--color-surface` on a literal `#fff`), so `bg-muted` — `--color-surface`'s faithful bridge,
 * the substitution `earthquake-list.tsx` and `pm25-table.tsx` already make where `bg-card` IS
 * the surface underneath — carries it across unchanged rather than introducing it.
 */
const TIMELINE_BAR = "relative mb-[38px] h-1.5 rounded-full bg-muted";

/**
 * The whole tick — dot plus time — is the link, so the target is the 24px dot AND the label
 * beneath it. `-translate-x-1/2` centres it on its own percentage.
 *
 * `group` is load-bearing: the stylesheet's `.tick:hover .tickDot` is a descendant rule, and a
 * Tailwind `hover:` on the DOT would only fire when the pointer is over the dot itself rather
 * than anywhere on the link. `text-primary-strong` is the bridge for `--color-primary-dark`,
 * which the dot's number inherits: **7.89:1 light / 8.99:1 dark** on `--background`, against
 * the frozen token's 2.23:1 in dark.
 */
const TICK =
  "group absolute -top-[9px] flex -translate-x-1/2 flex-col items-center gap-1 text-primary-strong no-underline";

/**
 * 24x24 is WCAG 2.2 §2.5.8's (AA) floor EXACTLY, and unlike the question cells this control
 * cannot be generous: its position IS its meaning, so a 44px dot would overlap its neighbours
 * at the measured spacings and stop reporting where the question is. That is §2.5.8's own
 * "Essential" case. The question is never reachable only here — the same six links sit in the
 * index row below at 44px.
 *
 * `size-6` is the `width: 24px` the fixed-px census used to hold, so `bench.structure.test.ts`
 * pins it here instead, bidirectionally and against a de-hoist control.
 *
 * `bg-card` matches the card beneath it deliberately: the dot is drawn by its 2px terracotta
 * BORDER, not by a fill that differs from the card, exactly as the stylesheet's `#fff`-on-
 * `#fff` pair did.
 */
const TICK_DOT =
  "grid size-6 place-items-center rounded-full border-2 border-primary bg-card text-[0.75rem] " +
  "font-bold tabular-nums group-hover:border-primary-strong group-hover:bg-muted";

/**
 * `text-[0.7rem]` rather than `text-xs`: a named Tailwind size carries a line-height the
 * stylesheet never set (the tick inherits 1.6 from `body`), and `text-xs` would have replaced
 * 17.92px with 16px and reflowed the label lane the empty card's height depends on.
 * `text-muted-foreground` is `--color-slate`'s bridge — **7.92:1 light / 7.79:1 dark** on the
 * card, against the frozen token's 2.36:1 on a dark page.
 */
const TICK_TIME = "text-[0.7rem] text-muted-foreground tabular-nums";

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
 * index row (`lib/book/video-identity.ts`), from the same `tags` array that renders those
 * rows. A tick pointing at a fragment that does not exist is `SEO-POLICY.md` §B8 8.9's BLOCKER,
 * and deriving both ends from one array is what makes "every href has a target" true by
 * construction rather than by two lists agreeing — the discipline `FENER66-M2` established for
 * the jump strip, applied to the strip this PR adds.
 *
 * The ticks carry no `id`. The ids stay on the index rows, where they have always been, so this
 * strip adds no duplicate id and no second definition of where `#video-12-etiket-3` points.
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
 * Each tick keeps `tagLabelAria`, the same accessible name the index row carries — the name
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
 * The reachable path is a shared deep link. `#video-33-etiket-4` renders on the server with the
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
  orderNo,
  tags,
  durationSeconds,
}: {
  orderNo: number;
  tags: readonly {
    readonly orderNo: number;
    readonly second: number;
    readonly nameTr: string | null;
  }[];
  /** `null` in the two non-rich states — the card still renders, with no ticks in it. */
  durationSeconds: number | null;
}) {
  const t = useTranslations("BookDetail");

  // A zero or negative duration is unreachable through the contract (its minimum is 1) and would
  // divide every tick to Infinity; `null` is the ordinary no-snapshot case. Both land here, and
  // both keep the box.
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return (
      <div className={TIMELINE}>
        <div className={TIMELINE_BAR} />
      </div>
    );
  }

  return (
    <div className={TIMELINE} role="group" aria-label={t("timelineLabel")}>
      <div className={TIMELINE_BAR}>
        {tags.map((tag) => {
          const ratio = Math.min(1, Math.max(0, tag.second / durationSeconds));
          return (
            <a
              key={tag.orderNo}
              className={TICK}
              style={{ left: `${(ratio * 100).toFixed(2)}%` }}
              href={`#${tagFragment(orderNo, tag, tags)}`}
              data-second={tag.second}
              aria-label={t("tagLabelAria", {
                no: tag.orderNo,
                time: formatDuration(tag.second),
              })}
            >
              <span className={TICK_DOT} aria-hidden="true">
                {tag.orderNo}
              </span>
              <span className={TICK_TIME} aria-hidden="true">
                {formatDuration(tag.second)}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
