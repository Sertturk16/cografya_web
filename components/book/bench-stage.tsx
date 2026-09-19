"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { AuthSessionState } from "@/lib/auth/use-session.client";
import { formatDuration } from "@/lib/book/duration";
import { videoTitle } from "@/lib/book/video-identity";
import type { VideoProgressValue } from "@/lib/video-progress/client";
import { useBenchState } from "./active-video";
import { BenchTimeline } from "./bench-timeline";
import { DenemeVideo } from "./deneme-video";
import { VideoProgressControls } from "./video-progress-controls";

/**
 * THE STAGE COLUMN — `book-video.module.css`'s `.stage`, in bridge tokens (T-033 task 7).
 *
 * `min-w-0` IS NOT BOILERPLATE: it fixes a measured 56px horizontal overflow at the two
 * mandatory narrow viewports. A grid item's default `min-width: auto` refuses to shrink below
 * its content's min-content width, and `FRAME` (`deneme-video.tsx`) combines `aspect-video`
 * with `min-h-[200px]`, which gives it an intrinsic minimum WIDTH of 200 x 16/9 ~= 355.6px. At
 * a 320px viewport the column is 280px, so the stage pushed `document.scrollWidth` to 356 and
 * the page scrolled sideways (WCAG 1.4.10 Reflow).
 *
 * THE STAGE STICKS ONLY WHERE THERE IS A SECOND COLUMN TO STICK BESIDE. Below `lg` (64rem, the
 * media query the stylesheet wrote) it sits above the index in one column and scrolls away
 * normally: a sticky player there would take 200px+ off a 568px viewport and the reader would
 * be studying through a slot.
 *
 * `lg:top-[calc(var(--header-height)+1rem)]` IS THE SAME EXPRESSION `PLAYER`'s
 * `scroll-mt-[…]` uses, and the pairing is the point rather than a coincidence: it keeps the
 * player clear of the sticky site header, and it makes `deneme-video.tsx`'s corrective scroll a
 * no-op in the stuck state — that effect compares the box's measured `top` against its own
 * scroll margin and only scrolls when the box is above its mark. Change one and the other has
 * to change with it; `bench.structure.test.ts` asserts the two expressions are one string.
 * `--header-height` is a LAYOUT token, not a colour one, so it stays a `var()` read.
 */
const STAGE = "min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1rem)]";

/**
 * THE CAPTION'S HEIGHT IS RESERVED, and it is the second half of "selecting a video moves
 * nothing but the stage". The heading's width varies with the deneme number and the fact
 * strip's with the duration, so the line count can tip between videos at a given viewport;
 * without a floor the timeline below — and, in the one-column layout, the entire index — would
 * step up and down as the reader moves through the book. `min-h-[3.1rem]` is the two-line
 * height measured at 320px, the widest the strip ever wraps in either locale.
 *
 * IT CARRIES `FRAME`'s CAP TOO. `max-w-[560px]` is one of FOUR copies of one cap — `FRAME`,
 * this caption, `TIMELINE` and `PROGRESS_CONTROLS` — and `bench.structure.test.ts` asserts the
 * four as an EQUALITY, because between 564 and 1023px an uncapped caption started 84px to the
 * left of the player it names (PR #70 review `CODE70-M2`).
 *
 * `mb-0` IS LOAD-BEARING AND IS NOT DECORATION. This is a `<p>`, and `app/globals.css`'s base
 * rule gives every `<p>` `margin: 0 0 1rem`. The stylesheet's `margin: 10px auto 0` cancelled
 * that bottom margin; `mt-2.5 mx-auto` alone would let 16px back in under the caption and push
 * the timeline card — and with it the whole index — down. Measured before/after rather than
 * reasoned.
 */
const STAGE_CAPTION =
  "mx-auto mt-2.5 mb-0 flex max-w-[560px] flex-wrap items-baseline gap-x-[10px] gap-y-1 min-h-[3.1rem]";

