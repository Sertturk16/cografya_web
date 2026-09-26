"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * A measuring tool's result, on its map (T-120; T-121 fills it for the area and coordinate
 * tools). A two-column grid: `summary` beside `actions` on the first row, `details` across the
 * whole second row, so at 320 px the details get the panel's full width instead of the space
 * the buttons leave. Every cell is placed explicitly: an auto-placed two-column row beside
 * another column-1 cell falls into an implicit third column.
 *
 * `hint` replaces the details before there is a result ("tap the map"); the details stay in the
 * grid, `invisible`, so the panel is as tall with a hint as with a result. Adding the first point
 * never moves the map (the T-126 rule), and the workbench's fit and label insets, which read the
 * panel's size, do not jump. The caller keeps the summary's row filled (a dash) for the same
 * reason, and gives the panel a fixed width. `hintTone: "warning"` colours the hint as a warning
 * (the area tool's crossing edges, T-121).
 *
 * Screen readers get `status`, one always-mounted `role="status"` line holding the whole result
 * or the hint; the visible cells are hidden from them. A region that turns live in the same
 * update as its text is not announced, which is what the first total would otherwise do.
 *
 * It sits over (or next to) a pan surface, so a press on it stops there, as `MapSelectionCard`'s
 * does. Placement belongs to the caller (`className`, `style`).
 */
export function MapResultPanel({
  label,
  summary,
  details,
  actions,
  hint,
  hintTone = "muted",
  status,
  className,
  style,
  ref,
}: {
  label: string;
  summary: React.ReactNode;
  details: React.ReactNode;
  actions: React.ReactNode;
  hint?: string;
  hintTone?: "muted" | "warning";
  status: string;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const hinted = hint !== undefined;
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      onPointerDown={stopPropagation}
      onMouseDown={stopPropagation}
      style={style}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl border border-primary/40 bg-card/95 p-2.5 shadow-xl backdrop-blur-md",
        className,
      )}
    >
      <div aria-hidden="true" className="col-start-1 row-start-1 min-w-0">
        {summary}
      </div>
      <div className="col-start-2 row-start-1 flex items-center gap-1">{actions}</div>
      <div
        data-result-details=""
        className={cn("col-start-1 col-span-2 row-start-2 min-w-0", hinted && "invisible")}
        aria-hidden="true"
      >
        {details}
      </div>
      {hinted && (
        <p
          data-result-hint=""
          className={cn(
            "col-start-1 col-span-2 row-start-2 m-0 self-center text-[11px] leading-4",
            hintTone === "warning" ? "text-warning-strong" : "text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {hint}
        </p>
      )}
      <p role="status" aria-atomic="true" className="sr-only">
        {status}
      </p>
    </div>
  );
}

/** A panel button: icon only below `sm` (its label stays for assistive tech), icon and text from
 *  `sm`, the pattern `MapSelectionCard` uses for its explore action. 32 px tall.
 *
 *  `aria-disabled`, never `disabled`: Undo down to no points and Clear both switch off the button
 *  that was just pressed, and a disabled button drops keyboard focus to `<body>`. */
export function MapResultAction({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      leftIcon={icon}
      className="min-w-8 px-2 sm:px-3 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Button>
  );
}
