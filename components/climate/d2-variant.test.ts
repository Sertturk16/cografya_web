import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { D2_VARIANT } from "./climate-section";

/**
 * D2 ships TWO layout treatments for ONE sample round, and exactly one of them is live
 * (`D2_VARIANT`). This file guards the two ways that arrangement can rot:
 *
 * 1. **A dangling class.** `styles.d2Rails` / `styles.d2Minimal` are index lookups into a CSS
 *    module. If the stylesheet's rule is renamed or deleted, the lookup returns `undefined`,
 *    React renders `class="detailRow undefined"`, and the page silently loses its layout with
 *    a green build.
 * 2. **The variant surviving the decision.** Once the owner picks, the loser is deleted before
 *    merge (DEC 2026-08-05g md.1). The last test states that obligation where the next person
 *    to read this code will see it.
 *
 * It asserts nothing about which treatment is better, and no measurement.
 */

const css = readFileSync(new URL("./climate.module.css", import.meta.url), "utf8");

describe("D2 variant wiring", () => {
  it("declares a rule for every variant name the component can select", () => {
    expect(css).toMatch(/\.d2Rails\b/);
    expect(css).toMatch(/\.d2Minimal\b/);
  });

  it("keeps the wrappers themselves declared, so neither class lookup is undefined", () => {
    expect(css).toMatch(/\.detailRow\s*\{/);
    expect(css).toMatch(/\.detailAside\s*\{/);
  });

  it("selects one of the two variants", () => {
    expect(["rails", "minimal"]).toContain(D2_VARIANT);
  });

  it("keeps the table capped rather than stretched to the full content column", () => {
    // Whichever variant wins, the rule the 560px cap protects must survive: the table never
    // spans the 1080px content width, so a number never drifts away from its month label.
    expect(css).toMatch(/\.d2Minimal \.tableScroll\s*\{[^}]*max-width:\s*720px/);
    expect(css).toMatch(/\.d2Rails \.tableScroll\s*\{[^}]*flex:\s*1 1 420px/);
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
