"use client";

import { useEffect, useRef } from "react";
import { loadIframeApi, type YouTubePlayer } from "@/lib/youtube/iframe-api";
import { playerEmbedSrc } from "@/lib/youtube/embed";
import type { ActiveVideo } from "./active-video";
import type { BenchVideo } from "./bench-stage";
import styles from "./book-video.module.css";

/**
 * The swap point: the stage's cover, or the stage's player — never both, and never a player
 * anywhere else on the page.
 *
 * ## Its role changed with the bench; its invariants did not
 *
 * This used to be one of thirty swap points, one inside each accordion block. There is one stage
 * now, so there is one of these — which is what makes "one player on the page" a property of the
 * component tree rather than of the store alone. Everything below about the `src`, the seek, the
 * teardown and the delegated Permissions-Policy is unchanged and unchanged deliberately: the
 * bench moved where the player lives, not what it is allowed to do.
 *
 * (The file keeps its name. `deneme-video` names the deneme vocabulary that `DEC 2026-08-17i`
 * asks the surface not to depend on; renaming the component tree is a refactor the bench task did
 * not ask for and is recorded as debt under `FU-BOOK-GENERIC-CONTRACT` instead of smuggled in.)
 *
 * ## The cover is rendered HERE now, and that is the one structural change
 *
 * It used to arrive as a server-rendered `facade` prop. It cannot any more: the cover has to
 * change when the reader selects another video, and a server component cannot re-render on a
 * client store. It is still in the FIRST HTML — this is a client component, so Next renders it on
 * the server too, and `SPEC.md` §9's criterion 10 (zero iframes in the raw HTML, one in the DOM
 * afterwards) is measured against that same output.
 *
 * The three cover states are the state machine's, resolved once in `lib/book/video-state.ts` and
 * carried here as `rich`/`playable`:
 *
 * · **rich** — the provider's thumbnail with the `İzle` control over it.
 * · **typographic** (`rich === null`, `playable`) — the control alone on the reserved box. The
 *   player still loads here, because the video id is OUR data and does not depend on the sync
 *   leg.
 * · **external** (`playable === false`) — a visible outbound link and no player, because the
 *   provider refuses embedding for this video. No thumbnail either: fetching a provider image for
 *   a video the reader cannot watch here would spend a third-party request for nothing.
 *
 * ## The thumbnail: hotlinked, unoptimised, and never constructed
 *
 * `ENGINEERING.md` §4 #9's SECOND exception covers exactly this image. The address is the
 * payload's own string — never built from the video id, which Developer Policies III.E.5 bars —
 * and it never reaches `next/image`, because the optimiser would fetch the bytes and write a copy
 * under `.next/cache/images`, which III.E.1 bars without prior written approval. `unoptimized` is
 * not the answer either: it keeps the wrapper and removes the only thing the wrapper buys. CLS is
 * held by the two dimensions the contract publishes plus the fixed box.
 *
 * `referrerPolicy="no-referrer"` is the second of the two cheap measures DEC 2026-08-15k made
 * part of its own ruling — the first being the provider-host gate that runs before this component
 * is reached. Without it the thumbnail request would disclose our origin to `i.ytimg.com` where
 * the ruling ordered none.
 *
 * `alt=""`: the frame is decorative. The stage is already named by its caption and the control
 * carries its own accessible name, so a described thumbnail would announce the same fact a third
 * time — and any description we wrote would be of an image we have never seen. It follows that
 * the thumbnail stays out of Google Images, which is intended rather than incidental
 * (→ PR #63 review `FENER63-M2`).
 *
 * ## Why the `src` does not change when the reader jumps to another question
 *
 * Because it is built from `loadStartSecond`, which the store freezes at load time, and not from
 * the live `seekSecond`. Writing a new `src` onto an iframe reloads it, which is the
 * six-reloads-per-video cost DEC 2026-08-15d exists to remove; the jump goes through `seekTo` on
 * the loaded player instead. The string is therefore byte-identical across seek renders and React
 * never touches the attribute.
 *
 * ## `destroy()` is deliberately not called
 *
 * The IFrame Player API's `destroy()` removes the iframe ELEMENT, and this element belongs to
 * React — which is about to remove it too. Racing the two is the "node to be removed is not a
 * child" class of error: the cleanup below runs as a passive effect, AFTER React has already
 * committed the cover in this element's place, so `destroy()` would be reaching for a node whose
 * parent is gone. Dropping the reference is enough for the thing that matters: React's removal
 * tears down the frame, and with it the playback and the browsing context.
 *
 * What is knowingly leaked, at its real size (→ PR #63 review `CODE63-M2`): one `YT.Player` object
 * and the window `message` listener it registered, per VIDEO SWITCH — not per page. A reader
 * working through a 30-video index can plausibly leave 10–30 of them behind in a session. No
 * functional failure is constructible from it (the API filters incoming messages by
 * `event.source`, and a detached frame's `contentWindow` is null), so the cost is bounded memory
 * growth for the length of one page visit; it is stated at that size rather than described as a
 * handful.
 */
