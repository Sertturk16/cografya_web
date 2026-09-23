import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import type { MeasurementsBffCode } from "./transport.server";
import {
  QUOTA_EXCEEDED_BFF_CODE,
  SAVE_ERROR_MESSAGE_KEY,
  saveErrorCodeFromResponse,
  type SaveMeasurementErrorCode,
} from "./save-error";

// Drift gate: the code this module keys the quota branch on must be one the BFF can send. A
// rename in `MeasurementsBffCode` is a type error here instead of a quota error shown as generic.
const _quotaCodeIsABffCode: MeasurementsBffCode = QUOTA_EXCEEDED_BFF_CODE;
void _quotaCodeIsABffCode;

/**
 * Every failure `handleCreateMeasurement` (`lib/measurements/transport.server.ts`) can answer
 * `POST /api/measurements` with, as the browser receives it: status + JSON body.
 */
describe("saveErrorCodeFromResponse", () => {
  const cases: readonly [string, number, unknown, SaveMeasurementErrorCode][] = [
    [
      "api quota (403 quotaExceeded)",
      403,
      { ok: false, code: QUOTA_EXCEEDED_BFF_CODE },
      "quota-exceeded",
    ],
    // Same status, different cause: the BFF's own Origin check. Retrying will not help either,
    // but telling the user to delete a measurement would be wrong.
    [
      "Origin check (403 forbidden)",
      403,
      { ok: false, code: "errors.transport.forbidden" },
      "failed",
    ],
    ["403 with no body", 403, null, "failed"],
    ["403 with a non-object body", 403, "quota", "failed"],
    ["quota code on a non-403 status", 400, { ok: false, code: QUOTA_EXCEEDED_BFF_CODE }, "failed"],
    ["session gone (401)", 401, { ok: false, code: "errors.auth.unauthenticated" }, "failed"],
    [
      "api shape rule (400 invalidShape)",
      400,
      { ok: false, code: "errors.measurements.invalidShape" },
      "failed",
    ],
    [
      "BFF schema (400 invalidRequest)",
      400,
      { ok: false, code: "errors.transport.invalidRequest" },
      "failed",
    ],
    ["body too large (413)", 413, { ok: false, code: "errors.transport.invalidRequest" }, "failed"],
    [
      "api down / timeout (502)",
      502,
      { ok: false, code: "errors.transport.unavailable" },
      "failed",
    ],
    ["proxy error page (500, HTML)", 500, null, "failed"],
  ];

  it.each(cases)("%s -> %s", (_label, status, body, expected) => {
    expect(saveErrorCodeFromResponse(status, body)).toBe(expected);
  });
});

describe("SAVE_ERROR_MESSAGE_KEY", () => {
  it("sends a quota failure to the quota copy and everything else to the retry copy", () => {
    expect(SAVE_ERROR_MESSAGE_KEY).toEqual({
      "quota-exceeded": "saveQuotaError",
      failed: "saveError",
    });
  });

  it.each(Object.values(SAVE_ERROR_MESSAGE_KEY))(
    "Measurements.%s resolves to non-empty copy in both catalogues",
    (key) => {
      for (const catalogue of [trMessages.Measurements, enMessages.Measurements]) {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    },
  );
});
