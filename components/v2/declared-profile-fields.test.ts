import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/api/types";
import {
  declaredFieldElementId,
  declaredProfileFromProfile,
  emptyDeclaredProfile,
  missingDeclaredFields,
  roleHasDetails,
} from "./declared-profile-fields";
import { missingTeacherFields } from "./teacher-fieldset";

const PROFILE_BASE = {
  educationLevel: null,
  gradeLevel: null,
  studyStream: null,
  schoolName: null,
  universityName: null,
  departmentName: null,
  teacherSubject: null,
  institutionType: null,
} as const;

describe("declared profile rules (T-103)", () => {
  it("only the enthusiast has no second step", () => {
    expect(roleHasDetails("STUDENT")).toBe(true);
    expect(roleHasDetails("PARENT")).toBe(true);
    expect(roleHasDetails("TEACHER")).toBe(true);
    expect(roleHasDetails("ENTHUSIAST")).toBe(false);
  });

  it("names the missing fields of the selected role only", () => {
    expect(missingDeclaredFields(emptyDeclaredProfile("STUDENT"))).toEqual(["educationLevel"]);
    expect(missingDeclaredFields(emptyDeclaredProfile("PARENT"))).toEqual([
      "gradeLevel",
      "studyStream",
    ]);
    expect(missingDeclaredFields(emptyDeclaredProfile("TEACHER"))).toEqual([
      "teacherSubject",
      "institutionType",
    ]);
    expect(missingDeclaredFields(emptyDeclaredProfile("ENTHUSIAST"))).toEqual([]);
  });

  it("a teacher with only one of branch/institution is missing the other, not both (Review Focus 4)", () => {
    expect(
      missingTeacherFields({ teacherSubject: "COGRAFYA", institutionType: "" }),
    ).toEqual(["institutionType"]);
    expect(
      missingTeacherFields({ teacherSubject: "", institutionType: "DERSHANE_KURS" }),
    ).toEqual(["teacherSubject"]);

    const partial = emptyDeclaredProfile("TEACHER");
    expect(
      missingDeclaredFields({
        ...partial,
        teacher: { teacherSubject: "", institutionType: "DERSHANE_KURS" },
      }),
    ).toEqual(["teacherSubject"]);
  });

  it("a parent's stored education becomes the child selection, not the student one", () => {
    const value = declaredProfileFromProfile({
      ...PROFILE_BASE,
      accountRole: "PARENT",
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
    } as Profile);
    expect(value.childEducation).toMatchObject({
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
    });
    expect(value.education.educationLevel).toBe("");
  });

  it("a teacher's stored fields become the teacher selection", () => {
    const value = declaredProfileFromProfile({
      ...PROFILE_BASE,
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
      institutionType: "DERSHANE_KURS",
    } as Profile);
    expect(value.teacher).toEqual({ teacherSubject: "COGRAFYA", institutionType: "DERSHANE_KURS" });
  });

  it("element ids follow the fieldsets' kebab spelling", () => {
    expect(declaredFieldElementId("settings-profile", "gradeLevel")).toBe(
      "settings-profile-grade-level",
    );
    expect(declaredFieldElementId("v2-register-details", "institutionType")).toBe(
      "v2-register-details-institution-type",
    );
  });
});
