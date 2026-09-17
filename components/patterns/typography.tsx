import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The type scale, as components.
 *
 * `docs/design.md` owns the scale itself; this file reproduces it rather than inventing one.
 * Headings are Fraunces, body is Nunito Sans at 16px/1.6, and the fluid clamps are the ones
 * the design doc documents:
 *
 *   h1  clamp(1.9rem, 1.2rem + 2.6vw, 2.6rem)
 *   h2  clamp(1.4rem, 1rem + 1.4vw, 1.8rem)
 *
 * THE 1.9rem h1 FLOOR IS NOT NEGOTIABLE. `app/globals.css` records that a previous fix round
 * lowered it to solve a 320px wrap, and that the lowering was itself the defect the next
 * review caught: it put one page's h1 below the floor every other h1 on the site respects.
 * A narrow viewport gets more room, never smaller text.
 */

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

export function H1({ className, ...props }: HeadingProps) {
  return (
    <h1
      className={cn(
        "font-heading text-[clamp(1.9rem,1.2rem+2.6vw,2.6rem)] font-bold leading-[1.15] tracking-[-0.01em] text-foreground",
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
        "font-heading text-[clamp(1.4rem,1rem+1.4vw,1.8rem)] font-semibold leading-[1.15] tracking-[-0.01em] text-primary",
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
