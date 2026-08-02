import "server-only";
import { apiGet } from "./client";
import { isProductionBuild } from "./provinces";
import type { MarineLayer, MarineOverview, MarinePointListItem } from "./types";

/**
 * Marine data access for the `/deniz` hub.
 *
 * Three routes are wrapped here: the reference points, the measurement catalogue and — as
 * of W2a — the value overview. The per-point conditions and series routes stay unwrapped
 * (they belong to the province section, W2b/W2c) and `/api/marine/points/{slug}/conditions`
 * is never consumed at all, because `/deniz/{point}` pages were rejected as thin content.
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

/**
 * The VALUE reads (overview today, province conditions in W2b). The api serves them with
 * `s-maxage=900`, so 900 s is a mirror, not a choice: a page that revalidated faster would
 * only re-render the same CDN-cached numbers, and one that revalidated slower would keep
 * claiming a künye the api had already replaced.
 *
 * This is also the SHORTEST window on `/deniz`, and Next takes a route's effective ISR
 * period from the shortest fetch in it — so the hub moves from 1800 s to 900 s. That is the
 * intended cost of publishing live values, and it is paid against a Postgres/Redis read:
 * the api's locked cold-behavior table forbids these reads from ever reaching upstream.
 */
export const MARINE_VALUES_REVALIDATE_SECONDS = 900;

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

/** The value band's payload: 30 blocks of five values each, plus the publish gate. */
export async function getMarineOverview(): Promise<MarineOverview> {
  return apiGet<MarineOverview>("/api/marine/overview", {
    revalidate: MARINE_VALUES_REVALIDATE_SECONDS,
  });
}

/**
 * FAIL-SOFT value read — deliberately a DIFFERENT resilience shape from the two wrappers
 * above, and the difference is the point.
 *
 * `getMarinePointsResilient` / `getMarineLayersResilient` re-throw at runtime so that a
 * transient blip leaves the last good static render in place: points and the catalogue ARE
 * this page. The value band is not. It is a progressive enhancement layered on top of an
 * editorial page, it depends on a chain of external providers we do not operate, and it is
 * additionally consumed by 27 province pages (W2b) whose subject is not the sea at all.
 *
 * A re-throwing wrapper would let one provider outage — or simply this branch landing
 * before M4, where `/api/marine/overview` still answers 404 — turn an indexable page into a
 * 500. So both at build AND at runtime this returns `null` and warns: the band disappears,
 * every other section stays, the page keeps its status code. The api's own rule is the
 * mirror image of this one: a provider failure may break the widget, never the page.
 *
 * `null` is therefore "no band this render", never "no values exist" — the caller renders
 * the section in its value-less shape (see `components/marine/reference-points.tsx`), which
 * keeps all 30 internal province links whatever the api is doing.
 */
export async function getMarineOverviewSafe(): Promise<MarineOverview | null> {
  try {
    return await getMarineOverview();
  } catch (error) {
    console.warn(
      `[marine] overview fetch failed; the /deniz value band is not rendered this pass. ${String(error)}`,
    );
    return null;
  }
}
