import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The per-call-site resume shape, asserted uniformly across all four converted sites
 * (uyelik-auth-redesign plan §11.2): the source no longer contains a `/kayit` redirect, DOES
 * contain `requestAuth(` and `consumeResolved(`, and the gate's own `return;` still precedes
 * any save/open call — preserving the "never spends a save call while anonymous" property the
 * four pre-existing per-component structure tests already assert individually. This file is
 * the shared, cross-site view of that same property; the per-component files keep the
 * detailed, component-specific assertions (exact message keys, exact branch shapes).
 *
 * SOURCE-SCAN, the `favorite-button.structure.test.ts` pattern — this repo's vitest
 * environment is a bare `node` environment with no jsdom (`FU-WEB-JSDOM`).
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const SITES = [
  {
    label: "favorite-button.tsx",
    path: "../favorites/favorite-button.tsx",
    intent: "favorite",
  },
  {
    label: "game-round-save.tsx",
    path: "../game/game-round-save.tsx",
    intent: "gameRound",
  },
  {
    label: "tool-measurement-save.tsx",
    path: "../tools/tool-measurement-save.tsx",
    intent: "measurement",
  },
  {
    label: "video-bench.tsx",
    path: "../book/video-bench.tsx",
    intent: "video",
  },
] as const;

describe("every converted call site: no more /kayit redirect, opens the shared auth modal instead", () => {
  it.each(SITES)("$label", ({ path, intent }) => {
    const source = sourceOf(path);
    expect(source).not.toContain('href: "/kayit"');
    expect(source).not.toContain("getPathname");
    expect(source).toContain(`requestAuth("${intent}")`);
    expect(source).toContain("consumeResolved(");
  });
});

describe("every converted call site keeps a ref-held request id and watches modal.resolvedRequestId", () => {
  it.each(SITES)("$label", ({ path }) => {
    const source = sourceOf(path);
    expect(source).toMatch(/useRef<string \| null>\(null\)/);
    expect(source).toContain("modal.resolvedRequestId");
    expect(source).toContain("useAuthModalState");
  });
});

describe("every converted call site imports requestAuth/consumeResolved from the shared modal store, never a local reimplementation", () => {
  it.each(SITES)("$label", ({ path }) => {
    const source = sourceOf(path);
    expect(source).toContain('from "@/lib/auth/auth-modal.client"');
  });
});

describe("the header/footer auth links are DELIBERATELY untouched (plan §2.2/§3 — a hard non-goal, converting them would be an SEO regression)", () => {
  it("site-nav.tsx still renders real page links to /giris and /kayit", () => {
    const source = sourceOf("../site-nav/site-nav.tsx");
    expect(source).toContain('href="/giris"');
    expect(source).toContain('href="/kayit"');
    expect(source).not.toContain("requestAuth(");
  });

  it("site-footer.tsx still renders real page links to /giris and /kayit", () => {
    const source = sourceOf("../site-footer.tsx");
    expect(source).toContain('href="/giris"');
    expect(source).toContain('href="/kayit"');
    expect(source).not.toContain("requestAuth(");
  });
});
