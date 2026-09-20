"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface SettingsCardProps {
  /** Anchor target for the section nav; also what a deep link scrolls to. */
  readonly id: string;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly headerAside?: React.ReactNode;
  readonly children: React.ReactNode;
}

/**
 * The shell every settings section wears (T-061): one panel, one `h2`, one icon, one lede.
 *
 * Four sections rendering their own header would be four chances for the heading level, the
 * icon size or the divider to drift — and the settings page is the one page where four
 * near-identical blocks sit directly above one another, so any drift is visible at a glance.
 *
 * `h2` is fixed here rather than taken as a prop: the page owns the single `h1`, and every
 * section is a peer of every other. A section that wanted a different level would be saying
 * it is nested inside another section, which this layout has no place for.
 */
export function SettingsCard({
  id,
  icon,
  title,
  description,
  headerAside,
  children,
}: SettingsCardProps) {
  const headingId = `${id}-heading`;
  // The anchor target and its scroll offset sit on a wrapper, not on the Card: the variant
  // form of `Card` types `className` as `never` on purpose, so that a panel cannot be
  // quietly re-styled at a call site. A section needs a scroll margin, not a different panel.
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <Card variant="panel" space="6" elevation="sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">{icon}</div>
            <div className="space-y-0.5">
              <h2 id={headingId} className="font-heading font-bold text-lg text-foreground">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>
          {headerAside}
        </div>
        {children}
      </Card>
    </section>
  );
}

export interface SettingsResultProps {
  readonly saved: boolean;
  readonly savedMessage: string;
  readonly errorMessage: string | null;
}

/**
 * A section's one result line.
 *
 * Success is `role="status"` (polite) and failure is `role="alert"` (assertive), which is the
 * distinction that matters to a screen reader: "saved" can wait for a pause, "that did not
 * save" cannot.
 */
export function SettingsResult({ saved, savedMessage, errorMessage }: SettingsResultProps) {
  if (errorMessage) {
    return (
      <div
        role="alert"
        className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive-strong"
      >
        <AlertCircle className="size-4 shrink-0 mt-0.5" />
        <span className="leading-relaxed font-medium">{errorMessage}</span>
      </div>
    );
  }
  if (!saved) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="p-3.5 rounded-2xl bg-success/10 border border-success/25 flex items-start gap-2.5 text-xs text-success-strong"
    >
      <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
      <span className="leading-relaxed font-medium">{savedMessage}</span>
    </div>
  );
}

export function SettingsFieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[11px] font-medium text-destructive">
      {message}
    </p>
  );
}

/** A read-only key/value tile — the "Hesap" section's only shape. */
export function SettingsReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
      <span className="text-muted-foreground font-medium block text-xs">{label}</span>
      <span className="font-semibold text-foreground text-sm block break-words">{value}</span>
    </div>
  );
}
