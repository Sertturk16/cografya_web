"use client";

import { useTranslations } from "next-intl";
import { formatDuration } from "@/lib/book/duration";
import { watchUrl } from "@/lib/youtube/embed";
import { useBenchState } from "./active-video";
import { BenchTimeline } from "./bench-timeline";
import { DenemeVideo } from "./deneme-video";
import styles from "./book-video.module.css";

/**
 * One video's presentational payload, as the stage needs it.
 *
 * ## What is in here, and what is deliberately NOT
 *
 * The stage is a client component and this array is its props, so every field is bytes in the
 * RSC payload. Three rules kept it small enough to be worth the swap it buys:
 *
 * · **No copy.** Every string a reader sees on the stage — the heading, the question count, the
 *   İzle label, the accessible names — is resolved from the message catalogue in this component
 *   with `useTranslations`, not shipped thirty times over. The catalogue is where those strings
 *   are authored and `messages.test.ts` discovers this consumer through the same
 *   `useTranslations("BookDetail")` binding it already scans for.
 * · **One exception, and it is the reason the rule is written down.** `publishedText` IS
 *   pre-formatted on the server. `i18n/request.ts` pins `timeZone: "UTC"` for the whole project
 *   because "the same build prints a different DAY depending on which machine rendered it", and
 *   a `useFormatter` call here would make that guarantee depend on the provider inheriting the
 *   request config into the browser. Formatting the date once, on the server, removes the
 *   question instead of answering it — and the machine-readable instant travels beside it, so
 *   `<time dateTime>` is still exact.
 * · **No derived values.** `formatDuration` is a pure function over an integer the contract
 *   already publishes, so the duration text is computed here rather than carried.
 *
 * `rich === null` covers BOTH non-rich states — the discriminated union stays server-side in
 * `lib/book/video-state.ts`, which remains the single place that decides them, and what crosses
 * to the client is the answer rather than the inputs. `playable === false` is the `external`
 * state (the provider refuses to embed) and is what tells the stage to offer an outbound link
 * instead of a player.
 */
export interface BenchVideo {
  readonly denemeNo: number;
  readonly videoId: string;
  /** False for a video the provider refuses to embed — no player, an outbound link instead. */
  readonly playable: boolean;
  readonly questions: readonly { readonly no: number; readonly second: number }[];
  readonly rich: {
    readonly thumbnailUrl: string;
    readonly thumbnailWidth: number;
    readonly thumbnailHeight: number;
    readonly durationIso: string;
    readonly durationSeconds: number;
    readonly publishedAtUtc: string;
    /** Formatted on the SERVER — see the docblock's timezone note. */
    readonly publishedText: string;
  } | null;
}

/**
 * The stage: the page's one player, its künye line, and the timeline that places the questions
 * inside the video.
 *
 * ## Why the stage exists at all, in one sentence
 *
 * Before this, each of the thirty index rows could grow its own player; a reader working through
 * a book therefore lost the video every time they moved to another deneme. The stage is the
 * single place a video lives, so moving between denemeler moves the picture rather than the page.
 *
 * ## The default selection comes from the server, and the sentinel is what keeps hydration honest
 *
 * `defaultDenemeNo` is the first video that actually rendered (page.tsx derives it from the
 * rendered blocks, never from `coverage.denemeNumbers` — the same discipline `FENER66-M2` asked
 * for on the jump strip). The store's `selected` starts as `null` meaning "the server's choice",
 * so this component resolves `selected ?? defaultDenemeNo` and the server's HTML and the client's
 * first frame cannot disagree about which video is on the stage.
 *
 * ## The box is reserved in EVERY state, and that inverts an earlier decision on purpose
 *
 * The cover used to reserve no box for the non-rich states (the retired `.plainControl` rule),
 * with a stated reason: thirty empty 16:9 rectangles would be a page of grey holes. There is ONE
 * box now, so that reason does not transfer — and the opposite property matters here. A stage whose height changed
 * with the selected video's state would move the entire index every time the reader pressed a
 * question, on a page whose whole point is that pressing a question moves nothing but the stage.
 *
 * ## Nothing is placed over the player
 *
 * The İzle control sits over OUR cover, and the cover is REPLACED by the iframe rather than
 * layered under it — see `deneme-video.tsx`. The provenance ledger's Required Minimum
 * Functionality rules bar any "overlay, frame or visual element in front of any part of the
 * player", and the stage adds no exception to that: the caption and the timeline are siblings
 * BELOW the box, never children of it.
 */
export function BenchStage({
  videos,
  defaultDenemeNo,
}: {
  videos: readonly BenchVideo[];
  defaultDenemeNo: number;
}) {
  const t = useTranslations("BookDetail");
  const { selected, active } = useBenchState();

  const denemeNo = selected ?? defaultDenemeNo;
  // A selection that names no rendered video cannot happen through the island (it reads
  // `data-deneme` off markup this same array produced), but the lookup is total anyway: the
  // fallback keeps the stage rendering rather than blanking if a stale store survives a remount.
  const video = videos.find((candidate) => candidate.denemeNo === denemeNo) ?? videos[0];
  if (video === undefined) return null;

  const rich = video.rich;
  const isActive = video.playable && active !== null && active.denemeNo === video.denemeNo;

  return (
    /* `data-deneme` is the island's only way to know which video a press belongs to, and it is
       an attribute rather than a closure because the island delegates ONE listener over both the
       stage and the thirty index rows. The index puts the same attribute on each row's question
       list, so `closest("[data-deneme]")` answers the question from either side. */
    <div className={styles.stage} data-deneme={video.denemeNo}>
      <DenemeVideo
        video={video}
        active={isActive ? active : null}
        title={t("playerTitle", { no: video.denemeNo })}
        watchLabel={t("watch")}
        watchAriaLabel={t("watchAria", { no: video.denemeNo })}
        watchOnYoutubeLabel={t("watchOnYoutube")}
        watchOnYoutubeAriaLabel={t("watchOnYoutubeAria", { no: video.denemeNo })}
        watchOnYoutubeUrl={watchUrl(video.videoId)}
      />

      {/* THE STAGE CAPTION — which video is on the stage, and its two visible facts.
          The same two facts also stand on every one of the thirty index rows, which is what
          satisfies `SEO-POLICY.md` §B5 5.7 for all thirty `VideoObject` blocks; this copy is a
          convenience for the reader whose eyes are on the player, not the compliance surface. */}
      <p className={styles.stageCaption}>
        <span className={styles.stageName}>{t("denemeHeading", { no: video.denemeNo })}</span>
        <span className={styles.stageFacts}>
          <span>{t("denemeQuestionCount", { count: video.questions.length })}</span>
          {rich !== null && (
            <>
              <span className={styles.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={styles.srOnly}>{t("durationLabel")}</span>
              <time dateTime={rich.durationIso}>{formatDuration(rich.durationSeconds)}</time>
              <span className={styles.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={styles.srOnly}>{t("publishedLabel")}</span>
              <time dateTime={rich.publishedAtUtc}>{rich.publishedText}</time>
            </>
          )}
        </span>
      </p>

      {/* Only where a duration exists to place the questions against: the strip's whole encoding
          is proportional position, and without `durationSeconds` there is nothing to be
          proportional to. The questions are never lost with it — they are in the index row below,
          as they are for every one of the thirty videos. */}
      {rich !== null && (
        <BenchTimeline
          denemeNo={video.denemeNo}
          questions={video.questions}
          durationSeconds={rich.durationSeconds}
        />
      )}
    </div>
  );
}
