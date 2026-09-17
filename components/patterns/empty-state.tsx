import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly icon?: React.ReactNode;
  readonly title: string;
  /**
   * Why it is empty, in the reader's terms. Ten V2 files hand-roll this, and the useful ones
   * say what to do next rather than restating the title.
   */
  readonly description?: string;
  readonly action?: React.ReactNode;
}

/**
 * Shown where content would be if there were any.
 *
 * `title` is required and `description` is not, because a title alone ("Kayıt bulunamadı") is
 * a complete, honest empty state, whereas a description alone is not.
 *
 * NOT a `role="status"`. An empty state is the page's ordinary content for the current
 * filter, not an event — it is present on first paint and a screen-reader user reaches it by
 * reading, the same way a sighted reader does. Announcing it would interrupt them to report
 * something they were already on their way to.
 *
 * `components/ui/table.tsx` ships `TableEmpty` for the in-table case, which has to be a
 * `<tr>`; this is the general one.
 */
export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon !== undefined ? (
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1.5">
        <p className="font-heading text-base font-bold text-foreground">{title}</p>
        {description !== undefined ? (
          <p className="mx-auto max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action !== undefined ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
