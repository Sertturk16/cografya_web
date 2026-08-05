import "server-only";
import { createWarnLimiter } from "@/lib/marine/warn-limiter";
import { apiGet } from "./client";
import { isProductionBuild } from "./provinces";
import type {
  MarineLayer,
  MarineOverview,
  MarinePointListItem,
  MarineProvinceConditions,
} from "./types";

/**
 * Marine data access for the `/deniz` hub and the province marine sections.
 *
 * Four routes are wrapped here: the reference points, the measurement catalogue, the value
 * overview (W2a) and one province's conditions (W2b). The series route stays unwrapped (the
 * chart is W2c, and `series` already rides on the conditions payload) and
 * `/api/marine/points/{slug}/conditions` is never consumed at all, because `/deniz/{point}`
 * pages were rejected as thin content.
 *
 * Each read carries its own ISR window, mirroring the api's own `s-maxage` so the page can
 * never be staler than the CDN in front of it.
 *
 * TWO RESILIENCE SHAPES, AND WHICH SURFACE GETS WHICH. The `…Resilient` wrappers degrade at
 * BUILD and re-throw at RUNTIME, so a blip leaves the last good static render in place. The
 * `…Safe` wrappers never throw in either phase. The split is not per ROUTE, it is per
 * SURFACE: on `/deniz` the points and the catalogue ARE the page, while on
 * `/turkiye/{il}` every marine read is an enhancement bolted onto a page about a province —
 * and an external provider chain may never turn a province page into a 500.
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

/**
 * One limiter per failure CLASS, module-scoped so the 27 coastal province pages share a tally
 * instead of each warning on its own (→ the M9 decision, `lib/marine/warn-limiter.ts`). The
 * hub's own reads are deliberately NOT limited: they happen once per page, and one line about
 * `/deniz` is exactly the right amount of noise.
 */
const pointsWarnLimiter = createWarnLimiter();
const layersWarnLimiter = createWarnLimiter();
const provinceConditionsWarnLimiter = createWarnLimiter();

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

/**
 * FAIL-SOFT point list, for the surfaces where the marine data is NOT the subject — the
 * province pages and, since the rebuild, the homepage.
 *
 * Same URL, same ISR window and the same shared fetch entry as
 * `getMarinePointsResilient` — a different failure contract, because it is read from a
 * different kind of page. On `/deniz` the points are the subject and a runtime re-throw is
 * what preserves the last good render of them. On a province page the list is a GATE: it
 * answers "does this province have a coast", and the honest answer when it cannot be reached
 * is "we cannot tell right now", which means no section — never a 500 on a page about
 * Sinop's population. The homepage reads it for the same class of reason: it feeds a scope
 * chip and the value-less sea card, and an external provider chain may never turn the site's
 * front door into a 500.
 *
 * The 27 coastal province pages and the homepage all read this on every regeneration, so its
 * warnings go through the shared limiter (see `lib/marine/warn-limiter.ts`).
 */
export async function getMarinePointsSafe(): Promise<MarinePointListItem[]> {
  try {
    const points = await getMarinePoints();
    pointsWarnLimiter.reset();
    return points;
  } catch (error) {
    const line = pointsWarnLimiter(
      `[marine] points fetch failed; province marine sections are gated off this pass. ${String(error)}`,
    );
    if (line !== null) console.warn(line);
    return [];
  }
}

/**
 * FAIL-SOFT layer catalogue, for the PROVINCE surface only — same split, same reasoning as
 * the points wrapper above.
 *
 * An empty catalogue degrades gracefully rather than hiding the section: with no published
 * `directionConvention` no arrow may be drawn (the binding arrow-unlock rule), with no
 * `calmThreshold` no calm claim may be made, and with no ingested cycle the ECMWF copyright
 * LINE is omitted while the mandatory notice still renders. Every one of those is the same
 * answer the code already gives when the api genuinely publishes nothing.
 */
export async function getMarineLayersSafe(): Promise<MarineLayer[]> {
  try {
    const layers = await getMarineLayers();
    layersWarnLimiter.reset();
    return layers;
  } catch (error) {
    const line = layersWarnLimiter(
      `[marine] layer catalogue fetch failed; province marine sections render without thresholds this pass. ${String(error)}`,
    );
    if (line !== null) console.warn(line);
    return [];
  }
}

/** The value band's payload: 30 blocks of five values each, plus the publish gate. */
export async function getMarineOverview(): Promise<MarineOverview> {
  return apiGet<MarineOverview>("/api/marine/overview", {
    revalidate: MARINE_VALUES_REVALIDATE_SECONDS,
  });
}

/**
 * One province's marine conditions: one block per reference point, in `displayOrder`.
 *
 * The plaka is path-encoded even though the api's own codes are two ASCII digits — the value
 * reaching here comes from a province payload, and a route parameter is never interpolated
 * raw regardless of how well-behaved today's data is.
 */
export async function getMarineProvinceConditions(
  plateCode: string,
): Promise<MarineProvinceConditions> {
  return apiGet<MarineProvinceConditions>(
    `/api/marine/provinces/${encodeURIComponent(plateCode)}/conditions`,
    { revalidate: MARINE_VALUES_REVALIDATE_SECONDS },
  );
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

/**
 * FAIL-SOFT province conditions read — `null` means "no marine section this render", never
 * "this province has no sea".
 *
 * It is fail-soft in both phases for the same reason the overview read is, only more so: the
 * page it hangs off is not about the sea at all. A province page must keep its facts, its
 * climate chart, its neighbour links and its 200 whatever ECMWF and Copernicus are doing.
 *
 * WHY THE WARNING IS LIMITED (the M9 decision). This one function is called by 27 provinces
 * × 2 locales, and a failed fetch is not cached, so one outage would otherwise print the same
 * line up to 54 times per build and once per regeneration forever. The limiter emits
 * occurrences 1, 2, 4, 8, … with the running count attached: the first failure is still
 * reported immediately and in full, and the scale is readable from any single line. The tally
 * resets on the first successful read, so the next outage is reported as a new event.
 */
export async function getMarineProvinceConditionsSafe(
  plateCode: string,
): Promise<MarineProvinceConditions | null> {
  try {
    const conditions = await getMarineProvinceConditions(plateCode);
    provinceConditionsWarnLimiter.reset();
    return conditions;
  } catch (error) {
    const line = provinceConditionsWarnLimiter(
      `[marine] province conditions fetch failed for plaka ${plateCode}; ` +
        `the marine section is not rendered this pass. ${String(error)}`,
    );
    if (line !== null) console.warn(line);
    return null;
  }
}
