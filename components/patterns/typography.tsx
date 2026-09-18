import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The type scale, as components.
 *
 * `docs/design.md` owns the scale itself; this file reproduces it rather than inventing one.
 * Headings are Fraunces, body is Nunito Sans at 16px/1.6, and `h2` keeps the documented fluid
 * clamp, `clamp(1.4rem, 1rem + 1.4vw, 1.8rem)`.
 *
 * ## The h1 is two tiers, and the 1.9rem floor survives both
 *
 * There is no single h1 on this site. Measured across the 17 heroes: 14 hub pages write
 * `text-3xl sm:text-5xl font-bold … text-primary`, and 3 detail pages write
 * `text-4xl sm:text-6xl font-extrabold … text-foreground`. `H1` is the hub tier and
 * `H1Display` is the detail tier; those are the only two, and a third is a defect, not a
 * variant.
 *
 * `H1` used to render the fluid clamp `clamp(1.9rem, 1.2rem + 2.6vw, 2.6rem)` in
 * `text-foreground`, which one page (`/hakkimizda`) rendered and no other h1 on the site did.
 * Retuning it to the hub tier is a real, visible change to that page: the heading becomes
 * terracotta, and 6.4px larger on desktop.
 *
 * THE 1.9rem h1 FLOOR IS STILL NOT NEGOTIABLE, and this spelling does not lower it.
 * `app/globals.css` records that a previous fix round dropped the floor to solve a 320px wrap,
 * and that the lowering was itself the defect the next review caught. The site's own hub
 * spelling and that floor disagree by exactly 0.4px — `text-3xl` is 1.875rem/30px against
 * 1.9rem/30.4px — and by 6.4px at desktop, where the site is the LARGER of the two (`sm:text-5xl`
 * is 48px; the old clamp topped out at 41.6px). So the site wins everything a reader can
 * perceive — the brand colour, the weight, the tracking, the desktop size — and the floor holds
 * in the one place it is sub-perceptual: the mobile size is written `text-[1.9rem]`, not
 * `text-3xl`. Conceding those 0.4px would retire a rule this repo has already paid for once.
 *
 * `text-[1.9rem]` is an arbitrary value, so unlike `text-3xl` it ships NO paired line-height.
 * `leading-tight` in the spelling is load-bearing, not decoration: without it the heading sets
 * solid at 1.9rem and wraps into itself at 320px.
 */

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

/** The hub tier — the h1 of a section landing page. 14 of the site's 17 heroes. */
export function H1({ className, ...props }: HeadingProps) {
  return (
    <h1
      className={cn(
        "font-heading text-[1.9rem] sm:text-5xl font-bold tracking-tight text-primary leading-tight",
        className,
      )}
      {...props}
    />
  );
}

/** The detail tier — the h1 of one province, one country, one sea. Larger, heavier, neutral. */
export function H1Display({ className, ...props }: HeadingProps) {
  return (
    <h1
      className={cn(
        "font-heading text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function H2({ className, ...props }: HeadingProps) {
  return (
    <h2
      className={cn(
        "font-heading text-[clamp(1.4rem,1rem+1.4vw,1.8rem)] font-semibold leading-[1.15] tracking-[-0.01em] text-primary-strong",
        className,
      )}
      {...props}
    />
  );
}

export function H3({ className, ...props }: HeadingProps) {
  return (
    <h3
      className={cn(
        "font-heading text-xl font-bold leading-[1.15] tracking-[-0.01em] text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function H4({ className, ...props }: HeadingProps) {
  return (
    <h4
      className={cn("font-heading text-base font-bold leading-snug text-foreground", className)}
      {...props}
    />
  );
}

export function Lede({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      // `max-w-prose` rather than a character count in a comment: a lede that runs the full
      // width of a desktop container is unreadable however good the copy is.
      className={cn("max-w-prose text-lg leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

export function Muted({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

/**
 * A keyboard key. Three V2 files draw the Ctrl+K hint by hand.
 *
 * `<kbd>` is the right element and carries the meaning on its own, so nothing here adds a
 * role or a label.
 */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5",
        "font-sans text-[11px] font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