/**
 * SMALLER THAN A REAL HEADING, deliberately, and the direction was reversed after review. At
 * 1.15rem/600 in the heading face this `<p>`'s name out-weighed the thirty `<h3>` index rows it
 * sits above (1.05rem), so the visual outline and the document outline disagreed about what the
 * most important line in the section was — WCAG 1.3.1's F2 shape (PR #70 review `A11Y70-M5`).
 * Marking it up AS a heading is worse: the caption follows client state, so the outline would
 * gain a heading whose text changes when the reader presses a question.
 *
 * `text-[1rem]` rather than `text-base`: `text-base` carries a 1.5 line-height token, and this
 * span inherits 1.6 from `body` — 25.6px, not 24px. `text-primary-strong` is
 * `--color-primary-dark`'s bridge: **7.89:1 light / 8.99:1 dark** on the page's `--background`,
 * which is what the stage sits on. The retired raw token measured **2.23:1** in dark.
 */
const STAGE_NAME = "font-heading text-[1rem] font-semibold text-primary-strong";

/** The künye strip beside the name. `text-[0.85rem]` for the same line-height reason;
 *  `text-muted-foreground` is `--color-slate`'s bridge — **7.48:1 light / 8.53:1 dark** on
 *  `--background`, against the frozen token's 2.36:1 in dark. */
const STAGE_FACTS = "flex flex-wrap items-baseline gap-1.5 text-[0.85rem] text-muted-foreground";

/** THE SAME SPELLING `deneme-meta.tsx`'s separator carries — asserted equal in
 *  `bench.structure.test.ts`, because the two dots sit on ONE line inside one fact strip and a
 *  drift in either file would split that line into two colours. */
