import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary/12 text-primary-dark border border-primary/25 hover:bg-primary/20",
        primary:
          "bg-primary text-primary-foreground shadow-xs",
        secondary:
          "bg-secondary/15 text-secondary border border-secondary/25 hover:bg-secondary/25",
        success:
          "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
        warning:
          "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
        destructive:
          "bg-red-100 text-red-900 border border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800",
        outline:
          "border border-border bg-card text-foreground",
        info:
          "bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-300 dark:border-cyan-800",
        chip:
          "bg-[var(--color-chip-bg,#ede3d5)] text-[var(--color-chip-ink,#7e3a1e)] rounded-full",
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
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: React.ReactNode;
}

function Badge({
  className,
  variant,
  size,
  dot = false,
  icon,
  children,
  ...props
}: BadgeProps) {
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
