import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { classConstant, renderSites } from "@/lib/test-support/converted-floor";

/**
 * WHAT THE HEADER COMBOBOX KEEPS NOW THAT ITS STYLESHEET IS GONE.
 *
 * T-033 task 5 converted `search-combobox.tsx` to bridge-token utilities and deleted
 * `site-search.module.css`. Two things left a suite when that file went, and both come back here
 * rather than into `pnpm sweep:overflow`, which is NOT in `.github/workflows/ci.yml` and therefore
 * runs only when a human remembers: the target floors `components/css-module-fixed-widths.test.ts`
 * censused, and the focus-ring arrangement the stylesheet's own comments recorded as a fixed
 * defect. See `lib/test-support/converted-floor.ts` for the rule and the two earlier examples.
 *
 * Every pin here is bidirectional — it reds when the value disappears from the component AND when
 * the fixture stops describing what the component really says.
 */

const source = stripComments(
  readFileSync(new URL("./search-combobox.tsx", import.meta.url), "utf8"),
);

/**
 * THE TRIGGER'S 28x28, RE-PINNED WHERE IT NOW LIVES.
 *
 * It had its own `min-width: 28px` entry in the census, and the number is measured rather than
 * chosen: on a 390px viewport the trigger shares the header's first row with the brand link, whose
 * line box is 30.72px, so the trigger must stay UNDER that or it becomes the row's tallest item.
 * At 44px the header grew 177 -> 190px and at 32px it still grew by 1.09px, against an acceptance
 * criterion that says the header must not grow by a single pixel with the search closed. 28px
 * clears WCAG 2.5.8 (AA)'s 24x24 target floor with the height to spare.
 *
 * `min-w-[44px]` is the rejected spelling because it is the tempting one: "make it a proper tap
 * target" is the change that costs 13px of header on every page.
 */
describe("the header trigger keeps its measured 28x28 floor", () => {
  const FLOOR = ["min-w-[28px]", "min-h-[28px]"];
  const REJECTED = /min-w-\[44px\]|\bmin-w-11\b/;

  it("TRIGGER still carries both halves of the floor, and not the 44px one", () => {
    const trigger = classConstant(source, "TRIGGER");
    expect(trigger, "search-combobox.tsx has no TRIGGER constant").not.toBeNull();
    for (const utility of FLOOR) expect(trigger, `TRIGGER lost ${utility}`).toContain(utility);
    expect(trigger, "TRIGGER carries the 44px target that grew the header").not.toMatch(REJECTED);
  });

  it("…on the constant the header actually renders, both times", () => {
    // Half of "bidirectional": a pin that only reads the declaration stays green on a constant
    // nothing uses. TWO sites, and both matter — the pre-hydration `<a>` fallback is the box the
    // no-JS reader never leaves, and it has to be the same size as the one that replaces it or
    // hydration moves the header.
    expect(renderSites(source, "TRIGGER")).toBe(2);
  });

  it("POSITIVE CONTROL — the same reading reds on the defect it exists for", () => {
    // Run against a MUTATION of the real declaration rather than an invented string, so the
    // control cannot rot into a green copy of itself.
    const real = classConstant(source, "TRIGGER")!;
    const poisoned = real.split("min-w-[28px]").join("min-w-[44px]");
    expect(poisoned).not.toBe(real);
    expect(poisoned).not.toContain("min-w-[28px]");
    expect(poisoned).toMatch(REJECTED);
  });

  it("POSITIVE CONTROL — a DE-HOISTED floor reds, which is the failure mode that is silent", () => {
    // The control above exercises `String.split`, not `classConstant`, and `classConstant` is the
    // part that fails quietly: `lib/test-support/converted-floor.ts` returns `null` for a floor
    // left inline on a `className`, so a pin built on it asserts nothing and stays green. So this
    // control mutates the SHAPE rather than the value — it puts the floor back where the extractor
    // cannot read it — and proves the `not.toBeNull()` guard above is what stands between this
    // suite and a vacuous pass.
    const declaration = classConstant(source, "TRIGGER")!;
    const literal = declaration.slice(declaration.indexOf("=") + 1, -1).trim();
    const deHoisted = source
      .split(declaration)
      .join("")
      .split("className={TRIGGER}")
      .join(`className={${literal}}`);

    // The floor is still THERE — the value did not move, only its shape did. That is the whole
    // point: the pin goes blind while the component is still correct, and stays blind when it
    // stops being correct.
    expect(deHoisted).toContain("min-w-[28px]");
    expect(classConstant(deHoisted, "TRIGGER"), "the extractor read a de-hoisted floor").toBeNull();
    expect(renderSites(deHoisted, "TRIGGER")).toBe(0);
  });
});

/**
 * THE CLOSE BUTTON'S 32x32, the census's other target floor from this file.
 *
 * It is a pointer target inside the panel and nothing constrains it from above — it sits in a row
 * whose own height is the input's 40px — so unlike the trigger it is a plain WCAG 2.5.8 floor.
 *
 * The census's remaining two entries from this stylesheet are deliberately NOT pinned. `width:
 * 1px` was the visually-hidden clip rect and is now Tailwind's own `sr-only`, so the value is the
 * framework's rather than this component's. `width: 420px` is the desktop panel width, which
 * applies only above `min-[70rem]` — a 420px box inside a >=1120px viewport cannot overflow, and
 * below that breakpoint the panel is inset 16px from both edges instead. Pinning either would
 * assert a value nothing depends on.
 */
