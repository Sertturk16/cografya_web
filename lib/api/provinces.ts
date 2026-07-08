import "server-only";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { ApiError, apiGet } from "./client";
import type { ProvinceDetail, ProvinceListItem } from "./types";

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
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      console.warn(
        `[provinces] list fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/** Index the list by plaka kodu (for resolving neighbour cross-links). */
export function byPlateCode(provinces: ProvinceListItem[]): Map<string, ProvinceListItem> {
  return new Map(provinces.map((province) => [province.plateCode, province]));
}
