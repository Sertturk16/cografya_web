import type { BookVideo, BookVideoYoutube } from "@/lib/api/types";
import { isProviderThumbnailUrl } from "@/lib/seo/json-ld";

/**
 * Which of the three facades one deneme block shows — and the ONE place that decides it.
 *
 * ## Why a single function rather than three conditions at three render sites
 *
 * The rule this surface has to hold is a chain, not a checkbox (`SEO-POLICY.md` §B5 5.7/5.8):
 * a `VideoObject` may only be emitted where the video can be watched, `uploadDate`/`duration`
 * may only be emitted where the page SHOWS them, and no field may be invented where the api
 * has none. Written as separate conditions at the thumbnail, at the künye row and at the
 * JSON-LD builder, those three could drift apart in a later edit and the drift would be
 * invisible — the page would still render. Written once, they cannot: the markup and the
 * visible facts read the same discriminated union, so "printed but not shown" is not a state
 * this component tree can express.
 *
 * ## The three states, and the two gates that produce them
 *
 * · **`typographic`** — `youtube === null`. The NORMAL path, not an error (the contract says
 *   so in as many words): the provider sync may never have run, or the snapshot may have aged
 *   past its serve threshold. The player still loads on a click, because the video id is OUR
 *   data and does not depend on the sync leg at all.
 * · **`external`** — a snapshot exists but `embeddable` is false. The video cannot be watched
 *   on this page, so there is no player and no markup; the reader gets a visible outbound link
 *   instead. Google's own precondition for `VideoObject` is "a page where users can watch the
 *   video", which this block is not.
 * · **`rich`** — a snapshot exists, embedding is permitted, AND the thumbnail address is on a
 *   provider host.
 *
 * ## The host gate lands HERE and not only in the JSON-LD builder, deliberately
 *
 * `videoObjectJsonLd` already refuses a thumbnail whose host is not YouTube's (→ PR #61
 * review `SEC61-M3`). That protects the markup. It does not protect the READER: the same
 * address becomes an `<img src>` the browser fetches before any click, so an address on some
 * other origin would publish a third-party request we never authorised. Running the assertion
 * at the state boundary makes one answer serve both — and the answer is to publish neither,
 * never to "fix" the address, because rebuilding it from the video id is precisely what
 * Developer Policies III.E.5 bars.
 *
 * A failed host assertion degrades to `typographic` rather than `external`: the video IS
 * embeddable, so the player must still work. Sending the reader to YouTube for a video we are
 * allowed to embed would be a worse page, not a safer one — the only things lost are the
 * thumbnail, the two visible facts and the markup, which is exactly what the gate is about.
 */
export type BookVideoState =
  | { readonly kind: "rich"; readonly youtube: BookVideoYoutube }
  | { readonly kind: "external" }
  | { readonly kind: "typographic" };

export function resolveVideoState(video: BookVideo): BookVideoState {
  const youtube = video.youtube;
  if (youtube === null) return { kind: "typographic" };
  if (!youtube.embeddable) return { kind: "external" };
  if (!isProviderThumbnailUrl(youtube.thumbnailUrl)) return { kind: "typographic" };
  return { kind: "rich", youtube };
}
