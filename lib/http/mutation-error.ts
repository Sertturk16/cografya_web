/**
 * What a failed BFF write (a save, a delete, a favorite toggle) means to the person who clicked.
 * Pure and client-safe: each domain's browser client calls it on every non-success answer and the
 * component turns the result into copy.
 *
 * Three kinds, because three fixes differ:
 *
 * - `session-expired`: the BFF answered 401. The session cookie is gone or the api refused it.
 *   Clicking again cannot help; signing in again does, so the copy links to the login page.
 * - `quota-exceeded`: a 403 whose body carries the domain's quota code. Clicking again cannot help
 *   either; the fix (delete something) is specific to the domain.
 * - `failed`: everything else (the api or the network down, a timeout, a body the BFF refused,
 *   the BFF's own Origin-check 403). "That did not work, try again."
 *
 * The 403 branch is keyed on the body code, not the status, because the BFF answers 403 for two
 * unrelated reasons: the api's quota and its own failed Origin check (`errors.transport.forbidden`).
 * Telling someone whose Origin check failed to delete a measurement sends them after the wrong fix.
 * A 401 has one cause, so the status is enough there.
 */
export type MutationErrorCode = "session-expired" | "quota-exceeded" | "failed";

/** A domain whose writes have no quota can never see `quota-exceeded`. */
export type UnmeteredMutationErrorCode = Exclude<MutationErrorCode, "quota-exceeded">;

function bodyCode(body: unknown): unknown {
  return typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
}

export function mutationErrorCodeFromResponse(
  status: number,
  body: unknown,
): UnmeteredMutationErrorCode;
export function mutationErrorCodeFromResponse(
  status: number,
  body: unknown,
  quotaCode: string,
): MutationErrorCode;
export function mutationErrorCodeFromResponse(
  status: number,
  body: unknown,
  quotaCode?: string,
): MutationErrorCode {
  if (status === 401) return "session-expired";
  if (status === 403 && quotaCode !== undefined && bodyCode(body) === quotaCode) {
    return "quota-exceeded";
  }
  return "failed";
}

/** Reads a failed response's JSON body for {@link mutationErrorCodeFromResponse}; `null` when the
 *  body is empty or not JSON (a proxy error page, a 204-less failure). Never throws. */
export async function readErrorBody(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}
