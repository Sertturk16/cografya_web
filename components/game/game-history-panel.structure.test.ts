import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SEO-INVARIANCE GUARD (UYELIK-10 plan §5.7/§9/§10 item 4) — the concrete, TESTABLE form of
 * `SEO-POLICY.md` §B12 12.3.a/b (cloaking): an indexing signal or the server-rendered body
 * must never change by identity. `/oyun` is the game surface's ONE indexable page (its own
 * docblock), so this is the one page in the whole surface where an identity-conditioned
 * server response would be a BLOCKER, not a stylistic nitpick.
 *
 * SOURCE-SCAN, the `favorite-button.structure.test.ts`/`game-island.early-finish.test.ts`
 * pattern — this repo's vitest environment is a bare `node` environment with no jsdom.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip comments: this scan must read CODE, not this file's (or the scanned files' own)
 *  prose about `cookies()`/`headers()` — the same `game-island.early-finish.test.ts`
 *  precedent. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const PAGE = code(sourceOf("../../app/[locale]/(site)/oyun/page.tsx"));
const PANEL = code(sourceOf("./game-history-panel.tsx"));

describe("(a) app/[locale]/(site)/oyun/page.tsx never reads identity server-side", () => {
  it("carries no cookies() or headers() call anywhere in its source", () => {
    expect(PAGE).not.toMatch(/\bcookies\s*\(/);
    expect(PAGE).not.toMatch(/\bheaders\s*\(/);
  });

  it("does not import next/headers", () => {
    expect(PAGE).not.toContain('from "next/headers"');
  });

  it("passes no identity-derived prop to anything it renders", () => {
    /**
     * This named `GameHistoryPanel` specifically, because that was the one identity-aware island
     * the page mounted, and the rule was: it gets locale-derived props and nothing else, so the
     * server response cannot vary by who is asking (§B12 12.3.a/b, cloaking).
     *
     * The V2 page does not render the panel at all — the game-history feature did not survive
     * the rewrite (T-032 PR4 deletes `components/game/`). Pinning the call site would just fail;
     * asserting nothing would drop a BLOCKER-tier rule on a page that is still indexable.
     *
     * So the assertion widened from ONE island's props to EVERY prop the page passes. That is
     * strictly stronger: it now also covers whatever island replaces the panel, without anyone
     * having to remember to re-add a check for it.
     */
    const props = [...PAGE.matchAll(/\s([A-Za-z][A-Za-z0-9]*)=\{/g)].map((match) => match[1]!);
    // Anti-vacuity: a page that passed no props at all would satisfy the loop for free.
    expect(props.length, "props passed anywhere on the page").toBeGreaterThan(0);
    for (const prop of props) {
      expect(prop, `identity-derived prop "${prop}" on an indexable page`).not.toMatch(
        /auth|session|cookie|user|identity/i,
      );
    }
    // And the panel really is gone, rather than renamed past the scan above.
    expect(PAGE).not.toContain("<GameHistoryPanel");
  });
});

describe("(b) GameHistoryPanel's data fetch is client-side, inside useEffect, never at module/render top level", () => {
  it('is a "use client" module', () => {
    expect(PANEL.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("calls fetchGameRounds only inside a useEffect callback, never at the top of the component body", () => {
    const effectStart = PANEL.indexOf("useEffect(() => {");
    const effectEnd = PANEL.indexOf("}, [authState]);");
    const fetchCall = PANEL.indexOf("fetchGameRounds(");
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(effectStart);
    expect(fetchCall).toBeGreaterThan(effectStart);
    expect(fetchCall).toBeLessThan(effectEnd);
  });

  it("gates the fetch on authState === authenticated, inside the effect", () => {
    const effectStart = PANEL.indexOf("useEffect(() => {");
    const effectEnd = PANEL.indexOf("}, [authState]);");
    const body = PANEL.slice(effectStart, effectEnd);
    expect(body).toContain('if (authState !== "authenticated") return;');
  });

  it("never calls fetchGameRounds outside any function (module top level)", () => {
    // Every occurrence of the call must be preceded, somewhere earlier in the file, by the
    // useEffect opener that is its only legitimate call site.
    const effectStart = PANEL.indexOf("useEffect(() => {");
    const allCalls = [...PANEL.matchAll(/fetchGameRounds\(/g)].map((m) => m.index ?? -1);
    expect(allCalls.length).toBeGreaterThan(0);
    for (const index of allCalls) {
      expect(index).toBeGreaterThan(effectStart);
    }
  });
});

// CODE96-M2 / TEST96R2-M1 (PR #96 round-2 fix commit, `Owner's Inbox/pr-review-archive/
// cografya_web-96-round2.md`): the row `key` moved from bare `round.clientRoundId` to the
// composite `${round.clientRoundId}-${round.createdAt}` expression, and a sr-only
// `t("statScore")` label was added before the score number — neither had a committed
// regression test.
describe("(c) each row keys on the composite clientRoundId+createdAt expression, and the score carries a sr-only label", () => {
  it("keys the row on the composite `${round.clientRoundId}-${round.createdAt}` expression, not clientRoundId alone", () => {
    expect(PANEL).toContain("key={`${round.clientRoundId}-${round.createdAt}`}");
  });

  it("renders a sr-only statScore label before the score value", () => {
    const srOnlyIndex = PANEL.indexOf("className={styles.srOnly}");
    const scoreIndex = PANEL.indexOf("className={styles.score}");
    expect(srOnlyIndex).toBeGreaterThan(-1);
    expect(scoreIndex).toBeGreaterThan(srOnlyIndex);
    const label = PANEL.slice(srOnlyIndex, scoreIndex);
    expect(label).toContain('t("statScore")');
  });
});
