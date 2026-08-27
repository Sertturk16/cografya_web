"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
// Deliberately NOT `@/i18n/navigation`'s `useRouter` (the same review `CODE85-M5` reasoning
// `login-form.tsx` already documents): the target this pushes is `getPathname(...)`'s output,
// a final path with its locale prefix already resolved — a second locale-prefixing pass would
// double it.
import { useRouter } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { resolveIzleStartSecond } from "@/lib/book/resume-second";
import {
  buildWatchedTogglePayload,
  fetchVideoProgress,
  saveVideoProgress,
  VIDEO_PROGRESS_FETCH_TIMEOUT_MS,
  type VideoProgressValue,
} from "@/lib/video-progress/client";
import { openVideo, resetBench, selectVideo, useBenchState } from "./active-video";
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
/**
 * Which video a node belongs to, or `null` — the island's ONE way of answering that.
 *
 * Both entry points ask it: the hash effect about the element a fragment resolved to, and the
 * delegated handler about the control that was pressed. They asked it with the same five lines
 * written twice (→ PR #70 review `SIMP70-M3`), and the copies could answer differently the day
 * one of them learned about a second attribute.
 *
 * `Number.parseInt` on a missing attribute yields `NaN`, which is why the finite check is the
 * return value rather than a comment: `data-deneme` is markup, so "absent" and "not a number" are
 * both reachable from a page edit, and neither may resolve to video 0.
 */
function denemeNoOf(node: Element): number | null {
  const holder = node.closest<HTMLElement>("[data-deneme]");
  const denemeNo = Number.parseInt(holder?.dataset.deneme ?? "", 10);
  return Number.isFinite(denemeNo) ? denemeNo : null;
}

/**
 * Where a gated click sends the reader (UYELIK-06 plan §5.3.3). AK-48's own framing is
 * "become a MEMBER", so the primary path is `/kayit` (register), not `/giris` — a first-time
 * reader arriving from organic search on a solved-question video has no account yet.
 * `returnTo` carries the current pathname plus the pressed control's own fragment (a question
 * row/timeline tick's `href`, or nothing for the İzle button, which has none of its own) — an
 * ORDINARY fragment arrival on return, exactly as any other visit to a fragment URL:
 * `active-video.ts`'s own hash effect SELECTS the video the fragment names and never opens a
 * player on its own, so the reader lands back on the right video, sees the (now-gone) sign-in
 * CTA, and presses İzle once more, now unblocked. No special "resume after auth round-trip"
 * mechanism exists or is needed.
 */
function redirectToSignIn(
  router: ReturnType<typeof useRouter>,
  locale: Locale,
  fragment: string | null,
): void {
  const target = getPathname({ locale, href: "/kayit" });
  const returnTo = `${window.location.pathname}${fragment ?? ""}`;
  router.push(`${target}?returnTo=${encodeURIComponent(returnTo)}`);
}

