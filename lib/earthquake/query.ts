/**
 * The five documented `EarthquakeListQueryDto` query parameters, built/parsed in ONE place.
 *
 * `cografya_api/src/earthquake/dto/earthquake-list-query.dto.ts` rejects unknown query
 * parameters (400) and — the defect class its own comment records as previously shipped on a
 * sibling endpoint, review #121 CODE121-M1 — treats `?minMagnitude=` (empty string) as `0`,
 * silently replacing the published 2.5 default with a floor that returns a far heavier page
 * than the caller asked for. So an absent/blank optional field is OMITTED here, never sent as
 * an empty string, on both the way OUT (the Route Handler proxy forwarding to the api) and the
 * way IN (the client filter island building a request to the proxy) — one function, no second
 * copy of the omit-if-blank rule to drift.
 *
 * Pure and `server-only`-free on purpose: `app/api/earthquakes/route.ts` (server) and
 * `components/earthquake/earthquake-filters.tsx` (`"use client"`) both import it.
 */

export interface EarthquakeFilter {
  minMagnitude?: number;
  fromUtc?: string;
  toUtc?: string;
  page?: number;
  pageSize?: number;
}

/** `?minMagnitude=2.5&page=2` (or `""` when the filter carries nothing to send). */
export function buildEarthquakeQuery(filter: EarthquakeFilter): string {
  const params = new URLSearchParams();
  if (filter.minMagnitude !== undefined) params.set("minMagnitude", String(filter.minMagnitude));
  if (filter.fromUtc !== undefined) params.set("fromUtc", filter.fromUtc);
  if (filter.toUtc !== undefined) params.set("toUtc", filter.toUtc);
  if (filter.page !== undefined) params.set("page", String(filter.page));
  if (filter.pageSize !== undefined) params.set("pageSize", String(filter.pageSize));
  const qs = params.toString();
  return qs.length > 0 ? `?${qs}` : "";
}

/** A well-formed (non-blank, finite) numeric string, or `undefined` — never `NaN`. */
function parseNumberParam(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** A non-blank string, or `undefined`. */
function parseStringParam(raw: string | null): string | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  return raw;
}

/**
 * Reads the five documented parameters out of an incoming request's search params —
 * used by `app/api/earthquakes/route.ts` to forward only the known shape, never a blind
 * passthrough of whatever the client sent (an unrecognised parameter would 400 upstream
 * anyway, per the query DTO's own `forbidNonWhitelisted` rule; this keeps that behaviour
 * explicit rather than accidental).
 */
export function parseEarthquakeFilterParams(searchParams: URLSearchParams): EarthquakeFilter {
  return {
    minMagnitude: parseNumberParam(searchParams.get("minMagnitude")),
    fromUtc: parseStringParam(searchParams.get("fromUtc")),
    toUtc: parseStringParam(searchParams.get("toUtc")),
    page: parseNumberParam(searchParams.get("page")),
    pageSize: parseNumberParam(searchParams.get("pageSize")),
  };
}
