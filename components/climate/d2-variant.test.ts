import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { D2_VARIANT } from "./climate-section";

/**
 * D2's layout wiring, after the A/B round closed.
 *
 * The file used to guard two treatments shipping side by side. It no longer does, because they
 * no longer do: `minimal` was deleted rather than merged (DEC 2026-08-05g md.1). What is left
 * to guard is the same pair of rot modes, minus the one the deletion removed:
 *
 * 1. **A dangling class.** `styles.d2Rails` is an index lookup into a CSS module. If the
 *    stylesheet's rule is renamed or deleted the lookup returns `undefined`, React renders
 *    `class="detailRow undefined"`, and the page silently loses its layout with a green build.
 * 2. **The loser coming back.** The previous version of this file *stated* the deletion
 *    obligation and then asserted only that the live variant was one of two names — which was
 *    green with both shipped. A test that names a rule it does not enforce is worse than no
 *    test, so the obligation is now an assertion.
 *
 * It asserts nothing about which treatment is better, and no tuning numbers: the earlier
 * "keeps the table capped" case pinned 720px and 420px, and the 720px half applied only to the
 * dormant variant, so it verified the shipped layout not at all while failing CI on any
 * legitimate retune.
 */

const css = readFileSync(new URL("./climate.module.css", import.meta.url), "utf8");

describe("D2 variant wiring", () => {
  it("declares the rule for the variant the component selects", () => {
    expect(D2_VARIANT).toBe("rails");
    expect(css).toMatch(/\.d2Rails\b/);
  });

  it("keeps the wrappers themselves declared, so neither class lookup is undefined", () => {
    expect(css).toMatch(/\.detailRow\s*\{/);
    expect(css).toMatch(/\.detailAside\s*\{/);
  });

  it("no longer carries the losing variant, in either layer", () => {
    // The obligation the old docblock quoted, now enforceable. `minimal` is gone from the
    // stylesheet and from the component, so a one-line constant flip can no longer resurrect
    // an untested layout on every province page with a climate series.
    expect(css).not.toMatch(/d2Minimal/i);
    const component = readFileSync(new URL("./climate-section.tsx", import.meta.url), "utf8");
    expect(component).not.toMatch(/d2Minimal/i);
  });

  it("keeps the table's width bounded by the rail rather than by the content column", () => {
    // The PROPERTY, not the number: the table sits in a flex rail, so it can never span the
    // full 1080px column and drift a value away from its month label. Retuning the basis is a
    // design change, not a regression, so the basis value itself is not pinned.
    expect(css).toMatch(/\.d2Rails \.tableScroll\s*\{[^}]*flex:/);
  });

  it("changes nothing below the breakpoint under the rails variant", () => {
    // The single-column stack the UX tour praised is untouched: every rails rule lives inside
    // a min-width media query.
    const railsRules = [...css.matchAll(/\.d2Rails\b/g)];
    const mediaBlocks = [...css.matchAll(/@media \(min-width: 1024px\)\s*\{[\s\S]*?\n\}/g)];
    const insideMedia = mediaBlocks.map((m) => m[0]).join("\n");
    const railsInsideMedia = [...insideMedia.matchAll(/\.d2Rails\b/g)];
    expect(railsInsideMedia).toHaveLength(railsRules.length);
  });
});
