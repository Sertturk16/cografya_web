import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { cardVariants, type CardVariant } from "./card";

/**
 * THE CLI TRIPWIRE.
 *
 * `docs/design.md` records the concrete risk this file exists for: `shadcn add` **overwrites**
 * files in the configured `ui` alias, and it asked to overwrite `button.tsx` during T-034. The
 * three surfaces below are not the CLI's card — they are the site's own card language, measured
 * off 76 real elements and adopted at all 76 (see `components/v2/page-composition.test.ts`, the
 * card section). An overwrite would restore the stock `rounded-xl ring-1 ring-foreground/10` card,
 * and **no other test in this repo would notice**: `page-composition.test.ts` excludes
 * `components/ui/**` from its walk, and the adopted sites would keep compiling and keep rendering
 * — in the wrong shape, on 28 files, in a diff nobody reviews because it touches one file.
 *
 * So the assertions are on the exact CLASS STRINGS, not on "a variant exists". A rewrite that
 * kept the prop names and changed the tokens is the same failure as a rewrite that deleted them.
 *
 * `.ts`, not the `.tsx` the brief named: there is no jsdom in this suite (`vitest.config.ts`,
 * `docs/conventions.md`), so nothing renders. `cardVariants` is a pure function, which is why it
 * is exported — this checks what the component will actually put on the element, one call away
 * from the element itself, rather than grepping the file for a substring.
 *
 * MUTATION-CHECKED 2026-09-18, four ways, each reverted:
 *
 *   - `panel`'s `rounded-3xl` changed to `rounded-2xl` — RED, `expected 'rounded-2xl border …' to
 *     be 'rounded-3xl border …'`, on the panel row of the surface table;
 *   - `feature`'s `to-muted/30` changed to `to-muted/20` — RED, same shape, on the feature row;
 *   - `panel`'s default elevation changed from `sm` to `xs` — RED on "each surface carries its own
 *     measured elevation by default", `expected '… shadow-xs' to be '… shadow-sm'`;
 *   - `cardVariants` un-exported, which is what a CLI overwrite of this file amounts to — RED on
 *     every assertion at once, `TypeError: (0 , cardVariants) is not a function`, plus RED on the
 *     source guard below.
 */
const SURFACES: ReadonlyArray<readonly [CardVariant, string]> = [
  ["panel", "rounded-3xl border border-border bg-card p-6 sm:p-8"],
  ["glass", "rounded-2xl border border-border bg-card/85 backdrop-blur-md p-4 sm:p-5"],
  [
    "feature",
    "relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10",
  ],
];

/** Each surface's measured elevation, i.e. what it renders when no `elevation` is passed. */
const DEFAULT_ELEVATIONS: ReadonlyArray<readonly [CardVariant, string]> = [
  ["panel", "shadow-sm"],
  ["glass", "shadow-xs"],
  ["feature", "shadow-lg"],
];

describe("the Card variants survive a CLI overwrite", () => {
  it.each(SURFACES)("%s renders exactly its measured surface tokens", (variant, surface) => {
    const [, elevation] = DEFAULT_ELEVATIONS.find(([name]) => name === variant)!;
    expect(cardVariants({ variant })).toBe(`${surface} ${elevation}`);
  });

  it.each(DEFAULT_ELEVATIONS)(
    "%s carries its own measured elevation by default",
    (variant, shadow) => {
      expect(cardVariants({ variant }).split(" ")).toContain(shadow);
    },
  );

  it("the elevation axis exists and overrides the default", () => {
    // The axis is what let 16 panels (10 at `shadow-xs`, 6 at `shadow-xl`) be adopted without
    // inventing `panel-xs` and `panel-xl` as separate surfaces.
    expect(cardVariants({ variant: "panel", elevation: "xs" })).toContain("shadow-xs");
    expect(cardVariants({ variant: "panel", elevation: "xl" })).toContain("shadow-xl");
    expect(cardVariants({ variant: "panel", elevation: "xs" })).not.toContain("shadow-sm");
  });

  it("the space axis renders every measured rhythm, and none for `none`", () => {
    for (const space of ["1", "3", "4", "5", "6"] as const) {
      expect(cardVariants({ variant: "panel", space }).split(" ")).toContain(`space-y-${space}`);
    }
    expect(cardVariants({ variant: "panel", space: "none" })).not.toContain("space-y-");
    expect(cardVariants({ variant: "panel" })).not.toContain("space-y-");
  });

  it("reproduces the exact spelling of the largest adopted site", () => {
    // 13 elements wrote this string by hand before Task 5. Asserted whole, in the order the
    // component emits it, because "contains the right tokens" is what a re-theme would also pass.
    expect(cardVariants({ variant: "panel", space: "4" })).toBe(
      "rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4",
    );
    expect(cardVariants({ variant: "glass", space: "1" })).toBe(
      "rounded-2xl border border-border bg-card/85 backdrop-blur-md p-4 sm:p-5 shadow-xs space-y-1",
    );
    expect(cardVariants({ variant: "feature" })).toBe(
      "relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg",
    );
  });

  /**
   * The stock card is not collateral damage. `Card` without a `variant` is still the CLI's
   * component, and 93 `<Card*>` elements across 9 importers rendered it before this task — so an
   * assertion that only proved the variants exist could be satisfied by a rewrite that broke them.
   */
  it("the stock card's chrome is still in the file, unmerged with the variants", () => {
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./card.tsx", import.meta.url)), "utf8"),
    );
    expect(source).toContain("ring-1 ring-foreground/10");
    expect(source).toContain("[--card-spacing:--spacing(4)]");
    // `className?: never` is the half of the contract `cardVariants` cannot express: it is what
    // stops a caller re-introducing the spelling the variant replaced. A CLI overwrite deletes it.
    expect(source).toContain("className?: never");
    // Deleted by Task 5 for having no product call site; a CLI overwrite brings it straight back.
    expect(source).not.toContain("CardAction");
  });
});
