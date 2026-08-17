import { describe, expect, it } from "vitest";
import type { BookVideo, BookVideoYoutube } from "@/lib/api/types";
import { resolveVideoState } from "./video-state";

/**
 * The gate that decides what one deneme block shows AND whether it may carry structured data.
 *
 * These assert the STRUCTURE of the decision, never a fact about a real video: the snapshot
 * below is a fixture, and the only literal that matters is the thumbnail HOST, which is a
 * boundary this repo asserts rather than a datum it stores.
 */
const snapshot: BookVideoYoutube = {
  thumbnailUrl: "https://i.ytimg.com/vi/mnF6F4kQ3CA/hqdefault.jpg",
  thumbnailWidth: 480,
  thumbnailHeight: 360,
  publishedAtUtc: "2025-03-12T09:00:00.000Z",
  durationIso: "PT6M8S",
  durationSeconds: 368,
  embeddable: true,
  dataFetchedAtUtc: "2026-08-15T06:00:00.000Z",
};

function video(youtube: BookVideoYoutube | null): BookVideo {
  return {
    denemeNo: 12,
    youtubeVideoId: "mnF6F4kQ3CA",
    questions: [{ questionNo: 1, startSecond: 0 }],
    youtube,
  };
}

describe("resolveVideoState", () => {
  it("treats a missing snapshot as the normal typographic path, not an error", () => {
    expect(resolveVideoState(video(null))).toEqual({ kind: "typographic" });
  });

  it("sends a video the provider refuses to embed to the external state", () => {
    // No player and no VideoObject: Google's precondition for the markup is a page where the
    // video can be watched, and this block is not one.
    expect(resolveVideoState(video({ ...snapshot, embeddable: false }))).toEqual({
      kind: "external",
    });
  });

  it("resolves rich when the snapshot exists, embedding is allowed and the host is the provider's", () => {
    const state = resolveVideoState(video(snapshot));
    expect(state.kind).toBe("rich");
    // The narrowing is the point: only this branch can reach the snapshot at all.
    expect(state.kind === "rich" && state.youtube.durationIso).toBe("PT6M8S");
  });

  it("degrades to typographic — NOT external — when the thumbnail is off a provider host", () => {
    // The video is still embeddable, so the player must still work. What is withheld is the
    // image, the two visible facts and the markup. Sending the reader away from a video we may
    // embed would be a worse page, not a safer one.
    const state = resolveVideoState(
      video({ ...snapshot, thumbnailUrl: "https://evil-ytimg.com/vi/x/hqdefault.jpg" }),
    );
    expect(state).toEqual({ kind: "typographic" });
  });

  it("puts the embeddable gate FIRST when both gates would fire", () => {
    // Gate precedence, asserted because reordering the two conditions is a silent change:
    // resolving `typographic` here would hand the reader an İzle button that loads an embed the
    // provider has refused, which is the one outcome neither gate may produce (→ PR #63
    // TA63-M5).
    const state = resolveVideoState(
      video({
        ...snapshot,
        embeddable: false,
        thumbnailUrl: "https://evil-ytimg.com/vi/x/hqdefault.jpg",
      }),
    );
    expect(state).toEqual({ kind: "external" });
  });

  it("accepts a numbered provider subdomain", () => {
    const state = resolveVideoState(
      video({ ...snapshot, thumbnailUrl: "https://i9.ytimg.com/vi/x/hqdefault.jpg" }),
    );
    expect(state.kind).toBe("rich");
  });
});
