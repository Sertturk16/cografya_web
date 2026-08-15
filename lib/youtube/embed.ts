/**
 * Every YouTube address this repo builds, in one file — and one of them it deliberately does
 * NOT build.
 *
 * ## What may be composed from the video id, and what may not
 *
 * The video id is OUR data: it is seeded, it is what the contract calls "the identifier the
 * embed is built from", and composing a player or watch address from it is the sanctioned
 * use. The **thumbnail** address is the opposite case — it is API Data, it arrives on
 * `BookVideoYoutubeDto.thumbnailUrl`, and Developer Policies III.E.5 bars replacing API Data
 * with independently computed data. So there is no `thumbnailUrl()` here and there must never
 * be one; the payload's string is hotlinked as received.
 *
 * ## The host, and why the cookie-free one
 *
 * `youtube-nocookie.com` sets no cookie until the reader actually plays, and it costs nothing
 * — the IFrame Player API's `enablejsapi`/`origin` pair works there the same way (SPEC A1;
 * verified empirically before merge rather than assumed, see `closing-summary-w2.md`). If it
 * ever stops working, the revert is this one constant.
 *
 * The API SCRIPT itself is served from `www.youtube.com` and that is a knowing trade: it is
 * fetched only after the reader's click, so nothing from either host is requested by a reader
 * who never presses play.
 */
const EMBED_ORIGIN = "https://www.youtube-nocookie.com";
const WATCH_ORIGIN = "https://www.youtube.com";

/**
 * The parameter-free player address, handed to `VideoObject.embedUrl`.
 *
 * Parameter-free on purpose: `embedUrl` names the playable resource, while `origin` and
 * `start` describe one particular in-page load. A structured-data field that carried a
 * runtime origin would be wrong the moment the page moved host.
 */
export function canonicalEmbedUrl(videoId: string): string {
  return `${EMBED_ORIGIN}/embed/${encodeURIComponent(videoId)}`;
}

/**
 * The `src` of the iframe this page actually loads.
 *
 * `origin` is the caller's real `window.location.origin` rather than the configured site URL:
 * the IFrame Player API matches it against the embedding page, so the only value that works
 * in dev, in preview and in production is the one the browser is actually on. It is also why
 * this address can only be built on the client — which is what makes "zero iframes in the
 * first response" structural rather than a promise someone has to keep.
 *
 * `start` is emitted only for the INITIAL load and only when it is non-zero. The provenance
 * ledger allows exactly that ("`?start=` remains legal for the initial load only"); every
 * later jump goes through `seekTo` on the loaded player, because rebuilding this URL per
 * question would cost a full reload on each of the six (→ DEC 2026-08-15d). Zero is skipped
 * because it is the default, not because it is a sentinel — the contract warns that 0 is an
 * ordinary first-question value.
 */
export function playerEmbedSrc(args: {
  videoId: string;
  origin: string;
  startSecond: number;
}): string {
  const params = new URLSearchParams({
    // The IFrame Player API's two required parameters. Without `origin` the API refuses to
    // talk to the frame, so `seekTo` — the whole reason the player is scripted — would fail.
    enablejsapi: "1",
    origin: args.origin,
    // iOS otherwise takes the video fullscreen on play, which tears the reader out of the
    // question index they are working through.
    playsinline: "1",
    // The load is user-initiated by construction (a click or a key press on the facade), so
    // this is not the "automatic playback" the Required Minimum Functionality rules bar — it
    // is what spares the reader a second press. If the browser blocks it, the player shows
    // its own play button and nothing is broken.
    autoplay: "1",
  });
  if (args.startSecond > 0) params.set("start", Math.floor(args.startSecond).toString());
  return `${canonicalEmbedUrl(args.videoId)}?${params.toString()}`;
}

/**
 * The public watch page — used only where the video cannot be embedded, so the block offers a
 * visible outbound link instead of a player it is not permitted to show.
 */
export function watchUrl(videoId: string): string {
  return `${WATCH_ORIGIN}/watch?v=${encodeURIComponent(videoId)}`;
}
