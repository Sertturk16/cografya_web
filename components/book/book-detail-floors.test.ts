import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classConstant, renderSites } from "@/lib/test-support/converted-floor";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * THE BOOK DETAIL PAGE'S GEOMETRY, PINNED WHERE VITEST CAN ACTUALLY REACH IT.
 *
 * ## Why this file exists at all, and why it is HERE and not beside its subject
 *
 * T-033 task 8 retired `app/[locale]/(site)/kitaplar/[slug]/book-detail.module.css` and moved its
 * fourteen live rules into hoisted class constants in the page beside it. Two of those rules were
 * pinned by `components/css-module-fixed-widths.test.ts` — the question index's
 * `minmax(min(88px, 100%), 1fr)` cell floor and the visually-hidden `width: 1px` — and that census
 * can only read CSS Modules, so both would have evaporated with the stylesheet.
 *
 * The obvious home for the replacement is beside the page. It cannot be: `vitest.config.ts`
 * includes `lib/**`, `components/**` and `tools/**` and nothing under `app/`, so a test written
 * next to the page would never be executed — green by never running, which is worse than absent.
 * `components/book/attribution-gate.test.ts` already reads this same page's source from here for
 * the same reason, and the page's own consumers (`VideoBench`, `DenemeMeta`) live in this
 * directory. So the pin reads the file rather than importing it, exactly as that sibling does.
 *
 * This module was also the ONLY one of T-033's eight with no unit cover of any kind. `pnpm
 * sweep:overflow` is not in `.github/workflows/ci.yml`, so before this file the whole page was
 * covered by screenshots and a command a human has to remember. Every assertion below is a
 * declaration this repo measured once and would otherwise have to measure again.
 *
 * ## HOIST FIRST, THEN PIN
 *
 * `classConstant` reads a top-level `const NAME = …;`. A floor left inline on a JSX `className`
 * is not one, so it returns `null`, every `toContain` built on it never runs, and the suite is
 * green on nothing. Each group below therefore asserts `not.toBeNull()` first and closes with a
 * control that DE-HOISTS the real declaration and proves the extractor goes blind — built by
 * mutating this file's real subject, never an invented string, so the control cannot drift from
 * the thing it is controlling for.
 *
 * ## Bidirectional
 *
 * A pin that only reads a declaration stays green on a constant nothing renders any more. Every
 * group therefore also counts the constant's render sites, so the floor can be deleted from the
 * JSX and this file still reds.
 */

const PAGE = stripComments(
  readFileSync(
    new URL("../../app/[locale]/(site)/kitaplar/[slug]/page.tsx", import.meta.url),
    "utf8",
  ),
);

/**
 * Every quoted segment of a constant's declaration, joined.
 *
 * Prettier breaks a long Tailwind string into a `"…" + "…" + "…"` concatenation, and the
 * de-hoist control has to reconstruct the WHOLE value: taking only the first quoted run — which
 * is what the single-segment worked examples do — would rebuild a truncated class string and
 * silently weaken the control into something that passes for the wrong reason.
 */
function literalValue(declaration: string): string {
  return [...declaration.matchAll(/"([^"]*)"/g)].map((match) => match[1]).join("");
}

/** The declaration, with `not.toBeNull()` already discharged. */
function required(name: string): string {
  const declaration = classConstant(PAGE, name);
  expect(declaration, `the book page has no top-level ${name} constant`).not.toBeNull();
  return declaration!;
}

/** De-hoist: delete the declaration and inline its value on every `className={NAME}`. */
function deHoisted(name: string): string {
  const declaration = required(name);
  return PAGE.replace(declaration, "")
    .split(`className={${name}}`)
    .join(`className="${literalValue(declaration)}"`);
}

describe("the book page hoisted every rule the retired stylesheet carried", () => {
  const CONSTANTS = [
    "JUMP",
    "JUMP_HEADING",
    "JUMP_LIST",
    "JUMP_ITEM",
    "WORKBENCH",
    "INDEX",
    "DENEME",
    "DENEME_HEAD",
    "DENEME_HEADING",
    "DENEME_FACTS",
    "FACT_SEPARATOR",
    "QUESTION_GRID",
    "QUESTION_LINK",
  ] as const;

  it("declares all thirteen, and the fourteenth rule is Tailwind's own utility", () => {
    // Anti-vacuity for every group below: if the page stopped hoisting, `required` would throw
    // here first and name the constant rather than letting thirteen `toContain`s pass on null.
    for (const name of CONSTANTS) expect(required(name)).toContain(name);
    // `.srOnly` was the fourteenth class. It became `sr-only`, so it has no constant to pin —
    // what is pinned instead is that the jump tile still carries it. Without this the label a
    // screen reader reads ("Deneme 12") could be deleted with every other check green.
    expect(PAGE).toContain('className="sr-only"');
  });

  it("still reads no CSS Module", () => {
    // The point of the task. `styles.x` anywhere means the stylesheet came back.
    expect(PAGE).not.toContain("book-detail.module.css");
    expect(PAGE).not.toMatch(/\bstyles\./);
  });

  it("renders every constant it declares", () => {
    // The other half of bidirectional, for all of them at once: a constant nothing renders is a
    // pin on nothing, and this is the cheapest place to catch the whole set.
    for (const name of CONSTANTS) {
      if (name === "INDEX") continue; // passed as `indexClassName`, asserted on its own below
      expect(renderSites(PAGE, name), `${name} is declared but never rendered`).toBe(1);
    }
    // `INDEX` reaches the DOM through `VideoBench`'s `indexClassName` prop, not `className`, so
    // `renderSites` — which matches `className={NAME}` literally — correctly reports zero for it.
    // Asserting the real spelling rather than widening the shared helper: the helper's own
    // docblock says a non-literal site owes a fresh reading, and this is one.
    expect(renderSites(PAGE, "INDEX")).toBe(0);
    expect(PAGE).toContain("indexClassName={INDEX}");
  });
});

describe("the question index keeps its measured 88px cell floor", () => {
  const FLOOR = "grid-cols-[repeat(auto-fit,minmax(min(88px,100%),1fr))]";

  it("QUESTION_GRID still carries it", () => {
    // THE DECLARATION `components/css-module-fixed-widths.test.ts` WAS STILL PINNING when the
    // stylesheet went. 88px is the English label's requirement — `Question 1` measures 71.0px at
    // 600 13.6px Nunito Sans, plus 6px×2 padding and 1px×2 border — and Turkish needs only 59px,
    // so this is the locale that binds. Measured on the built page: 89px cells at 320, 103px at
    // 360, 116px at 768, 96px at 1024 and 106px at 1440, six on one row from 768 up.
    const grid = required("QUESTION_GRID");
    expect(grid, `QUESTION_GRID lost ${FLOOR}`).toContain(FLOOR);
  });

  it("…with auto-fit and not auto-fill, which is what makes the floor safe to raise", () => {
    // `auto-fill` keeps the empty track, so a column wide enough for seven cells lays the six out
    // at the floor width and leaves a seventh track's worth of hole on the right. Both spellings
    // contain "88px", so a `FLOOR` check alone does not separate them.
    const grid = required("QUESTION_GRID");
    expect(grid).not.toContain("auto-fill");
  });

  it("…and the `min(…, 100%)` guard that keeps a narrow viewport from scrolling sideways", () => {
    // A floor wider than the container keeps its width and pushes the row past the viewport. The
    // bare form is the exact defect `css-module-fixed-widths.test.ts` was built for, arriving in
    // a different file. Mutation-checked: the bare spelling must NOT satisfy the pin.
    const grid = required("QUESTION_GRID");
    const bare = grid.split(FLOOR).join("grid-cols-[repeat(auto-fit,minmax(88px,1fr))]");
    expect(bare).not.toBe(grid);
    expect(bare).not.toContain(FLOOR);
  });

  it("…and the three zeros beside `mt-2` that keep the ul's UA margin out", () => {
    // The stylesheet wrote `margin: 8px 0 0` on a `<ul>`, whose UA margin is block-axis `1em`.
    // `mt-2` alone is a bet on preflight; spelling the zeros out is what makes it a translation.
    const grid = required("QUESTION_GRID");
    for (const utility of ["mt-2", "mx-0", "mb-0", "p-0", "list-none", "gap-1.5"]) {
      expect(grid, `QUESTION_GRID lost ${utility}`).toContain(utility);
    }
  });

  it("POSITIVE CONTROL — de-hoisting QUESTION_GRID makes the extractor return null", () => {
    const inlined = deHoisted("QUESTION_GRID");
    expect(inlined).toContain(FLOOR); // the floor is still on the page…
    expect(classConstant(inlined, "QUESTION_GRID")).toBeNull(); // …and the pin sees nothing.
    expect(renderSites(inlined, "QUESTION_GRID")).toBe(0);
  });
});

describe("the jump strip keeps its intrinsic 2.75rem column floor", () => {
  const FLOOR = "grid-cols-[repeat(auto-fill,minmax(min(2.75rem,100%),1fr))]";

  it("JUMP_LIST still carries it", () => {
    // INTRINSIC, NOT A BREAKPOINT: `docs/design.md` pins ONE breakpoint (64rem) and forbids a
    // second without a two-locale measurement, so the strip's column count comes from the
    // available width. 2.75rem is 44px, the same WCAG 2.2 §2.5.5 target the tile itself takes.
    // This floor was never in the fixed-width census — it is a rem value and that scan only
    // reads `px` — so retiring the stylesheet would have left it with no reader at all.
    const list = required("JUMP_LIST");
    expect(list, `JUMP_LIST lost ${FLOOR}`).toContain(FLOOR);
    expect(list).toContain("m-0");
    expect(list).toContain("p-0");
  });

  it("…with auto-fill and not auto-fit, which is the opposite of the index's choice", () => {
    // Deliberately the other one: a strip of thirty numbered tiles reads as a keypad, so an
    // empty track at the end is correct and stretching 28 tiles across a row is not. Pinned
    // because the two lists sit twenty lines apart and "make them consistent" is one edit.
    expect(required("JUMP_LIST")).not.toContain("auto-fit");
  });

  it("POSITIVE CONTROL — de-hoisting JUMP_LIST makes the extractor return null", () => {
    const inlined = deHoisted("JUMP_LIST");
    expect(inlined).toContain(FLOOR);
    expect(classConstant(inlined, "JUMP_LIST")).toBeNull();
    expect(renderSites(inlined, "JUMP_LIST")).toBe(0);
  });
});

describe("the row heading keeps the 6.5rem floor that makes all thirty rows wrap alike", () => {
  const FLOOR = "min-w-[6.5rem]";

  it("DENEME_HEADING still carries it", () => {
    // 104px, measured rather than picked: Fraunces' digits are proportional and the heading spans
    // 86.6px ("Deneme 1") to 102.4px ("Deneme 40"), which put 25 rows on two lines and 5 on one.
    // `tabular-nums` was tried first and rejected — the computed style applies but the widths do
    // not move, because the self-hosted Fraunces subset carries no `tnum` feature.
    const heading = required("DENEME_HEADING");
    expect(heading, `DENEME_HEADING lost ${FLOOR}`).toContain(FLOOR);
    // A floor that stopped being a floor is the same loss as a deleted one.
    expect(heading.split(FLOOR).join(" ")).not.toMatch(/min-w-(0|full|fit|min|auto)\b/);
  });

  it("…and the `m-0` that keeps the base layer's heading margin off thirty rows", () => {
    // `@layer base` gives every heading `margin: 0 0 0.5em`. Without `m-0` this `<h3>` takes an
    // 8.4px bottom margin the stylesheet's `margin: 0` was cancelling, and every row grows by it.
    // This is the one trap of the three that cost this programme real damage and is invisible to
    // typecheck, lint and every other test.
    expect(required("DENEME_HEADING")).toContain("m-0");
  });

  it("POSITIVE CONTROL — de-hoisting DENEME_HEADING makes the extractor return null", () => {
    const inlined = deHoisted("DENEME_HEADING");
    expect(inlined).toContain(FLOOR);
    expect(classConstant(inlined, "DENEME_HEADING")).toBeNull();
    expect(renderSites(inlined, "DENEME_HEADING")).toBe(0);
  });
});

describe("both fragment targets keep their one-addend anchor offset", () => {
  // `#video-12` and `#video-12-etiket-3` are IA fragments, so the target has to land BELOW the
  // sticky header and be visible at every viewport, 320px included. ONE addend: the accordion's
  // open row was `position: sticky` and needed a second, and that row is gone.
  //
  // `components/anchor-offset-token.test.ts` is the tripwire for the failure mode that makes a
  // WRONG offset silent — `var()` on an undefined property invalidates the whole `calc()`, the
  // declaration is dropped and the offset becomes zero with nothing erroring. What it cannot see
  // is the offset going missing from a consumer, which is this.
  const OFFSET = "scroll-mt-[calc(var(--header-height)+1rem)]";

  it.each(["DENEME_HEADING", "QUESTION_LINK"] as const)("%s still carries it", (name) => {
    const declaration = required(name);
    expect(declaration, `${name} lost ${OFFSET}`).toContain(OFFSET);
    // A second addend would mean the sticky row came back without this comment being reread.
    expect(declaration).not.toMatch(/scroll-mt-\[calc\(var\(--header-height\)\+1rem\+/);
  });
});

