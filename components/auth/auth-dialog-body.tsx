"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { setAuthModalMode, type AuthIntent, type AuthMode } from "@/lib/auth/auth-modal.client";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import styles from "./auth-dialog.module.css";

/**
 * The dialog's own content — mode switch, the ONE §22-permitted helper line (the intent line,
 * naming the interrupted action), and the form host. Renders the SAME `LoginForm`/
 * `RegisterForm` the pages use, each wired through its new `onAuthenticated` prop
 * (uyelik-auth-redesign plan §5.7) — there is no second login/register implementation.
 */

/** Exhaustive, literal `t("modal.intent.…")` calls rather than a template-literal dynamic key
 *  — keeps every call statically visible to `messages.test.ts`'s own per-file key scan
 *  (a dynamic key would be invisible to that scan the same way `AUTH_ERROR_MESSAGE_KEYS[code]`
 *  already is, deliberately, for the error-code map — this file just does not need that
 *  exemption when a switch costs nothing). */
function intentLine(t: ReturnType<typeof useTranslations>, intent: AuthIntent): string {
  switch (intent) {
    case "favorite":
      return t("modal.intent.favorite");
    case "video":
      return t("modal.intent.video");
    case "gameRound":
      return t("modal.intent.gameRound");
    case "measurement":
      return t("modal.intent.measurement");
    case "generic":
      return t("modal.intent.generic");
  }
}

export interface AuthDialogBodyProps {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly intent: AuthIntent;
  readonly mode: AuthMode;
  readonly locale: Locale;
  readonly onAuthenticated: () => void;
  readonly onClose: () => void;
}

export function AuthDialogBody({
  headingRef,
  intent,
  mode,
  locale,
  onAuthenticated,
  onClose,
}: AuthDialogBodyProps) {
  const t = useTranslations("Auth");

  return (
    <div className={styles.dialogBody}>
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={t("modal.close")}
      >
        <CloseIcon />
      </button>
      <h2 id="auth-dialog-heading" ref={headingRef} tabIndex={-1} className={styles.heading}>
        {t(mode === "login" ? "login.heading" : "register.heading")}
      </h2>
      <p className={styles.intentLine}>{intentLine(t, intent)}</p>
      {mode === "login" ? (
        <LoginForm locale={locale} onAuthenticated={onAuthenticated} />
      ) : (
        // No `provinces` prop: the modal fetches it lazily (`RegisterForm`'s own
        // `/api/reference/provinces` fallback path, plan §5.7) rather than shipping 81
        // provinces into every page's payload for a control most pages never open.
        <RegisterForm locale={locale} onAuthenticated={onAuthenticated} />
      )}
      <button
        type="button"
        className={styles.modeToggle}
        onClick={() => setAuthModalMode(mode === "login" ? "register" : "login")}
      >
        {t(mode === "login" ? "modal.toRegister" : "modal.toLogin")}
      </button>
    </div>
  );
}

/** Decorative — the button carries its own accessible name via `aria-label` above. */
function CloseIcon() {
  return (
    <svg
      className={styles.closeIcon}
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
