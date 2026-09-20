"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useUnsavedChanges } from "@/lib/forms/use-unsaved-changes.client";
import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { Profile } from "@/lib/api/types";
import { buildProfileReplacementPayload } from "@/lib/auth/form-rules";
import { PROFILE_ERROR_MESSAGE_KEYS, submitProfileReplacement } from "@/lib/profile/client";
import type { ProfileBffCode } from "@/lib/profile/transport.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EducationFieldset,
  educationSelectionFromProfile,
  missingEducationFields,
  type EducationFieldKey,
  type EducationSelection,
} from "./education-fieldset";
import { SettingsCard, SettingsResult } from "./v2-settings-card";

export interface V2SettingsEducationCardProps {
  readonly locale: Locale;
  readonly profile: Profile;
}

/**
 * "Eğitim bilgileri" — the declared-education block (T-061).
 *
 * Rendered only for `STUDENT` and `PARENT`. A `TEACHER` does not see an empty version of this
 * card with an explanatory sentence in it, which is what `/profil` used to do: a section with
 * nothing to change is not a section, and the other three cards already give a teacher a full
 * page.
 *
 * Since T-061 registration collects these fields, so for a new account this card opens
 * already filled and is purely an edit surface. It stays required-on-save for the accounts
 * that predate that change and still carry `isComplete: false`.
 */
export function V2SettingsEducationCard({ locale, profile }: V2SettingsEducationCardProps) {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");
  const router = useRouter();

  const [value, setValue] = React.useState<EducationSelection>(
    educationSelectionFromProfile(profile),
  );
  const [isComplete, setIsComplete] = React.useState(profile.isComplete);
  const [errors, setErrors] = React.useState<Partial<Record<EducationFieldKey, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<ProfileBffCode | null>(null);

  /**
   * The saved selection this card's `value` is compared against for the unsaved-changes warning
   * (T-062). Serialised rather than compared field by field: `EducationSelection` is a
   * discriminated union whose shape changes with the level, so a field list here would have to be
   * kept in step with `education-fieldset.tsx`'s — a second reader of the same type, which is the
   * duplication `docs/conventions.md` asks for one of. Key order is stable because both sides come
   * out of `educationSelectionFromProfile`.
   */
  const [baseline, setBaseline] = React.useState(() =>
    JSON.stringify(educationSelectionFromProfile(profile)),
  );

  useUnsavedChanges(JSON.stringify(value) !== baseline);

  const handleChange = (next: EducationSelection) => {
    setValue(next);
    setErrors({});
    setSaved(false);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSubmitError(null);

    const missing = missingEducationFields(value);
    if (missing.length > 0) {
      const next: Partial<Record<EducationFieldKey, string>> = {};
      for (const key of missing) next[key] = tAuth("fieldErrors.required");
      setErrors(next);
      document.getElementById(`settings-education-${toKebab(missing[0] as string)}`)?.focus();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await submitProfileReplacement(buildProfileReplacementPayload(value));
      if (res.ok) {
        setSaved(true);
        setIsComplete(res.profile.isComplete);
        setValue(educationSelectionFromProfile(res.profile));
        setBaseline(JSON.stringify(educationSelectionFromProfile(res.profile)));
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
      id="egitim-bilgileri"
      icon={<GraduationCap className="size-5" />}
      title={t("education.title")}
      description={t("education.description")}
      headerAside={
        isComplete ? (
          <Badge variant="success" size="default" dot>
            {t("education.complete")}
          </Badge>
        ) : (
          <Badge variant="warning" size="default">
            {t("education.incomplete")}
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
        <EducationFieldset
          locale={locale}
          value={value}
          onChange={handleChange}
          errors={errors}
          idPrefix="settings-education"
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

/** `universityName` → `university-name`, matching `EducationFieldset`'s id spelling. */
function toKebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
