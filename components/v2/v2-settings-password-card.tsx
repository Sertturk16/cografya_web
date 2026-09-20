"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { isPasswordPolicyCompliant, PASSWORD_MIN } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard, SettingsFieldError, SettingsResult } from "./v2-settings-card";

type FieldKey = "currentPassword" | "newPassword" | "confirmPassword";

const IDS: Record<FieldKey, string> = {
  currentPassword: "settings-current-password",
  newPassword: "settings-new-password",
  confirmPassword: "settings-confirm-password",
};

/**
 * "Güvenlik" — the signed-in password change (T-061).
 *
 * Before this card the only path from a signed-in session was a link to `/sifre-sifirlama`,
 * the FORGOT-password flow: it asks a member who is already signed in for their e-mail
 * address and then waits on a mailbox. That flow stays where it belongs, on the login card,
 * for people who cannot sign in.
 *
 * On success the API revokes every other session and returns a fresh pair which the BFF
 * writes into the cookies, so the member stays signed in here and is signed out elsewhere.
 * The card says so before they submit rather than after, because "you have been signed out
 * of your other devices" is a surprise worth not being.
 */
export function V2SettingsPasswordCard() {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNew, setShowNew] = React.useState(false);

  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<AuthBffCode | null>(null);

  const rules = [
    { key: "length", ok: newPassword.length >= PASSWORD_MIN, label: t("password.ruleLength") },
    { key: "upper", ok: /[A-Z]/.test(newPassword), label: t("password.ruleUpper") },
    { key: "lower", ok: /[a-z]/.test(newPassword), label: t("password.ruleLower") },
    { key: "digit", ok: /[0-9]/.test(newPassword), label: t("password.ruleDigit") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSubmitError(null);

    const next: Partial<Record<FieldKey, string>> = {};
    if (!currentPassword) next.currentPassword = tAuth("fieldErrors.required");
    if (!isPasswordPolicyCompliant(newPassword)) next.newPassword = t("password.policy");
    else if (newPassword === currentPassword) next.newPassword = t("password.sameAsCurrent");
    if (confirmPassword !== newPassword) next.confirmPassword = t("password.mismatch");

    if (Object.keys(next).length > 0) {
      setErrors(next);
      const first = Object.keys(next)[0] as FieldKey | undefined;
      if (first) document.getElementById(IDS[first])?.focus();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await submitAuth("password/change", { currentPassword, newPassword });
      if (res.ok) {
        setSaved(true);
        // Nothing is kept on screen: a filled password field left behind after a successful
        // change is the member's live secret sitting in the DOM for no reason.
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setSubmitError(res.code);
      }
    } catch {
      setSubmitError("errors.transport.unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsCard
      id="guvenlik"
      icon={<ShieldCheck className="size-5" />}
      title={t("password.title")}
      description={t("password.description")}
    >
      <SettingsResult
        saved={saved}
        savedMessage={t("password.saved")}
        errorMessage={submitError ? tAuth(AUTH_ERROR_MESSAGE_KEYS[submitError]) : null}
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor={IDS.currentPassword} className="text-xs font-bold text-foreground">
            {t("password.current")}
          </Label>
          <Input
            id={IDS.currentPassword}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
            isError={Boolean(errors.currentPassword)}
            aria-describedby={errors.currentPassword ? `${IDS.currentPassword}-error` : undefined}
          />
          <SettingsFieldError
            id={`${IDS.currentPassword}-error`}
            message={errors.currentPassword}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={IDS.newPassword} className="text-xs font-bold text-foreground">
            {t("password.next")}
          </Label>
          <Input
            id={IDS.newPassword}
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            isError={Boolean(errors.newPassword)}
            aria-describedby={`${IDS.newPassword}-rules`}
            suffix={
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? t("password.hide") : t("password.show")}
                aria-pressed={showNew}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
          <ul id={`${IDS.newPassword}-rules`} className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
            {rules.map((rule) => (
              <li
                key={rule.key}
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  rule.ok ? "text-success-strong" : "text-muted-foreground"
                }`}
              >
                {rule.ok ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <X className="size-3" aria-hidden />
                )}
                {rule.label}
              </li>
            ))}
          </ul>
          <SettingsFieldError id={`${IDS.newPassword}-error`} message={errors.newPassword} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={IDS.confirmPassword} className="text-xs font-bold text-foreground">
            {t("password.confirm")}
          </Label>
          <Input
            id={IDS.confirmPassword}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            isError={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? `${IDS.confirmPassword}-error` : undefined}
          />
          <SettingsFieldError
            id={`${IDS.confirmPassword}-error`}
            message={errors.confirmPassword}
          />
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t("password.otherSessionsNotice")}
        </p>

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={submitting}
            className="w-full sm:w-auto min-w-32 text-xs font-bold"
          >
            {t("password.submit")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
