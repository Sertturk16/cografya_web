import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY } from "@/lib/tools/tool-registry";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * The `/araclar` hub's tool cards: every registered tool is reachable from the hub, through a
 * visible affordance, with a focus ring that belongs to the thing being focused.
 *
 * ## What changed under this test, and why it is not a loosening
 *
 * V1 built each card as a stretched anchor: `.toolCard { position: relative }` plus an empty,
 * edge-to-edge `.toolName a::after` that grew the ~16-character link's click target to the whole
 * card, plus a `:has(.toolName a:focus-visible)` ring scoped to that specific link rather than
 * `:focus-within` (which had already cost this repo a defect once, on
 * `components/auth/auth-form.module.css`). Those three pieces only work together, so this file
 * pinned all three in `araclar/tools.module.css`.
 *
 * V2 does not use a stretched anchor. Each card ends in a real CTA button inside a `<Link>`
 * ("Mesafe Aracını Başlat"), which is an explicit affordance rather than an invisible pseudo-
 * element, and it carries the focus ring natively — there is nothing to scope and nothing to
 * suppress. `tools.module.css` outlived that claim and was deleted by T-042, so the three CSS pins
 * have no file to read.
 *
 * What was never really about the CSS is the reachability: a tool in the register that the hub
 * does not link is a page only the sitemap knows about. V1 got that for free because the cards
 * were generated from `TOOL_REGISTRY`; V2 hand-writes three cards, so it can silently fall behind
 * the register — which is the failure this file now guards, against the register itself.
 *
 * Source-read rather than rendered: node env, no jsdom (`FU-WEB-JSDOM`), async server components.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * Source with comments removed. Every absence check below runs against this: the component's
 * docblocks name the identifiers under test, and prose about a rule is not the rule.
 */
const code = stripComments;

const hubHtml = code(read("./v2-tools-hub.tsx"));

describe("the hub reaches every registered tool", () => {
  it("links each tool in TOOL_REGISTRY", () => {
    // Anti-vacuity: an empty register would satisfy the loop for free.
    expect(TOOL_REGISTRY.length, "TOOL_REGISTRY entries").toBeGreaterThan(0);
    for (const tool of TOOL_REGISTRY) {
      expect(hubHtml, `hub does not link ${tool.pathname}`).toContain(`href="${tool.pathname}"`);
    }
  });

  it("links each one exactly once, so a card is not silently duplicated or orphaned", () => {
    for (const tool of TOOL_REGISTRY) {
      const hits = hubHtml.match(new RegExp(`href="${tool.pathname}"`, "g")) ?? [];
      expect(hits, `${tool.pathname} link count`).toHaveLength(1);
    }
  });

  it("uses the typed Link, never a bare anchor", () => {
    // `@/i18n/navigation`, per the repo's hard rule — a raw <a> skips the locale prefix.
    expect(hubHtml).toContain('from "@/i18n/navigation"');
    expect(hubHtml).not.toMatch(/<a\s+href="\/araclar/);
  });
});

describe("the card's affordance is visible, not an invisible stretched target", () => {
  it("each tool link wraps a real CTA control", () => {
    // The V2 replacement for the stretched anchor. If a card's link ever shrinks back to a bare
    // text run with no visible control, that is the geometry regression the V1 `::after` rule
    // existed to prevent, arriving from the other direction.
    const links = hubHtml.match(/<Link\s+href="\/araclar\/[^"]+"[\s\S]{0,800}?<\/Link>/g) ?? [];
    expect(links.length, "tool CTA links").toBe(TOOL_REGISTRY.length);
    for (const link of links) {
      expect(link, "tool link with no visible control inside").toContain("<Button");
    }
  });

  it("does not suppress the focus ring on those links", () => {
    // V1 moved the ring onto the card and suppressed it on the inner link. V2's ring is the
    // button's own, so suppressing it here would leave the card unreachable by keyboard sight.
    expect(hubHtml).not.toMatch(/focus-visible:outline-none|outline-none[^"]*focus/);
  });
});
