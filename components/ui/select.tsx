import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const selectVariants = cva(
  "w-full appearance-none rounded-xl border bg-card text-foreground transition-all duration-150 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
  {
    variants: {
      selectSize: {
        sm: "h-8 pl-2.5 pr-8 py-1 text-xs",
        md: "h-10 pl-3.5 pr-9 py-2 text-sm",
        default: "h-10 pl-3.5 pr-9 py-2 text-sm",
        lg: "h-12 pl-4 pr-10 py-2.5 text-base",
      },
      hasError: {
        true: "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-3 focus-visible:ring-destructive/20",
        false: "border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
      },
    },
    defaultVariants: {
      selectSize: "default",
      hasError: false,
    },
  }
);

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    Omit<VariantProps<typeof selectVariants>, "hasError"> {
  options?: SelectOption[];
  placeholder?: string;
  isError?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      selectSize,
      isError = false,
      options,
      placeholder,
      children,
      disabled,
      defaultValue,
      value,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("relative flex items-center w-full", disabled && "opacity-50")}>
        <select
          ref={ref}
          disabled={disabled}
          defaultValue={defaultValue}
          value={value}
          aria-invalid={isError ? "true" : undefined}
          className={cn(selectVariants({ selectSize, hasError: isError, className }))}
          {...props}
        >
          {placeholder && (
            <option value="" disabled selected={defaultValue === undefined && value === undefined}>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 size-4 text-muted-foreground shrink-0"
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select, selectVariants };
