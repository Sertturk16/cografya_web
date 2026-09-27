import { Check } from "lucide-react";

/**
 * The list row's watch status (T-128 spec §4.6), drawn empty on the server and switched by the
 * bench island through the row's `data-status` ("done" | "part") and `--ring` (0–1). No client
 * render, so the slot is reserved from first paint and progress arriving shifts nothing (§4.5).
 * The ring's circumference at r=8 is 50.27.
 */
export function StatusIcon({ doneLabel, partLabel }: { doneLabel: string; partLabel: string }) {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="invisible size-5 -rotate-90 group-data-[status=part]/row:visible"
      >
        <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" className="stroke-border" />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-primary [stroke-dasharray:calc(var(--ring,0)*50.27)_50.27]"
        />
      </svg>
      <Check
        aria-hidden="true"
        className="absolute hidden size-5 text-success group-data-[status=done]/row:block"
      />
      <span className="sr-only hidden group-data-[status=done]/row:inline">{doneLabel}</span>
      <span className="sr-only hidden group-data-[status=part]/row:inline">{partLabel}</span>
    </span>
  );
}
