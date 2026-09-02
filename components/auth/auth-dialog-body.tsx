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
 *  exemption when a switch costs nothing).
 */
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
      {/* Accessible Close Button */}
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={t("modal.close")}
      >
        <CloseIcon />
      </button>

      {/* Header with Compass Brand Badge */}
      <div className={styles.headerRow}>
        <div className={styles.brandBadge} aria-hidden="true">
          <svg
            className={styles.brandIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </div>
        <div className={styles.headerText}>
          <h2 id="auth-dialog-heading" ref={headingRef} tabIndex={-1} className={styles.heading}>
            {t(mode === "login" ? "login.heading" : "register.heading")}
          </h2>
          <p className={styles.intentLine}>{intentLine(t, intent)}</p>
        </div>
      </div>

      {/* Segmented Tab Switcher */}
      <div className={styles.tabSwitch} role="tablist" aria-label="Giriş / Üye Olma Seçimi">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={`${styles.tabBtn} ${mode === "login" ? styles.tabBtnActive : ""}`}
          onClick={() => setAuthModalMode("login")}
        >
          {t("login.heading")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={`${styles.tabBtn} ${mode === "register" ? styles.tabBtnActive : ""}`}
          onClick={() => setAuthModalMode("register")}
        >
          {t("register.heading")}
        </button>
      </div>

      {/* Form Content */}
      {mode === "login" ? (
        <LoginForm locale={locale} onAuthenticated={onAuthenticated} />
      ) : (
        <RegisterForm locale={locale} onAuthenticated={onAuthenticated} />
      )}

      {/* Bottom Mode Toggle Link */}
      <button
        type="button"
        className={styles.modeToggle}
        onClick={() => setAuthModalMode(mode === "login" ? "register" : "login")}
      >
        {t(mode === "login" ? "modal.toRegister" : "modal.toLogin")}
      </button>

      {/* Modern V2 Benefits & Feature Strip */}
      <div className={styles.benefitsStrip} aria-hidden="true">
        <span className={styles.benefitItem}>🌟 Favoriler</span>
        <span>&bull;</span>
        <span className={styles.benefitItem}>🏆 Skorlar</span>
        <span>&bull;</span>
        <span className={styles.benefitItem}>📐 CBS Ölçümleri</span>
        <span>&bull;</span>
        <span className={styles.benefitItem}>🛡️ Güvenli</span>
      </div>
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
