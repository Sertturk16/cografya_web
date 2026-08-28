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
  safeReadText,
} from "@/lib/http/bff-helpers.server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getSiteUrl } from "@/lib/seo/site";
import type { CreateMeasurementRequest, Measurement } from "@/lib/api/types";

/**
 * The web half of the measurements BFF proxy (UYELIK-12 plan §5.2) — a FIFTH small
 * domain-scoped pair, not a merge into `lib/favorites/`, `lib/video-progress/` or
 * `lib/game-rounds/`: a per-user saved-geometry record is a different domain from a
 * saved entity, playback state, or round history, the same reasoning every existing
 * pair already states for its own independence. Modelled on
 * `lib/game-rounds/transport.server.ts`'s shape (the closest precedent — a real request
 * body, an idempotent-create endpoint, plus a read-only list): a cookie read, an Origin
 * check on the state-changing verbs, `Cache-Control: no-store` unconditionally, a zod
 * response guard against the api's 200 body. The generic HTTP/cookie/body mechanics are
 * imported from `lib/http/bff-helpers.server.ts` (SIMP90-M1/SIMP96-M1).
 *
 * THREE HANDLERS, THREE VERBS: `GET /api/measurements` (list, read-only, no Origin
 * check), `POST /api/measurements` (idempotent create, state-changing, Origin
 * required), `DELETE /api/measurements/{id}` (unconditionally idempotent remove,
 * state-changing, Origin required). No `PATCH`/rename and no per-id `GET` — plan §2.6/§3:
 * rename is a deferred, separately-scoped roadmap item and recall reads directly from the
 * already-fetched list item, so a per-id fetch is never needed by this UI.
 */

/** The house standard (matches every other BFF-proxy module) — a domain-specific value
 *  kept local rather than folded into the shared module, which carries no opinion on any
 *  caller's own timeout budget. */
const MEASUREMENTS_REQUEST_TIMEOUT_MS = 15_000;

/** A create body is `type` + up to 20 points (each `{lon,lat}` ~35-40 bytes serialized) +
 *  `title` (<=200 chars) + `clientMeasurementId` (<=128 chars): well under 1.5 KiB even
 *  with generous JSON whitespace — the same house bound every comparably small payload in
 *  this repo uses (plan §5.2). */
const MAX_REQUEST_BODY_BYTES = 4 * 1024;

const measurementPointSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

/**
 * The request-side mirror of `CreateMeasurementRequestDto`'s own FLAT, per-field bounds
 * only (plan §5.2's table) — it deliberately does NOT re-implement the type-dependent
 * minimum-point cross-field rule the api itself owns
 * (`measurement-shape.validator.ts`): every existing request-side mirror in this repo
 * only ever mirrors a DTO's own flat per-field bounds, never a business rule the api
 * enforces server-side, and the UI can never construct an under-count payload by
 * construction (`tool-island.tsx`'s own `minExportPoints` gate) — the only caller that
 * could ever reach that cross-field rule is a non-UI client hitting the BFF directly,
 * which the api's own `errors.measurements.invalidShape` 400 already answers correctly.
 */
