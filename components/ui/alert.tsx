import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 shadow-2xs transition-all flex items-start gap-3.5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-card text-foreground border-border [&>svg]:text-primary",
        success:
          "bg-[var(--color-success,#496f35)]/10 text-[var(--color-success,#496f35)] border-[var(--color-success,#496f35)]/30 dark:bg-[var(--color-success,#496f35)]/20 dark:text-[var(--color-success,#496f35)] dark:border-[var(--color-success,#496f35)]/40 [&>svg]:text-[var(--color-success,#496f35)]",
        warning:
          "bg-amber-500/10 text-amber-900 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300",
        destructive:
          "bg-[var(--color-danger,#b23b2e)]/10 text-[var(--color-danger,#b23b2e)] border-[var(--color-danger,#b23b2e)]/30 dark:bg-[var(--color-danger,#b23b2e)]/20 dark:text-[var(--color-danger,#b23b2e)] dark:border-[var(--color-danger,#b23b2e)]/40 [&>svg]:text-[var(--color-danger,#b23b2e)]",
        info: "bg-[var(--color-info,#276b70)]/10 text-[var(--color-info,#276b70)] border-[var(--color-info,#276b70)]/30 dark:bg-[var(--color-info,#276b70)]/20 dark:text-[var(--color-info,#276b70)] dark:border-[var(--color-info,#276b70)]/40 [&>svg]:text-[var(--color-info,#276b70)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
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
  role,
  ...props
}: AlertProps) {
  const chosenIcon = icon !== undefined ? icon : defaultIcons[variant || "default"];
  const resolvedRole = role ?? (variant === "destructive" ? "alert" : "status");

  return (
    <div role={resolvedRole} className={cn(alertVariants({ variant, className }))} {...props}>
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

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("font-semibold leading-tight text-sm tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-xs leading-relaxed opacity-90", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
