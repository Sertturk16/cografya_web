import "server-only";
import { z } from "zod";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { serverEnv } from "@/lib/env.server";
import {
  bffHeaders,
  contentLengthExceeds,
  drainBody,
  readBoundedBodyAsText,
  readCookieValue,
} from "@/lib/http/bff-helpers.server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getSiteUrl } from "@/lib/seo/site";
import type { Profile, UpdateProfileRequest } from "@/lib/api/types";

/**
 * Maximum allowable byte length for PUT /api/profile request bodies.
 * The payload contains only five short enum and string fields, so 2 048 bytes
 * provides ample headroom while preventing oversized body abuses.
 */
export const MAX_PROFILE_BODY_BYTES = 2_048;

/**
 * Request timeout budget (15 s) for outbound profile requests to cografya_api,
 * matching the house standard applied across all other BFF transports.
 */
export const PROFILE_REQUEST_TIMEOUT_MS = 15_000;

export type ProfileBffCode =
  | "errors.auth.unauthenticated"
  | "errors.transport.invalidRequest"
  | "errors.transport.forbidden"
  | "errors.transport.unavailable";

export type ProfileBffBody =
  | { readonly ok: true; readonly profile: Profile }
  | { readonly ok: false; readonly code: ProfileBffCode };

export interface ProfileBffResult {
  readonly status: number;
  readonly body: ProfileBffBody;
  readonly headers: Record<string, string>;
}

export const profileSchema = z.object({
  accountRole: z.enum(["STUDENT", "TEACHER"]),
  educationLevel: z.enum(["SECONDARY", "UNDERGRADUATE", "GRADUATE"]).nullable(),
  gradeLevel: z
    .enum([
      "GRADE_5",
      "GRADE_6",
      "GRADE_7",
      "GRADE_8",
      "GRADE_9",
      "GRADE_10",
      "GRADE_11",
      "GRADE_12",
      "MEZUN",
      "KPSS",
      "DIGER",
    ])
    .nullable(),
  studyStream: z
    .enum([
      "SAYISAL",
      "SOZEL",
      "ESIT_AGIRLIK",
      "TYT",
      "DIL",
      "LGS",
      "MSU",
      "ARA_SINIF",
      "KPSS",
      "DIGER",
    ])
    .nullable(),
  universityName: z.string().nullable(),
  departmentName: z.string().nullable(),
  isComplete: z.boolean(),
});

type ProfileShape = z.infer<typeof profileSchema>;

// Drift gate: runtime response guard must agree with contract Profile DTO
const _profileShapeAgreesWithContract: [ProfileShape, Profile] = [
  null as unknown as Profile,
  null as unknown as ProfileShape,
];
void _profileShapeAgreesWithContract;

const updateProfileRequestSchema = z
  .object({
    educationLevel: z.enum(["SECONDARY", "UNDERGRADUATE", "GRADUATE"]).nullable(),
    gradeLevel: z
      .enum([
        "GRADE_5",
        "GRADE_6",
        "GRADE_7",
        "GRADE_8",
        "GRADE_9",
        "GRADE_10",
        "GRADE_11",
        "GRADE_12",
        "MEZUN",
        "KPSS",
        "DIGER",
      ])
      .nullable(),
    studyStream: z
      .enum([
        "SAYISAL",
        "SOZEL",
        "ESIT_AGIRLIK",
        "TYT",
        "DIL",
        "LGS",
        "MSU",
        "ARA_SINIF",
        "KPSS",
        "DIGER",
      ])
      .nullable(),
    universityName: z.string().max(200).nullable(),
    departmentName: z.string().max(200).nullable(),
  })
  .strict();

type UpdateProfileShape = z.infer<typeof updateProfileRequestSchema>;

// Drift gate: runtime request guard must agree with contract UpdateProfileRequest DTO
const _updateProfileShapeAgreesWithContract: [UpdateProfileShape, UpdateProfileRequest] = [
  null as unknown as UpdateProfileRequest,
  null as unknown as UpdateProfileShape,
];
void _updateProfileShapeAgreesWithContract;

function bffResult(status: number, body: ProfileBffBody): ProfileBffResult {
  return { status, body, headers: bffHeaders() };
}

export async function handleReplaceProfile(request: Request): Promise<ProfileBffResult> {
  // Clause 1: Origin check
  if (!isSameOrigin(request, getSiteUrl())) {
    return bffResult(403, { ok: false, code: "errors.transport.forbidden" });
  }

  // Clause 2: Bounded body check
  if (contentLengthExceeds(request, MAX_PROFILE_BODY_BYTES)) {
    return bffResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }
  const read = await readBoundedBodyAsText(request, MAX_PROFILE_BODY_BYTES);
  if (!read.ok) {
    return bffResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }

  // Clause 3: Cookie check
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  // Clause 4: Parse & validate body
  let rawJson: unknown;
  try {
    rawJson = read.text.length > 0 ? JSON.parse(read.text) : {};
  } catch {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const parsedBody = updateProfileRequestSchema.safeParse(rawJson);
  if (!parsedBody.success) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  // Clause 5: Outbound PUT fetch
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROFILE_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${serverEnv.API_BASE_URL}/api/auth/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(parsedBody.data),
    });
  } catch {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  } finally {
    clearTimeout(timer);
  }

  // Clause 6: Status mapping & drain
  if (res.status === 200) {
    try {
      const json: unknown = await res.json();
      const profile = profileSchema.safeParse(json);
      if (!profile.success) {
        return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
      }
      return bffResult(200, { ok: true, profile: profile.data });
    } catch {
      return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
  }

  // Clause 7: drainBody on unread body
  await drainBody(res);

  if (res.status === 400) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  if (res.status === 401) {
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
}
