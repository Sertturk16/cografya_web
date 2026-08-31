"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FlaskConical } from "lucide-react";

interface V2MockBadgeProps {
  label?: string;
  variant?: "badge" | "indicator" | "subtle";
  className?: string;
  tooltipText?: string;
}

export function V2MockBadge({
  label = "Simülasyon / Örnek Veri",
  variant = "badge",
  className = "",
  tooltipText = "Bu özellik konsept ve gösterim aşamasında olup örnek/simüle verilerle çalışmaktadır.",
}: V2MockBadgeProps) {
  if (variant === "subtle") {
    return (
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium text-muted-foreground/80 bg-muted/50 hover:bg-muted px-2 py-0.5 rounded-md border border-border/50 cursor-help transition-colors ${className}`}
      >
        <FlaskConical className="size-3 text-amber-500 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  if (variant === "indicator") {
    return (
      <div
        title={tooltipText}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-medium shadow-2xs cursor-help ${className}`}
      >
        <Sparkles className="size-3 shrink-0 text-amber-500 animate-pulse" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <Badge
      variant="outline"
      size="sm"
      title={tooltipText}
      icon={<FlaskConical className="size-3 text-amber-500" />}
      className={`bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium text-[10px] py-0 cursor-help shadow-2xs ${className}`}
    >
      {label}
    </Badge>
  );
}
