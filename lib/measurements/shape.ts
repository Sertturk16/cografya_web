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

/** A coordinate is a single point by definition; the api rejects a second one as well. */
const COORDINATE_MAX_POINTS = 1;

/** Whether `pointCount` points form a `type` measurement the api will accept as a shape. */
export function canSaveMeasurement(type: MeasurementType, pointCount: number): boolean {
  if (pointCount < MEASUREMENT_MIN_POINTS[type]) return false;
  if (type === "coordinate" && pointCount > COORDINATE_MAX_POINTS) return false;
  return true;
}
