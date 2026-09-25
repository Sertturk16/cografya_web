"use client";

import type { Locale } from "@/i18n/routing";
import type { AccountRole, Profile } from "@/lib/api/types";
import type { DeclaredProfileFormState } from "@/lib/auth/form-rules";
import {
  EducationFieldset,
  EMPTY_CHILD_EDUCATION_SELECTION,
  EMPTY_EDUCATION_SELECTION,
  educationSelectionFromProfile,
  missingEducationFields,
  type EducationFieldKey,
} from "./education-fieldset";
import {
  EMPTY_TEACHER_SELECTION,
  TeacherFieldset,
  missingTeacherFields,
  type TeacherFieldKey,
} from "./teacher-fieldset";

export type DeclaredProfileSelection = DeclaredProfileFormState;
export type DeclaredFieldKey = EducationFieldKey | TeacherFieldKey;

/** Every role but the enthusiast has a second step (spec §1.2). */
export function roleHasDetails(role: AccountRole): boolean {
  return role !== "ENTHUSIAST";
}

export function emptyDeclaredProfile(role: AccountRole): DeclaredProfileSelection {
  return {
    accountRole: role,
    education: EMPTY_EDUCATION_SELECTION,
    childEducation: EMPTY_CHILD_EDUCATION_SELECTION,
    teacher: EMPTY_TEACHER_SELECTION,
  };
}

/** A stored profile, split into the selection its own role uses. */
export function declaredProfileFromProfile(profile: Profile): DeclaredProfileSelection {
  const stored = educationSelectionFromProfile(profile);
  return {
    accountRole: profile.accountRole,
    education: profile.accountRole === "STUDENT" ? stored : EMPTY_EDUCATION_SELECTION,
    childEducation:
      profile.accountRole === "PARENT"
        ? {
            ...EMPTY_CHILD_EDUCATION_SELECTION,
            gradeLevel: stored.gradeLevel,
            studyStream: stored.studyStream,
          }
        : EMPTY_CHILD_EDUCATION_SELECTION,
    teacher: {
      teacherSubject: profile.teacherSubject ?? "",
      institutionType: profile.institutionType ?? "",
    },
  };
}

/** The selected role's missing required fields, in display order. */
export function missingDeclaredFields(value: DeclaredProfileSelection): DeclaredFieldKey[] {
  switch (value.accountRole) {
    case "STUDENT":
      return missingEducationFields(value.education);
    case "PARENT":
      return missingEducationFields(value.childEducation);
    case "TEACHER":
      return missingTeacherFields(value.teacher);
    case "ENTHUSIAST":
      return [];
  }
}

/** The element id a fieldset gives `key` under `idPrefix` (`gradeLevel` → `…-grade-level`). */
export function declaredFieldElementId(idPrefix: string, key: DeclaredFieldKey): string {
  return `${idPrefix}-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export interface DeclaredProfileFieldsProps {
  readonly locale: Locale;
  readonly value: DeclaredProfileSelection;
  readonly onChange: (next: DeclaredProfileSelection) => void;
  readonly errors: Partial<Record<DeclaredFieldKey, string>>;
  readonly idPrefix: string;
  readonly disabled?: boolean;
}

/**
 * The second step for the selected role (T-103), shared by the register wizard and the
 * settings card so both ask the same questions with the same rules.
 */
export function DeclaredProfileFields({
  locale,
  value,
  onChange,
  errors,
  idPrefix,
  disabled = false,
}: DeclaredProfileFieldsProps) {
  switch (value.accountRole) {
    case "STUDENT":
      return (
        <EducationFieldset
          locale={locale}
          value={value.education}
          onChange={(education) => onChange({ ...value, education })}
          errors={errors}
          idPrefix={idPrefix}
          disabled={disabled}
        />
      );
    case "PARENT":
      return (
        <EducationFieldset
          variant="child"
          locale={locale}
          value={value.childEducation}
          onChange={(childEducation) => onChange({ ...value, childEducation })}
          errors={errors}
          idPrefix={idPrefix}
          disabled={disabled}
        />
      );
    case "TEACHER":
      return (
        <TeacherFieldset
          locale={locale}
          value={value.teacher}
          onChange={(teacher) => onChange({ ...value, teacher })}
          errors={errors}
          idPrefix={idPrefix}
          disabled={disabled}
        />
      );
    case "ENTHUSIAST":
      return null;
  }
}
