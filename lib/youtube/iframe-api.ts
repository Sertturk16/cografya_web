/**
 * The YouTube IFrame Player API loader — one script, loaded once, and never before a click.
 *
 * ## Why the API at all
 *
 * Moving between the six questions of one deneme is a `seekTo` INSIDE the loaded player
 * (owner ruling → DEC 2026-08-15d, and the provenance ledger records the same mechanism by
 * name). The alternative — rebuilding the embed URL with a new `?start=` — costs a full
 * player reload on every question, six per video.
 *
 * ## Why the types are written here instead of installed
 *
 * `@types/youtube` describes an API surface of which this repo uses exactly one method. A
 * permanent dependency for one call is the speculative generality `ENGINEERING.md` §10 bars,
 * and a hand-written declaration keeps the shipped surface honest: anything not declared here
 * is not something this page may quietly start using.
 *
 * ## Loading discipline
 *
 * Nothing is fetched at page load, on hover, or on touch. The first `loadIframeApi()` call —
 * which only ever happens inside a click or key-press handler — injects the script and
 * memoises the promise, so 30 blocks share one download and a second click never re-injects.
 *
 * The API signals readiness through a single global callback, so an existing one is chained
 * rather than replaced. Nothing else on this site defines it today; the chaining costs one
 * line and removes a class of silent breakage from whatever lands next.
 */

/** The player handle. Only what this page calls is declared — see the file docblock. */
export interface YouTubePlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YouTubePlayerConstructor {
  new (element: HTMLIFrameElement, options: { events?: { onReady?: () => void } }): YouTubePlayer;
}

interface YouTubeApi {
  Player: YouTubePlayerConstructor;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

let pending: Promise<YouTubeApi> | null = null;

export function loadIframeApi(): Promise<YouTubeApi> {
  // Already resolved by an earlier block on this page — or by a bfcache restore, where the
  // module state is gone but `window.YT` survives.
  const existing = window.YT;
  if (existing !== undefined) return Promise.resolve(existing);
  if (pending !== null) return pending;

  pending = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      const api = window.YT;
      if (api === undefined) {
        reject(new Error("[youtube] iframe_api signalled ready without exposing window.YT"));
        return;
      }
      resolve(api);
    };

    const script = document.createElement("script");
    script.src = IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => {
      // The player itself is unaffected — it is a plain iframe and plays on its own. Only
      // jump-to-question is lost, so the failure is reported and the page carries on.
      pending = null;
      reject(new Error("[youtube] iframe_api failed to load"));
    };
    document.head.appendChild(script);
  });

  return pending;
}
