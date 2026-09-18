import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * THE SITE'S CARD LANGUAGE, AS AXES RATHER THAN NAMES.
 *
 * `Card` shipped from the CLI wearing `rounded-xl` + `ring-1 ring-foreground/10`. The site does
 * not write that anywhere: it writes `rounded-2xl`/`rounded-3xl` + `border border-border` +
 * a `shadow-*`, 486 times, and `components/v2/page-composition.test.ts` counts every one. T-035
 * PR4's decision is that the site wins and the primitive adapts.
 *
 * The measured spellings (see that file's card section for the pinned totals) are NOT seven card
 * types. They are THREE surfaces at several settings of two other things:
 *
 *   - `rounded-3xl … bg-card p-6 sm:p-8` appears 54 times across 12 spellings that differ only in
 *     which `shadow-*` and which `space-y-*` they carry — 37 at `shadow-sm`, 10 at `shadow-xs`,
 *     6 at `shadow-xl`, 1 at `shadow-md`;
 *   - the `bg-card/85 backdrop-blur-md` hero strip appears 12 times at one padding and one rhythm;
 *   - the gradient hero plate appears 13 times, once on each of 13 hub pages.
 *
 * So `variant` is the SURFACE, `elevation` is the shadow, `space` is the rhythm, and each union is
 * CLOSED with `className?: never` — the shape `components/patterns/page-container.tsx` set in PR1,
 * for the reason its docblock gives: a passthrough reproduces the spellings it replaced through
 * the prop, and the counter stops meaning anything.
 *
 * A fourth surface (`rounded-2xl bg-card p-4 shadow-2xs`) was measured and deliberately NOT built:
 * all 52 of its occurrences, plus the 4 in `turkiye/bolge/page.tsx` that add `space-y-1`, are the
 * Metric Strip tile, which `components/patterns/stat-tile.tsx` owns. Every other
 * `rounded-2xl bg-card` panel on the surface with 3+ occurrences is a stat-grid tile too. A `tile`
 * variant would have had zero consumers that are not strip tiles.
 */
const CARD_SURFACES = {
  /** The section panel: 54 measured occurrences, 51 of them adopted. */
  panel: "rounded-3xl border border-border bg-card p-6 sm:p-8",
  /** The translucent hero strip, over a page's own gradient band: 12 occurrences. */
  glass: "rounded-2xl border border-border bg-card/85 backdrop-blur-md p-4 sm:p-5",
  /** The hub hero plate that holds `PageHero`: 13 occurrences, one per hub page. */
  feature:
    "relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10",
} as const;

/**
 * Its own axis because the measurement says so: the SAME panel surface carries `shadow-sm` 37
 * times, `shadow-xs` 10 and `shadow-xl` 6. Folding those into the variant name would have made
 * three panels out of one; leaving them out would have left 16 panels hand-drawn.
 *
 * `lg` has no explicit caller — it is `feature`'s default, which is how `shadow-lg` reaches the
 * 13 hero plates.
 */
const CARD_ELEVATIONS = {
  xs: "shadow-xs",
  sm: "shadow-sm",
  lg: "shadow-lg",
  xl: "shadow-xl",
} as const;

/** The rhythm, mirroring the measured `space-y-*` settings. `none` is 17 of the 76 adopted sites. */
const CARD_SPACE = {
  none: "",
  "1": "space-y-1",
  "3": "space-y-3",
  "4": "space-y-4",
  "5": "space-y-5",
  "6": "space-y-6",
} as const;

/** Each surface's own elevation, so `elevation` is written only where a site departs from it. */
const DEFAULT_ELEVATION = {
  panel: "sm",
  glass: "xs",
  feature: "lg",
} as const satisfies Record<CardVariant, CardElevation>;

export type CardVariant = keyof typeof CARD_SURFACES;
export type CardElevation = keyof typeof CARD_ELEVATIONS;
export type CardSpace = keyof typeof CARD_SPACE;

/**
 * The element a variant card renders.
 *
 * Closed, and it exists because the adoption could not be honest without it: 8 of the 77 sites are
 * `<section>` — three carrying an `aria-labelledby` (`earthquake-attribution`,
 * `marine-attribution`, `v2-related-tools`), one an `id` a quicknav links to (`dunya/kita`), four
 * with no ARIA (`turkiye/[slug]`) — and 8 more are `<article>` in `v2-sea-basin-detail-view.tsx`.
 * Rewriting those as `<div>` to fit the primitive would have deleted document structure to make a
 * counter fall; it is a landmark and a heading outline, not an attribute tally, that is preserved.
 */
export type CardElement = "div" | "section" | "article";

/**
 * The class string one variant card wears — exported so the contract test can assert it, and so a
 * `shadcn add` that overwrites this file fails the suite instead of silently reverting the site to
 * `rounded-xl ring-1`. `docs/design.md` records that the CLI asked to overwrite `button.tsx`
 * during T-034; `button.tsx`'s own hand-added variants are the precedent for this living here.
 *
 * Joined rather than `cn()`-merged on purpose: every token here is distinct and the adopted sites
 * must render the exact string they used to write inline. `tailwind-merge` has no conflict to
 * resolve, so running it would only add a way for one to disappear.
 */
export function cardVariants({
  variant,
  space = "none",
  elevation,
}: {
  variant: CardVariant;
  space?: CardSpace;
  elevation?: CardElevation;
}): string {
  return [
    CARD_SURFACES[variant],
    CARD_ELEVATIONS[elevation ?? DEFAULT_ELEVATION[variant]],
    CARD_SPACE[space],
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The CLI's own card, unchanged: 93 `<Card*>` elements across 9 importers rendered it before the
 * adoption and still do.
 *
 * **This branch is still an open `className` passthrough, and that is inherited, not introduced.**
 * The two guards in the variant branch below do NOT cover it: `<Card className="rounded-2xl
 * bg-card border-border">` compiles, merges, and renders a hand-drawn card wearing a primitive's
 * tag. It differs from the hole those guards close only in that nothing here ever promised
 * otherwise — the counter does not see it either, because `cardKind` returns `null` for every
 * `<Card*>` tag (`page-composition.test.ts` SCOPE note 4, which pins that exclusion as inert and
 * re-measures it). So: do not reach for the stock branch as an escape hatch from the closed
 * unions. A variant card that needs width or layout gets a wrapper element, not a `className`.
 */
type StockCardProps = React.ComponentProps<"div"> & {
  size?: "default" | "sm";
  variant?: never;
  elevation?: never;
  space?: never;
  as?: never;
};

type VariantCardProps = Omit<React.ComponentProps<"div">, "className"> & {
  variant: CardVariant;
  elevation?: CardElevation;
  space?: CardSpace;
  as?: CardElement;
  /** No escape hatch. See the docblock above `CARD_SURFACES`. */
  className?: never;
  size?: never;
};

function Card(props: StockCardProps | VariantCardProps) {
  if (props.variant === undefined) {
    const { className, size = "default", ...rest } = props as StockCardProps;
    return (
      <div
        data-slot="card"
        data-size={size}
        className={cn(
          "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
          className,
        )}
        {...rest}
      />
    );
  }

  /**
   * TWO GUARDS, BECAUSE `className?: never` IS NOT ONE.
   *
   * The type rejects `className="zz"` and every typed spread — 15 smuggles were checked — but an
   * INDEX-SIGNATURE spread walks straight through it: `const bag: Record<string, unknown> =
   * { className: "zz" }; <Card variant="panel" {...bag} />` typechecks with zero errors, because
   * TypeScript does not check a `Record<string, unknown>` spread against `never`. And it was worse
   * than a merge: `{...rest}` used to come AFTER `className`, so the smuggled class REPLACED the
   * surface while the element still advertised `data-variant="panel"`. Invisible to both nets —
   * the type system passes it, and `cardKind` returns `null` for every `<Card>` tag, so a caller
   * could re-spell `rounded-2xl bg-card border-border` through a spread and no counter would move.
   * That is the load-bearing invariant of the whole PR4 counting programme.
   *
   * So: `className` is destructured OUT of `rest`, so it can never reach the element whatever its
   * declared type says; and `{...rest}` is spread FIRST, so the computed surface and the two data
   * attributes win even if someone reintroduces the hole. Either fix alone closes today's case;
   * both together mean the next edit to this line cannot silently reopen it. Pinned at runtime by
   * `card-variants.test.tsx` — a type-level guard with an unpinned runtime hole is worth exactly
   * what the runtime behaviour is worth.
   *
   * Latent, not live, when this was found: no call site spreads into `Card` today.
   */
  const { variant, elevation, space, as: Element = "div", className, ...rest } = props;
  void className;
  return (
    <Element
      {...rest}
      data-slot="card"
      data-variant={variant}
      className={cardVariants({ variant, space, elevation })}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
