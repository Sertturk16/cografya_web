"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useUnsavedChanges } from "@/lib/forms/use-unsaved-changes.client";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { Profile } from "@/lib/api/types";
import { buildProfileReplacementPayload } from "@/lib/auth/form-rules";
import { PROFILE_ERROR_MESSAGE_KEYS, submitProfileReplacement } from "@/lib/profile/client";
import type { ProfileBffCode } from "@/lib/profile/transport.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountRolePicker } from "./account-role-picker";
import {
  DeclaredProfileFields,
  declaredFieldElementId,
  declaredProfileFromProfile,
  missingDeclaredFields,
  type DeclaredFieldKey,
  type DeclaredProfileSelection,
} from "./declared-profile-fields";
import { SettingsCard, SettingsResult } from "./v2-settings-card";

const ID_PREFIX = "settings-profile";

export interface V2SettingsProfileCardProps {
  readonly locale: Locale;
  readonly profile: Profile;
}

/**
 * "Hesap Türü" (T-103): the declared role and that role's fields, for every member.
 *
 * The role and its fields save together through `PUT /api/profile`, because a role without
 * its fields (or fields of another role) is a shape the API refuses. Switching the role shows
 * the new role's fields in place and a one-line notice; nothing is written until the member
 * saves, and the save clears the previous role's data.
 */
export function V2SettingsProfileCard({ locale, profile }: V2SettingsProfileCardProps) {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");
  const router = useRouter();

  const [value, setValue] = React.useState<DeclaredProfileSelection>(() =>
    declaredProfileFromProfile(profile),
  );
  const [savedRole, setSavedRole] = React.useState(profile.accountRole);
  const [isComplete, setIsComplete] = React.useState(profile.isComplete);
  const [errors, setErrors] = React.useState<Partial<Record<DeclaredFieldKey, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<ProfileBffCode | null>(null);
  const [baseline, setBaseline] = React.useState(() =>
    JSON.stringify(declaredProfileFromProfile(profile)),
  );

  useUnsavedChanges(JSON.stringify(value) !== baseline);

  const handleChange = (next: DeclaredProfileSelection) => {
    setValue(next);
    setErrors({});
    setSaved(false);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSubmitError(null);

    const missing = missingDeclaredFields(value);
    if (missing.length > 0) {
      const next: Partial<Record<DeclaredFieldKey, string>> = {};
      for (const key of missing) next[key] = tAuth("fieldErrors.required");
      setErrors(next);
      const first = missing[0];
      if (first) document.getElementById(declaredFieldElementId(ID_PREFIX, first))?.focus();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await submitProfileReplacement(buildProfileReplacementPayload(value));
      if (res.ok) {
        const next = declaredProfileFromProfile(res.profile);
        setSaved(true);
        setIsComplete(res.profile.isComplete);
        setSavedRole(res.profile.accountRole);
        setValue(next);
        setBaseline(JSON.stringify(next));
        router.refresh();
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
      id="hesap-turu"
      icon={<UserRound className="size-5" />}
      title={t("profile.title")}
      description={t("profile.description")}
      headerAside={
        isComplete ? (
          <Badge variant="success" size="default" dot>
            {t("profile.complete")}
          </Badge>
        ) : (
          <Badge variant="warning" size="default">
            {t("profile.incomplete")}
          </Badge>
        )
      }
    >
      <SettingsResult
        saved={saved}
        savedMessage={t("saved")}
        errorMessage={submitError ? tAuth(PROFILE_ERROR_MESSAGE_KEYS[submitError]) : null}
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AccountRolePicker
          locale={locale}
          idPrefix={`${ID_PREFIX}-role`}
          value={value.accountRole}
          onChange={(accountRole) => handleChange({ ...value, accountRole })}
          disabled={submitting}
        />

        {value.accountRole !== savedRole && (
          <p role="status" className="text-[11px] text-muted-foreground leading-relaxed">
            {t("profile.roleChangeNotice")}
          </p>
        )}

        <DeclaredProfileFields
          locale={locale}
          value={value}
          onChange={handleChange}
          errors={errors}
          idPrefix={ID_PREFIX}
          disabled={submitting}
        />

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={submitting}
            className="w-full sm:w-auto min-w-32 text-xs font-bold"
          >
            {t("save")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
