import { describe, expect, it } from "vitest";
import { focusReturnTarget, type FocusReturnCandidate } from "./focus-return";

/**
 * A stand-in for an element as `focusReturnTarget` sees it. `rendered: false` is what
 * `display: none` gives — `getClientRects()` returns an empty list — which is exactly the
 * desktop trigger's state below the `sm` breakpoint.
 */
function el(
  name: string,
  { connected = true, rendered = true } = {},
): FocusReturnCandidate & {
  name: string;
} {
  return {
    name,
    isConnected: connected,
    getClientRects: () => ({ length: rendered ? 1 : 0 }),
  };
}

describe("focusReturnTarget", () => {
  it("returns the element that opened the dialog when it is still on screen", () => {
    const mobile = el("mobile");
    expect(focusReturnTarget([mobile, el("desktop", { rendered: false }), mobile])).toBe(mobile);
  });

  it("skips an opener that is in the DOM but not rendered (the desktop trigger at 390px)", () => {
    // The header's drawer opens search by clicking `[data-testid="global-search"]`, the desktop
    // trigger, which is `display: none` on a phone. Focusing it is a silent no-op, so the
    // visible trigger is the honest place to land.
    const desktop = el("desktop", { rendered: false });
    const mobile = el("mobile");
    expect(focusReturnTarget([desktop, desktop, mobile])).toBe(mobile);
  });

  it("skips an opener that has left the DOM (the drawer button that unmounted)", () => {
    const gone = el("drawer-button", { connected: false });
    const desktop = el("desktop");
    expect(focusReturnTarget([gone, desktop, el("mobile", { rendered: false })])).toBe(desktop);
  });

  it("tolerates empty slots — no opener recorded, a ref not attached yet", () => {
    const mobile = el("mobile");
    expect(focusReturnTarget([null, undefined, mobile])).toBe(mobile);
  });

  it("returns null when nothing is focusable, so the caller can fall back", () => {
    expect(focusReturnTarget([])).toBeNull();
    expect(
      focusReturnTarget([el("a", { rendered: false }), el("b", { connected: false }), null]),
    ).toBeNull();
  });
});
