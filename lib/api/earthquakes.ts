import "server-only";
import { buildEarthquakeQuery, type EarthquakeFilter } from "@/lib/earthquake/query";
import { apiGet } from "./client";
import { isProductionBuild } from "./provinces";
import type { EarthquakeList, EarthquakeMeta } from "./types";

/**
 * Earthquake data access for the `/deprem` hub (PR-A, `deprem-sayfalari` plan §5.4).
 *
 * The `filter` shape mirrors the query DTO's own fields (`minMagnitude`, `fromUtc`, `toUtc`,
 * `page`, `pageSize`) and is built through `lib/earthquake/query.ts`'s shared, tested
 * `buildEarthquakeQuery` — an absent field is OMITTED from the query string, never sent empty
 * (`earthquake-list-query.dto.ts`'s own comment records the real, previously-shipped
 * `?minMagnitude=` defect this avoids, review #121 CODE121-M1).
 *
 * ISR windows mirror the api's own `Cache-Control` exactly, the same discipline
 * `lib/api/marine.ts` documents: 120 s for the list read (`s-maxage=120`), 3600 s for `meta`
 * (`s-maxage=3600`) — `earthquake.controller.ts`'s own `LIST_CACHE_CONTROL`/`META_CACHE_CONTROL`
 * constants.
 *
 * ONE resilience shape here — `…Resilient` (build-safe, runtime-re-throwing) — because the hub
 * page's default-view reads are the page itself (§5.3): the list and the map ARE `/deprem`, the
 * same reasoning `getMarinePointsResilient` states for `/deniz`'s points. The province section's
 * `…Safe` (never-throw) wrappers are PR-B's own addition (plan §7), not built here.
 */

/** Mirrors `earthquake.controller.ts`'s `LIST_CACHE_CONTROL` (`s-maxage=120`). */
export const EARTHQUAKE_LIST_REVALIDATE_SECONDS = 120;

/** Mirrors `earthquake.controller.ts`'s `META_CACHE_CONTROL` (`s-maxage=3600`). */
export const EARTHQUAKE_META_REVALIDATE_SECONDS = 3600;

export async function getEarthquakeList(filter: EarthquakeFilter = {}): Promise<EarthquakeList> {
  return apiGet<EarthquakeList>(`/api/earthquakes${buildEarthquakeQuery(filter)}`, {
    revalidate: EARTHQUAKE_LIST_REVALIDATE_SECONDS,
  });
}

export async function getEarthquakeMeta(): Promise<EarthquakeMeta> {
  return apiGet<EarthquakeMeta>("/api/earthquakes/meta", {
    revalidate: EARTHQUAKE_META_REVALIDATE_SECONDS,
  });
}

/**
 * Build-safe default-view list read — the same build-vs-runtime split as
 * `getMarinePointsResilient` (`lib/api/marine.ts`), which documents the rationale in full.
 *
 * At BUILD an api outage degrades to the honest cold shape (`items: []`,
 * `dataStatus: "unavailable"`) so web CI (which has no api service) can still build; the page
 * then renders that cold state (§5.11 — never a fetch-failure fallback, since an empty
 * `items` array is ALSO the real "no earthquakes match" answer on a live cold store). At
 * RUNTIME it re-throws, so a transient blip keeps the last good static render instead of
 * caching a hub with no events in it.
 */
export async function getEarthquakeListResilient(
  filter: EarthquakeFilter = {},
): Promise<EarthquakeList> {
  try {
    return await getEarthquakeList(filter);
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[earthquake] list fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return buildColdEarthquakeList(filter);
    }
    throw error;
  }
}

/** Same split as {@link getEarthquakeListResilient}, for the `meta` read. */
export async function getEarthquakeMetaResilient(): Promise<EarthquakeMeta> {
  try {
    return await getEarthquakeMeta();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[earthquake] meta fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return COLD_EARTHQUAKE_META;
    }
    throw error;
  }
}

/**
 * The honest cold shape a real `dataStatus: "unavailable"` response carries — reused as the
 * BUILD-TIME fallback rather than an empty array, because `/deprem`'s cold state (§5.11) is a
 * real, specified render (empty map, empty list, an honest lede) and not a generic "fetch
 * failed" placeholder. Attribution still populates in a genuine cold response (§2 — every
 * response, every `dataStatus`, carries it); the build-time fallback below deliberately does
 * NOT invent an attribution row, because unlike the api's own constant-backed attribution this
 * fallback has no real value to publish — the resilient wrapper's whole point is "web CI has no
 * api service", so the page renders the cold copy without a fabricated licence line rather than
 * printing one that was never actually served.
 */
const COLD_EARTHQUAKE_META: EarthquakeMeta = {
  minMagnitudeDefault: 2.5,
  scopeBufferKm: 200,
  defaultWindowDays: 7,
  maxWindowDays: 366,
  dataUpdatedAtUtc: null,
  latestEventAtUtc: null,
  dataStatus: "unavailable",
  disclaimerTr:
    "Bu sayfa, AFAD'ın yayımladığı gerçekleşmiş deprem kayıtlarını gösterir. Erken uyarı sistemi değildir; gelecek depremler hakkında bilgi vermez.",
  attributions: [],
};

function buildColdEarthquakeList(filter: EarthquakeFilter): EarthquakeList {
  const now = new Date().toISOString();
  const days = COLD_EARTHQUAKE_META.defaultWindowDays;
  const toUtc = filter.toUtc ?? now;
  const fromUtc =
    filter.fromUtc ?? new Date(new Date(toUtc).getTime() - days * 86_400_000).toISOString();
  return {
    page: filter.page ?? 1,
    pageSize: filter.pageSize ?? 50,
    total: 0,
    hasMore: false,
    items: [],
    meta: {
      filter: {
        minMagnitude: filter.minMagnitude ?? COLD_EARTHQUAKE_META.minMagnitudeDefault,
        plateCode: null,
        fromUtc,
        toUtc,
      },
      dataUpdatedAtUtc: null,
      latestEventAtUtc: null,
      dataStatus: "unavailable",
      attributions: [],
    },
  };
}
