"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { InstitutionType, TeacherSubject } from "@/lib/api/types";
import type { TeacherFormState } from "@/lib/auth/form-rules";
import {
  INSTITUTION_TYPE_LABELS,
  TEACHER_SUBJECT_LABELS,
  renderLabel,
} from "@/lib/auth/profile-labels";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type TeacherSelection = TeacherFormState;
export type TeacherFieldKey = keyof TeacherSelection;

export const EMPTY_TEACHER_SELECTION: TeacherSelection = {
  teacherSubject: "",
  institutionType: "",
};

export interface TeacherFieldsetProps {
  readonly locale: Locale;
  readonly value: TeacherSelection;
  readonly onChange: (next: TeacherSelection) => void;
  readonly errors: Partial<Record<TeacherFieldKey, string>>;
  readonly idPrefix: string;
  readonly disabled?: boolean;
}

/** A teacher's second step (T-103): branch and institution type, both required. */
export function TeacherFieldset({
  locale,
  value,
  onChange,
  errors,
  idPrefix,
  disabled = false,
}: TeacherFieldsetProps) {
  const t = useTranslations("Auth");
  const ids = {
    teacherSubject: `${idPrefix}-teacher-subject`,
    institutionType: `${idPrefix}-institution-type`,
  } as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={ids.teacherSubject} className="text-xs font-bold text-foreground">
          {t("fields.teacherSubject")}
        </Label>
        <Select
          id={ids.teacherSubject}
          value={value.teacherSubject}
          onChange={(e) =>
            onChange({ ...value, teacherSubject: e.target.value as TeacherSubject | "" })
          }
          disabled={disabled}
          aria-invalid={Boolean(errors.teacherSubject)}
          aria-describedby={errors.teacherSubject ? `${ids.teacherSubject}-error` : undefined}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {(Object.keys(TEACHER_SUBJECT_LABELS) as TeacherSubject[]).map((key) => {
            const label = renderLabel(locale, TEACHER_SUBJECT_LABELS[key]);
            return (
              <option key={key} value={key} lang={label.lang}>
                {label.text}
              </option>
            );
          })}
        </Select>
        <FieldError id={`${ids.teacherSubject}-error`} message={errors.teacherSubject} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={ids.institutionType} className="text-xs font-bold text-foreground">
          {t("fields.institutionType")}
        </Label>
        <Select
          id={ids.institutionType}
          value={value.institutionType}
          onChange={(e) =>
            onChange({ ...value, institutionType: e.target.value as InstitutionType | "" })
          }
          disabled={disabled}
          aria-invalid={Boolean(errors.institutionType)}
          aria-describedby={errors.institutionType ? `${ids.institutionType}-error` : undefined}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {(Object.keys(INSTITUTION_TYPE_LABELS) as InstitutionType[]).map((key) => {
            const label = renderLabel(locale, INSTITUTION_TYPE_LABELS[key]);
            return (
              <option key={key} value={key} lang={label.lang}>
                {label.text}
              </option>
            );
          })}
        </Select>
        <FieldError id={`${ids.institutionType}-error`} message={errors.institutionType} />
      </div>
    </div>
  );
}

export function missingTeacherFields(value: TeacherSelection): TeacherFieldKey[] {
  const missing: TeacherFieldKey[] = [];
  if (!value.teacherSubject) missing.push("teacherSubject");
  if (!value.institutionType) missing.push("institutionType");
  return missing;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[11px] font-medium text-destructive">
      {message}
    </p>
  );
}