describe("both tile controls keep WCAG 2.2 §2.5.5's 44×44 target", () => {
  // §2.5.8 (AA) would allow 24×24 and the mockup that proposed 36px would have passed it.
  // `docs/design.md` puts these in the "controls with room to be generous" bucket that takes
  // §2.5.5 (AAA), and a page that is mostly these controls is the last place to spend that. The
  // page-length saving the mockup wanted is taken from the WIDTH instead (the floors above).
  const TARGET = "min-h-11";

  it.each([
    ["JUMP_ITEM", "p-1"],
    ["QUESTION_LINK", "p-1.5"],
  ] as const)("%s carries %s and the target floor", (name, padding) => {
    const declaration = required(name);
    expect(declaration, `${name} lost ${TARGET}`).toContain(TARGET);
    // The padding is load-bearing on the index, not decoration: 6px rather than 8px is what put
    // the English label's requirement at 85px instead of 89px, and 89 was a third of a pixel too
    // wide for the 1024px index column.
    expect(declaration, `${name} lost ${padding}`).toContain(padding);
  });

  it("POSITIVE CONTROL — the reading reds when the target is dropped to the AA floor", () => {
    // Anti-vacuity against a MUTATION of the real declaration, not an invented string.
    const real = required("QUESTION_LINK");
    const shrunk = real.split(TARGET).join("min-h-6");
    expect(shrunk).not.toBe(real);
    expect(shrunk).not.toContain(TARGET);
  });

  it("POSITIVE CONTROL — de-hoisting JUMP_ITEM makes the extractor return null", () => {
    const inlined = deHoisted("JUMP_ITEM");
    expect(inlined).toContain(TARGET);
    expect(classConstant(inlined, "JUMP_ITEM")).toBeNull();
    expect(renderSites(inlined, "JUMP_ITEM")).toBe(0);
  });
});

