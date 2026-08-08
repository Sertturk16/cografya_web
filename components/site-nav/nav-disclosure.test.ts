import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL SHIELD for the header's navigation disclosure.
 *
 * This island owns the primary navigation of EVERY page, and two of its load-bearing
 * properties lived only in prose until this file existed (PR #56 review TA56-I1):
 *
 *  1. `children` is a server-rendered subtree that the island may show or hide and NEVER
 *     conditionally render (`SEO-POLICY.md` §B8.1/8.2). The most natural "improvement" a
 *     later edit can make to a hidden panel — `{open && children}` — removes six hub links
 *     from the first HTML response of every page below 64rem. `typecheck`, `lint`, `test`
 *     and `build` all stay green, and the desktop rendered sample looks identical, because
 *     nothing asserts that the links are unconditional.
 *  2. The disclosure contract: `aria-expanded`, Escape closing with focus returned to the
 *     button, no dialog semantics, and the two WebKit mousedown guards without which the
 *     panel's links do not navigate at all on iOS (review CR56-C1 / A11Y-1). Those guards
 *     are invisible to every gate this repo has: the defect they fix does not reproduce in
 *     Chromium, so CI, a desktop review and a screenshot all pass while it is live.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. `vitest.config.ts` runs a single `node`
 * environment with no jsdom and no `@testing-library/*`, so no test in this repo can render
 * a component or dispatch a DOM event (that gap is tracked as `FU-WEB-JSDOM`, and it is
 * pre-existing). A source-level invariant is the honest version of the same guard, and it is
 * the shape the repo already uses for exactly this class of risk
 * (`game-map.nav-guard.test.ts`, `map/attribution-separation.test.ts`). It does not claim to
 * prove what the DOM ends up looking like: the empirical half is the curl check on the
 * rendered page and the WebKit engine run, both part of this PR's evidence.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts shapes and invariants, never copy.
 * Every scan is anchored — a rename that moves a region out of view FAILS instead of
 * passing vacuously (PR #48 review TA48-I1).
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip block comments and whole-line `//` comments. This file's subject documents its own
 * invariants at length and quotes the very shapes banned below, so scanning the prose would
 * report the docblock as a violation of itself.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const ISLAND = code(sourceOf("./nav-disclosure.tsx"));
const CSS = sourceOf("./site-nav.module.css").replace(/\/\*[\s\S]*?\*\//g, " ");

describe("the nav disclosure renders the server's links unconditionally", () => {
  it("still receives and renders `children`", () => {
    // Anchors every assertion below: if the prop is renamed or the subtree stops being
    // passed through, this fails rather than letting the bans pass on absent code.
    expect(ISLAND).toMatch(/\{\s*children\s*\}\s*:\s*\{\s*children\s*:\s*ReactNode\s*\}/);
    expect(ISLAND.match(/\{children\}/g)).toHaveLength(1);
  });

  it("never gates the subtree behind the open state", () => {
    // The exact edit this file exists to stop, plus the two other ways to spell it.
    expect(ISLAND).not.toMatch(/\{\s*open\s*&&/);
    expect(ISLAND).not.toMatch(/open\s*\?[^:]*children/);
    expect(ISLAND).not.toMatch(/children\s*:\s*null/);
  });

  it("builds no link of its own — the links are the server's", () => {
    expect(ISLAND).not.toMatch(/<a[\s>]/);
    expect(ISLAND).not.toMatch(/<Link[\s>]/);
    expect(ISLAND).not.toMatch(/\bhref\b/);
  });
});

describe("the disclosure contract", () => {
  it("reports its state on the trigger", () => {
    expect(ISLAND).toMatch(/aria-expanded=\{open\}/);
    expect(ISLAND).toMatch(/aria-controls=\{panelId\}/);
  });

  it("is a disclosure, not a modal", () => {
    // No focus trap can exist without one of these; "Tab may leave the menu" is then a
    // property of the mechanism rather than something to re-verify by hand.
    expect(ISLAND).not.toMatch(/role=["']dialog["']/);
    expect(ISLAND).not.toMatch(/aria-modal/);
    expect(ISLAND).not.toMatch(/\binert\b/);
  });

  it("closes on Escape and hands focus back to the button", () => {
    const onKeyDown = ISLAND.slice(
      ISLAND.indexOf("const onKeyDown"),
      ISLAND.indexOf("const onBlur"),
    );
    expect(onKeyDown.length).toBeGreaterThan(0);
    expect(onKeyDown).toMatch(/event\.key !== "Escape"/);
    expect(onKeyDown).toMatch(/close\(true\)/);
    expect(ISLAND).toMatch(/buttonRef\.current\?\.focus\(\)/);
  });
});

describe("the WebKit mousedown guards", () => {
  /**
   * Two guards, two elements, two different defects — neither substitutes for the other,
   * because a handler on the trigger is never on a panel link's propagation path. Removing
   * either one restores a live defect that no other gate in this repo can see.
   */
  it("keeps the trigger's guard (A11Y-1: the close button reopened the menu on iOS)", () => {
    const trigger = ISLAND.slice(ISLAND.indexOf("<button"), ISLAND.indexOf("</button>"));
    expect(trigger.length).toBeGreaterThan(0);
    expect(trigger).toMatch(/onMouseDown=\{\((\w+)\) => \1\.preventDefault\(\)\}/);
  });

  it("keeps the panel's guard (CR56-C1: no panel link navigated on iOS)", () => {
    const handler = ISLAND.slice(
      ISLAND.indexOf("const onPanelMouseDown"),
      ISLAND.indexOf("const onPanelClick"),
    );
    expect(handler.length).toBeGreaterThan(0);
    expect(handler).toMatch(/event\.preventDefault\(\)/);
    expect(ISLAND).toMatch(/onMouseDown=\{onPanelMouseDown\}/);
  });

  it("scopes both panel handlers to open state", () => {
    const mouseDown = ISLAND.slice(
      ISLAND.indexOf("const onPanelMouseDown"),
      ISLAND.indexOf("const onPanelClick"),
    );
    const click = ISLAND.slice(ISLAND.indexOf("const onPanelClick"), ISLAND.indexOf("return ("));
    expect(mouseDown.length).toBeGreaterThan(0);
    expect(click.length).toBeGreaterThan(0);
    expect(mouseDown).toMatch(/if \(open\) event\.preventDefault\(\)/);
    expect(click).toMatch(/if \(!open\) return/);
  });
});

describe("the panel stylesheet carries the a11y-bearing rules", () => {
  /**
   * Pure CSS, therefore outside the reach of typecheck, lint and every other test — but the
   * closed panel's `display: none` is what removes eight links from the a11y tree AND the
   * tab order together. Drifting to `opacity`/`visibility` would leave them focusable behind
   * an invisible sheet (the PR #45 review C1 trap, WCAG 4.1.2).
   */
  it("hides the closed panel with `display: none` and reveals it with `display: flex`", () => {
    expect(ISLAND).toMatch(/className=\{styles\.panel\}/);
    expect(ISLAND).toMatch(/data-open=\{open \? "true" : "false"\}/);
    expect(CSS).toMatch(/\.panel\s*\{[^}]*display:\s*none/);
    expect(CSS).toMatch(/\.panel\[data-open="true"\]\s*\{[^}]*display:\s*flex/);
  });

  it("caps and scrolls the open panel so no row can land off screen", () => {
    const panel = CSS.slice(CSS.indexOf(".panel {"), CSS.indexOf(".panel[data-open"));
    expect(panel.length).toBeGreaterThan(0);
    expect(panel).toMatch(/max-height:\s*calc\(/);
    expect(panel).toMatch(/overflow-y:\s*auto/);
  });
});
