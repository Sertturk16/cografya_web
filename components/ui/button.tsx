import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all duration-150 outline-none select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white hover:bg-[var(--color-primary-dark,#7e3a1e)] shadow-sm hover:shadow",
        primary:
          "bg-primary text-white hover:bg-[var(--color-primary-dark,#7e3a1e)] shadow-sm hover:shadow",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm hover:shadow",
        emerald:
          "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow",
        sky:
          "bg-sky-600 text-white hover:bg-sky-700 shadow-sm hover:shadow",
        teal:
          "bg-teal-600 text-white hover:bg-teal-700 shadow-sm hover:shadow",
        amber:
          "bg-amber-600 text-white hover:bg-amber-700 shadow-sm hover:shadow",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted hover:border-primary/50 shadow-xs",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 shadow-sm",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto font-medium shadow-none active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
        md: "h-10 px-4 py-2 text-sm gap-2 rounded-lg",
        default: "h-10 px-4 py-2 text-sm gap-2 rounded-lg",
        lg: "h-12 px-6 text-base gap-2.5 rounded-lg",
        icon: "size-10 p-0 rounded-lg",
        "icon-sm": "size-8 p-0 rounded-md",
        "icon-lg": "size-12 p-0 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
