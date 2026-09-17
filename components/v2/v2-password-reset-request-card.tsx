"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Send } from "lucide-react";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { EMAIL_SHAPE, EMAIL_MAX } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { Button } from "@/components/ui/button";
import { FormErrorSummary, FormField } from "@/components/patterns/form-field";

interface FieldErrors {
  email?: string;
}

/**
 * `/sifre-sifirlama` · `/en/reset-password`. V2 port of
 * `components/auth/password-reset-request-form.tsx`; behaviour is unchanged.
 *
 * ANTI-ENUMERATION: a well-formed submission always resolves to the same accepted state,
 * whether or not the address exists. The api answers 202 either way, so this component never
 * branches on anything beyond the generic error codes any auth route can produce (rate
 * limiting, a bad `Origin`, an unreachable api). Do not add a branch that distinguishes them.
 *
 * The form primitives come from `components/patterns/form-field`, which T-034 built for this
 * job; T-032's plan had a `V2TextField` of its own, cut once T-034 landed first.
 */
export function V2PasswordResetRequestCard() {
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

  // Success replaces the form: focus the new heading once, on the transition.
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
      <h2
        ref={successHeadingRef}
        tabIndex={-1}
        className="flex items-start gap-2.5 font-heading text-lg font-bold text-foreground"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-strong" aria-hidden="true" />
        {t("reset.accepted")}
      </h2>
    );
  }

  const fieldErrorLinks = hasFieldErrors
    ? [{ id: "reset-email", label: t("fields.email") }]
    : undefined;

  return (
    <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {hasErrors ? (
        <FormErrorSummary
          headingRef={errorHeadingRef}
          summary={
            serverErrorCode !== null
              ? t(AUTH_ERROR_MESSAGE_KEYS[serverErrorCode])
              : t("formErrors.summary")
          }
          fieldErrors={fieldErrorLinks}
        />
      ) : null}
      <FormField
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
      <Button type="submit" variant="primary" isLoading={submitting} leftIcon={<Send />}>
        {t("reset.submit")}
      </Button>
      <noscript>
        <p className="text-xs text-muted-foreground">{t("noscript")}</p>
      </noscript>
    </form>
  );
}
