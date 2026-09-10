"use client";

import type { Profile, UpdateProfileRequest } from "@/lib/api/types";
import {
  EDUCATION_LEVEL_LABELS,
  GRADE_LEVEL_LABELS,
  STUDY_STREAM_LABELS,
} from "@/lib/auth/profile-labels";
import type { ProfileBffBody, ProfileBffCode } from "./transport.server";

export const PROFILE_FETCH_TIMEOUT_MS = 8000;

export const PROFILE_ERROR_MESSAGE_KEYS: Record<ProfileBffCode, string> = {
  "errors.auth.unauthenticated": "errors.unauthenticated",
  "errors.transport.invalidRequest": "errors.invalidRequest",
  "errors.transport.forbidden": "errors.forbidden",
  "errors.transport.unavailable": "errors.unavailable",
};

export type SubmitProfileResult =
  | { readonly ok: true; readonly profile: Profile }
  | { readonly ok: false; readonly code: ProfileBffCode };

export function isProfileLike(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;

  const isValidRole = p.accountRole === "STUDENT" || p.accountRole === "TEACHER";
  // Object.hasOwn (not `in`) — an Object.prototype property name must not satisfy this check (VAL128R3-I1).
  const isValidEducationLevel =
    p.educationLevel === null ||
    (typeof p.educationLevel === "string" &&
      Object.hasOwn(EDUCATION_LEVEL_LABELS, p.educationLevel));
  const isValidGradeLevel =
    p.gradeLevel === null ||
    (typeof p.gradeLevel === "string" && Object.hasOwn(GRADE_LEVEL_LABELS, p.gradeLevel));
  const isValidStudyStream =
    p.studyStream === null ||
    (typeof p.studyStream === "string" && Object.hasOwn(STUDY_STREAM_LABELS, p.studyStream));
  const isValidUniversityName = p.universityName === null || typeof p.universityName === "string";
  const isValidDepartmentName = p.departmentName === null || typeof p.departmentName === "string";

  return (
    isValidRole &&
    typeof p.isComplete === "boolean" &&
    isValidEducationLevel &&
    isValidGradeLevel &&
    isValidStudyStream &&
    isValidUniversityName &&
    isValidDepartmentName
  );
}

function parseProfileBffBody(value: unknown): SubmitProfileResult {
  if (!value || typeof value !== "object") {
    return { ok: false, code: "errors.transport.unavailable" };
  }
  const body = value as Partial<ProfileBffBody>;
  if (body.ok === true && isProfileLike(body.profile)) {
    return { ok: true, profile: body.profile };
  }
  // Object.hasOwn (not `in`) — an Object.prototype property name must not satisfy this check (VAL128R3-I1).
  if (
    body.ok === false &&
    typeof body.code === "string" &&
    Object.hasOwn(PROFILE_ERROR_MESSAGE_KEYS, body.code)
  ) {
    return { ok: false, code: body.code as ProfileBffCode };
  }
  return { ok: false, code: "errors.transport.unavailable" };
}

export async function submitProfileReplacement(
  payload: UpdateProfileRequest,
): Promise<SubmitProfileResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, code: "errors.transport.unavailable" };
    }

    return parseProfileBffBody(json);
  } catch {
    return { ok: false, code: "errors.transport.unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
