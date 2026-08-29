import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * CROSS-FILE TRIPWIRE for the header's nav-collapse breakpoint (→ PR #103 review `TA103-I1`).
 *
 * Three files carry the SAME breakpoint as three independent `@media (min-width: Xrem)`
 * literals — `site-header.module.css`, `site-nav/site-nav.module.css`,
 * `site-search/site-search.module.css` — and none of them is derived from a shared constant.
 * `DESIGN.md` §4 explains why the number itself is written nowhere in prose: it moved twice
 * already (66rem → 70rem most recently, PR-2 of `anasayfa-yenileme`), and a hardcoded copy
 * inside a comment is exactly what went stale both times a nav link count changed
 * (`CODE62-M1`). `nav-group-disclosure.test.ts` already guards that `site-nav.module.css`
 * carries exactly ONE such block internally, but nothing before this file compared the THREE
 * files' values to EACH OTHER.
 *
 * Concrete failure this closes: a future PR changes only ONE of the three files (say
 * `site-header.module.css`, 70rem → 72rem, for a ninth nav link). Typecheck, lint, build and
 * the rest of this suite all stay green — nothing else reads across these three files. But in
 * the real 70rem–72rem width band the header falls into a broken hybrid: the trigger hides
 * per `site-nav.module.css`'s still-70rem rule while `site-header.module.css`'s `.inner`
 * keeps its mobile `flex-wrap: nowrap` fix (and `site-search.module.css`'s
 * `margin-left: auto` fix) active per its own new 72rem threshold — the inline nav and the
 * single-row mobile layout fighting for the same row at once.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts the three literals are EQUAL to each
 * other, never what the shared value actually is — the number is FOUND, not spelled out here,
 * mirroring `nav-group-disclosure.test.ts`'s own reasoning so the next re-measurement (this
 * exact breakpoint's own precedent: 66rem → 70rem) cannot silently desync this guard from the
 * real value the way a hardcoded copy would.
 */

const FILES = [
  { label: "site-header.module.css", url: new URL("./site-header.module.css", import.meta.url) },
  {
    label: "site-nav/site-nav.module.css",
    url: new URL("./site-nav/site-nav.module.css", import.meta.url),
  },
  {
    label: "site-search/site-search.module.css",
    url: new URL("./site-search/site-search.module.css", import.meta.url),
  },
] as const;

/** CSS comments are stripped before every scan — this stylesheet family documents its own
 *  breakpoint at length (including the literal `@media (min-width: 70rem)` string in prose),
 *  and a rule quoted inside a comment must never satisfy a source-text guard (the PR-A CR-S2
 *  lesson, reused by `anchor-offset-token.test.ts` and `nav-group-disclosure.test.ts`). */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, " ");

/** Each file carries exactly one real (non-comment) `@media (min-width: …rem)` block for the
 *  nav-collapse breakpoint — verified below rather than assumed, the same anchoring discipline
 *  `nav-group-disclosure.test.ts` applies to `site-nav.module.css` alone. */
const MEDIA_QUERY = /@media \(min-width:\s*(\d+(?:\.\d+)?)rem\)/g;

const breakpoints = FILES.map(({ label, url }) => {
  const css = stripComments(readFileSync(fileURLToPath(url), "utf8"));
  const matches = [...css.matchAll(MEDIA_QUERY)];
  return { label, css, matches, value: matches[0]?.[1] };
});

describe("the header's nav-collapse breakpoint stays identical across all three files", () => {
  it.each(breakpoints)("$label declares exactly one nav-collapse media query", ({ matches }) => {
    // Anchors every assertion below: a renamed/removed/duplicated media query fails here
    // instead of letting `value` silently become `undefined` (or an unintended second match)
    // and the equality check below pass vacuously.
    expect(matches).toHaveLength(1);
  });

  it("carries the exact same breakpoint value in all three files", () => {
    const values = breakpoints.map(({ value }) => value);
    const [first, ...rest] = values;
    expect(first).toBeDefined();
    expect(rest.every((value) => value === first)).toBe(true);
  });
});
