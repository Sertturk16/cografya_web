import {
  mutationErrorCodeFromResponse,
  type MutationErrorCode,
  type UnmeteredMutationErrorCode,
} from "@/lib/http/mutation-error";

/**
 * What a failed `POST` / `DELETE /api/measurements` means to the person who clicked. Pure and
 * client-safe: `saveMeasurement` / `removeMeasurement` (`client.ts`) call it on every failed
 * answer, and the workbench turns the result into copy through {@link SAVE_ERROR_MESSAGE_KEY} /
 * {@link DELETE_ERROR_MESSAGE_KEY}. The shared mapping and why each kind exists are in
 * `lib/http/mutation-error.ts`.
 */
export type SaveMeasurementErrorCode = MutationErrorCode;
/** A delete spends no quota, so it can only fail for want of a session or for any other reason. */
export type DeleteMeasurementErrorCode = UnmeteredMutationErrorCode;

/** The code `handleCreateMeasurement` (`transport.server.ts`) sends for the api's quota 403. */
export const QUOTA_EXCEEDED_BFF_CODE = "errors.measurements.quotaExceeded";

/**
 * Classifies the BFF's answer to a save. The quota branch is keyed on the body code, not the
 * status alone: the BFF also answers 403 for a failed Origin check (`errors.transport.forbidden`).
 */
export function saveErrorCodeFromResponse(status: number, body: unknown): SaveMeasurementErrorCode {
  return mutationErrorCodeFromResponse(status, body, QUOTA_EXCEEDED_BFF_CODE);
}

/** Classifies the BFF's answer to a delete. */
export function deleteErrorCodeFromResponse(
  status: number,
  body: unknown,
): DeleteMeasurementErrorCode {
  return mutationErrorCodeFromResponse(status, body);
}

/** The `Measurements` message key for each save error kind. `sessionExpired` is rich text: it
 *  carries a `<link>` to the login page. */
export const SAVE_ERROR_MESSAGE_KEY = {
  "session-expired": "sessionExpired",
  "quota-exceeded": "saveQuotaError",
  failed: "saveError",
} as const satisfies Record<SaveMeasurementErrorCode, string>;

/** The `Measurements` message key for each delete error kind. */
export const DELETE_ERROR_MESSAGE_KEY = {
  "session-expired": "sessionExpired",
  failed: "deleteError",
} as const satisfies Record<DeleteMeasurementErrorCode, string>;
