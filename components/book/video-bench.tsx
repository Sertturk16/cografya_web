"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { BookContentKind } from "@/lib/api/types";
import { consumeResolved, requestAuth, useAuthModalState } from "@/lib/auth/auth-modal.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { readAutoNext, writeAutoNext } from "@/lib/book/auto-next-preference";
import {
  BENCH_HISTORY_MARK,
  type BenchStep,
  isBenchEntry,
  stepForHash,
} from "@/lib/book/bench-history";
import { rowStatuses } from "@/lib/book/book-status";
import { currentMarkerIndex } from "@/lib/book/current-marker";
import { formatDuration } from "@/lib/book/duration";
import { resolveIzleStartSecond } from "@/lib/book/resume-second";
import { videoFragment } from "@/lib/book/video-identity";
import { nextPlayable } from "@/lib/book/workbench-model";
import { fetchVideoIdentity, VIDEO_IDENTITY_FETCH_TIMEOUT_MS } from "@/lib/video-identity/client";
import {
  buildWatchedTogglePayload,
  fetchBookProgress,
  fetchVideoProgress,
  saveVideoProgress,
  VIDEO_PROGRESS_FETCH_TIMEOUT_MS,
  type BookProgressValue,
  type VideoProgressValue,
} from "@/lib/video-progress/client";
import { watchUrl } from "@/lib/youtube/embed";
import { openVideo, resetBench, selectVideo, useBenchState } from "./active-video";
import { BookBar, type BookBarProps } from "./book-bar";
import { BenchStage, type BenchVideo } from "./bench-stage";

/**
 * The workbench island (T-128): one stage, a server-rendered list and marker strip, and ONE
 * delegated listener over all of them.
 *
 * ## The server markup is the state; this island reconciles it
 *
 * Every video row and every marker is a real `<a href>` the server rendered (the page must read
 * and navigate without JavaScript — `SEO-POLICY.md` §B8 8.2, §B12 12.2.b). This island never
 * re-renders them. It writes the few attributes that change: `aria-current` on the selected row
 * and the current marker, `hidden` on the marker panels, `data-status`/`--ring` on the rows,
 * the group progress text. Each effect states the WHOLE answer on every run, so a reader who
 * changed the DOM by hand cannot leave it disagreeing with the selection.
 *
 * ## The interception is conditional, and the links stay real
 *
 * The delegated `onClick` acts only on an unmodified primary press on a control carrying
 * `data-video-row` (select a video), `data-second` (a marker: seek or load) or
 * `data-player-open` (İzle). Ctrl/Cmd/Shift/Alt and middle-click go to the browser, so "open in a
 * new tab" still works. A marker press on a non-playable video keeps its plain fragment jump.
 *
 * ## The hash is the mobile step
 *
 * Selecting a video pushes a marked history entry (`#video-12`), so a phone's back gesture
 * returns to the list step (`lib/book/bench-history.ts`). Marker presses keep `replaceState`:
 * 180 entries would bury whatever the reader was on before. Arriving on a fragment selects the
 * video and, below `lg`, opens the watch step — it never loads a player: the ledger permits the
 * load only on a click or a key press, and a hash is neither.
 *
 * ## Keyboard needs no separate path
 *
 * `<a>` and `<button>` both dispatch a click on Enter (and Space, on the button), so the one
 * delegated `onClick` covers "a click or a key press". There is deliberately no hover or touch
 * handler anywhere in this tree.
 */

/**
 * Which video a node belongs to, or `null` — the island's ONE way of answering that. `data-deneme`
 * is markup, so "absent" and "not a number" are both reachable and neither may resolve to video 0.
 */
function orderNoOf(node: Element): number | null {
  const holder = node.closest<HTMLElement>("[data-deneme]");
  const orderNo = Number.parseInt(holder?.dataset.deneme ?? "", 10);
  return Number.isFinite(orderNo) ? orderNo : null;
}

/**
 * Where a gated click's own fragment goes (uyelik-auth-redesign plan §5.6.4): the auth modal
 * opens in place, so the selection and the address are applied at click time rather than on a
 * page the reader never leaves.
 */
function applyFragmentAndSelect(orderNo: number, fragment: string | null): void {
  if (fragment !== null) {
    window.history.replaceState(null, "", fragment);
    notifyHash();
  }
  selectVideo(orderNo);
}

/** `localStorage`, or `null` where reading the property itself throws (blocked storage). */
function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The URL hash as an external store: the mobile step is derived from it rather than mirrored into
 * state, so the back gesture, a shared link and the bench's own pushes cannot disagree. The
 * History API fires no event for `pushState`/`replaceState`, so the bench calls
 * {@link notifyHash} after each of its own writes.
 */
