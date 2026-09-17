import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, Lightbulb, TriangleAlert, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const calloutVariants = cva("rounded-2xl border-l-4 px-4 py-3.5 [&>svg]:shrink-0", {
  variants: {
    variant: {
      note: "border-l-info bg-info/8 [&>svg]:text-info-strong",
      tip: "border-l-success bg-success/8 [&>svg]:text-success-strong",
      caution: "border-l-warning bg-warning/8 [&>svg]:text-warning-strong",
      source: "border-l-border bg-muted [&>svg]:text-muted-foreground",
    },
  },
  defaultVariants: { variant: "note" },
});

const DEFAULT_ICONS = {
  note: <Info className="size-4" />,
  tip: <Lightbulb className="size-4" />,
  caution: <TriangleAlert className="size-4" />,
  source: <BookOpen className="size-4" />,
} as const;

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof calloutVariants> {
  readonly title?: string;
  readonly icon?: React.ReactNode;
}

/**
 * An EDITORIAL ASIDE inside teaching copy: a definition, a caution about a common
 * misconception, a note on where a figure came from.
 *
 * ## Callout is not Alert, and the difference is load-bearing
 *
 * `Alert` reports SYSTEM STATE — a request failed, an email is unverified, a feature flag is
 * off. It resolves a `role` for exactly that reason: `alert` for destructive, `status`
 * otherwise.
 *
 * `Callout` has NO role, deliberately. Typesetting a pedagogical note as an `Alert` gives it
 * `role="alert"` or `role="status"` semantics, so assistive technology interrupts the reader
 * for something that is not an event and nothing has gone wrong — and the visual language of
 * "something broke" gets attached to ordinary teaching material. The failure is silent and
 * one-directional: it looks fine on screen and misbehaves only for the readers who cannot
 * see it.
 *
 * `components/en-work-in-progress-notice.tsx` already reasons its way to the same conclusion
 * for its own note.
 *
 * The heading is a `<p>`, not an `<h*>`: a callout sits inside a section that already has a
 * heading, and injecting a real heading here would put a rung in the document outline that
 * the page structure does not have.
 */
export function Callout({
  className,
  variant = "note",
  title,
  icon,
  children,
  ...props
}: CalloutProps) {
  const resolvedIcon = icon !== undefined ? icon : DEFAULT_ICONS[variant ?? "note"];

  return (
    <div className={cn(calloutVariants({ variant, className }))} {...props}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5">
          {resolvedIcon}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          {title !== undefined ? (
            <p className="text-sm font-bold text-foreground">{title}</p>
          ) : null}
          <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

export { calloutVariants };
