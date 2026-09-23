import type { MeasurementType } from "@/lib/api/types";

/**
 * The per-type point-count rule the api enforces on `POST /api/measurements`
 * (`validateMeasurementShape` in `cografya_api/src/measurements/measurement-shape.validator.ts`),
 * which answers a violation with a 400 `errors.measurements.invalidShape`. The rule is not in the
 * OpenAPI contract (it is cross-field, not a DTO bound), so this is its single web-side copy:
 * client-safe, so the save UI can disable itself before building a payload the api would refuse.
 */
export const MEASUREMENT_MIN_POINTS: Readonly<Record<MeasurementType, number>> = {
  coordinate: 1,
  distance: 2,
  area: 3,
};

/**
 * The api DTO's flat bound on `points` (`MEASUREMENT_POINTS_MAX` in
 * `cografya_api/src/measurements/dto/create-measurement-request.dto.ts`, `maxItems: 20` in the
 * OpenAPI spec). The BFF's request schema (`transport.server.ts`) imports this constant, so the
 * save gate below and the schema that would refuse the body cannot drift apart.
 */
export const MEASUREMENT_POINTS_MAX = 20;

/**
 * The api DTO's bound on `title` (`MEASUREMENT_TITLE_MAX_LENGTH` in
 * `cografya_api/src/measurements/dto/create-measurement-request.dto.ts`, `maxLength: 200` in the
 * OpenAPI spec). The BFF's request schema refuses a longer title with a 400, and the workbench's
 * title input carries it as `maxLength`, so a reader cannot type a title that fails to save.
 */
export const MEASUREMENT_TITLE_MAX_LENGTH = 200;

/**
 * The per-type maximum. A coordinate is a single point by definition and the api rejects a second
 * one; every other type is bounded only by the flat DTO limit above.
 */
export const MEASUREMENT_MAX_POINTS: Readonly<Record<MeasurementType, number>> = {
  coordinate: 1,
  distance: MEASUREMENT_POINTS_MAX,
  area: MEASUREMENT_POINTS_MAX,
};

export type MeasurementPointCountIssue = "tooFew" | "tooMany";

/** Why `pointCount` points cannot be saved as a `type` measurement, or `null` when they can. */
export function measurementPointCountIssue(
  type: MeasurementType,
  pointCount: number,
): MeasurementPointCountIssue | null {
  if (pointCount < MEASUREMENT_MIN_POINTS[type]) return "tooFew";
  if (pointCount > MEASUREMENT_MAX_POINTS[type]) return "tooMany";
  return null;
}

/** Whether `pointCount` points form a `type` measurement the api (and the BFF) will accept. */
export function canSaveMeasurement(type: MeasurementType, pointCount: number): boolean {
  return measurementPointCountIssue(type, pointCount) === null;
}
