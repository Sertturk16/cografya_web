import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  switchSize?: "sm" | "md" | "lg";
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      className,
      label,
      description,
      switchSize = "md",
      checked,
      defaultChecked,
      disabled,
      id,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const [isOn, setIsOn] = React.useState<boolean>(Boolean(defaultChecked || checked));

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsOn(Boolean(checked));
      }
    }, [checked]);

    const trackClasses = {
      sm: "w-8 h-4.5 p-0.5",
      md: "w-11 h-6 p-0.5",
      lg: "w-14 h-7.5 p-1",
    }[switchSize];

    const thumbClasses = {
      sm: "size-3.5",
      md: "size-5",
      lg: "size-5.5",
    }[switchSize];

    const translateClasses = {
      sm: "translate-x-3.5",
      md: "translate-x-5",
      lg: "translate-x-6.5",
    }[switchSize];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (checked === undefined) {
        setIsOn(e.target.checked);
      }
      onChange?.(e);
    };

    return (
      <div className={cn("flex items-start gap-3 select-none", disabled && "opacity-50 cursor-not-allowed")}>
        <div className="relative inline-flex items-center mt-0.5">
          <input
            type="checkbox"
            role="switch"
            id={inputId}
            ref={ref}
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
              "inline-flex items-center rounded-full transition-colors duration-200 cursor-pointer border border-transparent",
              trackClasses,
              isOn ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/40",
              "peer-focus-visible:outline-none peer-focus-visible:ring-3 peer-focus-visible:ring-primary/25",
              disabled && "cursor-not-allowed",
              className
            )}
          >
            <span
              className={cn(
                "rounded-full bg-white shadow-sm transition-transform duration-200 pointer-events-none block",
                thumbClasses,
                isOn ? translateClasses : "translate-x-0"
              )}
            />
          </label>
        </div>
        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <label
                htmlFor={inputId}
                className={cn(
                  "text-sm font-medium text-foreground cursor-pointer",
                  disabled && "cursor-not-allowed"
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-muted-foreground leading-normal">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
