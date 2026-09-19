"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AuthSessionState } from "@/lib/auth/use-session.client";
import { formatDuration } from "@/lib/book/duration";
import type { VideoProgressValue } from "@/lib/video-progress/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `book-video.module.css`'s `.progressControls`, in bridge tokens (T-033 task 7).
 *
 * `max-w-[560px]` is the FOURTH copy of the stage's one cap (`FRAME`, `STAGE_CAPTION`,
 * `TIMELINE`, this row); `bench.structure.test.ts` asserts the four as an equality. Here the
 * cap is for visual alignment only — this block sits BELOW the index's stage column, so its
 * height is not a CLS mechanism the way the three above it are.
 */
const PROGRESS_CONTROLS =
  "mx-auto mt-2.5 flex max-w-[560px] flex-wrap items-center gap-x-3 gap-y-2";

/**
 * The resume line. `m-0` IS LOAD-BEARING: this is a `<p>`, and `app/globals.css`'s base rule
 * gives every `<p>` `margin: 0 0 1rem`; the stylesheet's `margin: 0` cancelled it, and dropping
 * the utility would let 16px back in and break the row's baseline alignment with the toggle.
 * `text-[0.85rem]` rather than `text-sm`, for the line-height reason the whole stage shares.
 * `text-muted-foreground` is `--color-slate`'s bridge — **7.48:1 light / 8.53:1 dark** on the
 * page's `--background`; the frozen token measured 2.36:1 in dark.
 */
const RESUME_LINE = "m-0 text-[0.85rem] text-muted-foreground";

/**
 * WCAG 2.2 §2.5.5 (AAA) 44px, the same generosity the İzle control takes — these are the
 * block's primary controls and there is room.
 */
const WATCHED_TOGGLE = "min-h-11";

/**
 * THE CHECKED STATE, AND WHY IT IS NOT CARRIED BY `aria-checked` ALONE. A WAI-ARIA switch
 * reports its state through the attribute, but nothing about that attribute is visible — a
 * sighted reader pressing "İzledim" needs to SEE the toggle answer back.
 *
 * OLIVE, NOT TERRACOTTA (İRİS idea B2/video-wall): `BenchStage` renders the "İzle" overlay
 * button (`Button variant="primary"`, terracotta) immediately above this toggle in the same
 * stage column, and the two controls are genuinely different weight — a primary call to action
 * vs. a secondary self-declaration toggle — so sharing one fill made them read as equally
 * important. `bg-secondary`/`text-secondary-foreground` measure **5.89:1 light / 5.37:1 dark**,
 * and the fill separates from the page's `--background` at **5.56:1 light / 5.94:1 dark**.
 *
 * WHY THE HOVER IS `bg-secondary/90` AND NOT THE STYLESHEET'S `filter: brightness(0.88)`, and
 * this is a MEASURED correction rather than a preference. `brightness()` scales the fill AND
 * the ink together. Over the retired frozen pair (white ink on #4f6d30) that landed at 5.36:1,
 * which is what the stylesheet's own note recorded. Over the BRIDGE pair it does not: dark
 * mode's `--secondary-foreground` is `--color-ink-dark` (#211c19), so darkening both leaves
 * **4.39:1** — under AA for a 14px/600 label. `bg-secondary/90` is the same composition
 * `Button`'s own `secondary` variant uses, touches only the fill, and measures **4.76:1 light /
 * 4.57:1 dark** for the label with the fill still at 4.49:1 / 5.06:1 against `--background`.
 *
 * THE HOVER FILL HAS TO BE RESTATED HERE. The stylesheet's `.watchedToggle[aria-checked="true"]`
 * was an UNLAYERED CSS-Module selector and therefore beat `buttonVariants`' own layered
 * `hover:bg-muted`. These are Tailwind utilities now, so the outline variant's hover would win
 * on source order for anything this string does not name — `tailwind-merge` resolves
 * `hover:bg-muted` against `hover:bg-secondary/90`, not against the resting `bg-secondary`.
 * Verified against the computed hover fill in both themes rather than assumed.
 *
 * NOT COLOUR ALONE (`docs/design.md`): the `before:content-['✓']` glyph pairs with the fill, so
 * the state still reads for someone who cannot distinguish the two. Decorative either way — the
 * control's accessible name already carries the state through its two `aria-label`s.
 */
const WATCHED_TOGGLE_CHECKED =
  "border-secondary bg-secondary text-secondary-foreground hover:border-secondary " +
  "hover:bg-secondary/90 before:content-['✓'] before:font-bold";

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
    <div className={PROGRESS_CONTROLS}>
      {/* A resume-position line states a FACT about THIS reader's own saved position — never a
          coverage ratio across the catalogue (`CONTENT-STYLE.md` §22's "eksik-vurgusu" ban).
          Omitted entirely at 0: "resume from 0:00" tells the reader nothing they do not
          already know from the cover itself. */}
      {known !== null && known.lastPositionSeconds > 0 && (
        <p className={RESUME_LINE}>
          {t("resumeLine", { time: formatDuration(known.lastPositionSeconds) })}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        role="switch"
        aria-checked={watched}
        className={cn(WATCHED_TOGGLE, watched && WATCHED_TOGGLE_CHECKED)}
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
      </Button>
    </div>
  );
}