describe("the workbench keeps its derived 40% stage column at the one pinned breakpoint", () => {
  const COLUMNS = "lg:grid-cols-[minmax(0,40%)_minmax(0,1fr)]";

  it("WORKBENCH still carries it", () => {
    // THE 40% IS DERIVED, NOT PICKED. The index's six question cells must sit on one row, which
    // at the 88px floor plus the 6px gap needs 6×88 + 5×6 = 558px; at the narrowest two-column
    // viewport (1024px → 984px of content, minus the 24px gap) a 40% stage leaves it 566px. A
    // fixed pixel column could satisfy that end or the 1440 end, not both.
    const workbench = required("WORKBENCH");
    expect(workbench, `WORKBENCH lost ${COLUMNS}`).toContain(COLUMNS);
    expect(workbench).toContain("gap-6");
    expect(workbench).toContain("items-start");
  });

  it("…at `lg` and at no other breakpoint", () => {
    // `docs/design.md` pins ONE breakpoint (64rem) and asks for a two-locale measurement before a
    // second. `lg` IS that 64rem — Tailwind's default, unchanged in this repo's `@theme` — so the
    // rule uses the pinned one and nothing else. Any other prefix here is a new breakpoint.
    const workbench = required("WORKBENCH");
    expect(workbench).not.toMatch(/\b(sm|md|xl|2xl):/);
  });

  it("…and declares no overflow anywhere on the sticky stage's chain", () => {
    // Load-bearing rather than tidy: `position: sticky` resolves against the nearest scrollport,
    // so an ancestor with `overflow: hidden` — the obvious way to clip a bordered column — kills
    // the sticky stage with nothing erroring.
    for (const name of ["WORKBENCH", "INDEX"] as const) {
      expect(required(name), `${name} introduced an overflow`).not.toMatch(/\boverflow-/);
    }
    // And the index keeps `min-w-0`, without which a long row pushes the column past its track —
    // a grid item's default `min-width: auto` is what lets that happen silently.
    expect(required("INDEX")).toContain("min-w-0");
  });

  it("POSITIVE CONTROL — de-hoisting WORKBENCH makes the extractor return null", () => {
    const inlined = deHoisted("WORKBENCH");
    expect(inlined).toContain(COLUMNS);
    expect(classConstant(inlined, "WORKBENCH")).toBeNull();
    expect(renderSites(inlined, "WORKBENCH")).toBe(0);
  });
});

