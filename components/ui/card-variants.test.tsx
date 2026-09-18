import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { Card, cardVariants, type CardVariant } from "./card";

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
 * **What this file uniquely catches, stated narrowly because the broad claim is false.** A
 * WHOLESALE overwrite cannot land silently in any case: `pnpm typecheck` exits 2 with 83 errors
 * across the 77 adoption sites (`Property 'variant' does not exist…`), and the suite reds here
 * too. What nothing else in the repo catches is a **token-level re-theme** — `rounded-3xl` to
 * `rounded-2xl`, `shadow-sm` to `shadow-md`, `to-muted/30` to `to-muted/20` — which keeps the prop
 * names, typechecks clean, passes every other test, and silently re-spells 77 live surfaces.
 * `page-composition.test.ts` cannot see it: `CARD_SCAN_EXCLUSIONS` excludes `components/ui/`.
 *
 * `cardVariants` is exported so this can assert what the component will actually put on the
 * element rather than grepping the file for a substring; `renderToStaticMarkup` (no jsdom in this
 * suite — `docs/conventions.md`) is what pins the half a pure function cannot express.
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
    // ORDER MATTERS HERE, and it was wrong once. Under the scenario this file exists for — the
    // whole file replaced by the CLI's — a hard `expect` on `className?: never` aborts the test
    // and everything below it reports nothing, so the `CardAction` guard contributed nothing
    // under the exact case it was written for. `expect.soft` makes every fact reportable in one
    // run instead of one fact per run.
    expect.soft(source).toContain("ring-1 ring-foreground/10");
    expect.soft(source).toContain("[--card-spacing:--spacing(4)]");
    // `className?: never` is half the contract `cardVariants` cannot express. The OTHER half is
    // runtime and is asserted below, because the type alone does not hold — see the spread tests.
    expect.soft(source).toContain("className?: never");
    // Deleted by Task 5 for having no product call site; a CLI overwrite brings it straight back.
    expect.soft(source).not.toContain("CardAction");
  });
});

/**
 * RULING AS. `className?: never` is a claim about the TYPE, and the type is not the guard.
 *
 * `const bag: Record<string, unknown> = { className: "zz-evil" }; <Card variant="panel" {...bag} />`
 * typechecks with zero errors — TypeScript does not check an index-signature spread against
 * `never` — and before this fix the smuggled class did not merge with the surface, it REPLACED it,
 * because `{...rest}` was spread after `className`. The element rendered `class="zz-evil"` while
 * still advertising `data-variant="panel"`: invisible to the type system AND to `cardKind`, which
 * returns `null` for every `<Card>` tag. A caller could have re-spelled a hand-drawn card through
 * a spread and no counter in the PR4 programme would have moved.
 *
 * So the runtime behaviour is pinned here rather than inferred from the declaration. Both halves
 * of the fix are exercised: that the surface survives (ordering) and that `zz-evil` never reaches
 * the element at all (the explicit strip). MUTATION-CHECKED 2026-09-18, each reverted:
 *
 *   - `className` put back into `rest` AND `{...rest}` moved back after `className` (the exact
 *     pre-fix code) — RED on all three variants, `expected '<div data-slot="card"
 *     data-variant="p…' not to contain 'zz-evil'`, i.e. the smuggled class on the element beside
 *     an intact `data-variant`, which is the shape Ruling AS names;
 *   - only the ordering reverted, with the strip kept — GREEN, which is the point of keeping both:
 *     each closes the case alone, and the pair means the next edit to that line cannot reopen it.
 */
describe("a variant Card cannot be made to wear a smuggled className", () => {
  const smuggle = (): Record<string, unknown> => ({ className: "zz-evil" });

  it.each(SURFACES)("%s keeps its surface when a Record spread carries a className", (variant) => {
    const html = renderToStaticMarkup(<Card variant={variant} space="4" {...smuggle()} />);
    expect(html).not.toContain("zz-evil");
    for (const token of cardVariants({ variant, space: "4" }).split(" ")) {
      expect(html).toContain(token);
    }
    expect(html).toContain(`data-variant="${variant}"`);
  });

  it("the probe is a real smuggle — positive control on the stock branch", () => {
    // The same spread DOES reach the stock card, which never promised otherwise. Without this,
    // a `smuggle()` that had quietly stopped producing a `className` would leave the three
    // assertions above passing vacuously.
    const html = renderToStaticMarkup(<Card {...smuggle()} />);
    expect(html).toContain("zz-evil");
  });

  it("a spread that carries no className still reaches the element", () => {
    // The strip must remove `className` and nothing else: `id`, ARIA and the rest still pass
    // through, which is what the eight `as="section"` adoption sites depend on.
    const html = renderToStaticMarkup(
      <Card as="section" variant="panel" id="zz-id" aria-labelledby="zz-heading" />,
    );
    expect(html).toContain("<section");
    expect(html).toContain('id="zz-id"');
    expect(html).toContain('aria-labelledby="zz-heading"');
    expect(html).toContain("rounded-3xl");
  });
});
