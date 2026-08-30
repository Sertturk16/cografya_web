import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the `/araclar` hub's stretched-anchor card (PR #111 fix round,
 * TEST111-M1). The click-target geometry rests on three pieces moving together:
 *   1. `.toolCard` is `position: relative` — the containing block the stretch below needs.
 *   2. `.toolName a::after` is the empty, absolutely-positioned, edge-to-edge pseudo-element
 *      that actually stretches the click target to the whole card.
 *   3. The focus ring is scoped with `:has(.toolName a:focus-visible)`, not `:focus-within`
 *      (A11Y111-M1) — naming the specific link, not "any focused descendant", the exact
 *      defect class this repo already paid for once on a different component
 *      (`components/auth/auth-form.module.css`, `CODE88-M1`/`TEST88-I1`).
 *
 * None of this is renderable here — this repo's vitest environment is `node`, no jsdom
 * (`FU-WEB-JSDOM`) — so, following the pattern `auth-a11y.structure.test.ts` and
 * `air-pollution.structure.test.ts` already use for the sibling defect class, this is a
 * source-level guard: a future edit that drops `position: relative` from `.toolCard`, removes
 * the `::after` stretch rule, or widens the focus selector back to `:focus-within` fails HERE
 * instead of the click-target geometry or the focus ring silently regressing.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * Source with comments removed. Every "this string must be absent" assertion below runs
 * against this — the CSS file's own docblocks discuss the removed `:focus-within` selector by
 * name (recording why it was replaced), so an absence check against the raw source would fail
 * on the prose that explains the fix rather than on a real regression
 * (`air-pollution.structure.test.ts` names the same trap for its own file).
 */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");

const css = read("../../app/[locale]/araclar/tools.module.css");
const page = read("../../app/[locale]/araclar/page.tsx");
const cssCode = code(css);
const pageCode = code(page);

describe("the stretched-anchor's positioning context", () => {
  it("`.toolCard`'s own rule sets `position: relative`", () => {
    // The selector must be anchored so it cannot also match `.toolCard:hover` or
    // `.toolCard:has(...)` — both share the `.toolCard` prefix but are different rules.
    expect(cssCode).toMatch(/\.toolCard\s*\{[^}]*position\s*:\s*relative/);
  });

  it("`.toolCard` is the class actually applied to the rendered card (positive control — the selector under test corresponds to a real DOM hook, not an orphaned rule)", () => {
    expect(pageCode).toContain("className={`card ${styles.toolCard}`}");
  });
});

describe("the stretched anchor itself", () => {
  it("`.toolName a::after` is the empty, absolutely-positioned, edge-to-edge pseudo-element", () => {
    expect(cssCode).toMatch(
      /\.toolName a::after\s*\{[^}]*content\s*:\s*""[^}]*position\s*:\s*absolute[^}]*inset\s*:\s*0/,
    );
  });

  it("`.toolName` actually wraps the `<Link>` the stretch rule targets (positive control)", () => {
    expect(pageCode).toMatch(/className=\{styles\.toolName\}[\s\S]{0,100}<Link/);
  });
});

describe("the focus ring targets the specific link, not any focused descendant (A11Y111-M1 regression class)", () => {
  it("`.toolCard:has(.toolName a:focus-visible)` carries the accent ring", () => {
    expect(cssCode).toMatch(
      /\.toolCard:has\(\.toolName a:focus-visible\)\s*\{[^}]*outline\s*:\s*3px solid var\(--color-accent\)[^}]*outline-offset\s*:\s*2px/,
    );
  });

  it("the old broad `:focus-within` selector is gone — it is the exact defect this fix corrects", () => {
    expect(cssCode).not.toMatch(/\.toolCard:focus-within/);
  });

  it("the inner link's own focus ring stays suppressed — the ring lives on the card, not duplicated on the ~16-character text run", () => {
    expect(cssCode).toMatch(/\.toolName a:focus-visible\s*\{[^}]*outline\s*:\s*none/);
  });
});