const META_SEPARATOR = "text-muted-foreground";

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
  readonly orderNo: number;
  /** `book_videos.id` — the identifier the video-progress AND video-identity endpoints key on
   *  (UYELIK-06 plan §5.2, P2 plan §5.3). Populated from the api's own `BookVideoDto.bookVideoId`,
   *  never derived here. **No `videoId` field here any more** (P2): the anonymous payload never
   *  carries the YouTube video id at all, so it cannot ship in this props array either — a
   *  signed-in reader's own click resolves it through the guarded
   *  `lib/video-identity/client.ts` fetch, and `active-video.ts`'s store is what holds the
   *  resolved answer once one exists. */
  readonly bookVideoId: string;
  /** The generic contract's per-video display title, both nullable (`FU-BOOK-GENERIC-CONTRACT`
   *  — the trigger `videoTitle`'s own docblock names). `null` for every seeded row today: the
   *  reader-facing "Deneme N" label is still composed in the web layer from i18n + `orderNo`. */
  readonly titleTr: string | null;
  readonly titleEn: string | null;
  /** False for a video the provider refuses to embed — no player, an outbound link instead. */
  readonly playable: boolean;
  readonly tags: readonly {
    readonly orderNo: number;
    readonly second: number;
    /** Reachable only once a seeded etiket carries a non-null name (`FU-BOOK-GENERIC-CONTRACT`)
     *  — kept on this shape even though nothing renders it today, because `BenchTimeline`'s
     *  ticks compute the SAME fragment the server-rendered index row assigned, and that
     *  computation needs it (`lib/book/video-identity.ts`'s `tagFragment`). */
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
 * The stage: the page's one player, its künye line, and the timeline that places the questions
 * inside the video.
 *
 * ## Why the stage exists at all, in one sentence
 *
 * Before this, each of the thirty index rows could grow its own player; a reader working through
 * a book therefore lost the video every time they moved to another one. The stage is the
 * single place a video lives, so moving between videos moves the picture rather than the page.
 *
 * ## The default selection comes from the server, and the sentinel is what keeps hydration honest
 *
 * `defaultOrderNo` is the first video that actually rendered (page.tsx derives it from the
 * rendered blocks, never from a declared count — the same discipline `FENER66-M2` asked for on
 * the jump strip, and `SEO-POLICY.md` §B8 8.9's BLOCKER for a link with no target). The store's
 * `selected` starts as `null` meaning "the server's choice", so this component resolves
 * `selected ?? defaultOrderNo` and the server's HTML and the client's first frame cannot disagree
 * about which video is on the stage.
 *
 * ## The box is reserved in EVERY state, and that inverts an earlier decision on purpose
 *
 * The cover used to reserve no box for the non-rich states (the retired `.plainControl` rule),
 * with a stated reason: thirty empty 16:9 rectangles would be a page of grey holes. There is ONE
 * box now, so that reason does not transfer — and the opposite property matters here. A stage whose height changed
 * with the selected video's state would move the entire index every time the reader pressed a
 * question, on a page whose whole point is that pressing a question moves nothing but the stage.
 *
 * ALL THREE OF THE STAGE'S BLOCKS HOLD THAT INVARIANT, and until PR #70's review only two did.
 * `.frame` reserves the cover box and `.stageCaption` a two-line floor, but the timeline card was
 * printed only in the `rich` state — 88px that appeared and disappeared with the SELECTION, which
 * is a client-state change reaching a shift the reader did not ask for (→ `FENER70-I1`,
 * validated). The gate now lives inside `BenchTimeline`, which drops the ticks and keeps the card.
 * Anything added to this stage later is bound by the same rule: reserve it in all three states or
 * do not put it above the index.
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
  defaultOrderNo,
  authState,
  progress,
  onSaveWatched,
  externalResolvingOrderNo,
}: {
  videos: readonly BenchVideo[];
  defaultOrderNo: number;
  /** The login gate's own read of the shared session hook (UYELIK-06 §5.3.2), threaded down
   *  from `VideoBench` — never a second `useAuthSession()` call here, which would be a second
   *  live session check racing the one the gate already owns. */
  authState: AuthSessionState;
  /** The SELECTED video's saved progress, fetched once at the `VideoBench` level (§5.4) —
   *  `"loading"` while the request is in flight, `null` once resolved with no saved row (or
   *  for an anonymous/checking reader). */
  progress: VideoProgressValue | null | "loading";
  /** Persists a watched-toggle press (§5.6); owned by `VideoBench` because it also updates the
   *  progress state this component reads. */
  onSaveWatched: (watched: boolean) => Promise<{ readonly ok: boolean }>;
  /** The `external`-state "watch on YouTube" control's own identity fetch, in flight for this
   *  orderNo, or `null` (P2 plan §5.3/§10). Owned by `VideoBench`, not by `active-video.ts`'s
   *  store: an external video never gets a player, so it has no business in that store's own
   *  "one player, ever" shape. */
  externalResolvingOrderNo: number | null;
}) {
  const t = useTranslations("BookDetail");
  // `useLocale()`'s own return type is `use-intl`'s `Locale`, which resolves to plain `string`
  // absent an `AppConfig` augmentation this repo does not declare — narrower than the app's own
  // `Locale` (`@/i18n/routing`'s `"tr" | "en"`). The cast is safe: this component only ever
  // renders under the `[locale]` segment, which next-intl's own routing config restricts to
  // exactly those two values.
  const locale = useLocale() as Locale;
  const { selected, active } = useBenchState();

  const orderNo = selected ?? defaultOrderNo;
  // A selection that names no rendered video cannot happen through the island (it reads
  // `data-deneme` off markup this same array produced), but the lookup is total anyway: the
  // fallback keeps the stage rendering rather than blanking if a stale store survives a remount.
  const video = videos.find((candidate) => candidate.orderNo === orderNo) ?? videos[0];
  if (video === undefined) return null;

  const rich = video.rich;
  const knownWatched = progress !== null && progress !== "loading" ? progress.watched : false;

  return (
    /* `data-deneme` is the island's only way to know which video a press belongs to, and it is
       an attribute rather than a closure because the island delegates ONE listener over both the
       stage and the thirty index rows. The index puts the same attribute on each row's question
       list, so `closest("[data-deneme]")` answers the question from either side. */
    <div className={STAGE} data-deneme={video.orderNo}>
      {/* `active` IS HANDED DOWN WHOLE, and the gate is the swap point's alone. This site used to
          re-derive `video.playable && active?.orderNo === video.orderNo` and pass `null` when it
          failed — the same expression `deneme-video.tsx` computes again on arrival, because that
          component checks `playable` for itself rather than trusting a caller (→ PR #63 review
          `CODE63-I1`). Two copies of one gate is not defence in depth when only one of them
          decides anything: the child's is the one that reaches the iframe branch, and this one
          could only ever agree with it (→ PR #70 review `SIMP70-M1`). */}
      <DenemeVideo
        video={video}
        active={active}
        authState={authState}
        watched={knownWatched}
        title={t("playerTitle", { no: video.orderNo })}
        watchLabel={t("watch")}
        watchAriaLabel={t("watchAria", { no: video.orderNo })}
        watchAriaSignedOutLabel={t("watchAriaSignedOut", { no: video.orderNo })}
        signInCtaText={t("signInCta")}
        sessionReadyAnnounceText={t("sessionReadyAnnounce")}
        watchOnYoutubeLabel={t("watchOnYoutube")}
        watchOnYoutubeAriaLabel={t("watchOnYoutubeAria", { no: video.orderNo })}
        watchOnYoutubeLoading={externalResolvingOrderNo === video.orderNo}
        watchLoadingLabel={t("watchLoading")}
        watchLoadingAriaLabel={t("watchLoadingAria", { no: video.orderNo })}
      />

      {/* THE STAGE CAPTION — which video is on the stage, and its two visible facts.
          The same two facts also stand on every one of the thirty index rows, which is what
          satisfies `SEO-POLICY.md` §B5 5.7 for all thirty `VideoObject` blocks; this copy is a
          convenience for the reader whose eyes are on the player, not the compliance surface. */}
      <p className={STAGE_CAPTION}>
        {/* Through the shared builder, exactly as the index row and `VideoObject.name` are. The
            three strings must be one string (§B5 5.7), and this caption was the consumer outside
            the seam (→ PR #70 review `FENER70-M1` / `CODE70-M4`). */}
        <span className={STAGE_NAME}>{videoTitle(t, locale, video)}</span>
        <span className={STAGE_FACTS}>
          <span>{t("videoTagCount", { count: video.tags.length })}</span>
          {rich !== null && (
            <>
              <span className={META_SEPARATOR} aria-hidden="true">
                ·
              </span>
              <span className="sr-only">{t("durationLabel")}</span>
              <time dateTime={rich.durationIso}>{formatDuration(rich.durationSeconds)}</time>
              <span className={META_SEPARATOR} aria-hidden="true">
                ·
              </span>
              <span className="sr-only">{t("publishedLabel")}</span>
              <time dateTime={rich.publishedAtUtc}>{rich.publishedText}</time>
            </>
          )}
        </span>
      </p>

      {/* UNCONDITIONAL, AND THE `rich` GATE IS INSIDE THE COMPONENT. The strip's whole encoding is
          proportional position, so without `durationSeconds` there is nothing to be proportional
          to and the ticks are dropped — but the CARD stays, because a box that appears and
          disappears with the selection moves the thirty rows below it (→ `FENER70-I1`). The tags
          are never lost either way: they are in the index row below, as they are for every one
          of the thirty videos. */}
      <BenchTimeline
        orderNo={video.orderNo}
        tags={video.tags}
        durationSeconds={rich?.durationSeconds ?? null}
      />

      {/* Sits BELOW the reserved-height stage, not above it (§5.6) — unlike the CTA/caption/
          timeline above, a height change here does not shift the index, so it does not need
          the reserved-box treatment those three carry; it renders nothing for a reader who is
          not authenticated. */}
      <VideoProgressControls
        authState={authState}
        progress={progress}
        onToggleWatched={onSaveWatched}
      />
    </div>
  );
}