describe("the panel's close button keeps its 32x32 target floor", () => {
  it("CLOSE still carries both halves, on the constant the panel renders", () => {
    const close = classConstant(source, "CLOSE");
    expect(close, "search-combobox.tsx has no CLOSE constant").not.toBeNull();
    expect(close, "CLOSE lost min-w-[32px]").toContain("min-w-[32px]");
    expect(close, "CLOSE lost min-h-[32px]").toContain("min-h-[32px]");
    expect(renderSites(source, "CLOSE")).toBe(1);
  });
});

/**
 * ONE RING, AND WHERE IT IS PAINTED FROM.
 *
 * Two defects are recorded against this control and the conversion could reintroduce either.
 *
 * 1. **Two concentric rings.** The row draws the ring because the row is what the reader perceives
 *    as the search box; the `<input>` inside it must therefore not draw the global one. The
 *    stylesheet suppressed it with a (0,2,0) selector against the global (0,1,0). Tailwind cannot:
 *    `app/globals.css`'s `:focus-visible { outline: 3px solid var(--ring) }` sits OUTSIDE every
 *    `@layer`, and an unlayered rule beats every rule in `@layer utilities` whatever its
 *    specificity. So the suppression is `focus-visible:outline-none!` — importance is what
 *    reverses layer order — and a plain `focus-visible:outline-none` silently restores the double
 *    ring. Measured, not assumed: the v2 command dialog's input carries the plain form today and
 *    its computed outline is still `3px solid`.
 *
 * 2. **The ring naming the wrong control.** `has-[input:focus]`, never `:focus-within`: the row's
 *    other focusable child is the close button, and with `focus-within` the row ringed itself at
 *    the same time as that button drew the global ring — two rings again, the outer one saying
 *    "the input is focused" while focus was elsewhere.
 *
 * And the colour: `outline-ring`, not the `--color-accent` the deleted rule painted. That raw
 * token is frozen at #276b70 in both themes and measures 2.78:1 on dark `--card`, the ground the
 * converted panel takes — a focus ring below WCAG 1.4.11's 3:1 floor. `--ring` is 5.44:1 dark and
 * 6.13:1 light on the same surface.
 */
describe("the focused search box draws exactly one ring, from the themed token", () => {
  it("the ROW owns the ring, keyed on the input and not on focus-within", () => {
    const row = classConstant(source, "INPUT_ROW");
    expect(row, "search-combobox.tsx has no INPUT_ROW constant").not.toBeNull();
    expect(row, "INPUT_ROW lost the ring").toContain("has-[input:focus]:outline-ring");
    expect(row, "INPUT_ROW lost the 3px width").toContain("has-[input:focus]:outline-3");
    expect(row, "INPUT_ROW lost the 2px offset").toContain("has-[input:focus]:outline-offset-2");
    expect(
      row,
      "INPUT_ROW rings on focus-within, which rings for the close button too",
    ).not.toMatch(/focus-within/);
    expect(row, "INPUT_ROW paints the ring from a frozen raw token").not.toMatch(/outline-accent/);
    expect(renderSites(source, "INPUT_ROW")).toBe(1);
  });

  it("the INPUT suppresses the global ring with the important form", () => {
    const input = classConstant(source, "INPUT");
    expect(input, "search-combobox.tsx has no INPUT constant").not.toBeNull();
    expect(input, "INPUT lost the ring suppression").toContain("focus-visible:outline-none!");
    expect(renderSites(source, "INPUT")).toBe(1);
  });

  it("POSITIVE CONTROL — dropping the `!` reds, because that is the double ring", () => {
    const real = classConstant(source, "INPUT")!;
    const poisoned = real.split("focus-visible:outline-none!").join("focus-visible:outline-none");
    expect(poisoned).not.toBe(real);
    expect(poisoned).not.toContain("focus-visible:outline-none!");
  });

  it("POSITIVE CONTROL — the suppression de-hoisted goes unread, same as the floor", () => {
    // Same sharpening as the trigger's: exercise `classConstant`, not `String.split`. Inlining
    // INPUT on its `className` leaves the `!` in the file and takes it out of the pin's reach.
    const declaration = classConstant(source, "INPUT")!;
    const literal = declaration.slice(declaration.indexOf("=") + 1, -1).trim();
    const deHoisted = source
      .split(declaration)
      .join("")
      .split("className={INPUT}")
      .join(`className={${literal}}`);

    expect(deHoisted).toContain("focus-visible:outline-none!");
    expect(classConstant(deHoisted, "INPUT"), "the extractor read a de-hoisted INPUT").toBeNull();
    expect(renderSites(deHoisted, "INPUT")).toBe(0);
  });
});

/**
 * The stylesheet is gone, and it does not come back through the import it used to arrive by.
 * Anti-vacuity for every reading above: they all run against a source this file really read.
 */
describe("the stylesheet is not reachable from this component any more", () => {
  it("imports no CSS Module and reads no raw Terra token", () => {
    expect(source).not.toMatch(/site-search\.module\.css/);
    expect(source).not.toMatch(/var\(--color-/);
    expect(source.length, "search-combobox.tsx was not read").toBeGreaterThan(5000);
  });
});
