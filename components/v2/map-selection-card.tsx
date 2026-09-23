"use client";

import * as React from "react";
import { ArrowRight, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The card a map shows for its selected province or country (T-079). Three grid columns —
 * leading mark, text, actions — so the actions can never sit on top of the stats: at 390px the
 * old single flex row let the "İncele" button cover the area figure. The stats wrap inside their
 * own column instead of truncating. Below `sm` the explore action is an icon, its label kept for
 * assistive tech. Placement belongs to the caller (`className`): an overlay inside `/turkiye`'s
 * map box, a block under `/dunya`'s map on phones.
 */
export function MapSelectionCard({
  leading,
  title,
  badges,
  stats,
  href,
  exploreLabel,
  closeLabel,
  onClose,
  className,
}: {
  leading?: React.ReactNode;
  title: string;
  badges?: React.ReactNode;
  stats: readonly string[];
  href: React.ComponentProps<typeof Link>["href"];
  exploreLabel: string;
  closeLabel: string;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      // The card sits inside (or next to) a pan surface; a press on it must not start a drag.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl border border-primary/40 bg-card/95 p-2.5 shadow-xl backdrop-blur-md animate-in fade-in-50 duration-200 sm:p-3",
        className,
      )}
    >
      <div className="row-span-2">{leading}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-heading text-sm font-bold text-foreground">{title}</span>
        {badges}
      </div>
      <div className="row-span-2 flex items-center gap-1">
        <Link
          href={href}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "h-8 px-2 sm:px-2.5")}
        >
          <span className="sr-only sm:not-sr-only">{exploreLabel}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="col-start-2 flex flex-wrap gap-x-1.5 font-mono text-[11px] text-muted-foreground">
        {stats.map((stat, i) => (
          <span key={stat}>{i > 0 ? `· ${stat}` : stat}</span>
        ))}
      </p>
    </div>
  );
}
