import { describe, expect, it } from "vitest";
import { canonicalEmbedUrl, playerEmbedSrc, watchUrl } from "./embed";

describe("canonicalEmbedUrl", () => {
  it("is the cookie-free host and carries no parameters", () => {
    // Handed to `VideoObject.embedUrl`, which names the resource — not one in-page load.
    expect(canonicalEmbedUrl("mnF6F4kQ3CA")).toBe(
      "https://www.youtube-nocookie.com/embed/mnF6F4kQ3CA",
    );
  });
});

describe("playerEmbedSrc", () => {
  const base = { videoId: "mnF6F4kQ3CA", origin: "https://example.test" };

  it("carries the IFrame Player API's required pair", () => {
    // Without these two the API refuses to talk to the frame and `seekTo` — the whole reason
    // the player is scripted at all — silently does nothing.
    const url = new URL(playerEmbedSrc({ ...base, startSecond: 0 }));
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("https://example.test");
  });

  it("keeps the reader inside the page and spares them a second press", () => {
    // Dropping `playsinline` sends every iOS reader to native fullscreen, out of the question
    // index they are working through; dropping `autoplay` costs a second press after the one
    // that loaded the player. Neither is visible to CI in any other way (→ PR #63 TA63-M4).
    const url = new URL(playerEmbedSrc({ ...base, startSecond: 0 }));
    expect(url.searchParams.get("playsinline")).toBe("1");
    expect(url.searchParams.get("autoplay")).toBe("1");
  });

  it("omits `start` at zero and emits it above zero", () => {
    // Zero is an ORDINARY first-question value in this corpus (the measured set is
    // {0, 2, 6, 11, 94}), so it is skipped for being the default, not for being a sentinel.
    expect(playerEmbedSrc({ ...base, startSecond: 0 })).not.toContain("start=");
    expect(playerEmbedSrc({ ...base, startSecond: 94 })).toContain("start=94");
    expect(playerEmbedSrc({ ...base, startSecond: 94.9 })).toContain("start=94");
  });

  it("stays on the cookie-free host", () => {
    expect(new URL(playerEmbedSrc({ ...base, startSecond: 12 })).hostname).toBe(
      "www.youtube-nocookie.com",
    );
  });

  it("escapes the video id into the path rather than interpolating it raw", () => {
    expect(playerEmbedSrc({ ...base, videoId: "a/../b", startSecond: 0 })).toContain(
      "/embed/a%2F..%2Fb",
    );
  });

  it("produces a byte-identical string for one load, which is what stops a reload", () => {
    // The `src` derives from the FROZEN load second, never the live seek second: writing a new
    // `src` onto an iframe reloads it, and that is the cost DEC 2026-08-15d removes.
    expect(playerEmbedSrc({ ...base, startSecond: 94 })).toBe(
      playerEmbedSrc({ ...base, startSecond: 94 }),
    );
  });
});

describe("watchUrl", () => {
  it("addresses the public watch page for a video we may not embed", () => {
    expect(watchUrl("mnF6F4kQ3CA")).toBe("https://www.youtube.com/watch?v=mnF6F4kQ3CA");
  });
});
