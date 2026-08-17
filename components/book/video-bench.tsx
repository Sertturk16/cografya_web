"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { openVideo, resetBench, selectVideo } from "./active-video";
import { BenchStage, type BenchVideo } from "./bench-stage";

/**
 * The workbench: one stage, one server-rendered index, and ONE delegated listener over both.
 *
 * ## Thirty islands became one, and the count is the point
 *
 * The accordion needed an island per block, because the thing that had to hear a press
 * (`<details>`'s own `toggle`) was the thing that had to be torn down. Nothing is collapsible any
 * more, so the natural scope is the workbench: one listener covers 180 question rows, 6 timeline
 * ticks and the İzle control, and "which video does this press belong to" is answered by the
 * `data-deneme` attribute the nearest ancestor carries rather than by a closure per block.
 *
 * ## The links stay REAL links, and the interception is conditional
 *
 * Every question row is a server-rendered `<a href="#deneme-12-soru-3">` that resolves with no
 * JavaScript at all — `SEO-POLICY.md` §B8 8.2 rates JavaScript navigation a BLOCKER, and §B12
 * 12.2.b is what makes this index the page rather than an afterthought. This island does not
 * replace that behaviour; it adds to it, and only when all four of these hold:
 *
 * · the press landed on a control carrying `data-second` (a question row or a timeline tick) or
 *   `data-player-open` (the stage's İzle button);
 * · that control sits inside something carrying `data-deneme`, so the video is known;
 * · the press is an unmodified primary click — Ctrl/Cmd/Shift/Alt and middle-click go to the
 *   browser, so "open this question in a new tab" still works;
 * · the video is `playable` — a video the provider refuses to embed has no player to seek, so its
 *   rows keep their plain fragment behaviour, exactly as before.
 *
 * Anything else falls through untouched.
 *
 * `preventDefault` on the rows is not cosmetic: the native jump scrolls to the question row, which
 * on this layout is BELOW — often thousands of pixels below — the stage that is about to start
 * playing, and the Required Minimum Functionality rules ask that a player not begin playing
 * off-screen. The address bar is updated by hand instead, so the link stays copyable and
 * shareable.
 *
 * `replaceState` rather than `pushState`: this island has no `popstate` handler, so pushed entries
 * would move the URL while the stage stayed put, and 180 of them would bury whatever the reader
 * was on before. The cost — Back does not step through questions — is accepted knowingly.
 *
 * ## Keyboard needs no separate path
 *
 * `<a>` and `<button>` both dispatch a click on Enter (and Space, on the button), so the one
 * delegated `onClick` covers "a click or a key press" — which is the only way the ledger permits
 * the player to load. There is deliberately no `mouseover`, `pointerover` or `touchstart` handler
 * anywhere in this component tree.
 *
 * ## Arriving on a fragment selects, and does NOT load
 *
 * `#deneme-12-soru-3` puts video 12 on the stage and arms İzle with that question's second. It
 * does not start a player: the ledger permits the load on a click or a key press, and a hash is
 * neither — the reader would otherwise have a third-party request made on their behalf by a link
 * somebody else sent them. The fragment still works exactly as it always did; what it adds is
 * that pressing İzle then starts at the question the link named.
 *
 * The selection is read from the DOM rather than passed down, because the rows already carry both
 * the id and the second, so it costs nothing in the payload.
 */
export function VideoBench({
  className,
  indexClassName,
  videos,
  defaultDenemeNo,
  children,
}: {
  /** Optional exactly as React types it: a CSS-module lookup is `string | undefined` under
   *  `noUncheckedIndexedAccess`. The workbench is page LAYOUT, so its two class names come from
   *  the page's own module rather than this island importing across the app boundary — the same
   *  split the accordion row used before it. */
  className?: string;
  indexClassName?: string;
  videos: readonly BenchVideo[];
  defaultDenemeNo: number;
  /** The server-rendered index — 30 rows, 180 links, untouched markup. */
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  /** The second İzle should start from — 0 unless the reader arrived on a question link. */
  const hashStartSecond = useRef(0);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id === "") return;
    const target = document.getElementById(id);
    const root = rootRef.current;
    if (target === null || root === null || !root.contains(target)) return;

    const holder = target.closest<HTMLElement>("[data-deneme]");
    const denemeNo = Number.parseInt(holder?.dataset.deneme ?? "", 10);
    if (!Number.isFinite(denemeNo)) return;

    const video = videos.find((candidate) => candidate.denemeNo === denemeNo);
    if (video === undefined) return;
    selectVideo(denemeNo);

    const raw = target.dataset.second;
    if (video.playable && raw !== undefined) {
      const second = Number.parseInt(raw, 10);
      if (Number.isFinite(second)) hashStartSecond.current = second;
    }

    /* THE CORRECTIVE SCROLL, AND IT MEASURES BEFORE IT MOVES. Selecting a video swaps the stage's
       contents, and the stage sits ABOVE the index — so if its height ever changed with the
       selection, every row below would move out from under a reader the engine had already
       scrolled into place. The stylesheet reserves the box in all three cover states precisely so
       that cannot happen, and this branch is the tripwire for the day someone unreserves one: it
       re-measures the target against its own `scroll-margin-top` and corrects only a real
       displacement.
       An unconditional scroll here would be a scroll-jack — a reader who started moving between
       first paint and hydration would be pulled back (→ PR #66 review `CODE66-M5`). The residual
       is stated rather than engineered around: at most once per load, on a page with one island. */
    const wanted = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    if (Math.abs(target.getBoundingClientRect().top - wanted) > 1) target.scrollIntoView();
  }, [videos]);

  /* The page is leaving. The store is module state and a client-side route change does not
     re-evaluate the module, so without this an open player would survive leaving the page and
     reappear, autoplaying, on the reader's next arrival, with no click and no key press anywhere
     in between (→ PR #63 review `CODE63-I1`). One island means one unconditional reset; the
     one-tick same-route residue is documented in `active-video.ts`, where the state lives. */
  useEffect(() => resetBench, []);

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLElement>("[data-second], [data-player-open]");
    if (trigger === null) return;

    const holder = trigger.closest<HTMLElement>("[data-deneme]");
    const denemeNo = Number.parseInt(holder?.dataset.deneme ?? "", 10);
    if (!Number.isFinite(denemeNo)) return;
    const video = videos.find((candidate) => candidate.denemeNo === denemeNo);
    if (video === undefined || !video.playable) return;

    const raw = trigger.dataset.second;
    let second = hashStartSecond.current;
    if (raw !== undefined) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      second = parsed;
    }

    event.preventDefault();
    // The İzle button has no href of its own, so it addresses the video; a row addresses itself.
    const fragment = trigger.getAttribute("href");
    if (fragment !== null) window.history.replaceState(null, "", fragment);
    openVideo(denemeNo, second);
  };

  return (
    <div ref={rootRef} className={className} onClick={onClick}>
      <BenchStage videos={videos} defaultDenemeNo={defaultDenemeNo} />
      <div className={indexClassName}>{children}</div>
    </div>
  );
}