const createMeasurementRequestSchema = z.object({
  type: z.enum(["distance", "area", "coordinate"]),
  points: z.array(measurementPointSchema).min(1).max(20),
  title: z.string().max(200).optional(),
  clientMeasurementId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

type CreateMeasurementRequestShape = z.infer<typeof createMeasurementRequestSchema>;
// Drift gate, the same idiom every sibling transport module already uses: a contract
// change this schema misses is a TYPE ERROR in the Typecheck & Lint job, not a runtime
// surprise. Do not relax either direction.
const _createMeasurementRequestShapeAgreesWithContract: [
  CreateMeasurementRequestShape,
  CreateMeasurementRequest,
] = [null as unknown as CreateMeasurementRequest, null as unknown as CreateMeasurementRequestShape];
void _createMeasurementRequestShapeAgreesWithContract;

const measurementSchema = z.object({
  id: z.string(),
  type: z.enum(["distance", "area", "coordinate"]),
  points: z.array(measurementPointSchema),
  // OPTIONAL and nullable, matching the generated contract type exactly (`MeasurementDto`'s
  // own `title` is NOT in the DTO's `required` list, even though the api's own description
  // states the field is always present in practice, just possibly `null`) — the same
  // "mirror the DTO's declared shape, not its prose" posture `gameRoundSchema`'s own
  // `completionTimeSeconds` comment states for its own optional+nullable field.
  title: z.string().nullable().optional(),
  clientMeasurementId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const measurementListSchema = z.array(measurementSchema);

type MeasurementShape = z.infer<typeof measurementSchema>;
// Drift gate, the same idiom `lib/game-rounds/transport.server.ts`/
// `lib/favorites/transport.server.ts` already use.
const _measurementShapeAgreesWithContract: [MeasurementShape, Measurement] = [
  null as unknown as Measurement,
  null as unknown as MeasurementShape,
];
void _measurementShapeAgreesWithContract;

export type MeasurementsBffCode =
  | "errors.auth.unauthenticated"
  | "errors.measurements.invalidShape"
  | "errors.measurements.quotaExceeded"
  | "errors.transport.unavailable"
  | "errors.transport.invalidRequest"
  | "errors.transport.forbidden";

export type MeasurementListBffBody =
  | { readonly ok: true; readonly measurements: readonly MeasurementShape[] }
  | { readonly ok: false; readonly code: MeasurementsBffCode };

export interface MeasurementListBffResult {
  readonly status: number;
  readonly body: MeasurementListBffBody;
  readonly headers: Record<string, string>;
}

export type MeasurementBffBody =
  | { readonly ok: true; readonly measurement: MeasurementShape }
  | { readonly ok: true }
  | { readonly ok: false; readonly code: MeasurementsBffCode };

export interface MeasurementBffResult {
  readonly status: number;
  readonly body: MeasurementBffBody;
  readonly headers: Record<string, string>;
}

/** A version-agnostic UUID shape check (the OpenAPI schema declares `format: "uuid"` with
 *  no version pinned, so this does not over-constrain against what the api itself
 *  accepts) — mirrors `isPlateCodeShape`/`isIsoCodeShape`'s "refuse an unshapely value
 *  before spending an api call" reasoning (plan §5.2). */
const MEASUREMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMeasurementIdShape(value: string): boolean {
  return MEASUREMENT_ID_PATTERN.test(value);
}

// `bffHeaders`, `readCookieValue`, `safeReadText`, `drainBody`, `readBoundedBodyAsText`
// and `contentLengthExceeds` are imported from `lib/http/bff-helpers.server.ts`
// (SIMP90-M1/SIMP96-M1). `Cache-Control: no-store` is UNCONDITIONAL on every response,
// the same P2 property every BFF module guarantees.

function listResult(status: number, body: MeasurementListBffBody): MeasurementListBffResult {
  return { status, body, headers: bffHeaders() };
}

function itemResult(status: number, body: MeasurementBffBody): MeasurementBffResult {
  return { status, body, headers: bffHeaders() };
}

async function sendApiRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  accessToken: string,
  body: string | undefined,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MEASUREMENTS_REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    return await fetch(`${serverEnv.API_BASE_URL}${path}`, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `GET /api/measurements` — the caller's own saved measurements, every type mixed
 * together (plan §2.2 — the api's own list endpoint carries no `type` filter; the
 * per-tool filter is applied client-side, `tool-island.tsx` §5.4 item 5). No
 * `cg_access` cookie is a short-circuit (401, no api call), mirroring the established
 * posture: a missing cookie is a normal anonymous answer, not a condition worth
 * spending an outbound request on. No Origin check — read-only, not state-changing.
 */
export async function handleListMeasurements(request: Request): Promise<MeasurementListBffResult> {
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return listResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  let res: Response;
  try {
    res = await sendApiRequest("GET", "/api/measurements", accessToken, undefined);
  } catch {
    return listResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) {
    const rawBody = await safeReadText(res);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return listResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    const parsed = measurementListSchema.safeParse(json);
    if (!parsed.success) {
      return listResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    return listResult(200, { ok: true, measurements: parsed.data });
  }
  if (res.status === 401) {
    await drainBody(res);
    return listResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  await drainBody(res);
  return listResult(502, { ok: false, code: "errors.transport.unavailable" });
}

/**
 * `POST /api/measurements` — idempotent create, quota-gated (plan §5.2). Origin is
 * checked here — and only here alongside the `DELETE` below — per the roadmap's own
 * standing security boundary. The request body is parsed against
 * {@link createMeasurementRequestSchema} BEFORE an outbound call is spent — a
 * malformed/out-of-bounds client body is rejected locally as
 * `errors.transport.invalidRequest`, never forwarded.
 */
export async function handleCreateMeasurement(request: Request): Promise<MeasurementBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return itemResult(403, { ok: false, code: "errors.transport.forbidden" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (contentLengthExceeds(request, MAX_REQUEST_BODY_BYTES)) {
    return itemResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const read = await readBoundedBodyAsText(request, MAX_REQUEST_BODY_BYTES);
  if (!read.ok) {
    return itemResult(413, { ok: false, code: "errors.transport.invalidRequest" });
  }

  let parsedJson: unknown;
  try {
    parsedJson = read.text.length > 0 ? JSON.parse(read.text) : {};
  } catch {
    return itemResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const validated = createMeasurementRequestSchema.safeParse(parsedJson);
  if (!validated.success) {
    return itemResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  let res: Response;
  try {
    res = await sendApiRequest(
      "POST",
      "/api/measurements",
      accessToken,
      JSON.stringify(validated.data),
    );
  } catch {
    return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 200) {
    const rawBody = await safeReadText(res);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    const parsed = measurementSchema.safeParse(json);
    if (!parsed.success) {
      return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
    }
    return itemResult(200, { ok: true, measurement: parsed.data });
  }
  if (res.status === 400) {
    await drainBody(res);
    return itemResult(400, { ok: false, code: "errors.measurements.invalidShape" });
  }
  if (res.status === 401) {
    await drainBody(res);
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  if (res.status === 403) {
    await drainBody(res);
    return itemResult(403, { ok: false, code: "errors.measurements.quotaExceeded" });
  }
  await drainBody(res);
  return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
}

/**
 * `DELETE /api/measurements/{id}` — unconditionally idempotent remove (plan §5.2/§2.2).
 * Same Origin gate as the `POST` above, then a shape check on `id` BEFORE an api call is
 * spent (`isMeasurementIdShape`), then the cookie gate. 204 is the contract's own
 * unconditional success — existed-and-removed, never-existed, or another caller's id all
 * answer identically, so there is no "not found" branch to map here, matching the api
 * exactly (no `errors.measurements.notFound` in {@link MeasurementsBffCode}).
 */
export async function handleDeleteMeasurement(
  request: Request,
  id: string,
): Promise<MeasurementBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return itemResult(403, { ok: false, code: "errors.transport.forbidden" });
  }
  if (!isMeasurementIdShape(id)) {
    return itemResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);
  if (!accessToken) {
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  let res: Response;
  try {
    res = await sendApiRequest(
      "DELETE",
      `/api/measurements/${encodeURIComponent(id)}`,
      accessToken,
      undefined,
    );
  } catch {
    return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
  }

  if (res.status === 204) {
    await drainBody(res);
    return itemResult(204, { ok: true });
  }
  if (res.status === 401) {
    await drainBody(res);
    return itemResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  await drainBody(res);
  return itemResult(502, { ok: false, code: "errors.transport.unavailable" });
}
