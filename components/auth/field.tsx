"use client";

import type { InputHTMLAttributes, ReactNode, RefObject, SelectHTMLAttributes } from "react";
import styles from "./auth-form.module.css";

/**
 * The whole a11y contract for a form control, in ONE place (plan §8,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`; `DESIGN.md` §5).
 * {@link TextField} and {@link SelectField} CANNOT render a control without:
 *
 * - a real `<label htmlFor={id}>` with visible text — never a placeholder standing in for a
 *   label, never an `aria-label` on a visible field;
 * - `aria-invalid={"true"}` when `error` is set, otherwise omitted;
 * - `aria-describedby` listing exactly the hint id and the error id that actually exist;
 * - the error node rendered next to the field, in TEXT, never colour-only.
 *
 * Every auth island imports these two components and never writes a bare `<input>` /
 * `<select>` — the wiring exists once, and gate G4 (`auth-a11y.structure.test.ts`) pins
 * that it stays that way.
 */

function describedBy(hintId: string | undefined, errorId: string | undefined): string | undefined {
  const ids = [hintId, errorId].filter((value): value is string => value !== undefined);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

interface FieldChromeProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
}

type TextFieldProps = FieldChromeProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id">;

export function TextField({ id, label, error, hint, ...control }: TextFieldProps) {
  const hintId = hint !== undefined ? `${id}-hint` : undefined;
  const errorId = error !== undefined ? `${id}-error` : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint !== undefined ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        aria-invalid={error !== undefined ? "true" : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className={styles.control}
        {...control}
      />
      {error !== undefined ? (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = FieldChromeProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
    readonly children: ReactNode;
  };

export function SelectField({ id, label, error, hint, children, ...control }: SelectFieldProps) {
  const hintId = hint !== undefined ? `${id}-hint` : undefined;
  const errorId = error !== undefined ? `${id}-error` : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint !== undefined ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <select
        id={id}
        aria-invalid={error !== undefined ? "true" : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className={styles.control}
        {...control}
      >
        {children}
      </select>
      {error !== undefined ? (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The one place a screen reader is sent for ANY failure (plan §8) — client-side field
 * errors and a server-side failure (any code in plan §6.1) both render here, never in two
 * different places. `role="alert"` announces the region the instant it mounts;
 * `tabIndex={-1}` (paired with the caller's `headingRef.current?.focus()`, the same
 * `LocaleError` pattern `app/[locale]/error.tsx` already uses) moves keyboard/AT focus to it
 * without adding a new stop to the normal tab order.
 *
 * `summary` is either the single server-error sentence, or a short lead-in for the list of
 * failing fields below it — the caller decides which, this component only renders what it
 * is given. `fieldErrors`, when present, links each failing field to its own id so the
 * region is genuinely useful rather than only an announcement.
 */
export interface FormErrorRegionProps {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly summary: string;
  readonly fieldErrors?: readonly { readonly id: string; readonly label: string }[];
}

export function FormErrorRegion({ headingRef, summary, fieldErrors }: FormErrorRegionProps) {
  return (
    <div role="alert" className={styles.errorRegion}>
      <h2 ref={headingRef} tabIndex={-1} className={styles.errorHeading}>
        {summary}
      </h2>
      {fieldErrors !== undefined && fieldErrors.length > 0 ? (
        <ul className={styles.errorList}>
          {fieldErrors.map((field) => (
            <li key={field.id}>
              <a href={`#${field.id}`}>{field.label}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
