"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * A measuring tool's result, on its map (T-120; T-121 fills it for the area and coordinate
 * tools). A two-column grid: `summary` beside `actions` on the first row, `details` across the
 * whole second row, so at 320 px the details get the panel's full width instead of the space
 * the buttons leave.
 *
 * `hint` replaces the figures before there is a result ("tap the map"). The figures stay in the
 * grid, `invisible` and `aria-hidden`, so the panel is as tall with a hint as with a result:
 * adding the first point never moves the map (the T-126 rule), and the workbench's fit and label
 * insets, which read the panel's height, do not jump. The hint shares the first column's two rows.
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
  className,
  style,
  ref,
}: {
  label: string;
  summary: React.ReactNode;
  details: React.ReactNode;
  actions: React.ReactNode;
  hint?: string;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const hidden = hint !== undefined;
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
      <div
        aria-hidden={hidden || undefined}
        aria-live={hidden ? undefined : "polite"}
        className={cn("col-start-1 row-start-1 min-w-0", hidden && "invisible")}
      >
        {summary}
      </div>
      <div className="col-start-2 row-start-1 flex items-center gap-1">{actions}</div>
      <div
        aria-hidden={hidden || undefined}
        className={cn("col-start-1 col-span-2 row-start-2 min-w-0", hidden && "invisible")}
      >
        {details}
      </div>
      {/* Always mounted, so the live region exists before its text changes. */}
      <p
        aria-live="polite"
        className="pointer-events-none col-start-1 row-span-2 row-start-1 m-0 self-center text-xs text-muted-foreground"
      >
        {hint}
      </p>
    </div>
  );
}

/** A panel button: icon only below `sm` (its label stays for assistive tech), icon and text from
 *  `sm`, the pattern `MapSelectionCard` uses for its explore action. 32 px tall. */
export function MapResultAction({
  icon,
  label,
  onClick,
  disabled,
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
      onClick={onClick}
      disabled={disabled}
      leftIcon={icon}
      className="min-w-8 px-2 sm:px-3"
    >
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Button>
  );
}
