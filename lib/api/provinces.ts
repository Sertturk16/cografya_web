import "server-only";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { ApiError, apiGet } from "./client";
import type { ProvinceDetail, ProvinceListItem, ProvinceMapSummary } from "./types";

/**
 * Province data access (the SSG/ISR source for the il-hub + il detay pages).
 * Thin wrappers over the typed api client; the OpenAPI contract guarantees the
 * shapes. No geography facts live here — the api is the single source of truth
 * (CONVENTIONS §4/§6; nothing is invented client-side).
 */

/** All provinces, ordered by plaka kodu (as the api returns them). Throws on failure. */
export async function getProvinces(): Promise<ProvinceListItem[]> {
  return apiGet<ProvinceListItem[]>("/api/provinces");
}

/**
 * Bulk hover-card summary for the homepage SVG map (identity + population/area/
 * district numbers), keyed by plaka kodu. Purpose-built lean payload — one fetch,
 * build-time embedded (SPEC §5.1). Returns only seeded provinces (same set as the
 * list); the numeric fields are null until a province is fact-checked. Throws on
 * failure — the caller degrades the map (best-effort enhancement).
 */
export async function getMapSummary(): Promise<ProvinceMapSummary[]> {
  return apiGet<ProvinceMapSummary[]>("/api/provinces/map-summary");
}

/**
 * One province by its TR or EN slug (the api resolves both). Returns `null` on a
 * genuine 404 so the page can call `notFound()` (CONVENTIONS §6 #6 — a real 404,
 * never a soft-200); re-throws any other failure so ISR keeps the last good
 * render instead of caching a broken page.
 */
export async function getProvinceBySlug(slug: string): Promise<ProvinceDetail | null> {
  try {
    return await apiGet<ProvinceDetail>(`/api/provinces/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * True during `next build` (the static-generation phase). The single knob behind
 * the build-vs-runtime resilience split used by every enumerating consumer:
 * tolerate an api outage at BUILD (degrade to on-demand ISR), but re-throw at
 * RUNTIME so Next keeps serving the last good static artifact.
 */
export function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
}

/**
 * Build-safe province list for the enumerating consumers that run during
 * `next build` (generateStaticParams, the il-hub index, sitemap).
 *
 * - At BUILD (`next build`): if the api is unreachable it returns `[]` instead of
 *   failing the build — the routes then fall back to on-demand ISR at runtime
 *   (still full-HTML SSR/ISR, never client-only). This lets CI build without a
 *   live api (today's web CI has no api service).
 * - At RUNTIME (ISR regeneration): it re-throws, so a transient api blip makes
 *   Next keep serving the last good static page/sitemap rather than caching an
 *   empty hub — the SEO surface never silently loses its provinces.
 */
export async function getProvincesResilient(): Promise<ProvinceListItem[]> {
  try {
    return await getProvinces();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[provinces] list fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/**
 * Build-safe map summary — the same build-vs-runtime split as
 * `getProvincesResilient`, for the consumers whose ONLY api read is the map join.
 *
 * - At BUILD: degrade to `[]` so CI (no api service) can still build; the shapes are
 *   compiled in, so the map renders as an unjoined outline and the route falls back to
 *   on-demand ISR at runtime.
 * - At RUNTIME (ISR regeneration): re-throw, so a transient api failure makes Next keep
 *   serving the last good static page instead of caching a silently unjoined map for a
 *   full revalidate window. Swallowing here is only safe when a SIBLING call already
 *   re-throws at runtime (the `/turkiye` case, where `getProvincesResilient` guards the
 *   page); a page whose sole api read is this one must use this wrapper.
 */
export async function getMapSummaryResilient(): Promise<ProvinceMapSummary[]> {
  try {
    return await getMapSummary();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[provinces] map-summary fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/**
 * Index any plaka-kodu-bearing payload by its `plateCode` (neighbour cross-links,
 * the map's shape↔data join, …). Generic over the item type so the list, the
 * map-summary, and any future plate-keyed shape all reuse one indexer. Plate codes
 * are the api's 2-digit zero-padded values (api `CLAUDE.md` §5), matching the
 * generated map artifact, so raw string equality is the correct join.
 */
export function byPlateCode<T extends { plateCode: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.plateCode, item]));
}
