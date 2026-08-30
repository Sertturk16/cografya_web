import "server-only";
import { createWarnLimiter } from "@/lib/marine/warn-limiter";
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
 * TWO resilience shapes here, mirroring `lib/api/marine.ts`'s own split precisely (plan §5.3).
 * `…Resilient` (build-safe, runtime-re-throwing) is for the hub page's default-view reads: the
 * list and the map ARE `/deprem`, the same reasoning `getMarinePointsResilient` states for
 * `/deniz`'s points. `getProvinceEarthquakesSafe` (never-throw, either phase) is PR-B's own
 * addition — the province section is an enhancement bolted onto a page about the province, not
 * about earthquakes, so a provider/DB hiccup must degrade the section, never the page, exactly
 * `getMarineProvinceConditionsSafe`'s own contract.
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
 * One province's earthquake events (PR-B, `deprem-sayfalari` plan §5.12) — same envelope as
 * the hub, filtered server-side to the events bound to this `plateCode`
 * (`earthquake.controller.ts`'s own doc comment: "the same envelope as the hub, filtered to
 * the events bound to this province"). Every item this returns therefore carries
 * `bindingPlateCode === plateCode`, which is what lets the province section resolve the
 * `bindingKind` sentence's `{province}` placeholder from the page's own already-known province
 * name — no second province-list fetch needed (unlike the hub, which does not know in advance
 * which provinces its mixed event set will bind to).
 *
 * The plaka is path-encoded even though the api's own codes are two ASCII digits — the same
 * defensive discipline `getMarineProvinceConditions` already applies to the identical shape of
 * input, regardless of how well-behaved today's data is.
 *
 * Same ISR window as the hub list (120 s): `earthquake.controller.ts`'s own docblock groups
 * "list/province routes" under one `Cache-Control` (`s-maxage=120`), so mirroring it here is
 * the SAME number, not a second choice.
 */
export async function getProvinceEarthquakes(
  plateCode: string,
  filter: EarthquakeFilter = {},
): Promise<EarthquakeList> {
  return apiGet<EarthquakeList>(
    `/api/earthquakes/provinces/${encodeURIComponent(plateCode)}${buildEarthquakeQuery(filter)}`,
    { revalidate: EARTHQUAKE_LIST_REVALIDATE_SECONDS },
  );
}

/**
 * One limiter for this failure class, module-scoped so the 81 province pages × 2 locales share
 * one tally instead of each warning on its own — the identical M9 decision
 * `provinceConditionsWarnLimiter` (`lib/api/marine.ts`) already applies, reused via
 * `createWarnLimiter` rather than re-implemented (plan §5.3).
 */
const provinceEarthquakesWarnLimiter = createWarnLimiter();

/**
 * FAIL-SOFT province earthquake read — `null` means "no earthquake section this render",
 * never "this province has no earthquakes nearby". Same contract as
 * `getMarineProvinceConditionsSafe`: fail-soft in BOTH phases, because the section it powers is
 * an enhancement on a page about a province, not about earthquakes, and an external provider
 * chain may never turn a province page into a 500.
 *
 * A SUCCESSFUL read with `items: []` is a genuinely different case from a failed one — it is
 * the honest "no events matched the default window" answer, and the section renders it as
 * such (§5.12's empty-state copy), never as though the read had failed.
 */
export async function getProvinceEarthquakesSafe(
  plateCode: string,
): Promise<EarthquakeList | null> {
  try {
    const list = await getProvinceEarthquakes(plateCode);
    provinceEarthquakesWarnLimiter.reset();
    return list;
  } catch (error) {
    const line = provinceEarthquakesWarnLimiter(
      `[earthquake] province events fetch failed for plaka ${plateCode}; ` +
        `the earthquake section is not rendered this pass. ${String(error)}`,
    );
    if (line !== null) console.warn(line);
    return null;
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
