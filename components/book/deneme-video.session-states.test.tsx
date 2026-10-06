import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AuthSessionState } from "@/lib/auth/use-session.client";
import type { BenchVideo } from "./bench-stage";
import { DenemeVideo } from "./deneme-video";

/**
 * T-165 / T-167: the İzle cover by session state. While the session check runs, the cover says
 * nothing about signing in (a signed-in reader used to see "giriş yap" on every load), and a press
 * that waits for the check shows İzle's loading state.
 */

const video: BenchVideo = {
  orderNo: 1,
  bookVideoId: "bv-1",
  titleTr: null,
  titleEn: null,
  groupTitleTr: null,
  label: "Deneme 1",
  markerCount: 0,
  durationSeconds: null,
  playable: true,
  tags: [],
  rich: null,
};

const COPY = {
  watch: "İzle",
  watchAria: "İzle — Deneme 1 video çözümü",
  watchAriaSignedOut: "İzle — Deneme 1 video çözümü, giriş gerekir",
  signInCta: "Bu videoyu izlemek için giriş yap.",
  loading: "Yükleniyor…",
  loadingAria: "Deneme 1 video çözümü yükleniyor",
} as const;

function cover(authState: AuthSessionState, pressPending = false, playable = true): string {
  return renderToStaticMarkup(
    <DenemeVideo
      video={{ ...video, playable }}
      active={null}
      authState={authState}
      watched={false}
      title="Deneme 1"
      watchLabel={COPY.watch}
      watchAriaLabel={COPY.watchAria}
      watchAriaSignedOutLabel={COPY.watchAriaSignedOut}
      signInCtaText={COPY.signInCta}
      sessionReadyAnnounceText="Giriş yaptın, videoyu izleyebilirsin."
      watchOnYoutubeLabel="YouTube'da izle"
      watchOnYoutubeAriaLabel="YouTube'da izle — Deneme 1"
      pressPending={pressPending}
      watchLoadingLabel={COPY.loading}
      watchLoadingAriaLabel={COPY.loadingAria}
    />,
  );
}

describe("DenemeVideo while the session check runs", () => {
  it("shows no sign-in prompt and no signed-out name", () => {
    const html = cover("checking");
    expect(html).not.toContain(COPY.signInCta);
    expect(html).not.toContain(COPY.watchAriaSignedOut);
    expect(html).toContain(`aria-label="${COPY.watchAria}"`);
  });

  it("keeps the sign-in prompt and the signed-out name for a guest", () => {
    const html = cover("anonymous");
    expect(html).toContain(COPY.signInCta);
    expect(html).toContain(`aria-label="${COPY.watchAriaSignedOut}"`);
  });

  it("announces nothing on the first render of a signed-in reader", () => {
    expect(cover("authenticated")).not.toContain("Giriş yaptın");
  });
});

describe("DenemeVideo while a press waits for the session (T-167)", () => {
  it("İzle shows its loading state and aria-busy", () => {
    const html = cover("checking", true);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`aria-label="${COPY.loadingAria}"`);
    expect(html).toContain(`>${COPY.loading}</button>`);
  });

  it("İzle is not busy before a press", () => {
    const html = cover("checking", false);
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain(`>${COPY.watch}</button>`);
  });

  it("the YouTube control shows the same loading state", () => {
    const html = cover("checking", true, false);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`>${COPY.loading}</button>`);
  });
});
