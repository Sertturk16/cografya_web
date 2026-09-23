/**
 * What a failed `POST /api/measurements` means to the person who clicked save. Pure and
 * client-safe: `saveMeasurement` (`client.ts`) calls it on every non-200 answer, and the workbench
 * turns the result into copy through {@link SAVE_ERROR_MESSAGE_KEY}.
 *
 * Only two kinds, because only two things are worth telling someone apart. A quota failure will
 * not be fixed by clicking again, and the fix (delete an old measurement) is specific. Everything
 * else (the api or the network down, a timeout, an expired session, a body the BFF refused) is
 * "that did not save, try again".
 */
export type SaveMeasurementErrorCode = "quota-exceeded" | "failed";

/** The code `handleCreateMeasurement` (`transport.server.ts`) sends for the api's quota 403. */
export const QUOTA_EXCEEDED_BFF_CODE = "errors.measurements.quotaExceeded";

/**
 * Classifies the BFF's answer by its body code, not by status alone: the BFF also answers 403
 * for a failed Origin check (`errors.transport.forbidden`), and telling that person to delete a
 * measurement would send them after the wrong fix.
 */
export function saveErrorCodeFromResponse(status: number, body: unknown): SaveMeasurementErrorCode {
  if (
    status === 403 &&
    typeof body === "object" &&
    body !== null &&
    (body as { code?: unknown }).code === QUOTA_EXCEEDED_BFF_CODE
  ) {
    return "quota-exceeded";
  }
  return "failed";
}

/** The `Measurements` message key for each error kind. */
export const SAVE_ERROR_MESSAGE_KEY = {
  "quota-exceeded": "saveQuotaError",
  failed: "saveError",
} as const satisfies Record<SaveMeasurementErrorCode, string>;
