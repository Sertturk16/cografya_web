import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LockIcon } from "./lock-icon";

/**
 * Byte-identity regression proof for SIMP96-M2's consolidation (`Owner's Inbox/
 * pr-review-archive/cografya_web-96.md`): before `components/lock-icon.tsx` existed,
 * `components/game/game-icons.tsx`'s `LockIcon` and `components/favorites/favorite-button.tsx`'s
 * own private `LockIcon` each drew this silhouette independently. The two "baseline" components
 * below are the EXACT pre-consolidation JSX from each file, reproduced verbatim as a fixed
 * historical reference — never imported from the real files, so this test cannot start silently
 * comparing the shared component's output against itself if either ever drifts.
 * `renderToStaticMarkup` (`react-dom/server`) needs no jsdom (`FU-WEB-JSDOM`): it is pure
 * server-side string building, not DOM, so it runs fine under this repo's bare `node` vitest
 * environment.
 */

function OutlineBaseline({ size = 24 }: { readonly size?: number }) {
  // Pre-refactor components/game/game-icons.tsx: Glyph({ size = 24 }) wrapping LockIcon's two
  // children, reproduced verbatim (game-icons.tsx:21-38 + 96-103 as read 2026-08-28).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 10.5V7.5a6 6 0 1 1 12 0v3" />
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    </svg>
  );
}

function CompactBaseline({ className }: { readonly className?: string }) {
  // Pre-refactor components/favorites/favorite-button.tsx's own private LockIcon(), reproduced
  // verbatim (favorite-button.tsx:179-199 as read 2026-08-28).
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M5 7V5a3 3 0 0 1 6 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="3.5" y="7" width="9" height="6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

describe("LockIcon consolidation is byte-identical to each pre-refactor call site (SIMP96-M2)", () => {
  it("outline variant at its default size — game-icons.tsx's old Glyph-wrapped LockIcon called with no size prop", () => {
    expect(renderToStaticMarkup(<LockIcon variant="outline" />)).toBe(
      renderToStaticMarkup(<OutlineBaseline />),
    );
  });

  it("outline variant, size=14 — the exact call game-round-save.tsx makes (`<LockIcon size={14} />`)", () => {
    expect(renderToStaticMarkup(<LockIcon variant="outline" size={14} />)).toBe(
      renderToStaticMarkup(<OutlineBaseline size={14} />),
    );
  });

  it("compact variant with no className — favorite-button.tsx's old private LockIcon took no props at all", () => {
    expect(renderToStaticMarkup(<LockIcon variant="compact" />)).toBe(
      renderToStaticMarkup(<CompactBaseline />),
    );
  });

  it("compact variant with a className — the exact call the favorites call site now makes, passing styles.lockIcon through", () => {
    expect(renderToStaticMarkup(<LockIcon variant="compact" className="lockIcon_abc123" />)).toBe(
      renderToStaticMarkup(<CompactBaseline className="lockIcon_abc123" />),
    );
  });
});
