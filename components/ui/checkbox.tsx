import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  indeterminate?: boolean;
  checkboxSize?: "sm" | "md" | "lg";
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      error,
      indeterminate = false,
      checkboxSize = "md",
      checked,
      defaultChecked,
      disabled,
      id,
      onChange,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const [isChecked, setIsChecked] = React.useState<boolean>(Boolean(defaultChecked || checked));

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(Boolean(checked));
      }
    }, [checked]);

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate && !isChecked);
      }
    }, [indeterminate, isChecked]);

    const sizeClasses = {
      sm: "size-4 rounded",
      md: "size-5 rounded-md",
      lg: "size-6 rounded-md",
    }[checkboxSize];

    const iconSizes = {
      sm: "size-3",
      md: "size-3.5",
      lg: "size-4",
    }[checkboxSize];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (checked === undefined) {
        setIsChecked(e.target.checked);
      }
      onChange?.(e);
    };

    return (
      <div
        className={cn(
          "flex items-start gap-2.5 select-none",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            type="checkbox"
            id={inputId}
            ref={innerRef}
            disabled={disabled}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={handleChange}
            className="peer sr-only"
            {...props}
          />
          <label
            htmlFor={inputId}
            className={cn(
              "flex items-center justify-center border transition-all duration-150 cursor-pointer bg-card",
              sizeClasses,
              isChecked || indeterminate
                ? "bg-primary border-primary text-primary-foreground shadow-xs"
                : "border-border hover:border-primary/50",
              error && "border-destructive",
              "peer-focus-visible:outline-none peer-focus-visible:border-primary peer-focus-visible:ring-3 peer-focus-visible:ring-primary/25",
              disabled && "cursor-not-allowed",
              className,
            )}
          >
            {indeterminate ? (
              <Minus className={cn(iconSizes, "stroke-[3]")} />
            ) : isChecked ? (
              <Check className={cn(iconSizes, "stroke-[3]")} />
            ) : null}
          </label>
        </div>
        {(label || description) && (
          <div className="flex flex-col gap-0.5 leading-none">
            {label && (
              <label
                htmlFor={inputId}
                className={cn(
                  "text-sm font-medium text-foreground cursor-pointer leading-tight",
                  disabled && "cursor-not-allowed",
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-muted-foreground leading-normal mt-0.5">{description}</p>
            )}
            {error && <p className="text-xs font-medium text-destructive mt-1">{error}</p>}
          </div>
        )}
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
