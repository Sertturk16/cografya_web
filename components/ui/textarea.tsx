import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "w-full rounded-xl border bg-card text-foreground transition-all duration-150 placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-y",
  {
    variants: {
      textareaSize: {
        sm: "min-h-[70px] px-2.5 py-1.5 text-xs",
        md: "min-h-[100px] px-3.5 py-2 text-sm",
        default: "min-h-[100px] px-3.5 py-2 text-sm",
        lg: "min-h-[140px] px-4 py-2.5 text-base",
      },
      hasError: {
        true: "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-3 focus-visible:ring-destructive/20",
        false: "border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
      },
    },
    defaultVariants: {
      textareaSize: "default",
      hasError: false,
    },
  }
);

export interface TextareaProps
  extends React.ComponentProps<"textarea">,
    Omit<VariantProps<typeof textareaVariants>, "hasError"> {
  isError?: boolean;
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, textareaSize, isError = false, autoResize = false, onInput, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={isError ? "true" : undefined}
        onInput={(e) => {
          if (autoResize) {
            const target = e.currentTarget;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
          }
          onInput?.(e);
        }}
        className={cn(textareaVariants({ textareaSize, hasError: isError, className }))}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