export function VideoBench({
  className,
  indexClassName,
  videos,
  defaultDenemeNo,
  locale,
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
  /** The gated click's own `/kayit` redirect needs the current locale (§5.3.3) — the page
   *  already resolves it server-side, so it is threaded down as a prop rather than re-derived
   *  from the URL on the client. */
  locale: Locale;
  /** The server-rendered index — 30 rows, 180 links, untouched markup. */
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  /** The second İzle should start from — 0 unless the reader arrived on a question link. */
  const hashStartSecond = useRef(0);
  const router = useRouter();

  // THE LOGIN GATE'S OWN SESSION READ (§5.3.2), called ONCE at the VideoBench level — `authState`
  // is threaded down to `BenchStage`/`DenemeVideo`/`VideoProgressControls` as a prop, never
  // re-derived with a second `useAuthSession()` call anywhere in this tree.
  const [authState] = useAuthSession();

  // THE PROGRESS FETCH (§5.4) — lazy, per video, on selection, never eager for all 30. Resolves
  // the SELECTED video's `bookVideoId` the same way `BenchStage` resolves its own `video` (the
  // `selected ?? defaultDenemeNo` formula — the store is a singleton, so both components read
  // the same underlying value, but this one has to compute it independently because it has to
  // be available at CLICK TIME inside `onClick` below, which `BenchStage` does not own).
  const { selected } = useBenchState();
  const selectedDenemeNo = selected ?? defaultDenemeNo;
  const selectedVideo = videos.find((candidate) => candidate.denemeNo === selectedDenemeNo);
  const bookVideoId = selectedVideo?.bookVideoId;

  const [rawProgress, setRawProgress] = useState<VideoProgressValue | null | "loading">(null);
  // Not authenticated, or no video selected yet, both fold to `undefined` — the same "nothing
  // to fetch" key.
  const fetchKey = authState === "authenticated" ? bookVideoId : undefined;
  const [lastFetchKey, setLastFetchKey] = useState<string | undefined>(undefined);

  // ADJUSTING STATE DURING RENDER (the same idiom `register-form.tsx`'s own district-follows-
  // province fetch already uses, its own comment names it in as many words): the SYNCHRONOUS
  // reset to `"loading"` (or `null` when there's nothing to fetch) happens HERE, comparing
  // against the last key this ran for — never a bare `setState` at the top of an effect body,
  // which `react-hooks/set-state-in-effect` correctly flags as the "derive state from props"
  // anti-pattern it is. The effect below owns ONLY the actual fetch.
  if (fetchKey !== lastFetchKey) {
    setLastFetchKey(fetchKey);
    setRawProgress(fetchKey === undefined ? null : "loading");
  }

  const progress = fetchKey === undefined ? null : rawProgress;

  useEffect(() => {
    if (rawProgress !== "loading" || bookVideoId === undefined) return;
    const requestedBookVideoId = bookVideoId;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VIDEO_PROGRESS_FETCH_TIMEOUT_MS);
    fetchVideoProgress(requestedBookVideoId, controller.signal)
      .then((result) => {
        if (!cancelled) setRawProgress(result);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [rawProgress, bookVideoId]);

  /** The watched-toggle's own save (§5.6) — builds the full-state-replace payload through
   *  {@link buildWatchedTogglePayload} (the mechanical enforcement of the hazard named there),
   *  and, on success, updates the local `progress` state so the toggle reflects the new value
   *  immediately rather than waiting for the next selection change to re-fetch it. */
  const saveWatched = async (nextWatched: boolean): Promise<{ readonly ok: boolean }> => {
    if (bookVideoId === undefined) return { ok: false };
    const current = progress !== null && progress !== "loading" ? progress : null;
    const payload = buildWatchedTogglePayload(current, nextWatched);
    const result = await saveVideoProgress(bookVideoId, payload);
    if (result.ok) {
      setRawProgress({
        lastPositionSeconds: payload.lastPositionSeconds,
        watched: payload.watched,
        watchedAt: payload.watched ? new Date().toISOString() : null,
      });
    }
    return result;
  };

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id === "") return;
    const target = document.getElementById(id);
    const root = rootRef.current;
    if (target === null || root === null || !root.contains(target)) return;

    const denemeNo = denemeNoOf(target);
    if (denemeNo === null) return;

    const video = videos.find((candidate) => candidate.denemeNo === denemeNo);
    if (video === undefined) return;
    selectVideo(denemeNo);

    const raw = target.dataset.second;
    if (video.playable && raw !== undefined) {
      const second = Number.parseInt(raw, 10);
      if (Number.isFinite(second)) hashStartSecond.current = second;
    }

    /* THE CORRECTIVE SCROLL, AND IT MEASURES THE PRE-SWAP LAYOUT. `selectVideo` above schedules a
       re-render; React has not committed it when this line runs, so what is measured is the page
       as the server rendered it. That is CORRECT here and it is correct for one reason only —
       every block of the stage reserves its height in all three cover states, so the swap changes
       no geometry to re-measure. It is NOT a tripwire for the day someone unreserves one: it
       could not see that shift, because the shift happens after it (→ PR #70 review `CODE70-M1`).
       The invariant is held where it is stated — `.frame`, `.stageCaption` and the timeline card,
       each of which reserves its box for the non-rich states — and `bench.structure.test.ts` is
       what fails when one of them stops.
       What this line IS for is the ordinary fragment landing: it re-measures the target against
       its own `scroll-margin-top` and corrects only a real displacement. An unconditional scroll
       would be a scroll-jack — a reader who started moving between first paint and hydration would
       be pulled back (→ PR #66 review `CODE66-M5`). The residual is stated rather than engineered
       around: at most once per load, on a page with one island. */
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

    const denemeNo = denemeNoOf(trigger);
    if (denemeNo === null) return;
    const video = videos.find((candidate) => candidate.denemeNo === denemeNo);
    if (video === undefined || !video.playable) return;

    const raw = trigger.dataset.second;
    let second = hashStartSecond.current;
    if (raw !== undefined) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      second = parsed;
    } else {
      // §5.4's resume-second priority: a plain İzle press (no explicit `data-second`) resumes
      // from the last saved position when one exists and is further along than the explicit
      // (fragment-armed) target — never the reverse.
      second = resolveIzleStartSecond(
        second,
        progress !== null && progress !== "loading" ? progress.lastPositionSeconds : undefined,
      );
    }

    event.preventDefault();

    // THE LOGIN GATE (§5.3.2/§5.3.3). `checking` is treated the same as `anonymous`: a control
    // must not open a player before the session check has resolved.
    if (authState !== "authenticated") {
      redirectToSignIn(router, locale, trigger.getAttribute("href"));
      return;
    }

    // The İzle button has no href of its own, so it addresses the video; a row addresses itself.
    const fragment = trigger.getAttribute("href");
    if (fragment !== null) window.history.replaceState(null, "", fragment);
    openVideo(denemeNo, second);
  };

  return (
    <div ref={rootRef} className={className} onClick={onClick}>
      <BenchStage
        videos={videos}
        defaultDenemeNo={defaultDenemeNo}
        authState={authState}
        progress={progress}
        onSaveWatched={saveWatched}
      />
      <div className={indexClassName}>{children}</div>
    </div>
  );
}
