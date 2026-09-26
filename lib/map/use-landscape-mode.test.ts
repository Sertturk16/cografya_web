import { describe, expect, it } from "vitest";
import {
  FALLBACK_STYLE,
  isDocumentFullscreen,
  pickExitFullscreen,
  pickFullscreenRequest,
  shouldShowRotateHint,
} from "./use-landscape-mode.client";

/**
 * The DOM-free half of `useLandscapeMode` (T-015): everything the hook itself cannot be
 * unit-tested for, this repo's vitest environment being `node` with no jsdom
 * (`map-zoom-pan.contract.test.ts` documents the same constraint for the sibling zoom/pan
 * island). Plain object literals stand in for the browser globals — every function here reads
 * only the couple of properties it names, never a real `Element`/`Document`.
 */

describe("pickFullscreenRequest", () => {
  it("prefers the standard method when both exist", () => {
    let calledStandard = false;
    const el = {
      requestFullscreen: () => {
        calledStandard = true;
      },
      webkitRequestFullscreen: () => {
        throw new Error("must not be called");
      },
    };
    pickFullscreenRequest(el)?.();
    expect(calledStandard).toBe(true);
  });

  it("falls back to the webkit-prefixed method (older Safari)", () => {
    let calledPrefixed = false;
    const el = {
      webkitRequestFullscreen: () => {
        calledPrefixed = true;
      },
    };
    pickFullscreenRequest(el)?.();
    expect(calledPrefixed).toBe(true);
  });

  it("returns null when neither exists (iOS Safari on iPhone)", () => {
    expect(pickFullscreenRequest({})).toBeNull();
  });
});

describe("pickExitFullscreen", () => {
  it("prefers the standard method", () => {
    let calledStandard = false;
    const doc = {
      exitFullscreen: () => {
        calledStandard = true;
      },
      webkitExitFullscreen: () => {
        throw new Error("must not be called");
      },
    };
    pickExitFullscreen(doc)?.();
    expect(calledStandard).toBe(true);
  });

  it("returns null when neither exists", () => {
    expect(pickExitFullscreen({})).toBeNull();
  });
});

describe("isDocumentFullscreen", () => {
  it("is true when either spelling of the fullscreen element is set", () => {
    expect(isDocumentFullscreen({ fullscreenElement: {} })).toBe(true);
    expect(isDocumentFullscreen({ webkitFullscreenElement: {} })).toBe(true);
  });

  it("is false when neither is set", () => {
    expect(isDocumentFullscreen({ fullscreenElement: null, webkitFullscreenElement: null })).toBe(
      false,
    );
  });
});

describe("shouldShowRotateHint", () => {
  it("shows only when active, still portrait, and a coarse (touch) pointer", () => {
    expect(shouldShowRotateHint({ active: true, isPortrait: true, isCoarsePointer: true })).toBe(
      true,
    );
  });

  it("stays quiet once the device actually rotated to landscape", () => {
    expect(shouldShowRotateHint({ active: true, isPortrait: false, isCoarsePointer: true })).toBe(
      false,
    );
  });

  it("stays quiet before landscape mode was entered", () => {
    expect(shouldShowRotateHint({ active: false, isPortrait: true, isCoarsePointer: true })).toBe(
      false,
    );
  });

  it("stays quiet on a mouse-driven desktop window, even if tall and narrow", () => {
    expect(shouldShowRotateHint({ active: true, isPortrait: true, isCoarsePointer: false })).toBe(
      false,
    );
  });
});

describe("fallback layout colour", () => {
  it("paints the fallback with the theme background, which dark mode redefines", () => {
    // `--color-bg` is the light parchment only; `--background` is what `.dark` switches.
    expect(FALLBACK_STYLE.background).toBe("var(--background)");
  });

  it("names every property the way `style.setProperty` reads it, so none is silently dropped", () => {
    // `setProperty("zIndex", …)` is a no-op: it takes CSS names. The fallback sat under the
    // page's header and the content after the map until this was `z-index` (T-118).
    for (const prop of Object.keys(FALLBACK_STYLE)) {
      expect(prop, prop).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
    expect(FALLBACK_STYLE["z-index"]).toBe("1000");
  });
});
