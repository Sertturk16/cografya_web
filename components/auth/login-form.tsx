"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
// Deliberately NOT `@/i18n/navigation`'s `useRouter` (review `CODE85-M5`): the value passed
// to `router.replace()` below is the BFF's `safeReturnPath()` output, a final path with its
// locale prefix already resolved (`/` or `/en/...`, never a bare next-intl pathname key).
// next-intl's `useRouter` would apply a SECOND locale prefix on top of that, sending an EN
// visitor to the wrong address — so the plain Next router is the correct one here, not an
// oversight of the "always import from `@/i18n/navigation`" rule.
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { EMAIL_SHAPE, EMAIL_MAX, PASSWORD_MAX } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
// Type-only: erased at compile time (SWC elides `import type`), so this never pulls the
// `import "server-only"` side effect into the client bundle — the same pattern
// `error-messages.ts` already uses for the same type.
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { FormErrorRegion, TextField } from "./field";
import styles from "./auth-form.module.css";

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

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ locale }: { readonly locale: Locale }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const rawReturnTo = useReturnToParam();
  const fallbackHome = getPathname({ locale, href: "/" });

  const [sessionState, setSessionState] = useAuthSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrorCode, setServerErrorCode] = useState<AuthBffCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const signedInHeadingRef = useRef<HTMLHeadingElement>(null);
  const loggedOutHeadingRef = useRef<HTMLHeadingElement>(null);

  // The session check itself now lives in `useAuthSession()` — read-only, never stores or
  // renders `firstName` (plan §6.2). "Anything other than a 200" (including 401 and a network
  // failure) is treated identically to "no session": the form renders. The pre-hydration
  // render already shows the form (the static shell never calls `getSession()`), so the hook
  // only ever SWAPS to the signed-in state after mount — it can never introduce a hydration
  // mismatch.

  const hasFieldErrors = fieldErrors.email !== undefined || fieldErrors.password !== undefined;
  const hasErrors = hasFieldErrors || serverErrorCode !== null;

  // Moves focus to the shared error region the moment it first appears (plan §8). A LATER
  // failure while the region is already mounted does not need a second focus move to be
  // announced: `role="alert"` is an implicit assertive live region, so a text change inside
  // an already-present alert element is announced on its own (WCAG 4.1.3) without stealing
  // focus a second time from wherever the user has since moved it. Left UNCHANGED by
  // `VAL85-R1`: the authenticated branch below now mounts a real `FormErrorRegion` node, so
  // this effect (previously a no-op there — `errorHeadingRef.current` was `null`) starts
  // working for that branch on its own, with no edit needed here.
  useEffect(() => {
    if (hasErrors) errorHeadingRef.current?.focus();
  }, [hasErrors]);

  // Forward direction (review `VAL85-R2`/`A11Y85-I1`): the anonymous↔authenticated swap moves
  // no focus and announces nothing on its own — this closes the anonymous → authenticated leg.
  useEffect(() => {
    if (sessionState === "authenticated") signedInHeadingRef.current?.focus();
  }, [sessionState]);

  // Reverse direction, the second half of the same class (`VAL85-R2` part (2), Atlas-ruled
  // as option (a) in the dispatch): a successful logout also swaps the whole card's content
  // in place, and that transition is exactly as uninitiated-by-navigation as the forward one.
  // Rendered as a short confirmation heading ABOVE the form once it reappears, using the same
  // `.successHeading` class (and the same focus-ring opt-in, `auth-form.module.css`) the
  // "already signed in" heading and the two reset-flow success screens use — one selector,
  // not a fourth bespoke one.
  useEffect(() => {
    if (justLoggedOut) loggedOutHeadingRef.current?.focus();
  }, [justLoggedOut]);

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
    setJustLoggedOut(false);
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email !== undefined || errors.password !== undefined) return;

    setSubmitting(true);
    const result = await submitAuth(
      "login",
      { email, password },
      // `||`, not `??` (review `CODE85-M2`): `?returnTo=` (present but empty) parses to `""`,
      // not `null` — a nullish check lets the empty string through and skips the fallback,
      // reopening the "English visitor lands on the Turkish home page" bug the plan names
      // (§4.5). A falsy check catches both the absent and the empty-string case.
      { returnTo: rawReturnTo || fallbackHome },
    );
    setSubmitting(false);

    if (result.ok) {
      router.replace(result.redirectTo ?? fallbackHome);
      return;
    }
    setServerErrorCode(result.code);
  }

  // `VAL85-R1` (aliases `CODE85-I1`) — the original two-line remedy was measured HARMFUL: it
  // wrote `serverErrorCode` while staying on the `authenticated` branch, which (before this
  // fix) rendered no `FormErrorRegion` at all, so nothing appeared and the code was never
  // cleared — a LATER successful logout would then reopen the form carrying the previous
  // attempt's stale error box. The `setServerErrorCode(null)` below is the line that closes
  // that stale-error state; it is not optional cleanup.
  async function handleLogout() {
    setServerErrorCode(null);
    setLoggingOut(true);
    const result = await submitAuth("logout", {});
    setLoggingOut(false);
    if (result.ok) {
      setSessionState("anonymous");
      setJustLoggedOut(true);
      return;
    }
    setServerErrorCode(result.code);
  }

  if (sessionState === "authenticated") {
    return (
      <div className={styles.card}>
        {serverErrorCode !== null ? (
          <FormErrorRegion
            headingRef={errorHeadingRef}
            summary={t(AUTH_ERROR_MESSAGE_KEYS[serverErrorCode])}
          />
        ) : null}
        <h2 ref={signedInHeadingRef} tabIndex={-1} className={styles.successHeading}>
          {t("login.alreadySignedIn")}
        </h2>
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
      {justLoggedOut ? (
        <h2 ref={loggedOutHeadingRef} tabIndex={-1} className={styles.successHeading}>
          {t("login.loggedOut")}
        </h2>
      ) : null}
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
