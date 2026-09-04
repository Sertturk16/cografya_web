"use client";

import type { Profile, UpdateProfileRequest } from "@/lib/api/types";
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

function isProfileLike(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    (p.accountRole === "STUDENT" || p.accountRole === "TEACHER") &&
    typeof p.isComplete === "boolean" &&
    "educationLevel" in p &&
    "gradeLevel" in p &&
    "studyStream" in p &&
    "universityName" in p &&
    "departmentName" in p
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
  if (
    body.ok === false &&
    typeof body.code === "string" &&
    body.code in PROFILE_ERROR_MESSAGE_KEYS
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
