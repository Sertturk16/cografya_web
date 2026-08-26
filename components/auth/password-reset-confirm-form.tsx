"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { isPasswordPolicyCompliant, PASSWORD_MAX } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { FormErrorRegion, TextField } from "./field";
import styles from "./auth-form.module.css";

/**
 * `?token=` off the CURRENT url — the same `useSyncExternalStore` idiom `login-form.tsx`
 * uses for `?returnTo=` (plan §4.1,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`), duplicated locally
 * rather than shared: the two hooks read different parameters for different screens, and
 * `submit.client.ts`'s manifest entry is the ONE fetch wrapper, not a query-string module.
 */
const NEVER_CHANGES = () => () => {};
function readTokenParam(): string | null {
  return new URLSearchParams(window.location.search).get("token");
}
function serverTokenSnapshot(): string | null {
  return null;
}
function useTokenParam(): string | null {
  return useSyncExternalStore(NEVER_CHANGES, readTokenParam, serverTokenSnapshot);
}

interface FieldErrors {
  resetToken?: string;
  newPassword?: string;
  passwordConfirm?: string;
}

/**
 * `/sifre-sifirlama/yeni` — the reset-confirm screen (plan §6.2). The reset token is an
 * OPAQUE base64url string (`mintOpaqueToken()`, `cografya_api/src/auth/opaque-token.ts`,
 * measured `dev` @ `89fed7e`) — NOT the 6-digit numeric shape the (PR-2) e-mail
 * verification code has, so this field carries no `inputMode="numeric"`/`pattern` of its
 * own, but the SAME rule applies for the SAME reason: an opaque token containing letters
 * would be silently mangled by `type="number"`, so this field is `type="text"` and never
 * `type="number"` (gate G4's control for PR-1, adapted from the plan's verification-code
 * example since that field does not exist until PR-2).
 */
export function PasswordResetConfirmForm() {
  const t = useTranslations("Auth");
  const tokenFromUrl = useTokenParam();

  // Commits `tokenFromUrl` into real state THE FIRST TIME it is seen non-null — React's own
  // documented "adjusting state during render" idiom (never a ref: `react-hooks/refs`
  // forbids reading a ref's value during render, and never a `useEffect`:
  // `react-hooks/set-state-in-effect` forbids a `setState` call whose whole purpose is
  // mirroring a value already available during render). Calling `setState` conditionally
  // INSIDE the render body, guarded by a comparison against the previous value (also
  // stored in state), is React's sanctioned replacement — it re-runs the component
  // synchronously before anything paints, so it costs no extra visible frame.
  //
  // A committed copy (not `tokenFromUrl` read directly on every render) is required for a
  // second reason: the effect below STRIPS `?token=` from the address bar once read, and on
  // the NEXT render `useSyncExternalStore`'s `getSnapshot` then reads `null` from the
  // now-stripped URL — deriving the field's value straight from `tokenFromUrl` would make
  // the prefilled token visually vanish the moment anything else causes a re-render.
  const [lastSeenToken, setLastSeenToken] = useState<string | null>(null);
  const [resetTokenEdit, setResetTokenEdit] = useState<string | null>(null);
  if (tokenFromUrl !== null && tokenFromUrl !== lastSeenToken) {
    setLastSeenToken(tokenFromUrl);
    setResetTokenEdit((current) => current ?? tokenFromUrl);
  }
  const resetToken = resetTokenEdit ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrorCode, setServerErrorCode] = useState<AuthBffCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  // Drops `?token=` from the address bar once it has been read (plan §6.2). A pure
  // external-system side effect (browser history) — no `setState` inside it. The honest
  // limit, stated rather than implied: this removes the token from what a visitor can
  // copy/share/leave in a later history entry — it does NOT remove it from a server access
  // log or a `Referer` already sent.
  useEffect(() => {
    if (tokenFromUrl === null) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.toString());
  }, [tokenFromUrl]);

  const hasFieldErrors =
    fieldErrors.resetToken !== undefined ||
    fieldErrors.newPassword !== undefined ||
    fieldErrors.passwordConfirm !== undefined;
  const hasErrors = hasFieldErrors || serverErrorCode !== null;

  useEffect(() => {
    if (hasErrors) errorHeadingRef.current?.focus();
  }, [hasErrors]);

  useEffect(() => {
    if (done) successHeadingRef.current?.focus();
  }, [done]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (resetToken.trim().length === 0) next.resetToken = t("fieldErrors.required");
    if (newPassword.length === 0) next.newPassword = t("fieldErrors.required");
    else if (!isPasswordPolicyCompliant(newPassword)) {
      next.newPassword = t("fieldErrors.passwordPolicy");
    }
    if (passwordConfirm.length === 0) next.passwordConfirm = t("fieldErrors.required");
    else if (passwordConfirm !== newPassword) {
      next.passwordConfirm = t("fieldErrors.passwordMismatch");
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerErrorCode(null);
    const errors = validate();
    setFieldErrors(errors);
    if (
      errors.resetToken !== undefined ||
      errors.newPassword !== undefined ||
      errors.passwordConfirm !== undefined
    ) {
      return;
    }

    setSubmitting(true);
    // `passwordConfirm` is UI-only and never leaves the browser (the same
    // "Şifre tekrar" rule the register form's payload builder enforces, plan §4.3.1 #6).
    const result = await submitAuth("password-reset/confirm", {
      resetToken,
      password: newPassword,
    });
    setSubmitting(false);

    if (result.ok) {
      setDone(true);
      return;
    }
    setServerErrorCode(result.code);
  }

  if (done) {
    return (
      <div className={styles.card}>
        <h2 ref={successHeadingRef} tabIndex={-1} className={styles.successHeading}>
          {t("resetNew.done")}
        </h2>
        <Link href="/giris" className="btn btn-primary">
          {t("login.submit")}
        </Link>
      </div>
    );
  }

  const fieldErrorLinks = hasFieldErrors
    ? [
        ...(fieldErrors.resetToken !== undefined
          ? [{ id: "reset-new-code", label: t("fields.resetCode") }]
          : []),
        ...(fieldErrors.newPassword !== undefined
          ? [{ id: "reset-new-password", label: t("fields.newPassword") }]
          : []),
        ...(fieldErrors.passwordConfirm !== undefined
          ? [{ id: "reset-new-password-confirm", label: t("fields.passwordConfirm") }]
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
          id="reset-new-code"
          label={t("fields.resetCode")}
          type="number"
          autoComplete="one-time-code"
          required
          value={resetToken}
          onChange={(event) => setResetTokenEdit(event.target.value)}
          error={fieldErrors.resetToken}
        />
        <TextField
          id="reset-new-password"
          label={t("fields.newPassword")}
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX}
          hint={t("hints.newPassword")}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={fieldErrors.newPassword}
        />
        <TextField
          id="reset-new-password-confirm"
          label={t("fields.passwordConfirm")}
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX}
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          error={fieldErrors.passwordConfirm}
        />
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {t("resetNew.submit")}
          </button>
        </div>
        <noscript>
          <p className={styles.noscript}>{t("noscript")}</p>
        </noscript>
      </form>
    </div>
  );
}
