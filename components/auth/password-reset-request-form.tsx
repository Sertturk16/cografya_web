"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { EMAIL_MAX } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { FormErrorRegion, TextField } from "./field";
import styles from "./auth-form.module.css";

/** Same rough client-side shape check `login-form.tsx` uses — see that file's comment. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
}

/**
 * `/sifre-sifirlama` — the reset-request screen (plan §6.2,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). Always `202` on a
 * well-formed submission — a known and an unknown address are answered identically
 * (anti-enumeration), so this component never branches on anything the api returned beyond
 * the generic error codes any auth route can produce (rate limiting, a bad `Origin`, an
 * unreachable api).
 */
export function PasswordResetRequestForm() {
  const t = useTranslations("Auth");

  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrorCode, setServerErrorCode] = useState<AuthBffCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  const hasFieldErrors = fieldErrors.email !== undefined;
  const hasErrors = hasFieldErrors || serverErrorCode !== null;

  useEffect(() => {
    if (hasErrors) errorHeadingRef.current?.focus();
  }, [hasErrors]);

  // Success replaces the form (plan §8): focus the new heading once, on the transition.
  useEffect(() => {
    if (accepted) successHeadingRef.current?.focus();
  }, [accepted]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (email.trim().length === 0) next.email = t("fieldErrors.required");
    else if (!EMAIL_SHAPE.test(email)) next.email = t("fieldErrors.emailInvalid");
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerErrorCode(null);
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email !== undefined) return;

    setSubmitting(true);
    const result = await submitAuth("password-reset/request", { email });
    setSubmitting(false);

    if (result.ok) {
      setAccepted(true);
      return;
    }
    setServerErrorCode(result.code);
  }

  if (accepted) {
    return (
      <div className={styles.card}>
        <h2 ref={successHeadingRef} tabIndex={-1} className={styles.successHeading}>
          {t("reset.accepted")}
        </h2>
      </div>
    );
  }

  const fieldErrorLinks = hasFieldErrors
    ? [{ id: "reset-email", label: t("fields.email") }]
    : undefined;

  return (
    <div className={styles.card}>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
        {hasErrors ? (
          <FormErrorRegion
            headingRef={errorHeadingRef}
            summary={
              serverErrorCode !== null
                ? t(AUTH_ERROR_MESSAGE_KEYS[serverErrorCode])
                : t("formErrors.summary")
            }
            fieldErrors={fieldErrorLinks}
          />
        ) : null}
        <TextField
          id="reset-email"
          label={t("fields.email")}
          type="email"
          autoComplete="email"
          required
          maxLength={EMAIL_MAX}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {t("reset.submit")}
          </button>
        </div>
        <noscript>
          <p className={styles.noscript}>{t("noscript")}</p>
        </noscript>
      </form>
    </div>
  );
}
