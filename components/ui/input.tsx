import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-xl border bg-card text-foreground transition-all duration-150 placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      inputSize: {
        sm: "h-8 px-2.5 py-1 text-xs",
        md: "h-10 px-3.5 py-2 text-sm",
        default: "h-10 px-3.5 py-2 text-sm",
        lg: "h-12 px-4 py-2.5 text-base",
      },
      hasError: {
        true: "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-3 focus-visible:ring-destructive/20 aria-invalid:ring-destructive/20",
        false: "border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
      },
    },
    defaultVariants: {
      inputSize: "default",
      hasError: false,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix">,
    Omit<VariantProps<typeof inputVariants>, "hasError"> {
  isError?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      inputSize,
      isError = false,
      leftIcon,
      rightIcon,
      prefix,
      suffix,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasAddons = Boolean(leftIcon || rightIcon || prefix || suffix);

    if (!hasAddons) {
      return (
        <input
          type={type}
          ref={ref}
          disabled={disabled}
          aria-invalid={isError ? "true" : undefined}
          className={cn(inputVariants({ inputSize, hasError: isError, className }))}
          {...props}
        />
      );
    }

    return (
      <div className={cn("relative flex items-center w-full", disabled && "opacity-50")}>
        {prefix && (
          <span className="inline-flex items-center px-3 border border-r-0 border-border rounded-l-lg bg-muted text-muted-foreground text-sm self-stretch shrink-0">
            {prefix}
          </span>
        )}
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          disabled={disabled}
          aria-invalid={isError ? "true" : undefined}
          className={cn(
            inputVariants({ inputSize, hasError: isError, className }),
            leftIcon && "pl-9",
            rightIcon && "pr-9",
            prefix && "rounded-l-none",
            suffix && "rounded-r-none"
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 flex items-center pointer-events-none text-muted-foreground">
            {rightIcon}
          </div>
        )}
        {suffix && (
          <span className="inline-flex items-center px-3 border border-l-0 border-border rounded-r-lg bg-muted text-muted-foreground text-sm self-stretch shrink-0">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
