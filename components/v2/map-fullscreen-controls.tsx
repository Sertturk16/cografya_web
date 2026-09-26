"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";

/**
 * The atlas maps' fullscreen controls (T-118), shared by `/dunya` and `/turkiye`: the top-left
 * toggle, the rotate-your-phone hint, and the inline layout a surface switches to while
 * `useLandscapeMode().active`. The game and tool pages keep their own copies (T-015).
 *
 * Inline styles, not conditional classes, for the reasons `v2-game-screen.tsx` gives beside its
 * `LANDSCAPE_FILL`: they beat `aspect-*` / `min-h-*` without relying on Tailwind's emit order, and
 * a `${…}` className hides the plate's `aspect-[…]` from the composition scanner.
 */

/** Gap between a fullscreen overlay and the screen edge, in CSS px (`top-3`/`left-3`). */
const EDGE_PX = 12;
/** Gap between two overlays stacked in one corner. */
const STACK_GAP_PX = 8;
/** The credit's ⓘ button in the bottom-right corner (`size-8`, `map-attribution.tsx`). */
const CREDIT_BUTTON_PX = 32;

/** The fullscreen target itself. A real Fullscreen API session paints the element over a black
 *  `::backdrop`, so the page background is set here too, not only by the hook's CSS fallback. */
export const FULLSCREEN_FIGURE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  background: "var(--background)",
};

/** The positioning box around the map: fills the screen and centres a height-capped map. */
export const FULLSCREEN_STAGE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  flex: "1 1 0%",
  minHeight: 0,
};

/** The map box: the whole stage, no corner radius or border against straight screen edges. */
export const FULLSCREEN_MAP_BOX: React.CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  aspectRatio: "auto",
  borderRadius: 0,
  borderWidth: 0,
};

/** A toolbar that sits above the map on a phone floats over its top-right corner instead. */
export const FULLSCREEN_TOOLBAR: React.CSSProperties = {
  position: "absolute",
  top: EDGE_PX,
  right: EDGE_PX,
  zIndex: 30,
  margin: 0,
};

/**
 * The selection card over the bottom-left corner at every width, narrow enough to leave the
 * credit's ⓘ clear, and above the rotate hint while that shows (it is bottom-centre, `z-40`).
 */
export function fullscreenCardStyle(rotateHintHeight: number): React.CSSProperties {
  return {
    position: "absolute",
    left: EDGE_PX,
    bottom: rotateHintHeight > 0 ? EDGE_PX + rotateHintHeight + STACK_GAP_PX : EDGE_PX,
    zIndex: 30,
    margin: 0,
    maxWidth: `min(24rem, calc(100% - ${EDGE_PX + CREDIT_BUTTON_PX + STACK_GAP_PX + EDGE_PX}px))`,
  };
}

/**
 * ONE control for both directions, rendered inside the map box: once the Fullscreen API engages
 * only the target's subtree is on screen, so an exit control outside it would be unreachable.
 * Sized like the atlas toolbar's buttons so the two bars line up across the top edge.
 */
export function MapFullscreenToggle({
  active,
  onToggle,
  ref,
}: {
  active: boolean;
  onToggle: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("MapExplorer");
  return (
    <div
      ref={ref}
      // A press on the control must not start a pan on the map under it.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-3 left-3 z-30 flex bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label={active ? t("fullscreenExit") : t("fullscreenEnter")}
        className="size-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        {active ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </button>
    </div>
  );
}

/**
 * "Rotate your phone" (T-015): shown by the caller only while `landscape.showRotateHint`. Reports
 * its height so the selection card can sit above it. `onHeight` must be stable (a state setter).
 * As wide as its text, but never into the bottom corners (12px edge + 32px ⓘ + 8px gap a side):
 * on iOS it stays up for the whole portrait session and would otherwise cover the credit's ⓘ.
 */
export function MapRotateHint({
  onDismiss,
  onHeight,
}: {
  onDismiss: () => void;
  onHeight: (px: number) => void;
}) {
  const t = useTranslations("MapExplorer");
  const measure = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const observer = new ResizeObserver(() => onHeight(el.offsetHeight));
      observer.observe(el);
      return () => {
        observer.disconnect();
        onHeight(0);
      };
    },
    [onHeight],
  );
  return (
    <div
      ref={measure}
      role="status"
      aria-live="polite"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 w-max max-w-[calc(100%-104px)] flex items-center gap-2.5 bg-ink-dark/95 text-white px-3.5 py-2 rounded-2xl shadow-2xl text-xs"
    >
      <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
      <span>{t("rotateHint")}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 px-2 py-1 rounded-lg border border-white/40 hover:bg-white/10 transition-colors cursor-pointer"
      >
        {t("rotateDismiss")}
      </button>
    </div>
  );
}
