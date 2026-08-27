"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AuthSessionState } from "@/lib/auth/use-session.client";
import { formatDuration } from "@/lib/book/duration";
import type { VideoProgressValue } from "@/lib/video-progress/client";
import styles from "./book-video.module.css";

/**
 * The signed-in reader's own progress on the video currently on the stage (UYELIK-06 plan
 * §5.6): a resume-position line, and a watched self-declaration toggle.
 *
 * RENDERED BY `BenchStage`, NOT INSIDE `DenemeVideo`'s cover — unlike the sign-in CTA
 * (§5.3.4), this control is meaningful in EVERY video state (including `external`, and
 * regardless of whether a player is currently loaded), so it sits as a sibling below the
 * stage's caption and timeline rather than swapping with the cover/player.
 *
 * NO RESERVED-BOX TREATMENT, and that is a considered difference from the CTA/caption/
 * timeline above it — not an oversight. Those three sit ABOVE the 30-row index and their own
 * height changes would shift it (`bench-stage.tsx`'s own rule: "reserve it in all three states
 * or do not put it above the index"). This block sits BELOW the index's own stage column, so a
 * height change here (an anonymous reader sees nothing at all; an authenticated one sees a
 * toggle, and sometimes also a resume line) moves nothing that rule protects — the same posture
 * `login-form.tsx`'s own authenticated/anonymous swap already takes.
 */
export function VideoProgressControls({
  authState,
  progress,
  onToggleWatched,
}: {
  authState: AuthSessionState;
  /** `"loading"` and `null` are both treated as "no known saved state yet" here — an
   *  unchecked toggle and no resume line are the correct default for both. */
  progress: VideoProgressValue | null | "loading";
  onToggleWatched: (watched: boolean) => Promise<{ readonly ok: boolean }>;
}) {
  const t = useTranslations("BookDetail");
  const [pending, setPending] = useState(false);

  if (authState !== "authenticated") return null;

  const known = progress !== null && progress !== "loading" ? progress : null;
  const watched = known?.watched ?? false;

  async function handleToggle() {
    // The click/keyboard-activation guard `aria-disabled` cannot provide on its own (below):
    // unlike the native `disabled` attribute, `aria-disabled` does not stop the browser from
    // firing `click`/`Enter`/`Space` at all — the control has to refuse the second activation
    // itself while a save is already in flight.
    if (pending) return;
    setPending(true);
    try {
      await onToggleWatched(!watched);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.progressControls}>
      {/* A resume-position line states a FACT about THIS reader's own saved position — never a
          coverage ratio across the catalogue (`CONTENT-STYLE.md` §22's "eksik-vurgusu" ban).
          Omitted entirely at 0: "resume from 0:00" tells the reader nothing they do not
          already know from the cover itself. */}
      {known !== null && known.lastPositionSeconds > 0 && (
        <p className={styles.resumeLine}>
          {t("resumeLine", { time: formatDuration(known.lastPositionSeconds) })}
        </p>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={watched}
        className={`btn btn-ghost ${styles.watchedToggle}`}
        onClick={() => void handleToggle()}
        // `aria-disabled`, NOT `disabled` (PR #90 review `A11Y90-I3`) — a truly `disabled` button
        // is dropped from the Tab sequence and blurred by the browser the instant this attribute
        // flips, and nothing restores focus once the save round-trip finishes: a keyboard reader
        // pressing this button loses their place in the 180-row index on every save. Staying
        // focusable and in tab order costs nothing here, because `handleToggle`'s own `pending`
        // guard above already refuses a second activation while one is in flight.
        aria-disabled={pending}
        aria-label={watched ? t("watchedToggleAriaOn") : t("watchedToggleAriaOff")}
      >
        {t("watchedToggle")}
      </button>
    </div>
  );
}
