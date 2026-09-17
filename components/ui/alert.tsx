import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * T-034: every variant below reads BRIDGE tokens (`bg-success`, `text-info`) rather than the
 * `var(--color-x, #hex)` escapes it shipped with. Those escapes read Terra tokens that the
 * `.dark` block never redefines, so the whole component was frozen at its light values in
 * dark mode.
 *
 * The `dark:` twins that used to sit beside each variant are deleted rather than translated.
 * They never did anything: `dark:text-[var(--color-success,#496f35)]` resolved to the exact
 * same colour as its light counterpart, because both read the same un-redefined token. The
 * difference between the themes belongs in the `.dark` block, which is where it now lives.
 */
const alertVariants = cva(
  "relative w-full rounded-xl border p-4 shadow-2xs transition-all flex items-start gap-3.5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        /* `bg-muted`, not `bg-card`. Alert is the component that HAS a box — that is now the
           structural line between it and `Callout`, which has none — and `bg-card` was the
           same colour as the surface an alert normally sits on, measuring 1.06:1. The four
           coloured variants get their box from their own tint; this one has no hue to tint,
           so it takes the neutral surface that is not the card. */
        default: "bg-muted text-foreground border-border [&>svg]:text-primary",
        success: "bg-success/10 text-success-strong border-success/30 [&>svg]:text-success-strong",
        warning: "bg-warning/10 text-warning-strong border-warning/30 [&>svg]:text-warning-strong",
        destructive:
          "bg-destructive/10 text-destructive-strong border-destructive/30 [&>svg]:text-destructive-strong",
        info: "bg-info/10 text-info-strong border-info/30 [&>svg]:text-info-strong",
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

type AlertTitleLevel = 2 | 3 | 4 | 5 | 6;

export interface AlertTitleProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Promote the title to a real heading. Only for an alert that IS the page's content — a
   * full-page error state, say — where the reader needs it in the document outline.
   */
  readonly level?: AlertTitleLevel;
}

/**
 * A paragraph by default, not a heading.
 *
 * `Callout` and `EmptyState` both deliberately use `<p>` for their leads and record why: a
 * component that sits inside a section which already has a heading puts a rung in the outline
 * that the page structure does not have. `AlertTitle` shipped as `<h5>` and contradicted its
 * own siblings — and because an alert is a component you use several of, five demo alerts
 * added ten headings to one page's outline, at a level two rungs below anything above them.
 *
 * The `level` prop is the door out, for the case that genuinely wants a heading. It is a
 * deliberate act rather than the default, which is the point.
 */
function AlertTitle({ className, level, ...props }: AlertTitleProps) {
  const Tag = (level === undefined ? "p" : `h${level}`) as React.ElementType;
  return (
    <Tag
      className={cn("font-semibold leading-tight text-sm tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-xs leading-relaxed opacity-90", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