const hashListeners = new Set<() => void>();

function subscribeHash(listener: () => void): () => void {
  hashListeners.add(listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    hashListeners.delete(listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}

function notifyHash(): void {
  for (const listener of hashListeners) listener();
}

/** Stored auto-next preference; storage changes from another tab are not followed. */
function subscribeNothing(): () => void {
  return () => undefined;
}

/**
 * Bring `element` into view inside its nearest scrolling panel ONLY. `scrollIntoView` would also
 * scroll the document, which moves the one-screen workbench off the top of the viewport.
 */
function scrollWithin(element: HTMLElement): void {
  let panel = element.parentElement;
  while (panel !== null && getComputedStyle(panel).overflowY !== "auto") {
    panel = panel.parentElement;
  }
  if (panel === null) return;
  const box = panel.getBoundingClientRect();
  const item = element.getBoundingClientRect();
  if (item.top < box.top) panel.scrollTop -= box.top - item.top;
  else if (item.bottom > box.bottom) panel.scrollTop += item.bottom - box.bottom;
}

/** The breakpoint the two steps split at — `lg`, the same 64rem the layout classes use. */
const NARROW_QUERY = "(max-width: 63.999rem)";

export function VideoBench({
  videos,
  kind,
  bookSlug,
  barProps,
  list,
  markers,
}: {
  videos: readonly BenchVideo[];
  kind: BookContentKind;
  bookSlug: string;
  /** The book bar's server strings; the island adds the live watched count. */
  barProps: Omit<BookBarProps, "watchedText">;
  /** The server-rendered video list (`WorkbenchList`). */
  list: ReactNode;
  /** The server-rendered marker panels of every video (`MarkerPanels`). */
  markers: ReactNode;
}) {
  const t = useTranslations("BookDetail");
  const rootRef = useRef<HTMLDivElement>(null);
  /** The second İzle should start from — 0 unless the reader arrived on a marker link. */
  const hashStartSecond = useRef(0);
  const modal = useAuthModalState();
  /** The modal request currently being served, or `null` (plan §5.6.4). */
  const authRequestId = useRef<string | null>(null);
  /** What to focus once auth succeeds — the video only; the load stays a deliberate press. */
  const authResume = useRef<{ readonly orderNo: number; readonly second: number } | null>(null);

  const orderNos = useMemo(() => videos.map((video) => video.orderNo), [videos]);
  const defaultOrderNo = orderNos[0] ?? 0;
  const single = videos.length === 1;
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
  const landing = stepForHash(hash, orderNos);
  const step: BenchStep = single ? "watch" : landing.step;
  /** Set by a reader's own step change (not the first render), so focus follows only then. */
  const focusOnStep = useRef(false);
  const storedAutoNext = useSyncExternalStore(
    subscribeNothing,
    () => readAutoNext(safeLocalStorage()),
    () => true,
  );
  /** The reader's toggle in this page view; wins over storage, so a blocked store still works. */
  const [autoNextOverride, setAutoNextOverride] = useState<boolean | null>(null);
  const autoNext = autoNextOverride ?? storedAutoNext;
  const [currentMarker, setCurrentMarker] = useState<{ orderNo: number; index: number } | null>(
    null,
  );

  // THE LOGIN GATE'S OWN SESSION READ (§5.3.2), called ONCE here and threaded down as a prop.
  const [authState] = useAuthSession();

  // Book-level progress (UYE-P3 §3.1): the watched count, the resume card and, since T-128, one
  // row per started video for the list's status icons. Only fetched when authenticated.
  const [fetchedBookProgress, setFetchedBookProgress] = useState<BookProgressValue | null>(null);

  useEffect(() => {
    if (authState !== "authenticated") return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VIDEO_PROGRESS_FETCH_TIMEOUT_MS);
    fetchBookProgress(bookSlug, controller.signal)
      .then((result) => {
        if (!cancelled && result !== null) setFetchedBookProgress(result);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [authState, bookSlug]);

  const bookProgress = authState === "authenticated" ? fetchedBookProgress : null;

  // THE PER-VIDEO PROGRESS FETCH (§5.4) — lazy, on selection, never eager for every video.
  const { selected } = useBenchState();
  const selectedOrderNo = selected ?? defaultOrderNo;
  const selectedVideo = videos.find((candidate) => candidate.orderNo === selectedOrderNo);
  const bookVideoId = selectedVideo?.bookVideoId;

  const [rawProgress, setRawProgress] = useState<VideoProgressValue | null | "loading">(null);
  const fetchKey = authState === "authenticated" ? bookVideoId : undefined;
  const [lastFetchKey, setLastFetchKey] = useState<string | undefined>(undefined);

  // Adjusting state during render (the idiom `register-form.tsx` uses): the synchronous reset
  // happens here, and the effect below owns only the fetch.
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

  /** The watched toggle's save (§5.6): a full-state replace through
   *  {@link buildWatchedTogglePayload}, reflected locally in the video's and the book's state
   *  so the toggle, the count and the row's status icon move without a re-fetch. */
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
      setFetchedBookProgress((prev) => {
        if (!prev) return prev;
        const others = prev.videos.filter((row) => row.bookVideoId !== bookVideoId);
        const videosNext = [
          ...others,
          {
            bookVideoId,
            lastPositionSeconds: payload.lastPositionSeconds,
            watched: payload.watched,
          },
        ];
        return {
          ...prev,
          videos: videosNext,
          watchedCount: videosNext.filter((row) => row.watched).length,
        };
      });
    }
    return result;
  };

  /** Select a video as a reader action: a marked history entry, the watch step, and — below
   *  `lg` — focus on the stage heading. */
  const goTo = (orderNo: number) => {
    window.history.pushState({ [BENCH_HISTORY_MARK]: true }, "", `#${videoFragment(orderNo)}`);
    selectVideo(orderNo);
    setCurrentMarker(null);
    focusOnStep.current = window.matchMedia(NARROW_QUERY).matches;
    notifyHash();
  };

  /** Back to the list: step back through our own entry when there is one, so the phone's back
   *  gesture and this button agree; otherwise clear the fragment in place. */
  const backToList = () => {
    focusOnStep.current = true;
    if (isBenchEntry(window.history.state)) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    notifyHash();
  };

  const onPlaybackTime = (orderNo: number, second: number) => {
    const video = videos.find((candidate) => candidate.orderNo === orderNo);
    if (video === undefined) return;
    const index = currentMarkerIndex(
      video.tags.map((tag) => tag.second),
      second,
    );
    setCurrentMarker((prev) =>
      index === -1 || (prev?.orderNo === orderNo && prev.index === index)
        ? prev
        : { orderNo, index },
    );
  };

  /** Auto-next: only after the in-page player itself reported the end, only to a video that
   *  plays in the page. The reader started this playback, so continuing it is theirs too. */
  const onEnded = (orderNo: number) => {
    if (!autoNext) return;
    const next = nextPlayable(videos, orderNo);
    if (next === null) return;
    window.history.pushState({ [BENCH_HISTORY_MARK]: true }, "", `#${videoFragment(next.orderNo)}`);
    notifyHash();
    setCurrentMarker(null);
    openVideo(next.orderNo, 0);
  };

  const toggleAutoNext = () => {
    writeAutoNext(safeLocalStorage(), !autoNext);
    setAutoNextOverride(!autoNext);
  };

  /** The resume card's press: a click, so loading the player here respects click-to-load. */
  const resumeFrom = (orderNo: number, second: number, playable: boolean) => {
    goTo(orderNo);
    if (playable) openVideo(orderNo, second);
  };

  // The hash names a video (a shared link, the back gesture, our own push): select it. It never
  // loads a player — the ledger permits the load only on a click or a key press.
  useEffect(() => {
    if (landing.orderNo !== null) selectVideo(landing.orderNo);
  }, [landing.orderNo]);

  // Arriving on a marker fragment arms İzle with that marker's second. Keyed on the hash, so an
  // in-page fragment change (which the browser also scrolls the document for) is undone too.
  useEffect(() => {
    const id = hash.slice(1);
    const target = id === "" ? null : document.getElementById(id);
    const root = rootRef.current;
    if (target === null || root === null || !root.contains(target)) return;
    // The browser (and, on an in-page fragment change, Next's router after this commit) scrolls
    // the DOCUMENT to this fragment; the workbench starts at the top of the page, so undo that on
    // the next frame and bring the target into view inside its own panel instead.
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      scrollWithin(target);
    });
    const orderNo = orderNoOf(target);
    const video = videos.find((candidate) => candidate.orderNo === orderNo);
    const raw = target.dataset.second;
    if (video?.playable && raw !== undefined) {
      const second = Number.parseInt(raw, 10);
      if (Number.isFinite(second)) hashStartSecond.current = second;
    }
    return () => cancelAnimationFrame(frame);
  }, [videos, hash]);

  /* The page is leaving. The store is module state that a client-side route change does not
     re-evaluate, so without this an open player would reappear on the reader's next arrival
     (→ PR #63 review `CODE63-I1`). */
  useEffect(() => resetBench, []);

  // Focus follows a reader's own step change, and only then.
  useEffect(() => {
    if (!focusOnStep.current) return;
    focusOnStep.current = false;
    if (step === "watch") {
      document.getElementById("bench-current-heading")?.focus();
      return;
    }
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-video-row][data-deneme="${selectedOrderNo}"]`)
      ?.focus();
  }, [step, selectedOrderNo]);

  // The selection, stated whole: the current row, the visible marker panel, the row in view.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const key = String(selectedOrderNo);
    for (const row of root.querySelectorAll<HTMLElement>("[data-video-row]")) {
      if (row.dataset.deneme === key) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    }
    for (const panel of root.querySelectorAll<HTMLElement>("[data-marker-panel]")) {
      panel.hidden = panel.dataset.deneme !== key;
    }
    const row = root.querySelector<HTMLElement>(`[data-video-row][data-deneme="${key}"]`);
    if (row !== null) scrollWithin(row);
  }, [selectedOrderNo]);

  // The current marker, stated whole: playback or the last press, else the marker the hash names.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const id = hash.slice(1);
    const named = currentMarker === null && id !== "" ? document.getElementById(id) : null;
    for (const marker of root.querySelectorAll<HTMLElement>(
      "[data-marker-panel] [data-marker-index]",
    )) {
      const panel = marker.closest<HTMLElement>("[data-marker-panel]");
      const on =
        currentMarker === null
          ? marker === named
          : panel?.dataset.deneme === String(currentMarker.orderNo) &&
            marker.dataset.markerIndex === String(currentMarker.index);
      if (on) marker.setAttribute("aria-current", "true");
      else marker.removeAttribute("aria-current");
    }
  }, [currentMarker, hash]);

  const statuses = useMemo(
    () =>
      rowStatuses(
        bookProgress?.videos ?? [],
        new Map(videos.map((video) => [video.bookVideoId, video.durationSeconds])),
      ),
    [bookProgress, videos],
  );

  // The status icons and the group progress, stated whole.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    for (const row of root.querySelectorAll<HTMLElement>("[data-video-row]")) {
      const status = statuses.get(row.dataset.videoId ?? "");
      if (status === undefined) {
        delete row.dataset.status;
        row.style.removeProperty("--ring");
      } else {
        row.dataset.status = status.kind;
        row.style.setProperty("--ring", status.kind === "part" ? String(status.fraction) : "1");
      }
    }
    for (const slot of root.querySelectorAll<HTMLElement>("[data-group-progress]")) {
      const ids = (slot.dataset.groupIds ?? "").split(" ").filter(Boolean);
      const done = ids.filter((id) => statuses.get(id)?.kind === "done").length;
      slot.textContent = bookProgress === null ? "" : `${done}/${ids.length}`;
    }
  }, [statuses, bookProgress]);

  /** The external-state "watch on YouTube" control's in-flight orderNo, or `null` (§10). */
  const [externalResolving, setExternalResolving] = useState<number | null>(null);

  /**
   * The external-state control's flow (§10, P2 plan §5.3): gated like İzle, resolving to an
   * outbound tab once the guarded identity fetch answers. `window.open` runs after the `await` —
   * a known trade: `noopener` prevents writing a pre-opened tab's location.
   */
  async function openExternalWatch(video: BenchVideo): Promise<void> {
    if (externalResolving === video.orderNo) return;
    setExternalResolving(video.orderNo);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VIDEO_IDENTITY_FETCH_TIMEOUT_MS);
    try {
      const videoId = await fetchVideoIdentity(video.bookVideoId, controller.signal);
      if (videoId !== null) window.open(watchUrl(videoId), "_blank", "noopener,noreferrer");
    } finally {
      clearTimeout(timeout);
      setExternalResolving(null);
    }
  }

  const resume = bookProgress?.resume ?? null;
  const resumeVideo =
    resume === null ? undefined : videos.find((video) => video.orderNo === resume.orderNo);

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (!(event.target instanceof Element)) return;

    const row = event.target.closest<HTMLElement>("[data-video-row]");
    if (row !== null) {
      const rowOrderNo = orderNoOf(row);
      if (rowOrderNo === null) return;
      event.preventDefault();
      goTo(rowOrderNo);
      return;
    }

    const trigger = event.target.closest<HTMLElement>("[data-second], [data-player-open]");
    if (trigger === null) return;

    const orderNo = orderNoOf(trigger);
    if (orderNo === null) return;
    const video = videos.find((candidate) => candidate.orderNo === orderNo);
    if (video === undefined) return;

    if (!video.playable) {
      // A marker on a non-playable video is nothing but a fragment jump — the native default.
      // Only the "watch on YouTube" control (data-player-open, §10) is this handler's: gated the
      // same way İzle is, resolving to an outbound tab instead of an in-page player.
      if (!trigger.hasAttribute("data-player-open")) return;
      event.preventDefault();
      if (authState !== "authenticated") {
        authResume.current = { orderNo, second: 0 };
        authRequestId.current = requestAuth("video");
        return;
      }
      void openExternalWatch(video);
      return;
    }

    const raw = trigger.dataset.second;
    let second = hashStartSecond.current;
    if (raw !== undefined) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      second = parsed;
      const index = Number.parseInt(trigger.dataset.markerIndex ?? "", 10);
      if (Number.isFinite(index)) setCurrentMarker({ orderNo, index });
    } else {
      // §5.4's resume-second priority: a plain İzle press resumes from the last saved position
      // when it is further along than the fragment-armed target — never the reverse.
      second = resolveIzleStartSecond(
        second,
        progress !== null && progress !== "loading" ? progress.lastPositionSeconds : undefined,
      );
    }

    event.preventDefault();

    // THE LOGIN GATE (§5.3.2/§5.3.3). `checking` is treated the same as `anonymous`.
    if (authState !== "authenticated") {
      applyFragmentAndSelect(orderNo, trigger.getAttribute("href"));
      authResume.current = { orderNo, second };
      authRequestId.current = requestAuth("video");
      return;
    }

    // İzle has no href of its own, so it addresses the video; a marker addresses itself.
    const fragment = trigger.getAttribute("href");
    if (fragment !== null) window.history.replaceState(null, "", fragment);
    notifyHash();
    openVideo(orderNo, second);
  };

  // The post-auth resume DELIBERATELY does NOT call `openVideo()` (plan §5.6.4/§13): it closes
  // the loop by focusing the now-unblocked İzle control, one deliberate press from playing.
  useEffect(() => {
    const id = authRequestId.current;
    if (id === null || modal.resolvedRequestId !== id) return;
    if (!consumeResolved(id)) return;
    authRequestId.current = null;
    const pending = authResume.current;
    authResume.current = null;
    if (pending === null) return;
    const target = rootRef.current?.querySelector<HTMLElement>(
      `[data-deneme="${pending.orderNo}"] [data-player-open]`,
    );
    target?.focus();
  }, [modal.resolvedRequestId]);

  const watchedText =
    bookProgress === null
      ? null
      : t("bookWatched", { watched: bookProgress.watchedCount, count: bookProgress.videoCount });

  return (
    <div
      ref={rootRef}
      onClick={onClick}
      data-step={step}
      className="group/bench mx-auto flex h-[calc(100dvh-var(--header-height))] min-h-[30rem] w-full max-w-7xl flex-col lg:min-h-[36rem]"
    >
      <div className="shrink-0 border-b border-border px-4 py-3 group-data-[step=watch]/bench:max-lg:hidden sm:px-6 lg:px-8">
        <BookBar {...barProps} watchedText={watchedText} />
      </div>
      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-h-0 flex-1 overflow-y-auto group-data-[step=watch]/bench:max-lg:hidden lg:border-r lg:border-border">
          {resume !== null && resumeVideo !== undefined && (
            <button
              type="button"
              onClick={() =>
                resumeFrom(resumeVideo.orderNo, resume.lastPositionSeconds, resumeVideo.playable)
              }
              className="m-3 flex min-h-14 w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg border border-border bg-card px-3 text-left transition-colors duration-150 hover:border-primary"
            >
              <RotateCcw className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {t("resumeTitle")}
                </span>
                <span className="block text-xs tabular-nums text-muted-foreground">
                  {t("resumeDetail", {
                    label: resumeVideo.label,
                    time: formatDuration(resume.lastPositionSeconds),
                  })}
                </span>
              </span>
            </button>
          )}
          {list}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col group-data-[step=pick]/bench:max-lg:hidden">
          <BenchStage
            videos={videos}
            kind={kind}
            defaultOrderNo={defaultOrderNo}
            authState={authState}
            progress={progress}
            onSaveWatched={saveWatched}
            externalResolvingOrderNo={externalResolving}
            autoNext={autoNext}
            onToggleAutoNext={toggleAutoNext}
            onGo={goTo}
            onBack={backToList}
            onPlaybackTime={onPlaybackTime}
            onEnded={onEnded}
            markers={markers}
          />
        </div>
      </div>
    </div>
  );
}
