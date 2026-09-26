import { describe, expect, it } from "vitest";
import {
  buildProfileReplacementPayload,
  buildRegisterPayload,
  type DeclaredProfileFormState,
  type ProfileAxisFormState,
  type RegisterFormState,
} from "./form-rules";

const EMPTY_AXIS: ProfileAxisFormState = {
  educationLevel: "",
  gradeLevel: "",
  studyStream: "",
  schoolName: "",
  universityName: "",
  departmentName: "",
};

const BASE: RegisterFormState = {
  firstName: "Ayşe",
  lastName: "Yılmaz",
  phone: "+905321112233",
  email: "ayse@example.test",
  password: "Synthetic-Pass1",
  passwordConfirm: "Synthetic-Pass1",
  userType: "student",
  provincePlateCode: "34",
  districtId: "6b3f6f5a-6f5a-4f5a-8f5a-6f5a6f5a6f5a",
  termsAccepted: true,
  marketingConsent: false,
};

describe("buildRegisterPayload — T-103 types", () => {
  it("a parent sends the child's grade and stream as SECONDARY, and never a school", () => {
    const body = buildRegisterPayload(
      {
        ...BASE,
        userType: "parent",
        gradeLevel: "GRADE_12",
        studyStream: "SAYISAL",
        schoolName: "X Lisesi",
      },
      "tr",
    );
    expect(body).toMatchObject({
      accountRole: "PARENT",
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_12",
      studyStream: "SAYISAL",
    });
    expect(body).not.toHaveProperty("schoolName");
  });

  it("a teacher sends both teacher fields and no education field", () => {
    const body = buildRegisterPayload(
      {
        ...BASE,
        userType: "teacher",
        teacherSubject: "COGRAFYA",
        institutionType: "OZEL_OKUL",
        gradeLevel: "GRADE_9",
      },
      "tr",
    );
    expect(body).toMatchObject({
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
      institutionType: "OZEL_OKUL",
    });
    expect(body).not.toHaveProperty("educationLevel");
    expect(body).not.toHaveProperty("gradeLevel");
  });

  it("an enthusiast sends the role alone", () => {
    const body = buildRegisterPayload(
      { ...BASE, userType: "enthusiast", gradeLevel: "GRADE_9", teacherSubject: "DIGER" },
      "tr",
    );
    expect(body.accountRole).toBe("ENTHUSIAST");
    for (const key of [
      "educationLevel",
      "gradeLevel",
      "studyStream",
      "teacherSubject",
      "institutionType",
    ]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it("sends referralSource only when one was chosen", () => {
    expect(buildRegisterPayload({ ...BASE, referralSource: "YOUTUBE" }, "tr")).toMatchObject({
      referralSource: "YOUTUBE",
    });
    expect(buildRegisterPayload({ ...BASE, referralSource: "" }, "tr")).not.toHaveProperty(
      "referralSource",
    );
  });
});

describe("buildProfileReplacementPayload — role switch (T-103)", () => {
  const state = (over: Partial<DeclaredProfileFormState>): DeclaredProfileFormState => ({
    accountRole: "STUDENT",
    education: {
      ...EMPTY_AXIS,
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_11",
      studyStream: "SOZEL",
    },
    childEducation: {
      ...EMPTY_AXIS,
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
    },
    teacher: { teacherSubject: "COGRAFYA", institutionType: "DEVLET_OKULU" },
    ...over,
  });

  it("always sends all nine keys", () => {
    expect(Object.keys(buildProfileReplacementPayload(state({}))).sort()).toEqual(
      [
        "accountRole",
        "departmentName",
        "educationLevel",
        "gradeLevel",
        "institutionType",
        "schoolName",
        "studyStream",
        "teacherSubject",
        "universityName",
      ].sort(),
    );
  });

  it("a student sends only the student's education, never the child's or the teacher's", () => {
    expect(buildProfileReplacementPayload(state({}))).toMatchObject({
      accountRole: "STUDENT",
      gradeLevel: "GRADE_11",
      studyStream: "SOZEL",
      teacherSubject: null,
      institutionType: null,
    });
  });

  it("a parent sends only the child's grade and stream", () => {
    expect(buildProfileReplacementPayload(state({ accountRole: "PARENT" }))).toEqual({
      accountRole: "PARENT",
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
      schoolName: null,
      universityName: null,
      departmentName: null,
      teacherSubject: null,
      institutionType: null,
    });
  });

  it("a teacher clears every education field", () => {
    expect(buildProfileReplacementPayload(state({ accountRole: "TEACHER" }))).toEqual({
      accountRole: "TEACHER",
      educationLevel: null,
      gradeLevel: null,
      studyStream: null,
      schoolName: null,
      universityName: null,
      departmentName: null,
      teacherSubject: "COGRAFYA",
      institutionType: "DEVLET_OKULU",
    });
  });

  it("an enthusiast clears everything", () => {
    const body = buildProfileReplacementPayload(state({ accountRole: "ENTHUSIAST" }));
    expect(body.accountRole).toBe("ENTHUSIAST");
    for (const [key, value] of Object.entries(body)) {
      if (key !== "accountRole") expect(value, key).toBeNull();
    }
  });
});
