import { getFormatter, getTranslations } from "next-intl/server";
import { formatDuration } from "@/lib/book/duration";
import { PUBLISHED_DATE_FORMAT } from "@/lib/book/published-date";
import type { BookVideoState } from "@/lib/book/video-state";

/**
 * `book-video.module.css`'s `.meta`, in bridge tokens (T-033 task 7).
 *
 * `inline-flex` rather than `flex` because it shares a line with the question count inside the
 * row's fact strip and must sit on that line rather than start its own.
 *
 * `text-[0.85rem]` rather than `text-sm`: a named Tailwind size carries a line-height the
 * stylesheet never set. This strip inherits 1.6 from `body`, so 0.85rem renders at
 * 13.6px/21.76px; `text-sm` would have made it 14px/20px and reflowed all thirty rows.
 *
 * `text-muted-foreground` is `--color-slate`'s bridge: **7.48:1 light / 8.53:1 dark** on the
 * page's `--background`, which is what this strip actually sits on (the row and the index
 * around it paint no fill of their own). The retired raw token measured 2.36:1 in dark.
 *
 * NO `m-0`: the stylesheet wrote `margin: 0` on a `<span>`, which has no UA margin to cancel.
 * Verified against the computed margins before and after rather than assumed.
 */
const META = "inline-flex flex-wrap items-baseline gap-1.5 text-[0.85rem] text-muted-foreground";

/**
 * The decorative dot. THE SAME SPELLING `bench-stage.tsx`'s own separator carries, and the two
 * are asserted equal in `bench.structure.test.ts` for the reason the retired stylesheet gave
 * for putting them on one token: the question count, the duration and the date sit on ONE line
 * inside one fact strip, so a separator that drifted in one file would split that line into two
 * colours. `--color-taupe` maps to `text-muted-foreground` per the plan's bridge table — it is
 * never body text (3.64:1 on white), and both dots are `aria-hidden` decorative marks.
 */
const META_SEPARATOR = "text-muted-foreground";

/**
 * The visible facts about one video — duration and publication date — on its index row.
 *
 * ## This is the `VideoObject` chain's visible half, and it is why the row carries it
 *
 * `SEO-POLICY.md` §B5 5.7 is a chain: a `VideoObject` may carry `uploadDate` and `duration` only
 * where the page SHOWS them, and 5.2 makes the markup itself BLOCKER-required for every video
 * whose provider snapshot exists. Thirty blocks therefore need thirty visible pairs, and the
 * index row is where they live — one per video, in the first response, with no press required.
 *
 * The bench did not weaken that and could not: the stage shows the SELECTED video's two facts
 * too, but the stage shows one video at a time and its selection is client state, so it can never
 * be what discharges the chain for the other twenty-nine. The row is the compliance surface; the
 * caption is a convenience.
 *
 * **The pair was weighed for removal and kept (→ AK-23, Q4).** The partner suggested dropping the
 * publication date as meaningless on a deneme row, and on its own terms the point is fair — the
 * provenance ledger obliges an attribution string, a brand mark and a link back, and names no
 * visible date at all. §B5 is what keeps it: dropping the visible date while thirty `uploadDate`
 * fields stand is 5.7's BLOCKER, dropping `uploadDate` invalidates markup Google requires the
 * field on, and dropping `VideoObject` breaks 5.2. Three exits, each through a ruling, for a
 * cosmetic gain — so the facts stay and their visual weight is what got reduced instead.
 *
 * ## Shape
 *
 * A `<span>` rather than a `<p>`: it shares the row's fact strip with the question count and must
 * sit on that line rather than start its own.
 *
 * Rendered ONLY in the rich state, because only there does a snapshot exist. In the other two the
 * page shows nothing about duration or date, and emits nothing about them either.
 *
 * The labels are visually hidden: "6:08" beside "12 Mart 2025" is unambiguous on screen and
 * ambiguous to a screen reader, so the label is present for one and out of the way of the other.
 * Both values sit inside `<time>` carrying the machine-readable form — the raw ISO duration the
 * contract publishes, and the UTC instant — so the accessible layer never depends on parsing what
 * the human sees.
 */
export async function DenemeMeta({ state }: { state: BookVideoState }) {
  if (state.kind !== "rich") return null;

  const t = await getTranslations("BookDetail");
  const format = await getFormatter();
  const { durationIso, durationSeconds, publishedAtUtc } = state.youtube;

  return (
    <span className={META}>
      <span className="sr-only">{t("durationLabel")}</span>
      <time dateTime={durationIso}>{formatDuration(durationSeconds)}</time>
      <span className={META_SEPARATOR} aria-hidden="true">
        ·
      </span>
      <span className="sr-only">{t("publishedLabel")}</span>
      {/* Formatted in UTC, project-wide (`i18n/request.ts`): every instant the api publishes
          is UTC, and restating it in a local zone would silently move a late-evening
          publication to the next day on one machine and not another. This server formatting is
          also the source of the stage's `publishedText` — the client stage takes the finished
          string rather than re-formatting, so the two can never disagree about the day.
          THE STYLE COMES FROM `lib/book/published-date.ts` and not from a literal here: the two
          `format.dateTime` calls on this surface agreed by convention until PR #70's review
          (→ `TA70-M7`), and a `dateStyle` changed on one of them printed two different dates for
          one video with every gate green. */}
      <time dateTime={publishedAtUtc}>
        {format.dateTime(new Date(publishedAtUtc), PUBLISHED_DATE_FORMAT)}
      </time>
    </span>
  );
}
