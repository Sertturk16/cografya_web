import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { D2_VARIANT } from "./climate-section";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * D2's layout wiring, after the A/B round closed.
 *
 * The file used to guard two treatments shipping side by side. It no longer does, because they
 * no longer do: `minimal` was deleted rather than merged (DEC 2026-08-05g md.1). What is left
 * to guard is the same pair of rot modes, minus the one the deletion removed:
 *
 * 1. **A layout that quietly stops being applied.** This used to read `styles.d2Rails` — an
 *    index lookup into a CSS module that returns `undefined` when the rule is renamed or
 *    deleted, so React renders `class="detailRow undefined"` and the page loses its layout with
 *    a green build. T-033 retired `climate.module.css`, so the lookup is gone and TypeScript
 *    now catches a renamed constant. What TypeScript CANNOT catch is the utilities being
 *    deleted out of the string, which fails exactly as silently, so the rule survives in its
 *    new spelling: the three wrappers must still carry the rail layout.
 * 2. **The loser coming back.** The previous version of this file *stated* the deletion
 *    obligation and then asserted only that the live variant was one of two names — which was
 *    green with both shipped. A test that names a rule it does not enforce is worse than no
 *    test, so the obligation is an assertion.
 *
 * It asserts nothing about which treatment is better, and no tuning numbers: the earlier
 * "keeps the table capped" case pinned 720px and 420px, and the 720px half applied only to the
 * dormant variant, so it verified the shipped layout not at all while failing CI on any
 * legitimate retune.
 */

const section = stripComments(
  readFileSync(new URL("./climate-section.tsx", import.meta.url), "utf8"),
);
const table = stripComments(readFileSync(new URL("./climate-table.tsx", import.meta.url), "utf8"));

describe("D2 variant wiring", () => {
  it("declares the layout for the variant the component selects", () => {
    expect(D2_VARIANT).toBe("rails");
    // The row itself becomes a flex rail pair at the breakpoint.
    expect(section).toMatch(/const DETAIL_ROW =\s*"[^"]*lg:flex\b/);
  });

  it("keeps both wrappers themselves declared, so neither loses its box", () => {
    expect(section).toMatch(/const DETAIL_ROW =\s*"block\b/);
    expect(section).toMatch(/const DETAIL_ASIDE =\s*"block\b/);
    expect(section).toContain("className={DETAIL_ROW}");
    expect(section).toContain("className={DETAIL_ASIDE}");
  });

  it("no longer carries the losing variant, in either layer", () => {
    // The obligation the old docblock quoted, still enforced. `minimal` is gone from the
    // component and there is no longer a second layer for it to hide in, so a one-line constant
    // flip can no longer resurrect an untested layout on every province page with a climate
    // series.
    expect(section).not.toMatch(/d2Minimal/i);
    expect(table).not.toMatch(/d2Minimal/i);
  });

  it("keeps the table's width bounded by the rail rather than by the content column", () => {
    // The PROPERTY, not the number: the table sits in a flex rail, so it can never span the
    // full 1080px column and drift a value away from its month label. Retuning the basis is a
    // design change, not a regression, so the basis value itself is not pinned.
    expect(table).toMatch(/const SCROLL =[\s\S]*?lg:flex-\[1_1_\d+px\]/);
    // …and the 560px cap it overrides is really there to be overridden.
    expect(table).toMatch(/const SCROLL =[\s\S]*?max-w-\[560px\]/);
    expect(table).toMatch(/const SCROLL =[\s\S]*?lg:max-w-none/);
  });

  it("changes nothing below the breakpoint under the rails variant", () => {
    // The single-column stack the UX tour praised is untouched: every rails utility is `lg:`
    // prefixed, which is the Tailwind spelling of the `@media (min-width: 1024px)` block the
    // stylesheet used to put them in. Each is checked in both directions — present WITH the
    // prefix, absent without it — because an absence-only rule would be green on a file that
    // lost the layout entirely, which is rot mode 1.
    const rails: ReadonlyArray<readonly [string, string]> = [
      ["DETAIL_ROW", "flex"],
      ["DETAIL_ROW", "flex-wrap"],
      ["DETAIL_ROW", "items-start"],
      ["DETAIL_ASIDE", "flex-[1_1_220px]"],
      ["DETAIL_ASIDE", "min-w-[280px]"],
      ["SCROLL", "flex-[1_1_420px]"],
      ["SCROLL", "min-w-[300px]"],
      ["SCROLL", "max-w-none"],
    ];
    for (const [name, utility] of rails) {
      const source = name === "SCROLL" ? table : section;
      const declaration = new RegExp(`const ${name} =[\\s\\S]*?;`).exec(source)?.[0];
      expect(declaration, `${name} is not declared`).toBeDefined();
      expect(declaration, `${name} lost lg:${utility}`).toContain(`lg:${utility}`);
      // Whitespace-delimited so `flex` is not read out of `flex-wrap`, and the prefixed copies
      // are blanked first so the search can only find an UNPREFIXED one.
      const words = declaration!
        .split(`lg:${utility}`)
        .join(" ")
        .split(/[\s"+]+/);
      expect(words, `${utility} applies below 1024px`).not.toContain(utility);
    }
  });
});
