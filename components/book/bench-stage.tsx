"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { BookContentKind } from "@/lib/api/types";
import type { AuthSessionState } from "@/lib/auth/use-session.client";
import { formatDuration } from "@/lib/book/duration";
import { isNamed, neighbours } from "@/lib/book/workbench-model";
import { cn } from "@/lib/utils";
import type { VideoProgressValue } from "@/lib/video-progress/client";
import { useBenchState } from "./active-video";
import { DenemeVideo } from "./deneme-video";
import { VideoProgressControls } from "./video-progress-controls";

/**
 * One video's presentational payload, as the stage and the server lists need it.
 *
 * The stage is a client component and this array is its props, so every field is bytes in the
 * RSC payload. `label` is the one piece of copy that travels: it is composed once on the server
 * through `videoTitle` (the same builder the JSON-LD `VideoObject.name` uses), so the row, the
 * stage heading and the structured data cannot disagree. `publishedText` is pre-formatted on the
 * server for the timezone reason `i18n/request.ts` records.
 *
 * `rich === null` covers both non-rich states — `lib/book/video-state.ts` decides them
 * server-side. `playable === false` is the `external` state (the provider refuses to embed): no
 * player, an outbound link instead.
 */
export interface BenchVideo {
  readonly orderNo: number;
  /** `book_videos.id` — the progress endpoints' key and the identity fetch's key. The anonymous
   *  payload never carries the YouTube id; a signed-in reader's click resolves it. */
  readonly bookVideoId: string;
  readonly titleTr: string | null;
  readonly titleEn: string | null;
  /** The group heading this video sits under ("1. Ünite", "1. GÜN"), or null. */
  readonly groupTitleTr: string | null;
  /** "Deneme 12", "Test 4" or the authored title — composed on the server. */
  readonly label: string;
  readonly markerCount: number;
  /** From the provider snapshot when there is one; the list's duration and the status ring. */
  readonly durationSeconds: number | null;
  readonly playable: boolean;
  readonly tags: readonly {
    readonly orderNo: number;
    readonly second: number;
    /** Named markers (konu anlatımı, tek video) render as a list and get a named fragment. */
    readonly nameTr: string | null;
  }[];
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
 * The stage (T-128 spec §4.2/§4.3): the page's one player, the current video's heading and
 * controls, the marker strip (server markup handed in as `markers`) and, on a phone, the
 * back-to-list line and the previous/next bar.
 *
 * `selected ?? defaultOrderNo` keeps the server's HTML and the client's first frame on the same
 * video. `data-deneme` on the root is how the island's delegated listener knows which video a
 * press on İzle belongs to.
 */
export function BenchStage({
  videos,
  kind,
  defaultOrderNo,
  authState,
  progress,
  onSaveWatched,
  pressPendingOrderNo,
  autoNext,
  onToggleAutoNext,
  onGo,
  onBack,
  onPlaybackTime,
  onEnded,
  markers,
}: {
  videos: readonly BenchVideo[];
  kind: BookContentKind;
  defaultOrderNo: number;
  authState: AuthSessionState;
  progress: VideoProgressValue | null | "loading";
  onSaveWatched: (watched: boolean) => Promise<{ readonly ok: boolean }>;
  /** The video whose İzle or "watch on YouTube" press is in flight (`VideoBench`'s state). */
  pressPendingOrderNo: number | null;
  autoNext: boolean;
  onToggleAutoNext: () => void;
  onGo: (orderNo: number) => void;
  onBack: () => void;
  onPlaybackTime: (orderNo: number, second: number) => void;
  onEnded: (orderNo: number) => void;
  markers: ReactNode;
}) {
  const t = useTranslations("BookDetail");
  const { selected, active } = useBenchState();

  const orderNo = selected ?? defaultOrderNo;
  const video = videos.find((candidate) => candidate.orderNo === orderNo) ?? videos[0];
  if (video === undefined) return null;

  const single = videos.length === 1;
  const orderNos = videos.map((candidate) => candidate.orderNo);
  const { prev, next } = neighbours(orderNos, video.orderNo);
  const prevVideo = videos.find((candidate) => candidate.orderNo === prev);
  const nextVideo = videos.find((candidate) => candidate.orderNo === next);
  const knownWatched = progress !== null && progress !== "loading" ? progress.watched : false;
  const label = video.label;
  const named = isNamed(video.tags) ? "yes" : "no";
  const position = t("position", {
    current: orderNos.indexOf(video.orderNo) + 1,
    total: orderNos.length,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-deneme={video.orderNo}>
      {!single && (
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 min-h-11")}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("backToList", { kind })}
          </button>
          <span className="text-sm tabular-nums text-muted-foreground">{position}</span>
        </div>
      )}

      <div className="shrink-0 px-4 pt-2 lg:px-6 lg:pt-4">
        <DenemeVideo
          video={video}
          active={active}
          authState={authState}
          watched={knownWatched}
          title={t("playerTitle", { label })}
          watchLabel={t("watch")}
          watchAriaLabel={t("watchAria", { label })}
          watchAriaSignedOutLabel={t("watchAriaSignedOut", { label })}
          signInCtaText={t("signInCta")}
          sessionReadyAnnounceText={t("sessionReadyAnnounce")}
          watchOnYoutubeLabel={t("watchOnYoutube")}
          watchOnYoutubeAriaLabel={t("watchOnYoutubeAria", { label })}
          pressPending={pressPendingOrderNo === video.orderNo}
          watchLoadingLabel={t("watchLoading")}
          watchLoadingAriaLabel={t("watchLoadingAria", { label })}
          onPlaybackTime={(second) => onPlaybackTime(video.orderNo, second)}
          onEnded={() => onEnded(video.orderNo)}
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-1 px-4 pt-3 lg:px-6">
        <div className="min-w-0">
          {video.groupTitleTr !== null && (
            <p className="m-0 text-xs text-muted-foreground">{video.groupTitleTr}</p>
          )}
          <h2
            id="bench-current-heading"
            tabIndex={-1}
            className="m-0 font-heading text-xl font-semibold text-foreground"
          >
            {label}
          </h2>
          <p className="m-0 flex gap-3 text-xs tabular-nums text-muted-foreground">
            <span>{t("markerCount", { count: video.markerCount, named })}</span>
            {video.rich !== null && (
              <span>
                <span className="sr-only">{t("durationLabel")} </span>
                <time dateTime={video.rich.durationIso}>
                  {formatDuration(video.rich.durationSeconds)}
                </time>
              </span>
            )}
            {video.rich !== null && (
              <span>
                <span className="sr-only">{t("publishedLabel")} </span>
                <time dateTime={video.rich.publishedAtUtc}>{video.rich.publishedText}</time>
              </span>
            )}
          </p>
        </div>
        {!single && (
          <div className="flex items-center gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                role="switch"
                checked={autoNext}
                onChange={onToggleAutoNext}
                className="size-4 accent-primary"
              />
              {t("autoNext")}
            </label>
            <div className="hidden items-center gap-1 lg:flex">
              <button
                type="button"
                disabled={prevVideo === undefined}
                onClick={() => prevVideo && onGo(prevVideo.orderNo)}
                aria-label={prevVideo ? t("prevAria", { label: prevVideo.label }) : t("prev")}
                className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-14 text-center text-sm tabular-nums text-muted-foreground">
                {position}
              </span>
              <button
                type="button"
                disabled={nextVideo === undefined}
                onClick={() => nextVideo && onGo(nextVideo.orderNo)}
                aria-label={nextVideo ? t("nextAria", { label: nextVideo.label }) : t("next")}
                className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11")}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 lg:px-6">
        <VideoProgressControls
          authState={authState}
          progress={progress}
          onToggleWatched={onSaveWatched}
        />
      </div>

      <div
        role="region"
        aria-label={t("markersLabel", { named })}
        className="min-h-[6rem] flex-1 overflow-y-auto px-4 pt-3 pb-4 lg:px-6"
      >
        {markers}
      </div>

      {!single && (
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-2 lg:hidden">
          <button
            type="button"
            disabled={prevVideo === undefined}
            onClick={() => prevVideo && onGo(prevVideo.orderNo)}
            className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-12 justify-start")}
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="text-xs text-muted-foreground">{t("prev")}</span>
              <span className="max-w-full truncate">{prevVideo?.label ?? ""}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={nextVideo === undefined}
            onClick={() => nextVideo && onGo(nextVideo.orderNo)}
            className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-12 justify-end")}
          >
            <span className="flex min-w-0 flex-col items-end leading-tight">
              <span className="text-xs text-muted-foreground">{t("next")}</span>
              <span className="max-w-full truncate">{nextVideo?.label ?? ""}</span>
            </span>
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
