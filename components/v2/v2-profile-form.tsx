"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, ChevronDown, GraduationCap } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type {
  Department,
  EducationLevel,
  GradeLevel,
  Profile,
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
import { buildProfileReplacementPayload } from "@/lib/auth/form-rules";
import { PROFILE_ERROR_MESSAGE_KEYS, submitProfileReplacement } from "@/lib/profile/client";
import type { ProfileBffCode } from "@/lib/profile/transport.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export interface V2ProfileFormProps {
  readonly locale: Locale;
  readonly profile: Profile;
}

const FIELD_ELEMENT_IDS: Record<string, string> = {
  educationLevel: "v2-profile-education-level",
  gradeLevel: "v2-profile-grade-level",
  studyStream: "v2-profile-study-stream",
  universityName: "v2-profile-university-name",
  departmentName: "v2-profile-department-name",
};

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

export function V2ProfileForm({ locale, profile }: V2ProfileFormProps) {
  const t = useTranslations("Auth");
  const router = useRouter();

  // Form fields initialized from profile
  const [educationLevel, setEducationLevel] = React.useState<EducationLevel | "">(
    profile.educationLevel ?? "",
  );
  const [gradeLevel, setGradeLevel] = React.useState<GradeLevel | "">(profile.gradeLevel ?? "");
  const [studyStream, setStudyStream] = React.useState<StudyStream | "">(profile.studyStream ?? "");
  const [universityName, setUniversityName] = React.useState<string>(profile.universityName ?? "");
  const [departmentName, setDepartmentName] = React.useState<string>(profile.departmentName ?? "");

  const [isComplete, setIsComplete] = React.useState<boolean>(profile.isComplete);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<ProfileBffCode | null>(null);

  // Lazy reference data
  const [universities, setUniversities] = React.useState<University[]>([]);
  const [universityState, setUniversityState] = React.useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [departmentState, setDepartmentState] = React.useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const needsUniversity = educationLevel === "UNDERGRADUATE" || educationLevel === "GRADUATE";

  if (needsUniversity && universityState === "idle") {
    setUniversityState("loading");
  }
  if (needsUniversity && departmentState === "idle") {
    setDepartmentState("loading");
  }

  React.useEffect(() => {
    if (universityState !== "loading") return;
    fetchReferenceList<University[]>("/api/reference/universities")
      .then((data) => {
        setUniversities(data);
        setUniversityState("loaded");
      })
      .catch(() => {
        setUniversityState("error");
      });
  }, [universityState]);

  React.useEffect(() => {
    if (departmentState !== "loading") return;
    fetchReferenceList<Department[]>("/api/reference/departments")
      .then((data) => {
        setDepartments(data);
        setDepartmentState("loaded");
      })
      .catch(() => {
        setDepartmentState("error");
      });
  }, [departmentState]);

  // Dependent field reset on educationLevel change
  const handleEducationLevelChange = (newLevel: EducationLevel | "") => {
    setEducationLevel(newLevel);
    setGradeLevel("");
    setStudyStream("");
    setUniversityName("");
    setDepartmentName("");
    setFieldErrors({});
    setSaved(false);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSubmitError(null);

    const errors: Record<string, string | undefined> = {};

    if (!educationLevel) {
      errors.educationLevel = t("fieldErrors.required");
    } else if (educationLevel === "SECONDARY") {
      if (!gradeLevel) errors.gradeLevel = t("fieldErrors.required");
      if (!studyStream) errors.studyStream = t("fieldErrors.required");
    } else if (educationLevel === "UNDERGRADUATE") {
      if (!universityName) errors.universityName = t("fieldErrors.required");
      if (!departmentName) errors.departmentName = t("fieldErrors.required");
    } else if (educationLevel === "GRADUATE") {
      if (!universityName) errors.universityName = t("fieldErrors.required");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstInvalidField = Object.keys(errors)[0] as
        keyof typeof FIELD_ELEMENT_IDS | undefined;
      if (firstInvalidField) {
        const targetId = FIELD_ELEMENT_IDS[firstInvalidField];
        if (targetId) {
          document.getElementById(targetId)?.focus();
        }
      }
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const payload = buildProfileReplacementPayload({
        educationLevel,
        gradeLevel,
        studyStream,
        universityName,
        departmentName,
      });

      const res = await submitProfileReplacement(payload);
      if (res.ok) {
        setSaved(true);
        setIsComplete(res.profile.isComplete);
        setEducationLevel(res.profile.educationLevel ?? "");
        setGradeLevel(res.profile.gradeLevel ?? "");
        setStudyStream(res.profile.studyStream ?? "");
        setUniversityName(res.profile.universityName ?? "");
        setDepartmentName(res.profile.departmentName ?? "");
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

  const groupAnnouncement =
    educationLevel === "SECONDARY"
      ? t("fields.groupSecondaryAnnounce")
      : educationLevel === "UNDERGRADUATE" || educationLevel === "GRADUATE"
        ? t("fields.groupHigherEdAnnounce")
        : "";

  const nonKktcUniversities = universities.filter((u) => u.type !== "KKTC");
  const kktcUniversities = universities.filter((u) => u.type === "KKTC");
  const turkeyGroup = renderLabel(locale, UNIVERSITY_GROUP_LABELS.DEVLET);
  const kktcGroup = renderLabel(locale, UNIVERSITY_GROUP_LABELS.KKTC);

  const selectClass =
    "w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150 disabled:opacity-50";

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t("profile.heading")}
            </h1>
          </div>
        </div>
        {isComplete && (
          <Badge variant="success" size="default" dot>
            {t("profile.complete")}
          </Badge>
        )}
      </div>

      {/* Screen reader announcement for conditional reveal */}
      <div role="status" aria-live="polite" className="sr-only">
        {groupAnnouncement}
      </div>

      {/* Saved success banner */}
      {saved && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2.5"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{t("profile.saved")}</span>
        </div>
      )}

      {/* Submission error banner */}
      {submitError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2.5"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{t(PROFILE_ERROR_MESSAGE_KEYS[submitError])}</span>
        </div>
      )}

      {/* Form Errors summary */}
      {Object.values(fieldErrors).some(Boolean) && !submitError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2.5"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{t("formErrors.summary")}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Education Level Selector */}
        <div className="space-y-1.5">
          <Label
            htmlFor={FIELD_ELEMENT_IDS.educationLevel}
            className="text-xs font-bold text-foreground"
          >
            {t("fields.educationLevel")}
          </Label>
          <div className="relative">
            <select
              id={FIELD_ELEMENT_IDS.educationLevel}
              value={educationLevel}
              onChange={(e) => handleEducationLevelChange(e.target.value as EducationLevel | "")}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.educationLevel)}
              aria-describedby={fieldErrors.educationLevel ? "v2-error-education-level" : undefined}
              className={selectClass}
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
            <ChevronDown className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {fieldErrors.educationLevel && (
            <p id="v2-error-education-level" className="text-[11px] font-medium text-destructive">
              {fieldErrors.educationLevel}
            </p>
          )}
        </div>

        {/* Secondary branch */}
        {educationLevel === "SECONDARY" && (
          <fieldset className="space-y-4 pt-2 border-t border-border">
            <legend className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">
              {t("fields.groupSecondary")}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor={FIELD_ELEMENT_IDS.gradeLevel}
                  className="text-xs font-bold text-foreground"
                >
                  {t("fields.grade")}
                </Label>
                <div className="relative">
                  <select
                    id={FIELD_ELEMENT_IDS.gradeLevel}
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value as GradeLevel | "")}
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.gradeLevel)}
                    aria-describedby={fieldErrors.gradeLevel ? "v2-error-grade-level" : undefined}
                    className={selectClass}
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
                  <ChevronDown className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {fieldErrors.gradeLevel && (
                  <p id="v2-error-grade-level" className="text-[11px] font-medium text-destructive">
                    {fieldErrors.gradeLevel}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor={FIELD_ELEMENT_IDS.studyStream}
                  className="text-xs font-bold text-foreground"
                >
                  {t("fields.stream")}
                </Label>
                <div className="relative">
                  <select
                    id={FIELD_ELEMENT_IDS.studyStream}
                    value={studyStream}
                    onChange={(e) => setStudyStream(e.target.value as StudyStream | "")}
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.studyStream)}
                    aria-describedby={fieldErrors.studyStream ? "v2-error-study-stream" : undefined}
                    className={selectClass}
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
                  <ChevronDown className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {fieldErrors.studyStream && (
                  <p
                    id="v2-error-study-stream"
                    className="text-[11px] font-medium text-destructive"
                  >
                    {fieldErrors.studyStream}
                  </p>
                )}
              </div>
            </div>
          </fieldset>
        )}

        {/* Higher education branch (Undergraduate / Graduate) */}
        {(educationLevel === "UNDERGRADUATE" || educationLevel === "GRADUATE") && (
          <fieldset className="space-y-4 pt-2 border-t border-border">
            <legend className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">
              {t("fields.groupHigherEd")}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor={FIELD_ELEMENT_IDS.universityName}
                  className="text-xs font-bold text-foreground"
                >
                  {t("fields.university")}
                </Label>
                <div className="relative">
                  <select
                    id={FIELD_ELEMENT_IDS.universityName}
                    value={universityName}
                    onChange={(e) => setUniversityName(e.target.value)}
                    disabled={submitting || universityState === "loading"}
                    aria-invalid={Boolean(fieldErrors.universityName)}
                    aria-describedby={
                      fieldErrors.universityName ? "v2-error-university-name" : undefined
                    }
                    className={selectClass}
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
                  <ChevronDown className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {fieldErrors.universityName && (
                  <p
                    id="v2-error-university-name"
                    className="text-[11px] font-medium text-destructive"
                  >
                    {fieldErrors.universityName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor={FIELD_ELEMENT_IDS.departmentName}
                  className="text-xs font-bold text-foreground"
                >
                  {t("fields.department")}
                </Label>
                <div className="relative">
                  <select
                    id={FIELD_ELEMENT_IDS.departmentName}
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    disabled={submitting || departmentState === "loading"}
                    aria-invalid={Boolean(fieldErrors.departmentName)}
                    aria-describedby={
                      fieldErrors.departmentName ? "v2-error-department-name" : undefined
                    }
                    className={selectClass}
                  >
                    {departmentState === "loading" ? (
                      <option value="">{t("department.loading")}</option>
                    ) : departmentState === "error" ? (
                      <option value="">{t("department.loadError")}</option>
                    ) : (
                      <>
                        <option value="">{t("selectPlaceholder")}</option>
                        {departments.map((d) => (
                          <option key={d.nameTr} value={d.nameTr} lang="tr">
                            {d.nameTr}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <ChevronDown className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {fieldErrors.departmentName && (
                  <p
                    id="v2-error-department-name"
                    className="text-[11px] font-medium text-destructive"
                  >
                    {fieldErrors.departmentName}
                  </p>
                )}
              </div>
            </div>
          </fieldset>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={submitting}
            className="w-full sm:w-auto min-w-32 text-xs font-bold"
          >
            {t("profile.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
