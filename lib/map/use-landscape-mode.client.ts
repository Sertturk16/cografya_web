"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * "Yatay Modda Oyna" — shared fullscreen + landscape-orientation entry for the two map/game
 * surfaces that are cramped by portrait height on a phone (`v2-game-screen.tsx`,
 * `v2-tool-workbench.tsx`; T-015). One hook rather than two copies, because the browser-quirk
 * handling below (three fullscreen vendor prefixes, an orientation-lock call that may not
 * exist at all, iOS Safari supporting neither) is exactly the kind of logic that drifts
 * silently when duplicated.
 *
 * THE CORE POSTURE: entry is an explicit user action (a button calling `enter`/`toggle`),
 * never an unrequested auto-rotate. `active` flips to `true` immediately on `enter()` and
 * drives a CSS fixed-position layout on the target element even where the Fullscreen API and
 * the Orientation Lock API are both unavailable (iOS Safari on iPhone has neither) — so the
 * feature degrades to "a bigger, still-portrait-capable layout with a rotate hint" rather than
 * silently doing nothing. `showRotateHint` is the friendly nudge for exactly that case: shown
 * only once landscape mode is active, the viewport is still portrait, AND the device has a
 * coarse (touch) pointer — a mouse-driven desktop window resized to a tall aspect is not a
 * "please rotate your phone" situation.
 *
 * NO DOM ACCESS AT MODULE SCOPE (this repo's vitest environment is `node`, no jsdom —
 * `map-zoom-pan.contract.test.ts` documents the same constraint for the sibling zoom/pan
 * island). Every `window`/`document`/`screen` read lives inside a hook effect or callback;
 * the vendor-prefix lookups below are exported as plain functions so they can be unit-tested
 * against plain object literals instead.
 */

