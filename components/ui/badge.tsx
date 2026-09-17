import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * TEXT ON A TINT USES THE `-strong` MEMBER, not the base (T-034). A 15% tint of the base is a
 * very light surface, and the base colour on top of it measures 4.00-4.17:1 for success and
 * info, 3.98:1 for destructive and 2.62:1 for warning — all under 4.5:1. `app/globals.css`
 * documents the derivation and the measurements beside the tokens.
 *
 * `default` and `secondary` were left on the base member when that fix went in, because the
 * four SEMANTIC families were what the round was about and the brand pair reads as chrome
 * rather than as status. They are built the same way and they failed the same way — measured
 * afterwards at 4.12:1 and 4.54:1 in light mode. The rule is about the SHAPE (text on a tint
 * of itself), not about which family the colour belongs to.
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-primary/12 text-primary-strong border border-primary/25 hover:bg-primary/20",
        primary: "bg-primary text-primary-foreground shadow-xs",
        secondary:
          "bg-secondary/15 text-secondary-strong border border-secondary/25 hover:bg-secondary/25",
        success: "bg-success/15 text-success-strong border border-success/30",
        warning: "bg-warning/15 text-warning-strong border border-warning/30",
        destructive: "bg-destructive/15 text-destructive-strong border border-destructive/30",
        outline: "border border-border bg-card text-foreground",
        info: "bg-info/15 text-info-strong border border-info/30",
        chip: "bg-chip text-chip-foreground rounded-full",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px] gap-1 rounded-md",
        default: "px-2.5 py-0.5 text-xs gap-1.5 rounded-md",
        lg: "px-3 py-1 text-sm gap-1.5 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: React.ReactNode;
}

function Badge({ className, variant, size, dot = false, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {dot && (
        <span
          className="size-1.5 rounded-full bg-current shrink-0 animate-pulse"
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
