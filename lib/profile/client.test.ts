import { afterEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/api/types";
import { isProfileLike, submitProfileReplacement } from "./client";

const VALID_STUDENT_PROFILE: Profile = {
  accountRole: "STUDENT",
  educationLevel: "SECONDARY",
  gradeLevel: "GRADE_12",
  studyStream: "SAYISAL",
  universityName: null,
  departmentName: null,
  isComplete: true,
};

const VALID_TEACHER_PROFILE: Profile = {
  accountRole: "TEACHER",
  educationLevel: null,
  gradeLevel: null,
  studyStream: null,
  universityName: null,
  departmentName: null,
  isComplete: true,
};

const VALID_MINIMAL_STUDENT_PROFILE: Profile = {
  accountRole: "STUDENT",
  educationLevel: null,
  gradeLevel: null,
  studyStream: null,
  universityName: null,
  departmentName: null,
  isComplete: false,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isProfileLike (CON128-I1 runtime contract validation)", () => {
  it("accepts valid secondary student profile", () => {
    expect(isProfileLike(VALID_STUDENT_PROFILE)).toBe(true);
  });

  it("accepts valid teacher profile", () => {
    expect(isProfileLike(VALID_TEACHER_PROFILE)).toBe(true);
  });

  it("accepts minimal student profile with all null education fields", () => {
    expect(isProfileLike(VALID_MINIMAL_STUDENT_PROFILE)).toBe(true);
  });

  it("accepts valid undergraduate student profile with string university and department", () => {
    const ugProfile: Profile = {
      accountRole: "STUDENT",
      educationLevel: "UNDERGRADUATE",
      gradeLevel: null,
      studyStream: null,
      universityName: "İstanbul Üniversitesi",
      departmentName: "Coğrafya",
      isComplete: true,
    };
    expect(isProfileLike(ugProfile)).toBe(true);
  });

  it("rejects when accountRole is not STUDENT or TEACHER", () => {
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, accountRole: "ADMIN" })).toBe(false);
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, accountRole: null })).toBe(false);
  });

  it("rejects when isComplete is not a boolean", () => {
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, isComplete: "true" })).toBe(false);
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, isComplete: null })).toBe(false);
  });

  it("rejects invalid educationLevel enum value", () => {
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, educationLevel: "HIGH_SCHOOL" })).toBe(false);
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, educationLevel: 123 })).toBe(false);
  });

  it("rejects invalid gradeLevel enum value", () => {
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, gradeLevel: "GRADE_13" })).toBe(false);
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, gradeLevel: 12 })).toBe(false);
  });

  it("rejects invalid studyStream enum value", () => {
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, studyStream: "BILISIM" })).toBe(false);
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, studyStream: true })).toBe(false);
  });

  it("rejects non-string non-null universityName", () => {
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, universityName: 12345 })).toBe(false);
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, universityName: {} })).toBe(false);
  });

  it("rejects non-string non-null departmentName", () => {
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, departmentName: 67890 })).toBe(false);
    expect(isProfileLike({ ...VALID_STUDENT_PROFILE, departmentName: [] })).toBe(false);
  });

  it("rejects null, primitive, or objects missing required keys", () => {
    expect(isProfileLike(null)).toBe(false);
    expect(isProfileLike(undefined)).toBe(false);
    expect(isProfileLike("not an object")).toBe(false);
    expect(isProfileLike(123)).toBe(false);
    const missingEducationLevel = { ...VALID_STUDENT_PROFILE } as Record<string, unknown>;
    delete missingEducationLevel.educationLevel;
    expect(isProfileLike(missingEducationLevel)).toBe(false);
  });
});

describe("submitProfileReplacement", () => {
  const payload = {
    educationLevel: "SECONDARY" as const,
    gradeLevel: "GRADE_12" as const,
    studyStream: "SAYISAL" as const,
    universityName: null,
    departmentName: null,
  };

  it("returns ok: true with profile when BFF returns 200 with valid Profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true, profile: VALID_STUDENT_PROFILE }))),
    );

    const result = await submitProfileReplacement(payload);
    expect(result).toEqual({ ok: true, profile: VALID_STUDENT_PROFILE });
  });

  it("returns ok: false with errors.transport.unavailable when BFF returns 200 with invalid shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ok: true,
            profile: { ...VALID_STUDENT_PROFILE, educationLevel: "INVALID_LEVEL" },
          }),
        ),
      ),
    );

    const result = await submitProfileReplacement(payload);
    expect(result).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });

  it("returns ok: false with mapped error code on BFF error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(400, {
            ok: false,
            code: "errors.transport.invalidRequest",
          }),
        ),
      ),
    );

    const result = await submitProfileReplacement(payload);
    expect(result).toEqual({ ok: false, code: "errors.transport.invalidRequest" });
  });

  it("returns ok: false with errors.transport.unavailable on fetch exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network failure"))),
    );

    const result = await submitProfileReplacement(payload);
    expect(result).toEqual({ ok: false, code: "errors.transport.unavailable" });
  });
});
