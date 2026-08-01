import "server-only";
import { apiGet } from "./client";
import { isProductionBuild } from "./provinces";
import type { MarineLayer, MarinePointListItem } from "./types";

/**
 * Marine data access for the `/deniz` hub.
 *
 * TWO routes exist on the api today and this module wraps exactly those two. The value,
 * series, overview and conditions DTOs are frozen in the contract but deliberately NOT
 * mounted on the controller until M4 ("an advertised path that cannot work is worse than
 * an absent one"), so there is nothing here to read them with — and no placeholder wrapper
 * pretending otherwise.
 *
 * Each read carries its own ISR window, mirroring the api's own `s-maxage` so the page can
 * never be staler than the CDN in front of it.
 */

/**
 * Reference points change only when the probe set is re-run — the api serves them with
 * `s-maxage=86400`.
 */
export const MARINE_POINTS_REVALIDATE_SECONDS = 86_400;

/**
 * The layer catalogue carries the model künye, which moves four times a day and falls back
 * to null at the 24 h cycle-age ceiling. The api tightened this to `s-maxage=1800` (M3b
 * CR-5) for exactly that reason; the page matches it.
 */
export const MARINE_LAYERS_REVALIDATE_SECONDS = 1_800;

/** The 30 offshore reference points (lean payload). Throws on failure. */
export async function getMarinePoints(): Promise<MarinePointListItem[]> {
  return apiGet<MarinePointListItem[]>("/api/marine/points", {
    revalidate: MARINE_POINTS_REVALIDATE_SECONDS,
  });
}

/** The measurement catalogue: units, direction conventions, calm thresholds, künye. */
export async function getMarineLayers(): Promise<MarineLayer[]> {
  return apiGet<MarineLayer[]>("/api/marine/layers", {
    revalidate: MARINE_LAYERS_REVALIDATE_SECONDS,
  });
}

/**
 * Build-safe point list — the same build-vs-runtime split as `getProvincesResilient`
 * (`lib/api/provinces.ts`), which documents the rationale in full.
 *
 * At BUILD an api outage degrades to `[]` so web CI (which has no api service) can still
 * build; the page then renders its editorial half and falls back to on-demand ISR. At
 * RUNTIME it re-throws, so a transient blip keeps the last good static page instead of
 * caching a hub with no points in it.
 */
export async function getMarinePointsResilient(): Promise<MarinePointListItem[]> {
  try {
    return await getMarinePoints();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[marine] points fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/** Build-safe layer catalogue — same split, same reasoning, as the points wrapper above. */
export async function getMarineLayersResilient(): Promise<MarineLayer[]> {
  try {
    return await getMarineLayers();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[marine] layer catalogue fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}