export function DenemeVideo({
  video,
  active,
  title,
  watchLabel,
  watchAriaLabel,
  watchOnYoutubeLabel,
  watchOnYoutubeAriaLabel,
  watchOnYoutubeUrl,
}: {
  video: BenchVideo;
  /** The store's loaded player, WHATEVER video it belongs to — or `null` when none is loaded.
   *  This component decides for itself whether that player is this video's and whether this video
   *  is `playable` at all, so a stale store cannot reach the iframe branch by any route (→ PR #63
   *  review `CODE63-I1`). The stage used to pre-filter it and pass `null` on a mismatch, which was
   *  the same gate computed twice with only this copy deciding anything (→ `SIMP70-M1`). */
  active: ActiveVideo | null;
  title: string;
  watchLabel: string;
  watchAriaLabel: string;
  watchOnYoutubeLabel: string;
  watchOnYoutubeAriaLabel: string;
  watchOnYoutubeUrl: string;
}) {
  const isActive = video.playable && active !== null && active.denemeNo === video.denemeNo;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  /** A seek requested before the API answered; applied on `onReady`. */
  const pendingSeek = useRef<number | null>(null);
  /** What the stage has already acted on, so a fresh load is told apart from a jump. */
  const appliedRef = useRef<{ token: number; nonce: number } | null>(null);

  // Attach the player to the iframe WE rendered, rather than letting the API replace a
  // placeholder with an iframe of its own: the DOM here is React's. The script is fetched on
  // this first call and never before — no page-load cost, and nothing on hover.
  useEffect(() => {
    if (!isActive) return;
    const element = iframeRef.current;
    if (element === null) return;

    let cancelled = false;
    loadIframeApi()
      .then((api) => {
        if (cancelled || iframeRef.current !== element) return;
        playerRef.current = new api.Player(element, {
          events: {
            onReady: () => {
              const seconds = pendingSeek.current;
              if (seconds === null) return;
              pendingSeek.current = null;
              playerRef.current?.seekTo(seconds, true);
            },
          },
        });
      })
      .catch((error: unknown) => {
        // The player is a plain iframe and plays on its own; only jump-to-question is lost.
        console.warn("[book-video] IFrame Player API unavailable", error);
      });

    return () => {
      cancelled = true;
      playerRef.current = null;
      pendingSeek.current = null;
    };
  }, [isActive, active?.loadToken]);

  // WCAG 4.1.3: the control the reader just pressed leaves the DOM, so focus would fall to
  // `<body>` and the next Tab would restart from the skip link. It moves to the player, which
  // carries its own accessible name through `title`. After commit, and after paint, because
  // focusing a node the same handler is replacing is the bug pattern this repo has already paid
  // for once (PR #45 review C1/I5).
  //
  // AND ONLY WHEN THAT IS ACTUALLY WHAT HAPPENED — the condition is now checked rather than
  // assumed (→ PR #70 review `A11Y70-M2`). The rationale above holds for the stage's İzle button,
  // which the iframe replaces; it does NOT hold for the 180 index rows, which survive the commit
  // still focused. Moving focus off a control that is still there took a keyboard reader working
  // through one deneme's questions away from the list on every press. `document.activeElement`
  // answers the question the comment was already asking: body (or nothing) means the trigger is
  // gone and focus has nowhere to be.
  //
  // LOAD PATH ONLY. A seek inside the open video replaces no control at all, so there is nothing
  // to rescue — which is also why this effect keeps the load key while the scroll below does not.
  useEffect(() => {
    if (!isActive) return;
    const frame = requestAnimationFrame(() => {
      const iframe = iframeRef.current;
      if (iframe === null) return;
      const focused = document.activeElement;
      if (focused !== null && focused !== document.body) return;
      iframe.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isActive, active?.loadToken]);

  // THE CORRECTIVE SCROLL, AND IT IS A SEPARATE EFFECT BECAUSE IT RUNS ON A DIFFERENT SET OF
  // EVENTS (→ PR #70 review `CODE70-I1`). Both halves used to share `[isActive, loadToken]`, and
  // `loadToken` is FROZEN across a seek by design — so pressing a second question of the video
  // already on the stage moved the audio and moved nothing else. Below 64rem the stage is not
  // sticky, so from row thirty that is a press with no visible effect at all, while the identical
  // press on a NEIGHBOURING deneme scrolled: one gesture, two behaviours, and five of every six
  // questions on the silent side. `seekNonce` is what makes a repeat jump to one second
  // distinguishable, so it is the key that has to be here.
  //
  // THE SCROLL IS OURS, NOT THE ENGINE'S — measured, after two rounds of assuming otherwise
  // (→ PR #66 review `CODE66-M6`, then `CODE66R2-I1`). `focus()` on a cross-origin iframe scrolls
  // NOTHING: at 320px in both Playwright engines the page offset does not move by a pixel, while
  // the same probe's control (`focus()` on a question row) scrolls both by hundreds. Focusing a
  // frame owner moves the focused area into the nested document, so any scroll happens there.
  //
  // THE BENCH CHANGED THE DIRECTION THIS CORRECTS, AND THAT IS WHY IT MATTERS MORE NOW. The stage
  // sits ABOVE the index, so a reader who presses question six of video thirty is pressing a
  // control that is thousands of pixels BELOW the player about to start — the Required Minimum
  // Functionality breach ("a player must not begin playing off-screen") in its largest form. The
  // correction runs only when the player sits above its own offset: a box already in view must
  // not be yanked. Above 64rem the stage is sticky at exactly the offset this reads back, so the
  // comparison finds the box on its mark and moves nothing — which is what makes running this on
  // every seek free at the width where the stage never left the viewport.
  useEffect(() => {
    if (!isActive) return;
    const frame = requestAnimationFrame(() => {
      const iframe = iframeRef.current;
      if (iframe === null) return;
      const wanted = Number.parseFloat(getComputedStyle(iframe).scrollMarginTop) || 0;
      if (iframe.getBoundingClientRect().top < wanted - 1) iframe.scrollIntoView();
    });
    return () => cancelAnimationFrame(frame);
  }, [isActive, active?.loadToken, active?.seekNonce]);

  // Jump-to-question. A fresh load carries its second in the `src` already, so the first pass
  // only records what it saw; every later nonce is a real jump.
  useEffect(() => {
    if (!isActive || active === null) {
      appliedRef.current = null;
      return;
    }
    const applied = appliedRef.current;
    appliedRef.current = { token: active.loadToken, nonce: active.seekNonce };
    if (applied === null || applied.token !== active.loadToken) return;
    if (applied.nonce === active.seekNonce) return;

    const player = playerRef.current;
    if (player === null) {
      pendingSeek.current = active.seekSecond;
      return;
    }
    player.seekTo(active.seekSecond, true);
  }, [isActive, active]);

  if (isActive && active !== null) {
    return (
      // `data-player-box` is not styling and not dead markup: it is the handle `SPEC.md` §9's
      // criterion 12 addresses when it measures that this box holds the iframe and NOTHING else
      // — no badge, no gradient, no play button of our own — which is the Required Minimum
      // Functionality rule the facade architecture rests on. A class name would not do: classes
      // are hashed by CSS Modules and the check would break on a rename it should not care about.
      <div className={`${styles.frame} ${styles.playerBox}`} data-player-box="">
        <iframe
          /* ONE ELEMENT PER LOAD, and the bench is what made this necessary. Before, thirty
             separate instances of this component meant switching videos unmounted one iframe and
             mounted another; now there is ONE instance, so React reuses the same DOM node and
             merely rewrites `src` — measured: after switching from deneme 24 to deneme 33 the
             node was identical while a second embed request went out. That attaches a SECOND
             `YT.Player` to an element that already has one, which the IFrame API does not
             document and which leaves the previous player object pointing at a live element
             rather than a detached one. Keying on `loadToken` restores the old shape: a new
             video gets a new element, the effect's cleanup runs, and a fresh player attaches to
             a fresh frame. It does NOT re-key on a seek — `loadToken` is frozen across seeks by
             design, which is the same field the `src` reads. */
          key={active.loadToken}
          ref={iframeRef}
          className={styles.player}
          src={playerEmbedSrc({
            videoId: video.videoId,
            origin: window.location.origin,
            startSecond: active.loadStartSecond,
          })}
          title={title}
          // DELEGATED ONLY WHAT A RECORDING USES. `allow` is a Permissions-Policy delegation, not
          // a feature list: Chrome's default for the motion sensors is `self`, so naming
          // `accelerometer`/`gyroscope` here is precisely what would unblock a motion stream for
          // the cross-origin frame — and those two serve 360°/VR steering, which a lecture
          // recording does not have. Sensor calibration offsets are a published cookieless
          // fingerprinting vector, i.e. the identifier the `youtube-nocookie` host exists to deny,
          // so granting them would undo that choice for nothing (KVKK m.4, "ilgili, sınırlı ve
          // ölçülü"; → PR #63 review `SEC63-I1`). Dropped from YouTube's own embed-dialog snippet
          // deliberately, and only those two: `clipboard-write` and `web-share` back the player's
          // own "copy video URL at current time" and mobile share, which are the reader's controls
          // and are NOT verified unused.
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  /* THE COVER. `data-player-open` is what the bench island's delegated listener recognises; there
     is no `onClick` here because the press has to be handled by the one delegated listener that
     also owns the 180 index rows. The control does nothing without JavaScript, and that is stated
     rather than hidden: the page's content is the question index, every row of which is a real
     link that works with no script at all, and the video itself stays reachable through the
     source credit at the foot of the page. */
  if (!video.playable) {
    return (
      <div className={`${styles.frame} ${styles.thumbBox}`}>
        <span className={styles.watchOverlay}>
          {/* BOTH CONTROLS' ACCESSIBLE NAMES BEGIN WITH THEIR VISIBLE TEXT (WCAG 2.5.3 Label in
              Name — → PR #63 review `A11Y63-I1`). A name that REPLACES the visible word breaks
              speech input: a Voice Control user says "İzle" and nothing matches. So the
              disambiguation is appended to the visible token rather than substituted for it. */}
          <a
            className={`btn btn-ghost ${styles.watchButton}`}
            href={watchOnYoutubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={watchOnYoutubeAriaLabel}
          >
            {watchOnYoutubeLabel}
          </a>
        </span>
      </div>
    );
  }

  const rich = video.rich;
  return (
    <div className={`${styles.frame} ${styles.thumbBox}`}>
      {rich !== null && (
        /* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9's SECOND
           exception (→ DEC 2026-08-15c): a remote image whose provider bars byte copies. The
           address comes from the payload, the dimensions come from the payload, and the box
           above holds CLS. See this component's docblock for why `next/image` and `unoptimized`
           are both wrong here.

           `loading="lazy"` STAYS, AND THAT IS A MEASURED ANSWER RATHER THAN AN INHERITED ONE.
           The exception's carve-out is "unless the image is the page's LCP candidate", and the
           bench was expected to trip it: moving the one visible thumbnail up the page could
           plausibly have made it the largest element in the first viewport. It does not. Measured
           on the built page in both locales at 320/360/768/1024/1440, the LCP element is the
           intro paragraph, the `<h1>` or the book cover in every single case — the stage still
           sits below the intro, the künye and the jump strip at every width, so the thumbnail is
           never in the first viewport. The first draft of this component shipped
           `fetchPriority="high"` and no `lazy` on the assumption that it would be; the assumption
           was wrong in all ten measurements and is recorded here so it is not re-made. */
        <img
          className={styles.thumb}
          src={rich.thumbnailUrl}
          alt=""
          width={rich.thumbnailWidth}
          height={rich.thumbnailHeight}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
      <span className={styles.watchOverlay}>
        <button
          type="button"
          className={`btn btn-primary ${styles.watchButton}`}
          data-player-open=""
          aria-label={watchAriaLabel}
        >
          {watchLabel}
        </button>
      </span>
    </div>
  );
}
