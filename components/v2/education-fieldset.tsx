"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type {
  Department,
  EducationLevel,
  GradeLevel,
  StudyStream,
  University,
} from "@/lib/api/types";
import {
  EDUCATION_LEVEL_LABELS,
  GRADE_LEVEL_LABELS,
  STUDY_STREAM_LABELS,
  UNIVERSITY_GROUP_LABELS,
  renderLabel,
} from "@/lib/auth/profile-labels";
import { Label } from "@/components/ui/label";

/**
 * The six declared education fields, as a form holds them: `""` for "not chosen yet" rather
 * than `null`, because that is what a `<select>` with a placeholder option produces. The
 * conversion to the API's nullable shape happens in `buildProfileReplacementPayload`, at the
 * edge, once.
 */
export interface EducationSelection {
  readonly educationLevel: EducationLevel | "";
  readonly gradeLevel: GradeLevel | "";
  readonly studyStream: StudyStream | "";
  readonly schoolName: string;
  readonly universityName: string;
  readonly departmentName: string;
}

export type EducationFieldKey = keyof EducationSelection;

export const EMPTY_EDUCATION_SELECTION: EducationSelection = {
  educationLevel: "",
  gradeLevel: "",
  studyStream: "",
  schoolName: "",
  universityName: "",
  departmentName: "",
};

export interface EducationFieldsetProps {
  readonly locale: Locale;
  readonly value: EducationSelection;
  readonly onChange: (next: EducationSelection) => void;
  readonly errors: Partial<Record<EducationFieldKey, string>>;
  /**
   * Prefixes every element id this fieldset renders. Required, with no default, because two
   * mounts on one page must not collide — a default would make the collision the quiet case
   * and the correct spelling the effortful one.
   */
  readonly idPrefix: string;
  readonly disabled?: boolean;
}

/**
 * The declared-education matrix as one component (T-061).
 *
 * Two surfaces ask for these six fields — step 2 of registration and the settings page's
 * education card — and before T-061 the second one spelled them out inline while the first
 * did not ask at all. Extracted rather than copied so the branch rules, the dependent-field
 * reset and the two lazily-fetched reference lists have one home.
 *
 * **The branch rules** (they mirror the API's `isProfileShapeValid`, which is the authority):
 * - `SECONDARY` → grade and stream are required, school is optional, university/department
 *   must be absent.
 * - `UNDERGRADUATE` → university and department required, the secondary trio absent.
 * - `GRADUATE` → university required, department optional, the secondary trio absent.
 *
 * Changing the level CLEARS the fields the new branch does not use. Keeping them would send
 * the API a shape it rejects outright, and the member would see a validation failure naming
 * a field the form is no longer showing them.
 */
