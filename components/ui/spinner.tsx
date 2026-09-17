import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin shrink-0", {
  variants: {
    size: {
      sm: "size-3.5",
      default: "size-4",
      lg: "size-6",
      xl: "size-8",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof spinnerVariants> {
  /**
   * What is loading. Announced to assistive technology, which otherwise gets a silent
   * spinning icon and no idea anything is happening.
   */
  readonly label?: string;
  /**
   * The caller already owns the live region and the wording — a block that renders
   * "Favorileriniz yükleniyor…" as visible text inside its own `role="status"`.
   *
   * Then this renders the ICON ALONE: no second `role="status"` to nest inside the first
   * (nested live regions are unreliable), and no `sr-only` label repeating a sentence the
   * reader is already being read. T-036 adopted Spinner at eleven call sites and seven of
   * them were of this shape, so the alternative was seven hand-rolled `<Loader2 animate-spin
   * aria-hidden>` — which is the thing this component exists to stop.
   */
  readonly decorative?: boolean;
}

/**
 * Standalone loading indicator, for the cases `Button`'s own `isLoading` does not cover —
 * a panel fetching, a map still resolving.
 *
 * `role="status"` rather than `role="alert"`: a load starting is not an event that should
 * interrupt what a screen-reader user is currently reading. The icon is `aria-hidden` and
 * the label carries the meaning, so the announcement is words rather than "image".
 *
 * `animate-spin` stops under `prefers-reduced-motion`, which `app/globals.css` disables
 * animation globally for — the label still announces, so nothing is lost.
 */
function Spinner({
  className,
  size,
  label = "Yükleniyor",
  decorative = false,
  ...props
}: SpinnerProps) {
  if (decorative) {
    return <Loader2 className={cn(spinnerVariants({ size }), className)} aria-hidden="true" />;
  }
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)} {...props}>
      <Loader2 className={cn(spinnerVariants({ size }))} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Spinner, spinnerVariants };
