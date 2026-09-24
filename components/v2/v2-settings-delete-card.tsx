"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { submitAuth } from "@/lib/auth/submit.client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard, SettingsFieldError, SettingsResult } from "./v2-settings-card";

const PASSWORD_ID = "settings-delete-password";
const CONFIRM_ID = "settings-delete-confirm";

/**
 * "Hesabımı kalıcı olarak sil" (T-101) — the member deletes their own account.
 *
 * Two deliberate frictions and no more: the current password (the api refuses without it, and a
 * stolen session alone must not be able to delete an account) and an "I understand" box, so the
 * one irreversible button on the page cannot be pressed by a stray Enter in the password field.
 * On success the BFF has already cleared the session cookies; the client flips its session
 * state to anonymous and leaves for the home page, because every page under `/hesabim` would
 * now redirect to the login form.
 */
export function V2SettingsDeleteCard() {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");
  const router = useRouter();
  const [, setSessionState] = useAuthSession();

  const [password, setPassword] = React.useState("");
  const [understood, setUnderstood] = React.useState(false);
  const [errors, setErrors] = React.useState<{ password?: string; understood?: string }>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<AuthBffCode | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const next: { password?: string; understood?: string } = {};
    if (!password) next.password = tAuth("fieldErrors.required");
    if (!understood) next.understood = t("delete.confirmRequired");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      document.getElementById(next.password ? PASSWORD_ID : CONFIRM_ID)?.focus();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await submitAuth("account/delete", { currentPassword: password });
      if (res.ok) {
        setPassword("");
        setSessionState("anonymous");
        router.replace("/");
        router.refresh();
        return;
      }
      setSubmitError(res.code);
    } catch {
      setSubmitError("errors.transport.unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsCard
      id="hesabi-sil"
      icon={<Trash2 className="size-5" />}
      title={t("delete.title")}
      description={t("delete.description")}
    >
      <SettingsResult
        saved={false}
        savedMessage=""
        errorMessage={submitError ? tAuth(AUTH_ERROR_MESSAGE_KEYS[submitError]) : null}
      />

      <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive-strong">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed font-medium">{t("delete.warning")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor={PASSWORD_ID} className="text-xs font-bold text-foreground">
            {t("delete.password")}
          </Label>
          <Input
            id={PASSWORD_ID}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
            isError={Boolean(errors.password)}
            aria-describedby={errors.password ? `${PASSWORD_ID}-error` : undefined}
          />
          <SettingsFieldError id={`${PASSWORD_ID}-error`} message={errors.password} />
        </div>

        <div className="space-y-1">
          <label
            htmlFor={CONFIRM_ID}
            className="flex items-start gap-2.5 text-xs leading-relaxed text-foreground cursor-pointer"
          >
            <input
              id={CONFIRM_ID}
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              disabled={submitting}
              aria-invalid={Boolean(errors.understood)}
              aria-describedby={errors.understood ? `${CONFIRM_ID}-error` : undefined}
              className="mt-0.5 size-4 shrink-0 accent-destructive cursor-pointer"
            />
            <span>{t("delete.confirm")}</span>
          </label>
          <SettingsFieldError id={`${CONFIRM_ID}-error`} message={errors.understood} />
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            variant="destructive"
            size="md"
            isLoading={submitting}
            className="w-full sm:w-auto min-w-32 text-xs font-bold"
          >
            {t("delete.submit")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
