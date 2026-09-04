import "server-only";
import { ApiError, apiGet } from "./client";
import { isProductionBuild } from "./provinces";
import type { RegionDetail, RegionListItem } from "./types";

/**
 * Region data access (the SSG/ISR source for the `/turkiye/bolge/[slug]` detail pages
 * and `/turkiye` region cards). Thin wrappers over the typed api client; the OpenAPI
 * contract guarantees the shapes. No geography facts live here — the api is the
 * single source of truth (CONVENTIONS §4/§6; nothing is invented client-side).
 *
 * Build-vs-runtime resilience reuses `isProductionBuild()` from `provinces.ts`:
 * tolerate an api outage at BUILD (degrade to on-demand ISR), re-throw at RUNTIME so
 * Next keeps serving the last good static artifact.
 */

/** All seven regions, in canonical Kongre order. Throws on failure. */
export async function getRegions(): Promise<RegionListItem[]> {
  return apiGet<RegionListItem[]>("/api/regions");
}

/**
 * One region by its lowercase slug (e.g. 'marmara', 'ic-anadolu'). Returns `null` on a genuine
 * 404 so the page can call `notFound()` (CONVENTIONS §6 #6 — a real 404, never a
 * soft-200); re-throws any other failure so ISR keeps the last good render.
 */
export async function getRegionBySlug(slug: string): Promise<RegionDetail | null> {
  try {
    return await apiGet<RegionDetail>(`/api/regions/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Build-safe region list for enumerating consumers (generateStaticParams, sitemap).
 *
 * - At BUILD (`next build`): if the api is unreachable it returns `[]` instead of
 *   failing the build — the routes then fall back to on-demand ISR at runtime.
 * - At RUNTIME: it re-throws, so a transient api blip keeps serving the last good static page.
 */
export async function getRegionsResilient(): Promise<RegionListItem[]> {
  try {
    return await getRegions();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[regions] list fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}
