"use client";

/**
 * The browser half of the measurements transport (UYELIK-12 plan §5.2) — modelled on
 * `lib/game-rounds/client.ts`'s SHAPE, not merged into it: measurements is a different
 * domain (per-user saved-geometry records, not round history) and gets its own pair of
 * files, the same way every existing domain got its own.
 */

import type { MeasurementType } from "@/lib/api/types";

/** The house standard for a caller-owned read, mirroring `FAVORITES_FETCH_TIMEOUT_MS`'s/
 *  `GAME_ROUNDS_FETCH_TIMEOUT_MS`'s reasoning at the same scale. */
export const MEASUREMENTS_FETCH_TIMEOUT_MS = 8000;
/** Every write call in this repo now carries its own `AbortController` (plan §2.5's
 *  closed `CODE91-M1` gap) — this domain's writes carry one from day one, at the same
 *  timeout value as the read above, no "closed for this file only" caveat needed. */
export const MEASUREMENTS_WRITE_TIMEOUT_MS = 8000;

export interface MeasurementRecord {
  readonly id: string;
  readonly type: MeasurementType;
  readonly points: readonly { readonly lon: number; readonly lat: number }[];
  readonly title: string | null;
  readonly clientMeasurementId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * `null` collapses every "nothing to show" condition into one answer — an anonymous/
 * checking reader, a transport failure, or a malformed body — the same collapse every
 * existing `fetch*` in this codebase makes for "anything other than a clean success".
 */
export type FetchMeasurementsResult = readonly MeasurementRecord[] | null;

function buildMeasurementsListUrl(): string {
  return "/api/measurements";
}

function buildMeasurementUrl(id: string): string {
  return `/api/measurements/${encodeURIComponent(id)}`;
}

/** Narrows an unknown BFF list body into a {@link MeasurementRecord} array, or `null` on
 *  anything that is not the exact shape `handleListMeasurements` promises — unchecked
 *  network input, the same principle every existing `parse*Body` in this codebase states:
 *  a value that only PASSED THROUGH the BFF unexamined is not safe to trust as typed. */
function parseMeasurementsListBody(value: unknown): readonly MeasurementRecord[] | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  const items = (value as { measurements?: unknown }).measurements;
  if (!Array.isArray(items)) return null;

  const records: MeasurementRecord[] = [];
  for (const entry of items) {
    const record = parseMeasurementEntry(entry);
    if (record === null) return null;
    records.push(record);
  }
  return records;
}

function parseMeasurementPoint(
  value: unknown,
): { readonly lon: number; readonly lat: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.lon !== "number" || typeof v.lat !== "number") return null;
  return { lon: v.lon, lat: v.lat };
}

function parseMeasurementEntry(entry: unknown): MeasurementRecord | null {
  if (typeof entry !== "object" || entry === null) return null;
  const e = entry as Record<string, unknown>;
  if (
    typeof e.id !== "string" ||
    (e.type !== "distance" && e.type !== "area" && e.type !== "coordinate") ||
    !Array.isArray(e.points) ||
    // OPTIONAL and nullable, matching the generated contract type exactly (`MeasurementDto`'s
    // own `title` is not in the DTO's `required` list) — absent, explicit null and a real
    // string are all valid; anything else is not.
    (e.title !== undefined && e.title !== null && typeof e.title !== "string") ||
    typeof e.clientMeasurementId !== "string" ||
    typeof e.createdAt !== "string" ||
    typeof e.updatedAt !== "string"
  ) {
    return null;
  }
  const points: { readonly lon: number; readonly lat: number }[] = [];
  for (const raw of e.points) {
    const point = parseMeasurementPoint(raw);
    if (point === null) return null;
    points.push(point);
  }
  return {
    id: e.id,
    type: e.type,
    points,
    title: typeof e.title === "string" ? e.title : null,
    clientMeasurementId: e.clientMeasurementId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/**
 * `GET` — one bounded fetch, only ever called once per mount (`ToolIsland`'s own effect
 * owns the abort budget, the same split every existing `fetch*` draws).
 */
export async function fetchMeasurements(signal: AbortSignal): Promise<FetchMeasurementsResult> {
  try {
    const res = await fetch(buildMeasurementsListUrl(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (res.status !== 200) return null;
    const parsed: unknown = await res.json();
    return parseMeasurementsListBody(parsed);
  } catch {
    return null;
  }
}

export interface SaveMeasurementPayload {
  readonly type: MeasurementType;
  readonly points: readonly { readonly lon: number; readonly lat: number }[];
  readonly title?: string;
  readonly clientMeasurementId: string;
}

export type SaveMeasurementResult =
  | { readonly ok: true; readonly measurement: MeasurementRecord }
  | { readonly ok: false; readonly code: "quota-exceeded" | "failed" };

/**
 * `POST` — idempotent save (plan §5.2). A single discrete "Kaydet" click, not a
 * periodic/teardown save — no `keepalive`; nothing here needs to survive page unload.
 * Carries its own `AbortController` bounded by `MEASUREMENTS_WRITE_TIMEOUT_MS`.
 *
 * The two failure codes are distinguished DELIBERATELY (plan §5.4/§10): a quota failure
 * will not be fixed by retrying the same click, unlike every other failure — the caller
 * (`ToolMeasurementSave`) uses this to decide whether to keep the pending-save id alive.
 */
export async function saveMeasurement(
  payload: SaveMeasurementPayload,
): Promise<SaveMeasurementResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MEASUREMENTS_WRITE_TIMEOUT_MS);
  try {
    const res = await fetch("/api/measurements", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.status === 403) return { ok: false, code: "quota-exceeded" };
    if (res.status !== 200) return { ok: false, code: "failed" };
    const parsed: unknown = await res.json();
    const record = parseSaveBody(parsed);
    if (record === null) return { ok: false, code: "failed" };
    return { ok: true, measurement: record };
  } catch {
    return { ok: false, code: "failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function parseSaveBody(value: unknown): MeasurementRecord | null {
  if (typeof value !== "object" || value === null || !("ok" in value) || value.ok !== true) {
    return null;
  }
  return parseMeasurementEntry((value as { measurement?: unknown }).measurement);
}

export interface RemoveMeasurementResult {
  readonly ok: boolean;
}

/** `DELETE` — unconditionally idempotent remove, no request body. The BFF answers 204 on
 *  every genuine success, never 200 (plan §5.2's unconditional-204 design, matching the
 *  api exactly). Same `AbortController` + `MEASUREMENTS_WRITE_TIMEOUT_MS` treatment as
 *  `saveMeasurement` above — a fresh controller per call, `clearTimeout` unconditional in
 *  `finally`. */
export async function removeMeasurement(id: string): Promise<RemoveMeasurementResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MEASUREMENTS_WRITE_TIMEOUT_MS);
  try {
    const res = await fetch(buildMeasurementUrl(id), {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    return { ok: res.status === 204 };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