export function EducationFieldset({
  locale,
  value,
  onChange,
  errors,
  idPrefix,
  disabled = false,
}: EducationFieldsetProps) {
  const t = useTranslations("Auth");

  const ids = {
    educationLevel: `${idPrefix}-education-level`,
    gradeLevel: `${idPrefix}-grade-level`,
    studyStream: `${idPrefix}-study-stream`,
    schoolName: `${idPrefix}-school-name`,
    universityName: `${idPrefix}-university-name`,
    departmentName: `${idPrefix}-department-name`,
  } as const;

  const needsUniversity =
    value.educationLevel === "UNDERGRADUATE" || value.educationLevel === "GRADUATE";

  // Both lists are fetched only once a branch that needs them is chosen: the university list
  // is ~200 rows and the department list longer, and a member on the SECONDARY branch never
  // needs either.
  //
  // `null` means "not here yet" and the loading state is DERIVED from it rather than stored.
  // A separate `"idle" | "loading" | …` field would have to be moved to `"loading"`
  // synchronously inside the effect, which is the cascading-render pattern the lint rule
  // forbids — and it would be a second source of truth for a question the data already
  // answers.
  const [universities, setUniversities] = React.useState<University[] | null>(null);
  const [universityFailed, setUniversityFailed] = React.useState(false);
  const [departments, setDepartments] = React.useState<Department[] | null>(null);
  const [departmentFailed, setDepartmentFailed] = React.useState(false);

  React.useEffect(() => {
    if (!needsUniversity || universities !== null || universityFailed) return;
    let active = true;
    fetchReferenceList<University[]>("/api/reference/universities")
      .then((data) => {
        if (active) setUniversities(data);
      })
      .catch(() => {
        if (active) setUniversityFailed(true);
      });
    return () => {
      active = false;
    };
  }, [needsUniversity, universities, universityFailed]);

  React.useEffect(() => {
    if (!needsUniversity || departments !== null || departmentFailed) return;
    let active = true;
    fetchReferenceList<Department[]>("/api/reference/departments")
      .then((data) => {
        if (active) setDepartments(data);
      })
      .catch(() => {
        if (active) setDepartmentFailed(true);
      });
    return () => {
      active = false;
    };
  }, [needsUniversity, departments, departmentFailed]);

  const universityState: ReferenceState = universityFailed
    ? "error"
    : universities === null
      ? "loading"
      : "loaded";
  const departmentState: ReferenceState = departmentFailed
    ? "error"
    : departments === null
      ? "loading"
      : "loaded";

  const handleLevelChange = (nextLevel: EducationLevel | "") => {
    onChange({ ...EMPTY_EDUCATION_SELECTION, educationLevel: nextLevel });
  };

  const patch = (next: Partial<EducationSelection>) => onChange({ ...value, ...next });

  const groupAnnouncement =
    value.educationLevel === "SECONDARY"
      ? t("fields.groupSecondaryAnnounce")
      : needsUniversity
        ? t("fields.groupHigherEdAnnounce")
        : "";

  const nonKktcUniversities = (universities ?? []).filter((u) => u.type !== "KKTC");
  const kktcUniversities = (universities ?? []).filter((u) => u.type === "KKTC");
  const turkeyGroup = renderLabel(locale, UNIVERSITY_GROUP_LABELS.DEVLET);
  const kktcGroup = renderLabel(locale, UNIVERSITY_GROUP_LABELS.KKTC);

  return (
    <div className="space-y-5">
      <div role="status" aria-live="polite" className="sr-only">
        {groupAnnouncement}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={ids.educationLevel} className="text-xs font-bold text-foreground">
          {t("fields.educationLevel")}
        </Label>
        <SelectShell>
          <select
            id={ids.educationLevel}
            value={value.educationLevel}
            onChange={(e) => handleLevelChange(e.target.value as EducationLevel | "")}
            disabled={disabled}
            aria-invalid={Boolean(errors.educationLevel)}
            aria-describedby={errors.educationLevel ? `${ids.educationLevel}-error` : undefined}
            className={SELECT_CLASS}
          >
            <option value="">{t("selectPlaceholder")}</option>
            {(["SECONDARY", "UNDERGRADUATE", "GRADUATE"] as const).map((level) => {
              const label = renderLabel(locale, EDUCATION_LEVEL_LABELS[level]);
              return (
                <option key={level} value={level} lang={label.lang}>
                  {label.text}
                </option>
              );
            })}
          </select>
        </SelectShell>
        <FieldError id={`${ids.educationLevel}-error`} message={errors.educationLevel} />
      </div>

      {value.educationLevel === "SECONDARY" && (
        <fieldset className="space-y-4 pt-2 border-t border-border">
          <legend className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">
            {t("fields.groupSecondary")}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={ids.gradeLevel} className="text-xs font-bold text-foreground">
                {t("fields.grade")}
              </Label>
              <SelectShell>
                <select
                  id={ids.gradeLevel}
                  value={value.gradeLevel}
                  onChange={(e) => patch({ gradeLevel: e.target.value as GradeLevel | "" })}
                  disabled={disabled}
                  aria-invalid={Boolean(errors.gradeLevel)}
                  aria-describedby={errors.gradeLevel ? `${ids.gradeLevel}-error` : undefined}
                  className={SELECT_CLASS}
                >
                  <option value="">{t("selectPlaceholder")}</option>
                  {(Object.keys(GRADE_LEVEL_LABELS) as GradeLevel[]).map((key) => {
                    const label = renderLabel(locale, GRADE_LEVEL_LABELS[key]);
                    return (
                      <option key={key} value={key} lang={label.lang}>
                        {label.text}
                      </option>
                    );
                  })}
                </select>
              </SelectShell>
              <FieldError id={`${ids.gradeLevel}-error`} message={errors.gradeLevel} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ids.studyStream} className="text-xs font-bold text-foreground">
                {t("fields.stream")}
              </Label>
              <SelectShell>
                <select
                  id={ids.studyStream}
                  value={value.studyStream}
                  onChange={(e) => patch({ studyStream: e.target.value as StudyStream | "" })}
                  disabled={disabled}
                  aria-invalid={Boolean(errors.studyStream)}
                  aria-describedby={errors.studyStream ? `${ids.studyStream}-error` : undefined}
                  className={SELECT_CLASS}
                >
                  <option value="">{t("selectPlaceholder")}</option>
                  {(Object.keys(STUDY_STREAM_LABELS) as StudyStream[]).map((key) => {
                    const label = renderLabel(locale, STUDY_STREAM_LABELS[key]);
                    return (
                      <option key={key} value={key} lang={label.lang}>
                        {label.text}
                      </option>
                    );
                  })}
                </select>
              </SelectShell>
              <FieldError id={`${ids.studyStream}-error`} message={errors.studyStream} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={ids.schoolName} className="text-xs font-bold text-foreground">
              {t("fields.school")}
            </Label>
            <input
              id={ids.schoolName}
              type="text"
              value={value.schoolName}
              onChange={(e) => patch({ schoolName: e.target.value })}
              disabled={disabled}
              maxLength={200}
              autoComplete="organization"
              className={SELECT_CLASS}
            />
          </div>
        </fieldset>
      )}

      {needsUniversity && (
        <fieldset className="space-y-4 pt-2 border-t border-border">
          <legend className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">
            {t("fields.groupHigherEd")}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={ids.universityName} className="text-xs font-bold text-foreground">
                {t("fields.university")}
              </Label>
              <SelectShell>
                <select
                  id={ids.universityName}
                  value={value.universityName}
                  onChange={(e) => patch({ universityName: e.target.value })}
                  disabled={disabled || universityState === "loading"}
                  aria-invalid={Boolean(errors.universityName)}
                  aria-describedby={
                    errors.universityName ? `${ids.universityName}-error` : undefined
                  }
                  className={SELECT_CLASS}
                >
                  {universityState === "loading" ? (
                    <option value="">{t("university.loading")}</option>
                  ) : universityState === "error" ? (
                    <option value="">{t("university.loadError")}</option>
                  ) : (
                    <>
                      <option value="">{t("selectPlaceholder")}</option>
                      {nonKktcUniversities.length > 0 && (
                        <optgroup label={turkeyGroup.text} lang={turkeyGroup.lang}>
                          {nonKktcUniversities.map((u) => (
                            <option key={u.nameTr} value={u.nameTr} lang="tr">
                              {u.nameTr}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {kktcUniversities.length > 0 && (
                        <optgroup label={kktcGroup.text} lang={kktcGroup.lang}>
                          {kktcUniversities.map((u) => (
                            <option key={u.nameTr} value={u.nameTr} lang="tr">
                              {u.nameTr}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </SelectShell>
              <FieldError id={`${ids.universityName}-error`} message={errors.universityName} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ids.departmentName} className="text-xs font-bold text-foreground">
                {t("fields.department")}
              </Label>
              <SelectShell>
                <select
                  id={ids.departmentName}
                  value={value.departmentName}
                  onChange={(e) => patch({ departmentName: e.target.value })}
                  disabled={disabled || departmentState === "loading"}
                  aria-invalid={Boolean(errors.departmentName)}
                  aria-describedby={
                    errors.departmentName ? `${ids.departmentName}-error` : undefined
                  }
                  className={SELECT_CLASS}
                >
                  {departmentState === "loading" ? (
                    <option value="">{t("department.loading")}</option>
                  ) : departmentState === "error" ? (
                    <option value="">{t("department.loadError")}</option>
                  ) : (
                    <>
                      <option value="">{t("selectPlaceholder")}</option>
                      {(departments ?? []).map((d) => (
                        <option key={d.nameTr} value={d.nameTr} lang="tr">
                          {d.nameTr}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </SelectShell>
              <FieldError id={`${ids.departmentName}-error`} message={errors.departmentName} />
            </div>
          </div>
        </fieldset>
      )}
    </div>
  );
}

/**
 * The required-field rules, as data rather than as a chain of `if`s inside a submit handler.
 * Both consumers validate before they send, and both must answer the SAME question, so the
 * answer lives here next to the fields it is about.
 *
 * It returns keys, not sentences: the caller owns the message catalogue and the id prefix,
 * and a helper that reached for `useTranslations` could not be called from a submit handler.
 */
export function missingEducationFields(value: EducationSelection): EducationFieldKey[] {
  if (!value.educationLevel) return ["educationLevel"];

  const missing: EducationFieldKey[] = [];
  if (value.educationLevel === "SECONDARY") {
    if (!value.gradeLevel) missing.push("gradeLevel");
    if (!value.studyStream) missing.push("studyStream");
  } else {
    if (!value.universityName) missing.push("universityName");
    // GRADUATE leaves department optional — the API's own matrix says so, and a member who
    // has not declared a programme should not be blocked from declaring the university.
    if (value.educationLevel === "UNDERGRADUATE" && !value.departmentName) {
      missing.push("departmentName");
    }
  }
  return missing;
}

/** Turns a `Profile`'s nullable education fields into what this fieldset holds. */
export function educationSelectionFromProfile(profile: {
  educationLevel: EducationLevel | null;
  gradeLevel: GradeLevel | null;
  studyStream: StudyStream | null;
  schoolName: string | null;
  universityName: string | null;
  departmentName: string | null;
}): EducationSelection {
  return {
    educationLevel: profile.educationLevel ?? "",
    gradeLevel: profile.gradeLevel ?? "",
    studyStream: profile.studyStream ?? "",
    schoolName: profile.schoolName ?? "",
    universityName: profile.universityName ?? "",
    departmentName: profile.departmentName ?? "",
  };
}

type ReferenceState = "loading" | "loaded" | "error";

const SELECT_CLASS =
  "w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:border-primary transition-all duration-150 disabled:opacity-50";

function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[11px] font-medium text-destructive">
      {message}
    </p>
  );
}

async function fetchReferenceList<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`fetchReferenceList: ${url} failed with ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
