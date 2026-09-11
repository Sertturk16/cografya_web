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
 *
 * UYE-P4-SIFIRLAMA (`Owner's Inbox/uyelik-uyum-denetimi/p4-sifirlama-ekranlari/plan.md` §5.1)
 * added the dead-link gate: a URL-supplied token is checked against `password-reset/verify`
 * BEFORE these two password fields ever mount, so a dead or already-used link fails without
 * the member typing anything. A manually-typed token (no `?token=` in the URL) skips the gate
 * entirely, unchanged from before.
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
  // The dead-link gate (UYE-P4-SIFIRLAMA plan §5.1). Starts `"open"` — the SSR/first-paint
  // snapshot always reads `tokenFromUrl === null` (`serverTokenSnapshot` above), so a visitor
  // with NO `?token=` at all (the manual-entry path) never sees a "checking" flash: the `if`
  // block below only ever transitions the gate to `"checking"`, the ONE time a real token is
  // committed off the URL, in the SAME synchronous render-adjustment pass that commits
  // `lastSeenToken` — never in a `useEffect`, for the identical reason `lastSeenToken` itself
  // is not.
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

  // The dead-link gate's own network call (plan §5.1) — DESIGNED to fire at most once per
  // distinct committed token. `verifiedTokenRef`, not a second piece of `useState`, is the
  // guard: React's documented dev-mode StrictMode contract double-invokes an effect on
  // initial mount (setup → cleanup → setup again) for the SAME component instance, so a ref
  // written during the first invocation should still be visible during the second — unlike a
  // comparison against `lastSeenToken`/`tokenGateState` alone, which cannot distinguish the
  // two invocations (neither piece of state has had time to change between them; the api call
  // is still in flight). NOT YET EMPIRICALLY VERIFIED against a real dev-mode double-mount in
  // this session (plan §10's own named risk) — see the builder return's
  // `CLAIMS_REQUIRING_VERIFICATION`. No cleanup/cancellation here, matching this file's own
  // sibling reference-fetch effects in `register-form.tsx`
  // (`universityState`/`departmentState`) — a result arriving after a genuine unmount is the
  // same low-severity, unguarded case those effects accept.
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
      // Fail-open (plan §5.1): the api's real error vocabulary for this route names exactly
      // one condition that means "this link is dead"; everything else (a transport hiccup,
      // a rate limit, a bad Origin) means "we could not tell" — falsely telling an honest
      // member their working link is dead is worse than letting them attempt the form. The
      // unchanged `confirm`-time check below is the safety net if the token really is bad.
      setTokenGateState("open");
    });
  }, [lastSeenToken]);

  useEffect(() => {
    if (tokenGateState === "blocked") deadLinkHeadingRef.current?.focus();
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

  // An early `return`, not a ternary — chosen for consistency with this file's OWN existing
  // idiom for a full-card-state swap (matching `done` below), not primarily because of the
  // gate. Recorded honestly (Phase 2 verification session, UYE-P4-SIFIRLAMA), because the
  // superseded version of this comment claimed an `if`/`return` gives assistive tech a
  // "something changed" signal a ternary here would not — measured this session, that specific
  // claim does not survive: temporarily rewriting this branch as `tokenGateState === "checking"
  // ? (...) : null` and re-running the gate, the ternary shape fails it (`role="status"` as the
  // consequent of a null-alternate conditional), the `if`/`return` shape passes — but
  // `auth-a11y.structure.test.ts`'s A11Y93-I1 scan (`ts.isConditionalExpression` +
  // `ts.BinaryExpression` `&&`) is a syntactic AST check that does not visit `if` statements at
  // all, which is sufficient on its own to explain the pass/fail difference without any claim
  // about React's reconciliation or about assistive-tech behaviour — neither was independently
  // measured this session (no jsdom in this repo, `FU-WEB-JSDOM`). So: this shape is kept
  // because it matches `done`'s own established idiom, and it happens to also satisfy the
  // scanner; the previous comment's ASSISTIVE-TECH rationale for the choice is retracted as
  // unmeasured, not restated in a weaker form.
  if (tokenGateState === "checking") {
    return (
      <div className={styles.card}>
        <p role="status" className={styles.hint}>
          {t("resetNew.checking")}
        </p>
      </div>
    );
  }

  // Wrapped in `.form`/`.actions`, deliberately NOT the bare `.card`-child shape the "done"
  // state below uses for its own CTA (plan §5.1 originally cited that shape as precedent and
  // was wrong to — corrected this session, see the plan's own correction note at that
  // heading). `.card` itself carries no `flex`/`gap`; `done`'s spacing comes entirely from
  // `.successHeading`'s own `margin: 0 0 8px`, which `FormErrorRegion`'s `.errorRegion` has no
  // equivalent of (padding, no margin). Mounting `FormErrorRegion` and the CTA as bare `.card`
  // siblings here would render them touching. `.form`'s `gap: 18px` is the real fix, and
  // wrapping the CTA in `.actions` matches this file's OWN established single-button
  // precedent — the main form's submit button below — not an invented pattern.
  if (tokenGateState === "blocked") {
    return (
      <div className={styles.card}>
        <div className={styles.form}>
          <FormErrorRegion
            headingRef={deadLinkHeadingRef}
            // Through the SAME `AUTH_ERROR_MESSAGE_KEYS[code]` indirection the submit-error
            // region below uses, not a hardcoded call passing the resolved key string
            // straight to `t` as a literal — required, not just a style choice:
            // `messages.test.ts`'s AUTH_KEYS scan (gate G6) is a plain regex over the raw
            // source text, including comments, matching `t` immediately followed by a
            // quoted literal in parens; it deliberately excludes every `Auth.errors.*` key
            // from that list because it expects each one to be reached only through this
            // variable lookup (its own docblock says so; `error-messages.test.ts`, gate G3,
            // covers that set instead). A hardcoded literal call here — and, on the first
            // attempt, even just writing that literal-call SHAPE inside this very comment —
            // was caught failing G6 this session; fixed by matching the established idiom
            // and writing this note without reproducing the flagged shape.
            summary={t(AUTH_ERROR_MESSAGE_KEYS["errors.password.resetTokenInvalid"])}
          />
          <div className={styles.actions}>
            <Link href="/sifre-sifirlama" className="btn btn-primary">
              {t("resetNew.deadLinkCta")}
            </Link>
          </div>
        </div>
      </div>
    );
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
          type="text"
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
