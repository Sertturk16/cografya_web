import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary/12 text-[var(--color-primary-dark,#7e3a1e)] border border-primary/25 hover:bg-primary/20",
        primary: "bg-primary text-primary-foreground shadow-xs",
        secondary:
          "bg-secondary/15 text-secondary border border-secondary/25 hover:bg-secondary/25",
        success:
          "bg-[var(--color-success,#496f35)]/15 text-[var(--color-success,#496f35)] border border-[var(--color-success,#496f35)]/30",
        warning:
          "bg-[var(--color-warning,#c9860f)]/15 text-[var(--color-warning,#c9860f)] border border-[var(--color-warning,#c9860f)]/30",
        destructive:
          "bg-[var(--color-danger,#b23b2e)]/15 text-[var(--color-danger,#b23b2e)] border border-[var(--color-danger,#b23b2e)]/30",
        outline: "border border-border bg-card text-foreground",
        info: "bg-[var(--color-info,#276b70)]/15 text-[var(--color-info,#276b70)] border border-[var(--color-info,#276b70)]/30",
        chip: "bg-[var(--color-chip-bg,#ede3d5)] text-[var(--color-chip-ink,#7e3a1e)] rounded-full",
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
