import { getFormatter, getTranslations } from "next-intl/server";
import { formatDuration } from "@/lib/book/duration";
import type { BookVideoState } from "@/lib/book/video-state";
import styles from "./book-video.module.css";

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
    <span className={styles.meta}>
      <span className={styles.srOnly}>{t("durationLabel")}</span>
      <time dateTime={durationIso}>{formatDuration(durationSeconds)}</time>
      <span className={styles.metaSeparator} aria-hidden="true">
        ·
      </span>
      <span className={styles.srOnly}>{t("publishedLabel")}</span>
      {/* Formatted in UTC, project-wide (`i18n/request.ts`): every instant the api publishes
          is UTC, and restating it in a local zone would silently move a late-evening
          publication to the next day on one machine and not another. This server formatting is
          also the source of the stage's `publishedText` — the client stage takes the finished
          string rather than re-formatting, so the two can never disagree about the day. */}
      <time dateTime={publishedAtUtc}>
        {format.dateTime(new Date(publishedAtUtc), { dateStyle: "long" })}
      </time>
    </span>
  );
}