/** The subset of `Element.requestFullscreen` this hook needs, plus the Safari-era prefix. */
interface FullscreenRequestable {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/** The subset of `document` this hook needs to read/exit fullscreen, prefix included. */
interface FullscreenDocumentLike {
  fullscreenElement?: unknown;
  webkitFullscreenElement?: unknown;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
}

/**
 * `ScreenOrientation.lock` is real in every Chromium/Android browser but is not part of
 * TypeScript's `lib.dom.d.ts` (only `unlock` is) — it is still an experimental API. Named
 * here instead of a repo-wide ambient override so the gap stays local to the one place that
 * calls it.
 */
interface OrientationLockable {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>;
}

/** Pick whichever fullscreen entry point the element actually exposes, bound to it. */
export function pickFullscreenRequest(
  el: FullscreenRequestable,
): (() => Promise<void> | void) | null {
  if (typeof el.requestFullscreen === "function") return el.requestFullscreen.bind(el);
  if (typeof el.webkitRequestFullscreen === "function") return el.webkitRequestFullscreen.bind(el);
  return null;
}

/** Pick whichever fullscreen exit point the document actually exposes, bound to it. */
export function pickExitFullscreen(
  doc: FullscreenDocumentLike,
): (() => Promise<void> | void) | null {
  if (typeof doc.exitFullscreen === "function") return doc.exitFullscreen.bind(doc);
  if (typeof doc.webkitExitFullscreen === "function") return doc.webkitExitFullscreen.bind(doc);
  return null;
}

/** True while any element on `doc` is the fullscreen element, either spelling. */
export function isDocumentFullscreen(doc: FullscreenDocumentLike): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/**
 * Whether the "rotate your device" banner should show. Pure so the decision — landscape mode
 * is on, the viewport is still portrait, and the pointer is coarse (a touchscreen, not a
 * resized desktop window) — is unit-testable without a DOM.
 */
export function shouldShowRotateHint(params: {
  active: boolean;
  isPortrait: boolean;
  isCoarsePointer: boolean;
}): boolean {
  return params.active && params.isPortrait && params.isCoarsePointer;
}

export interface LandscapeMode {
  /** Landscape/fullscreen mode is on (regardless of whether real Fullscreen API engaged). */
  active: boolean;
  /** True only when the browser's own Fullscreen API is actually engaged. */
  isFullscreen: boolean;
  /** Show the "rotate your device" nudge — see `shouldShowRotateHint`. */
  showRotateHint: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

/**
 * Inline styles applied to the target element as the CSS-only fallback layout, used whenever
 * the Fullscreen API is unavailable or its request rejects. Individual properties are saved
 * and restored (not the whole `style` attribute) so this never clobbers styling the caller's
 * own render already put on the element (e.g. `game-map.tsx`'s `--game-stage-aspect`).
 *
 * Keys are CSS property names, not camelCase: `style.setProperty("zIndex", …)` is a silent no-op,
 * which left this layout under the page's header and the content after the map (T-118).
 *
 * Sized by the four insets alone: iOS Safari's `100vh` is the toolbar-hidden height, so a
 * `height: 100vh` box ran under the bottom address bar with everything anchored to its bottom.
 */
export const FALLBACK_STYLE: Readonly<Record<string, string>> = {
  position: "fixed",
  top: "0",
  left: "0",
  right: "0",
  bottom: "0",
  "z-index": "1000",
  background: "var(--background)",
  margin: "0",
};

function screenOrientationOf(win: Window): (OrientationLockable & { unlock?: () => void }) | null {
  const orientation = win.screen?.orientation as
    (OrientationLockable & { unlock?: () => void }) | undefined;
  return orientation ?? null;
}

/**
 * `isPortrait`/`isCoarsePointer` read through `useSyncExternalStore` rather than `useState` +
 * a `useEffect` that calls `setState` synchronously in its body to seed the initial value —
 * the latter is a real lint error under this repo's `react-hooks/set-state-in-effect` rule,
 * not a style preference: `matchMedia(...).matches` IS external, subscribable state, which is
 * exactly what `useSyncExternalStore` exists for.
 */
function subscribeMediaQuery(query: string) {
  return (onChange: () => void): (() => void) => {
    if (typeof window === "undefined") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}
function readMediaQuery(query: string) {
  return (): boolean => (typeof window === "undefined" ? false : window.matchMedia(query).matches);
}
const getServerSnapshotFalse = () => false;

const subscribePortrait = subscribeMediaQuery("(orientation: portrait)");
const readPortrait = readMediaQuery("(orientation: portrait)");
const subscribeCoarsePointer = subscribeMediaQuery("(pointer: coarse)");
const readCoarsePointer = readMediaQuery("(pointer: coarse)");

/**
 * `containerRef` is whichever element should fill the screen and (ideally) rotate — the CBS
 * canvas's own container in `v2-tool-workbench.tsx`, or the game arena card in
 * `v2-game-screen.tsx`. Either way, this hook only needs *an* element ref; it never assumes
 * anything about what else lives inside it.
 */
export function useLandscapeMode(containerRef: React.RefObject<HTMLElement | null>): LandscapeMode {
  const [active, setActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isPortrait = useSyncExternalStore(subscribePortrait, readPortrait, getServerSnapshotFalse);
  const isCoarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    readCoarsePointer,
    getServerSnapshotFalse,
  );
  const savedStyleRef = useRef<Map<string, string> | null>(null);

  const applyFallback = useCallback(
    (on: boolean) => {
      const el = containerRef.current;
      if (!el) return;
      if (on) {
        const saved = new Map<string, string>();
        for (const prop of Object.keys(FALLBACK_STYLE)) {
          saved.set(prop, el.style.getPropertyValue(prop));
        }
        savedStyleRef.current = saved;
        for (const [prop, value] of Object.entries(FALLBACK_STYLE)) {
          el.style.setProperty(prop, value);
        }
      } else {
        const saved = savedStyleRef.current;
        if (saved) {
          for (const [prop, value] of saved) {
            if (value) el.style.setProperty(prop, value);
            else el.style.removeProperty(prop);
          }
        }
        savedStyleRef.current = null;
      }
    },
    [containerRef],
  );

  const exit = useCallback(() => {
    setActive(false);
    if (isDocumentFullscreen(document)) {
      pickExitFullscreen(document)?.();
    }
    applyFallback(false);
    screenOrientationOf(window)?.unlock?.();
  }, [applyFallback]);

  const enter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setActive(true);
    const request = pickFullscreenRequest(el);
    if (request) {
      Promise.resolve(request()).catch(() => {
        // Denied, or unsupported despite existing (rare Safari/iPadOS quirk) — the fixed
        // layout below is what makes this a graceful degrade rather than a dead button.
        applyFallback(true);
      });
    } else {
      applyFallback(true);
    }
    // Best-effort only. iOS Safari and every desktop browser reject or lack this outright;
    // `showRotateHint` is the fallback UI for exactly that case, not an error path.
    screenOrientationOf(window)
      ?.lock?.("landscape")
      .catch(() => {});
  }, [containerRef, applyFallback]);

  const toggle = useCallback(() => {
    if (active) exit();
    else enter();
  }, [active, enter, exit]);

  useEffect(() => {
    // Leaving fullscreen by any route OTHER than our own `exit()` (Esc, the browser's own
    // "leave fullscreen" chrome, a back-gesture) must still drop `active` and the fallback
    // style — otherwise the fixed-position layout and the rotate hint outlive the fullscreen
    // session they were entered alongside.
    const onFullscreenChange = () => {
      const fs = isDocumentFullscreen(document);
      setIsFullscreen(fs);
      if (!fs) {
        setActive(false);
        applyFallback(false);
        screenOrientationOf(window)?.unlock?.();
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [applyFallback]);

  // Unmount safety net: a client-side route change must never leave the page stuck fullscreen
  // or orientation-locked.
  useEffect(() => {
    return () => {
      if (isDocumentFullscreen(document)) pickExitFullscreen(document)?.();
      screenOrientationOf(window)?.unlock?.();
    };
  }, []);

  return {
    active,
    isFullscreen,
    showRotateHint: shouldShowRotateHint({ active, isPortrait, isCoarsePointer }),
    enter,
    exit,
    toggle,
  };
}
