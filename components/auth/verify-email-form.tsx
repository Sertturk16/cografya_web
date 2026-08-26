"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
// Deliberately NOT `@/i18n/navigation`'s `useRouter` — the same `login-form.tsx` reasoning
// (review `CODE85-M5`): `router.replace()` below receives the BFF's own `safeReturnPath()`
// output, a final path with its locale prefix already resolved.
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { EMAIL_MAX, EMAIL_SHAPE, VERIFICATION_CODE_LENGTH } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { FormErrorRegion, TextField } from "./field";
import styles from "./auth-form.module.css";

/** `?returnTo=` off the CURRENT url — the identical `useSyncExternalStore` idiom
 *  `login-form.tsx` uses (plan §4.1,
 *  `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`); `verify-email` is
 *  the SECOND token-issuing action (plan §3.1), so this screen needs the same mechanism. */
const NEVER_CHANGES = () => () => {};
function readReturnToParam(): string | null {
  return new URLSearchParams(window.location.search).get("returnTo");
}
function serverReturnToSnapshot(): string | null {
  return null;
}
function useReturnToParam(): string | null {
  return useSyncExternalStore(NEVER_CHANGES, readReturnToParam, serverReturnToSnapshot);
}

/** 60 s — the api's own `VerifyResendCooldown` window (`cografya_api`
 *  `src/auth/auth.types.ts`, `limit: 1, windowMs: 60_000`). NOT load-bearing (plan §6.2): the
 *  api answers the same `202` whether it sent anything or not, so a drifted number only
 *  changes when the button re-enables, never what happens — recorded as a UI affordance,
 *  not a mirrored constant, and it gets no gate. */
const RESEND_COOLDOWN_SECONDS = 60;

interface FieldErrors {
  email?: string;
  code?: string;
}

/**
 * `/e-posta-dogrulama` · `/en/verify-email` (plan §6.2). Address + 6-digit code + `Doğrula` +
 * `Kodu yeniden gönder`. A reload here always lands on the empty form — no PII is kept in
 * browser storage (§6.3) — so the address is re-typed rather than remembered.
 */
export function VerifyEmailForm({ locale }: { readonly locale: Locale }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const rawReturnTo = useReturnToParam();
  const fallbackHome = getPathname({ locale, href: "/" });

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrorCode, setServerErrorCode] = useState<AuthBffCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [cooldown, setCooldown] = useState(0);

  const errorHeadingRef = useRef<HTMLHeadingElement>(null);

  const hasFieldErrors = fieldErrors.email !== undefined || fieldErrors.code !== undefined;
  const hasErrors = hasFieldErrors || serverErrorCode !== null;

  useEffect(() => {
    if (hasErrors) errorHeadingRef.current?.focus();
  }, [hasErrors]);

  // Ticks the resend cooldown down to zero, one second at a time — a UI affordance only
  // (see RESEND_COOLDOWN_SECONDS above), never a claim about when the api will actually
  // accept another resend.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (email.trim().length === 0) next.email = t("fieldErrors.required");
    else if (!EMAIL_SHAPE.test(email)) next.email = t("fieldErrors.emailInvalid");
    if (code.length === 0) next.code = t("fieldErrors.required");
    else if (code.length !== VERIFICATION_CODE_LENGTH) next.code = t("fieldErrors.codeShape");
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerErrorCode(null);
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email !== undefined || errors.code !== undefined) return;

    setSubmitting(true);
    const result = await submitAuth(
      "verify-email",
      { email, code },
      // Same `||` (not `??`) reasoning as `login-form.tsx` (review `CODE85-M2`): an empty
      // `?returnTo=` parses to `""`, which a nullish check would let through unfixed.
      { returnTo: rawReturnTo || fallbackHome },
    );
    setSubmitting(false);

    if (result.ok) {
      router.replace(result.redirectTo ?? fallbackHome);
      return;
    }
    setServerErrorCode(result.code);
  }

  async function handleResend() {
    if (email.trim().length === 0 || !EMAIL_SHAPE.test(email)) {
      setFieldErrors((previous) => ({ ...previous, email: t("fieldErrors.required") }));
      return;
    }
    setResendState("sending");
    const result = await submitAuth("verify-email/resend", { email });
    setResendState(result.ok ? "sent" : "idle");
    if (!result.ok) {
      setServerErrorCode(result.code);
      return;
    }
    setServerErrorCode(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  const fieldErrorLinks = hasFieldErrors
    ? [
        ...(fieldErrors.email !== undefined
          ? [{ id: "verify-email-address", label: t("fields.email") }]
          : []),
        ...(fieldErrors.code !== undefined
          ? [{ id: "verify-email-code", label: t("fields.verificationCode") }]
          : []),
      ]
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
          id="verify-email-address"
          label={t("fields.email")}
          type="email"
          autoComplete="email"
          required
          maxLength={EMAIL_MAX}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          id="verify-email-code"
          label={t("fields.verificationCode")}
          // Never `type="number"` (gate G4's revert-to-red control, plan §9 G4): the api
          // mints the code with `padStart(6,'0')`, so `'000000'` is a valid, real code and a
          // leading zero must never be silently stripped by a numeric input.
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={VERIFICATION_CODE_LENGTH}
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
          error={fieldErrors.code}
        />
        <div className={styles.codeActions}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {t("verify.submit")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void handleResend()}
            disabled={resendState === "sending" || cooldown > 0}
          >
            {t("verify.resend")}
          </button>
        </div>
        {resendState === "sent" ? (
          <p role="status" className={styles.resendNote}>
            {t("verify.resendAccepted")}
          </p>
        ) : null}
        <noscript>
          <p className={styles.noscript}>{t("noscript")}</p>
        </noscript>
      </form>
    </div>
  );
}
