import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

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
  return stripComments(source);
}

const PAGE = code(sourceOf("../../app/[locale]/(site)/oyun/page.tsx"));

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

/**
 * (b) and (c) guarded `GameHistoryPanel` itself — that its fetch lived inside a `useEffect`
 * gated on `authState`, and that each row keyed on the composite `clientRoundId+createdAt`
 * expression with a screen-reader label on the score.
 *
 * The V2 rewrite did not port the game-history feature, and T-032 PR4 deleted the component.
 * Both describe blocks went with it: their subject is gone, and re-expressing them against a
 * page that renders nothing would assert nothing.
 *
 * (a) stays, and is the reason this file does. It is not about the panel — it is about
 * `/oyun`, which is still the game surface's one indexable page, and it now covers EVERY prop
 * the page passes rather than the panel's three. An identity-conditioned server response there
 * is a SEO-POLICY §B12 12.3.a/b cloaking BLOCKER whatever island is mounted.
 */
