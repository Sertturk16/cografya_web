import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL SHIELD for the header nav's per-group dropdowns ("Haritalar", "Araçlar" —
 * finding 8, `Owner's Inbox/anasayfa-yenileme/plan.md` §5.7b). Mirrors
 * `nav-disclosure.test.ts`'s own shape and reasoning exactly (that file's docblock explains
 * why: `vitest.config.ts` runs no jsdom, so a source-level invariant is the honest version of
 * the same guard here too), on the same load-bearing properties:
 *
 *  1. `children` is a caller-provided subtree this island may show or hide and NEVER
 *     conditionally renders (`SEO-POLICY.md` §B8.1/8.2) — the same risk `nav-disclosure.test.ts`
 *     guards against, one level down: `{open && children}` would remove every link inside a
 *     group from the first HTML response below the nav-collapse breakpoint (`DESIGN.md` §4).
 *  2. The disclosure contract: `aria-expanded`, Escape closing with focus returned to the
 *     trigger, no dialog semantics, and the two WebKit mousedown guards this component reuses
 *     from `NavDisclosure` verbatim (that file's own docblock documents the underlying WebKit
 *     defect at length — a real, previously-shipped iOS defect, not defensive padding).
 *  3. The mobile/desktop split is the MIRROR IMAGE of `NavDisclosure`'s own: below the
 *     nav-collapse breakpoint the trigger hides and the panel is forced open (a plain heading
 *     plus its links, inline in the existing scrollable mobile panel); at/above it the trigger
 *     becomes a real button and the panel becomes a real dropdown.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts shapes and invariants, never copy. Every
 * scan is anchored — a rename that moves a region out of view FAILS instead of passing
 * vacuously (the `nav-disclosure.test.ts` / PR #48 review `TA48-I1` precedent).
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip block comments and whole-line `//` comments — this file's subject documents its own invariants at length. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const ISLAND = code(sourceOf("./nav-group-disclosure.tsx"));
const CSS = sourceOf("./site-nav.module.css").replace(/\/\*[\s\S]*?\*\//g, " ");

describe("the group disclosure renders the caller's children unconditionally", () => {
  it("still receives and renders `label` and `children`", () => {
    // Anchors every assertion below: if either prop is renamed or `children` stops being
    // passed through, this fails rather than letting the bans pass on absent code.
    expect(ISLAND).toMatch(
      /\{\s*label\s*,\s*children\s*\}\s*:\s*\{\s*label\s*:\s*string\s*;\s*children\s*:\s*ReactNode\s*\}/,
    );
    expect(ISLAND.match(/\{children\}/g)).toHaveLength(1);
  });

  it("never gates the subtree behind the open state", () => {
    // The exact edit this file exists to stop, plus the two other ways to spell it — the same
    // three bans `nav-disclosure.test.ts` enforces one level up.
    expect(ISLAND).not.toMatch(/\{\s*open\s*&&/);
    expect(ISLAND).not.toMatch(/open\s*\?[^:]*children/);
    expect(ISLAND).not.toMatch(/children\s*:\s*null/);
  });

  it("builds no link of its own — the links are the caller's", () => {
    expect(ISLAND).not.toMatch(/<a[\s>]/);
    expect(ISLAND).not.toMatch(/<Link[\s>]/);
    expect(ISLAND).not.toMatch(/\bhref\b/);
  });
});

describe("the accessible name does not depend on open/closed state", () => {
  // Unlike the top-level hamburger (icon-only, so its name has to change with the state), a
  // group trigger's own visible text already names what it opens — `aria-expanded` alone
  // communicates state (plan §5.7b). Verified here as an absence, so a later edit that adds a
  // state-dependent `aria-label` (copying the hamburger's pattern where it does not apply)
  // fails instead of passing silently.
  it("carries no `aria-label`", () => {
    expect(ISLAND).not.toMatch(/aria-label/);
  });

  it("makes no next-intl call of its own — every string arrives already translated", () => {
    // The reason this file can stay outside `components/site-nav/messages.test.ts`'s
    // single-namespace-per-file invariant: it never opens the `Nav` namespace (or any other),
    // so it cannot be caught requesting two. Checked against the comment-stripped source
    // (`ISLAND`), not the raw file — this component's own docblock names "next-intl" in prose
    // to explain the absence, which would otherwise trip this exact assertion on itself.
    expect(ISLAND).not.toMatch(/from "next-intl/);
    expect(ISLAND).not.toMatch(/(?:use|get)Translations/);
  });
});

describe("the disclosure contract", () => {
  it("reports its state on the trigger", () => {
    expect(ISLAND).toMatch(/aria-expanded=\{open\}/);
    expect(ISLAND).toMatch(/aria-controls=\{panelId\}/);
  });

  it("is a disclosure, not a modal", () => {
    expect(ISLAND).not.toMatch(/role=["']dialog["']/);
    expect(ISLAND).not.toMatch(/aria-modal/);
    expect(ISLAND).not.toMatch(/\binert\b/);
  });

  it("closes on Escape and hands focus back to the trigger", () => {
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
   * exactly `nav-disclosure.tsx`'s own pair one level up. Removing either one restores a live
   * defect that no other gate in this repo can see (that file's docblock, quoted rather than
   * re-derived here).
   */
  it("keeps the trigger's guard", () => {
    const trigger = ISLAND.slice(ISLAND.indexOf("<button"), ISLAND.indexOf("</button>"));
    expect(trigger.length).toBeGreaterThan(0);
    expect(trigger).toMatch(/onMouseDown=\{\((\w+)\) => \1\.preventDefault\(\)\}/);
  });

  it("keeps the panel's guard", () => {
    const handler = ISLAND.slice(
      ISLAND.indexOf("const onPanelMouseDown"),
      ISLAND.indexOf("const onPanelClick"),
    );
    expect(handler.length).toBeGreaterThan(0);
    expect(handler).toMatch(/event\.preventDefault\(\)/);
    expect(ISLAND).toMatch(/onMouseDown=\{onPanelMouseDown\}/);
  });

  it("scopes both panel handlers to the open state", () => {
    const mouseDown = ISLAND.slice(
      ISLAND.indexOf("const onPanelMouseDown"),
      ISLAND.indexOf("const onPanelClick"),
    );
    const clickStart = ISLAND.indexOf("const onPanelClick");
    const click = ISLAND.slice(clickStart, ISLAND.indexOf("\n  return (", clickStart));
    expect(mouseDown.length).toBeGreaterThan(0);
    expect(click.length).toBeGreaterThan(0);
    expect(mouseDown).toMatch(/if \(open\) event\.preventDefault\(\)/);
    expect(click).toMatch(
      /const onPanelClick[\s\S]*?=>\s*\{\s*if \(!open\) return;\s*if \(event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.button !== 0\) return;\s*if \(event\.target instanceof HTMLElement && event\.target\.closest\("a"\)\) \{\s*close\(true\);/,
    );

    const panelStart = ISLAND.indexOf("ref={panelRef}");
    const panelEnd = ISLAND.indexOf("</div>", panelStart);
    const panel = ISLAND.slice(panelStart, panelEnd);
    expect(panelStart).toBeGreaterThan(-1);
    expect(panelEnd).toBeGreaterThan(panelStart);
    expect(panel).toMatch(/onClick=\{onPanelClick\}/);
  });
});

describe("the stylesheet carries the inverted mobile/desktop split", () => {
  // The breakpoint NUMBER is deliberately not hardcoded here, mirroring this very stylesheet's
  // own top-of-file rationale for naming no number: `DESIGN.md` §4 is its one home, and a
  // second hardcoded copy is exactly what went stale twice before (a seventh, then an eighth,
  // nav link). Matched as a pattern instead, so a future re-measurement (this plan's own §5.7d,
  // already exercised once by PR-2 itself: 66rem → 70rem) cannot silently desync this test from
  // the real breakpoint.
  const mediaQuery = /@media \(min-width: \d+(?:\.\d+)?rem\)/;
  const mediaMatch = mediaQuery.exec(CSS);
  const mediaIndex = mediaMatch?.index ?? -1;
  const base = CSS.slice(0, mediaIndex);
  const desktop = CSS.slice(mediaIndex);

  it("finds exactly one nav-collapse media block to split on", () => {
    // Anchors the two regions below: if the breakpoint marker moves or is duplicated, this
    // fails rather than letting `base`/`desktop` silently become the wrong slices. Checked
    // against the comment-stripped `CSS`, not the raw file — this stylesheet's own comments
    // name the media query in prose (to explain the mobile/desktop split), which would
    // otherwise inflate this count without a second real block existing.
    expect(mediaIndex).toBeGreaterThan(-1);
    expect(CSS.match(new RegExp(mediaQuery, "g"))).toHaveLength(1);
  });

  it("hides the trigger and forces the panel open below the breakpoint", () => {
    expect(base).toMatch(/\.groupTrigger\s*\{[^}]*display:\s*none/);
    expect(base).toMatch(/\.groupPanel\s*\{[^}]*display:\s*contents/);
  });

  it("shows the trigger and hides the mobile heading at/above the breakpoint", () => {
    expect(desktop).toMatch(/\.groupTrigger\s*\{[^}]*display:\s*inline-flex/);
    expect(desktop).toMatch(/\.groupHeading\s*\{[^}]*display:\s*none/);
  });

  it("turns the panel into a real, closed-by-default dropdown at/above the breakpoint", () => {
    expect(desktop).toMatch(/\.groupPanel\s*\{[^}]*display:\s*none/);
    expect(desktop).toMatch(/\.groupPanel\[data-open="true"\]\s*\{[^}]*display:\s*flex/);
  });
});
