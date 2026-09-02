import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 shadow-2xs transition-all flex items-start gap-3.5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-card text-foreground border-border [&>svg]:text-primary",
        success:
          "bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800 [&>svg]:text-emerald-600",
        warning:
          "bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800 [&>svg]:text-amber-600",
        destructive:
          "bg-red-50 text-red-950 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-800 [&>svg]:text-red-600",
        info:
          "bg-cyan-50 text-cyan-950 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-200 dark:border-cyan-800 [&>svg]:text-cyan-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  onDismiss?: () => void;
}

const defaultIcons = {
  default: <Info className="size-5" />,
  info: <Info className="size-5" />,
  success: <CheckCircle2 className="size-5" />,
  warning: <AlertTriangle className="size-5" />,
  destructive: <AlertCircle className="size-5" />,
};

function Alert({
  className,
  variant = "default",
  icon,
  onDismiss,
  children,
  ...props
}: AlertProps) {
  const chosenIcon = icon !== undefined ? icon : defaultIcons[variant || "default"];

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    >
      {chosenIcon}
      <div className="flex-1 space-y-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded"
          aria-label="Bildirimi kapat"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("font-semibold leading-tight text-sm tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn("text-xs leading-relaxed opacity-90", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
