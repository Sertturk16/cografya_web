"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { EMAIL_MAX, PASSWORD_MAX } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
// Type-only: erased at compile time (SWC elides `import type`), so this never pulls the
// `import "server-only"` side effect into the client bundle — the same pattern
// `error-messages.ts` already uses for the same type.
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { FormErrorRegion, TextField } from "./field";
import styles from "./auth-form.module.css";

/** A rough client-side shape check, deliberately NOT the api's ASCII/format rules
 *  (`EMAIL_ASCII_PATTERN` in `lib/auth/form-rules.ts`) — this only catches an obviously
 *  malformed address before a submission reaches the api, which stays the real validator. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `?returnTo=` off the CURRENT url, read the way `search-combobox.tsx`'s hydration gate
 * reads "am I on the client yet" — `useSyncExternalStore` with a never-firing subscription,
 * so the server render and the first client render agree and only the post-hydration render
 * differs (plan §4.1, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`).
 * `getSnapshot` returns a STRING (a stable primitive under `===`), never a freshly built
 * object, or React would re-render forever.
 */
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

type SessionState = "checking" | "authenticated" | "anonymous";

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ locale }: { readonly locale: Locale }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const rawReturnTo = useReturnToParam();
  const fallbackHome = getPathname({ locale, href: "/" });

  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [loggingOut, setLoggingOut] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrorCode, setServerErrorCode] = useState<AuthBffCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorHeadingRef = useRef<HTMLHeadingElement>(null);

  // Session check — read-only, never stores or renders `firstName` (plan §6.2). "Anything
  // other than a 200" (including 401 and a network failure) is treated identically to "no
  // session": the form renders. The pre-hydration render already shows the form (the static
  // shell never calls `getSession()`), so this effect only ever SWAPS to the signed-in state
  // after mount — it can never introduce a hydration mismatch.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { method: "GET", credentials: "same-origin", cache: "no-store" })
      .then((res) => {
        if (!cancelled) setSessionState(res.status === 200 ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!cancelled) setSessionState("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFieldErrors = fieldErrors.email !== undefined || fieldErrors.password !== undefined;
  const hasErrors = hasFieldErrors || serverErrorCode !== null;

  // Moves focus to the shared error region the moment it first appears (plan §8). A LATER
  // failure while the region is already mounted does not need a second focus move to be
  // announced: `role="alert"` is an implicit assertive live region, so a text change inside
  // an already-present alert element is announced on its own (WCAG 4.1.3) without stealing
  // focus a second time from wherever the user has since moved it.
  useEffect(() => {
    if (hasErrors) errorHeadingRef.current?.focus();
  }, [hasErrors]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (email.trim().length === 0) next.email = t("fieldErrors.required");
    else if (!EMAIL_SHAPE.test(email)) next.email = t("fieldErrors.emailInvalid");
    if (password.length === 0) next.password = t("fieldErrors.required");
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerErrorCode(null);
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email !== undefined || errors.password !== undefined) return;

    setSubmitting(true);
    const result = await submitAuth(
      "login",
      { email, password },
      { returnTo: rawReturnTo ?? fallbackHome },
    );
    setSubmitting(false);

    if (result.ok) {
      router.replace(result.redirectTo ?? fallbackHome);
      return;
    }
    setServerErrorCode(result.code);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await submitAuth("logout", {});
    setLoggingOut(false);
    setSessionState("anonymous");
  }

  if (sessionState === "authenticated") {
    return (
      <div className={styles.card}>
        <p>{t("login.alreadySignedIn")}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
        >
          {t("login.logout")}
        </button>
      </div>
    );
  }

  const fieldErrorLinks = hasFieldErrors
    ? [
        ...(fieldErrors.email !== undefined
          ? [{ id: "login-email", label: t("fields.email") }]
          : []),
        ...(fieldErrors.password !== undefined
          ? [{ id: "login-password", label: t("fields.password") }]
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
          id="login-email"
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
          id="login-password"
          label={t("fields.password")}
          type="password"
          autoComplete="current-password"
          required
          maxLength={PASSWORD_MAX}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {t("login.submit")}
          </button>
          <Link href="/sifre-sifirlama" className={styles.secondaryLink}>
            {t("login.forgot")}
          </Link>
        </div>
        <noscript>
          <p className={styles.noscript}>{t("noscript")}</p>
        </noscript>
      </form>
    </div>
  );
}