describe("colour on this page comes from the bridge, measured rather than looked at", () => {
  /**
   * Figures from `lib/theme/contrast.ts`, each named with the backdrop it was measured against —
   * the page's `--background` for anything the strip and the row paint on (neither fills), and
   * the tile's own `bg-card` for the two tile labels:
   *
   *   `text-primary-strong` on `--background`  7.89 light / 8.99 dark
   *   `text-primary-strong` on `bg-card`       8.36 light / 8.20 dark
   *   `text-primary-strong` on hovered `bg-muted`  6.95 light / 7.06 dark
   *   `text-muted-foreground` on `--background`    7.48 light / 8.53 dark
   *
   * What the retired raw tokens measured on the same backdrops in dark: 2.23, 8.36 (on a tile
   * frozen white — the tile itself read **18.65:1** against the night page), 6.95 (same, frozen)
   * and 2.36.
   */
  it("binds every colour through a bridge token", () => {
    const declarations = [
      "JUMP_HEADING",
      "JUMP_ITEM",
      "DENEME",
      "DENEME_HEADING",
      "DENEME_FACTS",
      "FACT_SEPARATOR",
      "QUESTION_LINK",
    ].map(required);
    for (const declaration of declarations) {
      expect(declaration).not.toMatch(/var\(--color-/);
      expect(declaration).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(declaration).not.toMatch(/\bdark:/);
      expect(declaration).not.toMatch(
        /\b(bg|text|border|ring)-(slate|gray|zinc|neutral|stone|amber|emerald|sky|teal|rose|red|green|blue|orange|yellow|indigo|violet|purple|pink|cyan|lime)-\d{2,3}\b/,
      );
      expect(declaration).not.toMatch(/\b(bg|text|border|ring)-(white|black)\b/);
    }
  });

  it("keeps the two hover signals the retired `:hover` rules carried", () => {
    // Both tiles changed TWO things on hover — the boundary and the fill — and a conversion that
    // kept only one would read as a dead control on the half of the palette where the fill delta
    // is smallest. Measured: the hovered boundary is 4.26 light / 4.29 dark against the hovered
    // fill; the fill itself is 1.20 / 1.16 against the resting tile, which is why the boundary is
    // the signal that actually carries.
    for (const name of ["JUMP_ITEM", "QUESTION_LINK"] as const) {
      const declaration = required(name);
      expect(declaration, `${name} lost its hover boundary`).toContain("hover:border-primary");
      expect(declaration, `${name} lost its hover fill`).toContain("hover:bg-muted");
      // `bg-card` IS the resting fill, so mapping the hover to it deletes the hover instead of
      // translating it — the tempting reading of the plan's own bridge table.
      expect(declaration).not.toContain("hover:bg-card");
      // A filter-based hover scales fill AND ink together, which is how one of these conversions
      // nearly shipped a 4.39:1 label in dark. Not here, and not later either.
      expect(declaration).not.toMatch(/hover:(brightness|contrast|saturate|\[filter)/);
    }
  });

  it("sizes the two headings and the fact strip in rem, not in a named Tailwind step", () => {
    // A named size carries a line-height the stylesheet never set. Measured on this page: the
    // fact strip inherits 1.6 from `body` and renders 13.6px/21.76px, where `text-sm` would make
    // it 14px/20px and reflow all thirty rows.
    expect(required("JUMP_HEADING")).toContain("text-[0.95rem]");
    expect(required("DENEME_HEADING")).toContain("text-[1.05rem]");
    expect(required("DENEME_FACTS")).toContain("text-[0.85rem]");
    expect(required("QUESTION_LINK")).toContain("text-[0.85rem]");
    for (const name of ["JUMP_HEADING", "DENEME_HEADING", "DENEME_FACTS", "QUESTION_LINK"]) {
      expect(required(name)).not.toMatch(/\btext-(xs|sm|base|lg|xl)\b/);
    }
  });

  it("gives the two dots on one fact line the same token", () => {
    // The separator this page renders and `deneme-meta.tsx`'s own sit on ONE line inside ONE fact
    // strip. The retired `--color-taupe` made them different colours (#8a8078 against #57504a);
    // both are `text-muted-foreground` now and this is what keeps them that way.
    expect(required("FACT_SEPARATOR")).toBe('const FACT_SEPARATOR = "text-muted-foreground";');
    const meta = stripComments(readFileSync(new URL("./deneme-meta.tsx", import.meta.url), "utf8"));
    expect(classConstant(meta, "META_SEPARATOR")).toContain("text-muted-foreground");
  });
});
