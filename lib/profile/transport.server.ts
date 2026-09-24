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
import type { Profile, UpdateAccountRequest, UpdateProfileRequest } from "@/lib/api/types";

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
  // The personal block (T-061). `GET /api/auth/profile` is the ONE response that carries a
  // member's PII, so it is also the one guard that has to know these names.
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  districtId: z.string(),
  districtName: z.string(),
  provincePlateCode: z.string(),
  provinceName: z.string(),
  createdAt: z.string(),
  accountRole: z.enum(["STUDENT", "TEACHER", "PARENT"]),
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
  schoolName: z.string().nullable(),
  universityName: z.string().nullable(),
  departmentName: z.string().nullable(),
  isComplete: z.boolean(),
  marketingConsent: z.boolean(),
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
    schoolName: z.string().max(200).nullable(),
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

/**
 * `PUT /api/auth/account`'s request guard (T-061). `.strict()` like its sibling, so an extra
 * key is a 400 here rather than something the api has to refuse.
 *
 * The field rules are shape-only on purpose. Phone canonicalisation and the
 * district-belongs-to-province join are the api's, and duplicating either here would create a
 * second place for them to drift — this guard's job is to refuse a body that is not the right
 * SHAPE, not to re-decide what a valid Turkish mobile number is.
 */
const updateAccountRequestSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().min(1).max(32),
    provincePlateCode: z.string().length(2),
    districtId: z.string().min(1),
    // T-101: optional on purpose — absent leaves the stored consent untouched.
    marketingConsent: z.boolean().optional(),
  })
  .strict();

type UpdateAccountShape = z.infer<typeof updateAccountRequestSchema>;

// Drift gate: runtime request guard must agree with contract UpdateAccountRequest DTO
const _updateAccountShapeAgreesWithContract: [UpdateAccountShape, UpdateAccountRequest] = [
  null as unknown as UpdateAccountRequest,
  null as unknown as UpdateAccountShape,
];
void _updateAccountShapeAgreesWithContract;

function bffResult(status: number, body: ProfileBffBody): ProfileBffResult {
  return { status, body, headers: bffHeaders() };
}

/**
 * The eight clauses both replacement routes run, parameterised by the api path and the
 * request guard. `PUT /api/profile` (education) and `PUT /api/account` (personal) differ in
 * exactly those two things and in nothing else — same origin check, same bounded read, same
 * cookie, same timeout, same status mapping, same response guard. Written once so a fix to
 * any of those six lands on both.
 */
async function handleReplacement(
  request: Request,
  apiPath: "/api/auth/profile" | "/api/auth/account",
  schema: typeof updateProfileRequestSchema | typeof updateAccountRequestSchema,
): Promise<ProfileBffResult> {
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

  const parsedBody = schema.safeParse(rawJson);
  if (!parsedBody.success) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  // Clause 5: Outbound PUT fetch
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROFILE_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${serverEnv.API_BASE_URL}${apiPath}`, {
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

/** `PUT /api/profile` — the education block. */
export async function handleReplaceProfile(request: Request): Promise<ProfileBffResult> {
  return handleReplacement(request, "/api/auth/profile", updateProfileRequestSchema);
}

/** `PUT /api/account` — the personal block (T-061). */
export async function handleReplaceAccount(request: Request): Promise<ProfileBffResult> {
  return handleReplacement(request, "/api/auth/account", updateAccountRequestSchema);
}
