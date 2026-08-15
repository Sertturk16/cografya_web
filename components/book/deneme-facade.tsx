import { getFormatter, getTranslations } from "next-intl/server";
import { formatDuration } from "@/lib/book/duration";
import type { BookVideoState } from "@/lib/book/video-state";
import { watchUrl } from "@/lib/youtube/embed";
import styles from "./book-video.module.css";

/**
 * The visible facts about one video — duration and publication date.
 *
 * ## Why this is a separate component from the facade
 *
 * `SEO-POLICY.md` §B5 5.7 is a chain: a `VideoObject` may carry `uploadDate` and `duration`
 * only where the page shows them. The facade is REPLACED by the player on click; if these two
 * lived inside it they would leave the page at that moment, while the markup asserting them
 * stayed. As a sibling of the swap point they survive the swap, which is what the chain
 * actually asks for. It is also the order `SPEC.md` §4.3 sets out — heading, künye row,
 * facade, question grid — where the two are listed apart.
 *
 * Rendered ONLY in the rich state, because only there does a snapshot exist. In the other two
 * the page shows nothing about duration or date, and emits nothing about them either.
 *
 * The labels are visually hidden: "6:08" beside "12 Mart 2025" is unambiguous on screen and
 * ambiguous to a screen reader, so the label is present for one and out of the way of the
 * other. Both values sit inside `<time>` carrying the machine-readable form — the raw ISO
 * duration the contract publishes, and the UTC instant — so the accessible layer never depends
 * on parsing what the human sees.
 */
export async function DenemeMeta({ state }: { state: BookVideoState }) {
  if (state.kind !== "rich") return null;

  const t = await getTranslations("BookDetail");
  const format = await getFormatter();
  const { durationIso, durationSeconds, publishedAtUtc } = state.youtube;

  return (
    <p className={styles.meta}>
      <span className={styles.srOnly}>{t("durationLabel")}</span>
      <time dateTime={durationIso}>{formatDuration(durationSeconds)}</time>
      <span className={styles.metaSeparator} aria-hidden="true">
        ·
      </span>
      <span className={styles.srOnly}>{t("publishedLabel")}</span>
      {/* Formatted in UTC, project-wide (`i18n/request.ts`): every instant the api publishes
          is UTC, and restating it in a local zone would silently move a late-evening
          publication to the next day on one machine and not another. */}
      <time dateTime={publishedAtUtc}>
        {format.dateTime(new Date(publishedAtUtc), { dateStyle: "long" })}
      </time>
    </p>
  );
}

/**
 * The click-to-load cover, in its three states.
 *
 * ## It stands IN PLACE OF the player, which is the whole compliance argument
 *
 * The provenance ledger's Required Minimum Functionality rules bar any "overlay, frame or
 * visual element in front of any part of the player". A facade is compatible with that
 * precisely because there is no player yet: this markup is replaced by the iframe on the
 * click, so nothing is ever in front of anything. Once the iframe is in, nothing joins it —
 * see `deneme-video.tsx` and the player box in the stylesheet.
 *
 * ## What the three states show, and what they deliberately do not
 *
 * · **rich** — the provider's thumbnail with the `İzle` control over it.
 * · **typographic** — the control alone. It does NOT repeat "Deneme {n}" or the question
 *   count: the block's own `<h3>` carries the first and the six-cell grid carries the second,
 *   and `CONTENT-STYLE.md` §22 bars writing what the interface already shows (Atlas ruling
 *   AK-12/E-W2-3). The player still loads here — the video id is our data, not the sync
 *   leg's.
 * · **external** — a visible outbound link and no player, because the provider refuses
 *   embedding for this video. No thumbnail and no duration/date either: the state is a
 *   typographic cover plus a link (`SPEC.md` §4.4), and fetching a provider image for a video
 *   the reader cannot watch here would spend a third-party request for nothing.
 *
 * ## The thumbnail: hotlinked, unoptimised, and never constructed
 *
 * `ENGINEERING.md` §4 #9's SECOND exception covers exactly this image. The address is the
 * payload's own string — never built from the video id, which Developer Policies III.E.5 bars
 * — and it never reaches `next/image`, because the optimiser would fetch the bytes and write a
 * copy under `.next/cache/images`, which III.E.1 bars without prior written approval.
 * `unoptimized` is not the answer either: it keeps the wrapper and removes the only thing the
 * wrapper buys. CLS is held by the two dimensions the contract publishes plus the fixed box,
 * which is what that item's guarantee actually rests on.
 *
 * `loading="lazy"` because these sit well below the fold — the book cover above is the LCP
 * candidate and carries `priority`. The exception's carve-out ("unless the image is the page's
 * LCP candidate") is checked by measurement rather than by assumption; see the closing summary.
 *
 * `alt=""`: the frame is decorative here. The block is already named by its heading and the
 * control carries its own accessible name, so a described thumbnail would announce the same
 * fact a third time — and any description we wrote would be of an image we have never seen.
 */
export async function DenemeFacade({
  denemeNo,
  videoId,
  state,
}: {
  denemeNo: number;
  videoId: string;
  state: BookVideoState;
}) {
  const t = await getTranslations("BookDetail");

  if (state.kind === "external") {
    return (
      <a
        className={`btn btn-ghost ${styles.plainControl} ${styles.watchButton}`}
        href={watchUrl(videoId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("watchOnYoutubeAria", { no: denemeNo })}
      >
        {t("watchOnYoutube")}
      </a>
    );
  }

  /* `data-player-open` is what the block's delegated listener recognises. There is no `onClick`
     here because this is a server component and the control has to exist in the first HTML —
     which is also why the button does nothing without JavaScript. That is stated rather than
     hidden: the page's content is the question index, every row of which is a real link that
     works with no script at all, and the video itself stays reachable through the source
     credit at the foot of the page. The repo's own header disclosure makes the same trade. */
  const control = (
    <button
      type="button"
      className={`btn btn-primary ${styles.watchButton}`}
      data-player-open=""
      aria-label={t("watchAria", { no: denemeNo })}
    >
      {t("watch")}
    </button>
  );

  if (state.kind === "typographic") {
    return <span className={styles.plainControl}>{control}</span>;
  }

  const { thumbnailUrl, thumbnailWidth, thumbnailHeight } = state.youtube;
  return (
    <div className={`${styles.frame} ${styles.thumbBox}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9's SECOND
          exception (→ DEC 2026-08-15c): a remote image whose provider bars byte copies. The
          address comes from the payload, the dimensions come from the payload, and the box
          above holds CLS. See this component's docblock for why `next/image` and `unoptimized`
          are both wrong here. */}
      <img
        className={styles.thumb}
        src={thumbnailUrl}
        alt=""
        width={thumbnailWidth}
        height={thumbnailHeight}
        loading="lazy"
        decoding="async"
      />
      <span className={styles.watchOverlay}>{control}</span>
    </div>
  );
}
