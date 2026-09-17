"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends Omit<React.ComponentProps<"input">, "id"> {
  readonly id: string;
  readonly label: string;
  /** Guidance shown when there is no error. Replaced by `error` when one appears. */
  readonly helper?: string;
  readonly error?: string;
  readonly fieldClassName?: string;
}

/**
 * Label, control, helper text and error, wired together so the wiring cannot be forgotten.
 *
 * ## The contract
 *
 * The control gets `aria-invalid` and an `aria-describedby` pointing at whichever of helper
 * and error is currently rendered. Helper and error are mutually exclusive: showing both
 * means the reader has to work out which one applies, and a screen reader reads both in
 * sequence with no indication that one supersedes the other.
 *
 * ## Supersedes V2TextField
 *
 * T-032's plan builds `V2TextField`/`V2FormErrorRegion` for the three ported auth flows.
 * Whichever task lands second consumes what the first produced — both plans carry that rule
 * so the repo does not end up with two form-field abstractions. This is the one to keep.
 */
export function FormField({
  id,
  label,
  helper,
  error,
  className,
  fieldClassName,
  ...inputProps
}: FormFieldProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error.length > 0;
  const describedBy = hasError ? errorId : helper !== undefined ? helperId : undefined;

  return (
    <div className={cn("space-y-1.5", fieldClassName)}>
      <Label htmlFor={id} className="text-xs font-bold text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className={cn(hasError && "border-destructive", className)}
        {...inputProps}
      />
      {hasError ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-semibold text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : helper !== undefined ? (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export interface FormErrorSummaryProps {
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
  readonly summary: string;
  readonly fieldErrors?: readonly { readonly id: string; readonly label: string }[];
}

/**
 * The error region a form moves focus to when submission fails.
 *
 * `tabIndex={-1}` makes the heading programmatically focusable — Tab never lands here, but
 * the form can move focus to it — and `role="alert"` is what announces the change. Unlike
 * `Callout`, this one IS an event: something the reader just did did not work.
 *
 * Each field error links to its input by `id`, so the reader can jump straight to the field
 * rather than hunting for it.
 */
export function FormErrorSummary({ headingRef, summary, fieldErrors }: FormErrorSummaryProps) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"
    >
      {/* `-strong` throughout, not the base member: this is text on a tint of its own colour,
          the shape `components/ui/badge.tsx` documents. The heading also states its own size,
          because `@layer base` gives a bare `h2` a fluid `clamp(1.4rem, …)`. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-sm font-bold text-destructive-strong"
      >
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {summary}
      </h2>
      {fieldErrors !== undefined && fieldErrors.length > 0 ? (
        <ul role="list" className="list-disc space-y-1 pl-5 text-xs text-destructive-strong">
          {fieldErrors.map((fieldError) => (
            <li key={fieldError.id}>
              {/* The colour is stated here rather than inherited: `@layer base`'s `a` rule
                  beats inherited colour, so these links froze at the light-mode link colour —
                  measured at 1.99:1 on the dark error tint. */}
              <a
                href={`#${fieldError.id}`}
                className="text-destructive-strong underline underline-offset-2"
              >
                {fieldError.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
