"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { loadIframeApi, type YouTubePlayer } from "@/lib/youtube/iframe-api";
import { playerEmbedSrc } from "@/lib/youtube/embed";
import { useActiveVideo } from "./active-video";
import styles from "./book-video.module.css";

/**
 * The swap point: this block's facade, or this block's player — never both, and never a player
 * anywhere else on the page.
 *
 * ## The facade arrives as a prop, and that is what keeps it in the first HTML
 *
 * `facade` is a SERVER-rendered element handed down from `page.tsx` (React's "server component
 * as prop" composition, the same shape `nav-disclosure.tsx` uses with `children`). So the
 * cover — thumbnail included — is in the first response, while the iframe exists only after a
 * click. `SPEC.md` §9's criterion 10 measures that: zero iframes in the raw HTML, one in the
 * DOM afterwards.
 *
 * The `src` can ONLY be built on the client anyway: the IFrame Player API matches its `origin`
 * parameter against the embedding page, so the value has to be the browser's real origin
 * rather than a configured one. `window` is read inside the active branch, which is reachable
 * only when the store says a player is open — and the store's server snapshot is `null`.
 *
 * ## Why the `src` does not change when the reader jumps to another question
 *
 * Because it is built from `loadStartSecond`, which the store freezes at load time, and not
 * from the live `seekSecond`. Writing a new `src` onto an iframe reloads it, which is the
 * six-reloads-per-video cost DEC 2026-08-15d exists to remove; the jump goes through `seekTo`
 * on the loaded player instead. The string is therefore byte-identical across seek renders and
 * React never touches the attribute.
 *
 * ## `destroy()` is deliberately not called
 *
 * The IFrame Player API's `destroy()` removes the iframe ELEMENT, and this element belongs to
 * React — which is about to remove it too. Racing the two is the "node to be removed is not a
 * child" class of error: the cleanup below runs as a passive effect, AFTER React has already
 * committed the facade in this element's place, so `destroy()` would be reaching for a node
 * whose parent is gone. Dropping the reference is enough for the thing that matters: React's
 * removal tears down the frame, and with it the playback and the browsing context.
 *
 * What is knowingly leaked, at its real size (→ PR #63 review `CODE63-M2`): one `YT.Player`
 * object and the window `message` listener it registered, per BLOCK SWITCH — not per page. A
 * reader working through a 30-block index can plausibly leave 10–30 of them behind in a
 * session. No functional failure is constructible from it (the API filters incoming messages
 * by `event.source`, and a detached frame's `contentWindow` is null), so the cost is bounded
 * memory growth for the length of one page visit; it is stated at that size rather than
 * described as a handful.
 */
export function DenemeVideo({
  denemeNo,
  videoId,
  title,
  playable,
  facade,
}: {
  denemeNo: number;
  videoId: string;
  title: string;
  /** False for a video the provider refuses to embed. It is the same value the block's island
   *  receives, and it is required here as well as there: the island decides what a CLICK does,
   *  while this decides what a stale store may render without one — an `external` block must
   *  not be able to reach the iframe branch by any route (→ PR #63 review `CODE63-I1`). */
  playable: boolean;
  facade: ReactNode;
}) {
  const active = useActiveVideo();
  const isActive = playable && active !== null && active.denemeNo === denemeNo;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  /** A seek requested before the API answered; applied on `onReady`. */
  const pendingSeek = useRef<number | null>(null);
  /** What this block has already acted on, so a fresh load is told apart from a jump. */
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
  }, [isActive]);

  // WCAG 4.1.3: the control the reader just pressed leaves the DOM, so focus would fall to
  // `<body>` and the next Tab would restart from the skip link. It moves to the player, which
  // carries its own accessible name through `title`. After commit, and after paint, because
  // focusing a node the same handler is replacing is the bug pattern this repo has already paid
  // for once (PR #45 review C1/I5). The default scroll-into-view is WANTED here: the Required
  // Minimum Functionality rules ask that a player not start playing off-screen.
  useEffect(() => {
    if (!isActive) return;
    const frame = requestAnimationFrame(() => iframeRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isActive, active?.loadToken]);

  // Jump-to-question. A fresh load carries its second in the `src` already, so the first pass
  // only records what it saw; every later nonce is a real jump.
  useEffect(() => {
    if (active === null || active.denemeNo !== denemeNo) {
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
  }, [active, denemeNo]);

  if (!isActive) return facade;

  return (
    // `data-player-box` is not styling and not dead markup: it is the handle `SPEC.md` §9's
    // criterion 12 addresses when it measures that this box holds the iframe and NOTHING else
    // — no badge, no gradient, no play button of our own — which is the Required Minimum
    // Functionality rule the facade architecture rests on. A class name would not do: classes
    // are hashed by CSS Modules and the check would break on a rename it should not care about.
    <div className={`${styles.frame} ${styles.playerBox}`} data-player-box="">
      <iframe
        ref={iframeRef}
        className={styles.player}
        src={playerEmbedSrc({
          videoId,
          origin: window.location.origin,
          startSecond: active.loadStartSecond,
        })}
        title={title}
        // DELEGATED ONLY WHAT A DENEME RECORDING USES. `allow` is a Permissions-Policy
        // delegation, not a feature list: Chrome's default for the motion sensors is `self`,
        // so naming `accelerometer`/`gyroscope` here is precisely what would unblock a motion
        // stream for the cross-origin frame — and those two serve 360°/VR steering, which a
        // lecture recording does not have. Sensor calibration offsets are a published
        // cookieless fingerprinting vector, i.e. the identifier the `youtube-nocookie` host
        // exists to deny, so granting them would undo that choice for nothing (KVKK m.4,
        // "ilgili, sınırlı ve ölçülü"; → PR #63 review `SEC63-I1`). Dropped from YouTube's own
        // embed-dialog snippet deliberately, and only those two: `clipboard-write` and
        // `web-share` back the player's own "copy video URL at current time" and mobile share,
        // which are the reader's controls and are NOT verified unused.
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
