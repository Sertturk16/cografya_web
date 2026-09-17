"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { isPasswordPolicyCompliant, PASSWORD_MAX } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormErrorSummary, FormField } from "@/components/patterns/form-field";
import { cn } from "@/lib/utils";

/**
 * `?token=` off the CURRENT url — the same `useSyncExternalStore` idiom
 * `v2-login-card.tsx`'s V1 predecessor used for `?returnTo=`, duplicated locally rather than
 * shared: the two hooks read different parameters for different screens, and
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
 * `/sifre-sifirlama/yeni` · `/en/reset-password/new`. V2 port of
 * `components/auth/password-reset-confirm-form.tsx`. Presentation moves to Tailwind and
 * `components/patterns/form-field`; every piece of behaviour below is carried over unchanged,
 * including the three rationales that are load-bearing rather than stylistic:
 *
 * 1. The reset token is an OPAQUE base64url string (`mintOpaqueToken()`,
 *    `cografya_api/src/auth/opaque-token.ts`), not a numeric code, so its field is
 *    `type="text"` and must never become `type="number"` — that would silently mangle a token
 *    containing letters.
 * 2. The dead-link gate checks a URL-supplied token against `password-reset/verify` BEFORE
 *    the password fields mount, so a dead or already-used link fails without the member
 *    typing anything. A manually-typed token skips the gate entirely.
 * 3. Every full-card state swap announces itself by MOVING FOCUS to a `tabIndex={-1}` target,
 *    never by a live region. A `role="status"` node that is the sole content of a wholesale
 *    subtree replacement gives assistive technology no "something changed" signal, because
 *    the role and its first content arrive in the same commit.
 */
export function V2PasswordResetConfirmCard() {
  const t = useTranslations("Auth");
  const tokenFromUrl = useTokenParam();

  // Commits `tokenFromUrl` into real state THE FIRST TIME it is seen non-null — React's own
  // documented "adjusting state during render" idiom (never a ref: `react-hooks/refs` forbids
  // reading a ref's value during render, and never a `useEffect`:
  // `react-hooks/set-state-in-effect` forbids a `setState` whose whole purpose is mirroring a
  // value already available during render).
  //
  // A committed copy is required for a second reason: the effect below STRIPS `?token=` from
  // the address bar once read, so on the NEXT render `getSnapshot` reads `null` from the
  // now-stripped URL — deriving the field's value from `tokenFromUrl` directly would make the
  // prefilled token visually vanish the moment anything else caused a re-render.
  const [lastSeenToken, setLastSeenToken] = useState<string | null>(null);
  const [resetTokenEdit, setResetTokenEdit] = useState<string | null>(null);
  // Starts `"open"` — the SSR/first-paint snapshot always reads `tokenFromUrl === null`, so a
  // visitor with no `?token=` at all never sees a "checking" flash.
  const [tokenGateState, setTokenGateState] = useState<"checking" | "blocked" | "open">("open");
  if (tokenFromUrl !== null && tokenFromUrl !== lastSeenToken) {
    setLastSeenToken(tokenFromUrl);
    setResetTokenEdit((current) => current ?? tokenFromUrl);
    setTokenGateState("checking");
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
  const deadLinkHeadingRef = useRef<HTMLHeadingElement>(null);
  const checkingStatusRef = useRef<HTMLParagraphElement>(null);

  // Drops `?token=` from the address bar once it has been read. A pure external-system side
  // effect (browser history), no `setState` inside it. The honest limit: this removes the
  // token from what a visitor can copy, share or leave in a later history entry — it does NOT
  // remove it from a server access log or a `Referer` already sent.
  useEffect(() => {
    if (tokenFromUrl === null) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.toString());
  }, [tokenFromUrl]);

  // The dead-link gate's own network call — designed to fire at most once per distinct
  // committed token. `verifiedTokenRef`, not a second piece of state, is the guard: React's
  // dev-mode StrictMode double-invokes an effect on initial mount for the same component
  // instance, and a comparison against `lastSeenToken`/`tokenGateState` alone cannot
  // distinguish the two invocations because neither has had time to change between them.
  const verifiedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSeenToken === null) return;
    if (verifiedTokenRef.current === lastSeenToken) return;
    verifiedTokenRef.current = lastSeenToken;
    void submitAuth("password-reset/verify", { resetToken: lastSeenToken }).then((result) => {
      if (result.ok) {
        setTokenGateState("open");
        return;
      }
      if (result.code === "errors.password.resetTokenInvalid") {
        setTokenGateState("blocked");
        return;
      }
      // Fail-open: the api's error vocabulary for this route names exactly one condition that
      // means "this link is dead"; everything else (a transport hiccup, a rate limit, a bad
      // Origin) means "we could not tell". Falsely telling an honest member their working
      // link is dead is worse than letting them attempt the form, and the unchanged
      // confirm-time check below is the safety net if the token really is bad.
      setTokenGateState("open");
    });
  }, [lastSeenToken]);

  useEffect(() => {
    if (tokenGateState === "blocked") deadLinkHeadingRef.current?.focus();
  }, [tokenGateState]);

  useEffect(() => {
    if (tokenGateState === "checking") checkingStatusRef.current?.focus();
  }, [tokenGateState]);

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
    // `passwordConfirm` is UI-only and never leaves the browser.
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

  if (tokenGateState === "checking") {
    return (
      <p ref={checkingStatusRef} tabIndex={-1} className="text-sm text-muted-foreground">
        {t("resetNew.checking")}
      </p>
    );
  }

  if (tokenGateState === "blocked") {
    return (
      <div className="space-y-5">
        <FormErrorSummary
          headingRef={deadLinkHeadingRef}
          // Through the same `AUTH_ERROR_MESSAGE_KEYS[code]` indirection the submit-error
          // region below uses, never a hardcoded call passing the resolved key straight to
          // `t` as a literal: the Auth message-key scan is a regex over raw source text that
          // deliberately excludes every `Auth.errors.*` key, because it expects each one to be
          // reached only through this variable lookup.
          summary={t(AUTH_ERROR_MESSAGE_KEYS["errors.password.resetTokenInvalid"])}
        />
        <Link
          href="/sifre-sifirlama"
          className={cn(buttonVariants({ variant: "primary", size: "md" }))}
        >
          {t("resetNew.deadLinkCta")}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5">
        <h2
          ref={successHeadingRef}
          tabIndex={-1}
          className="flex items-start gap-2.5 font-heading text-lg font-bold text-foreground"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-strong" aria-hidden="true" />
          {t("resetNew.done")}
        </h2>
        <Link href="/giris" className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
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
        id="reset-new-code"
        label={t("fields.resetCode")}
        type="text"
        autoComplete="one-time-code"
        required
        value={resetToken}
        onChange={(event) => setResetTokenEdit(event.target.value)}
        error={fieldErrors.resetToken}
      />
      <FormField
        id="reset-new-password"
        label={t("fields.newPassword")}
        type="password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        helper={t("hints.newPassword")}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={fieldErrors.newPassword}
      />
      <FormField
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
      <Button type="submit" variant="primary" isLoading={submitting} leftIcon={<KeyRound />}>
        {t("resetNew.submit")}
      </Button>
      <noscript>
        <p className="text-xs text-muted-foreground">{t("noscript")}</p>
      </noscript>
    </form>
  );
}
