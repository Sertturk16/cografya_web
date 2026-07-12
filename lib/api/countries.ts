import "server-only";
import { ApiError, apiGet } from "./client";
import { isProductionBuild } from "./provinces";
import type { CountryDetail, CountryListItem, CountryMapSummary } from "./types";

/**
 * Country data access (the SSG/ISR source for the `/dunya` hub + `/dunya/{slug}` detail
 * pages — the world-map mirror of `provinces.ts`). Thin wrappers over the typed api
 * client; the OpenAPI contract guarantees the shapes. No geography facts live here — the
 * api is the single source of truth (CONVENTIONS §4/§6; nothing is invented client-side).
 *
 * Build-vs-runtime resilience reuses `isProductionBuild()` from `provinces.ts` (the single
 * knob): tolerate an api outage at BUILD (degrade to on-demand ISR), re-throw at RUNTIME so
 * Next keeps serving the last good static artifact.
 */

/** All countries, as the api returns them. Throws on failure. */
export async function getCountries(): Promise<CountryListItem[]> {
  return apiGet<CountryListItem[]>("/api/countries");
}

/**
 * Bulk hover-card summary for the world SVG map (identity + population/area/neighbour-count),
 * keyed by ISO code. Purpose-built lean payload — one fetch, build-time embedded. Returns
 * only seeded countries; numeric fields are null until fact-checked. Throws on failure — the
 * caller degrades the map (best-effort enhancement).
 */
export async function getCountryMapSummary(): Promise<CountryMapSummary[]> {
  return apiGet<CountryMapSummary[]>("/api/countries/map-summary");
}

/**
 * One country by its TR or EN slug (the api resolves both). Returns `null` on a genuine
 * 404 so the page can call `notFound()` (CONVENTIONS §6 #6 — a real 404, never a
 * soft-200); re-throws any other failure so ISR keeps the last good render.
 */
export async function getCountryBySlug(slug: string): Promise<CountryDetail | null> {
  try {
    return await apiGet<CountryDetail>(`/api/countries/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Build-safe country list for the enumerating consumers that run during `next build`
 * (generateStaticParams, the `/dunya` hub, sitemap). At BUILD an api outage yields `[]`
 * (routes fall back to on-demand ISR); at RUNTIME it re-throws so a transient blip keeps
 * the last good static page/sitemap. Mirrors `getProvincesResilient()`.
 */
export async function getCountriesResilient(): Promise<CountryListItem[]> {
  try {
    return await getCountries();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[countries] list fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/**
 * Index any ISO-code-bearing payload by its `isoCode` (the map's shape↔data join, the
 * neighbour cross-link resolution, …). Generic over the item type so the list and the
 * map-summary reuse one indexer. ISO codes are the api's uppercase alpha-2 values,
 * matching the generated map artifact, so raw string equality is the correct join.
 */
export function byIsoCode<T extends { isoCode: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.isoCode, item]));
}
