import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { D2_VARIANT } from "./climate-section";
import { stripComments } from "@/lib/test-support/strip-comments";
import { classConstant, renderSites } from "@/lib/test-support/converted-floor";

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
const chart = stripComments(readFileSync(new URL("./climate-chart.tsx", import.meta.url), "utf8"));

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
      const declaration = classConstant(source, name);
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

/**
 * T-046'S OVERFLOW FLOOR, RE-PINNED WHERE IT NOW LIVES.
 *
 * `.chartFrame`'s `min-width: min(300px, 100%)` had an entry of its own in
 * `components/css-module-fixed-widths.test.ts`, which said "if this line ever reads
 * `min-width: 300px` again, this suite is where it stops". T-033 task 4 deleted the stylesheet,
 * that entry went with it, and the declaration moved into `climate-chart.tsx`'s `FRAME` — where
 * the census cannot read it and `pnpm sweep:overflow`, which is NOT in `.github/workflows/ci.yml`,
 * became its only cover. So the pin moves here, to the consumer's own test, which `pnpm test`
 * runs on every task. See `lib/test-support/converted-floor.ts` for the rule.
 *
 * The bare `min-width: 300px` is what scrolled `/turkiye/istanbul` sideways at 320: the floor
 * exists for the SHARED row, where the frame sits beside the summary and must not be squeezed
 * below a readable plot, and at 320 the frame has wrapped to its own row where the floor is
 * protecting nothing and is simply wider than the 288px column. `min()` keeps the floor wherever
 * the column can hold it and yields where it cannot.
 */
describe("the chart frame keeps T-046's 320px overflow floor", () => {
  const FLOOR = "min-w-[min(300px,100%)]";
  const REJECTED = /min-w-\[300px\]/;

  it("FRAME still carries the yielding floor, and not the bare one", () => {
    const frame = classConstant(chart, "FRAME");
    expect(frame, "climate-chart.tsx has no FRAME constant").not.toBeNull();
    expect(frame, `FRAME lost ${FLOOR}`).toContain(FLOOR);
    expect(frame!.split(FLOOR).join(" "), "FRAME carries a bare 300px floor").not.toMatch(REJECTED);
  });

  it("…on the constant the plot actually renders", () => {
    // Half of "bidirectional": a pin that only reads the declaration stays green on a constant
    // nothing uses, so the floor could be deleted from the page while this file agreed.
    expect(renderSites(chart, "FRAME")).toBe(1);
  });

  it("POSITIVE CONTROL — the same reading reds on the defect it exists for", () => {
    // Anti-vacuity, run against a MUTATION of the real declaration rather than an invented
    // string, so the control cannot rot into a green copy of itself: take what the file really
    // says and put the T-046 defect back into it.
    const real = classConstant(chart, "FRAME")!;
    const poisoned = real.split(FLOOR).join("min-w-[300px]");
    expect(poisoned).not.toBe(real);
    expect(poisoned).not.toContain(FLOOR);
    expect(poisoned.split(FLOOR).join(" ")).toMatch(REJECTED);
  });
});
