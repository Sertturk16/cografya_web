import type { MarineLayer } from "@/lib/api/types";
import { parseModelInstant } from "./model-run";

/**
 * The year the ECMWF copyright line carries.
 *
 * ECMWF's licence requires the notice `Copyright "© [year] European Centre for
 * Medium-Range Weather Forecasts (ECMWF)"` (NOVA, read first-hand from
 * `apps.ecmwf.int/datasets/licences/general/` → `Owner's Inbox/atif-dogrulama/brief.md`
 * §1.2, ruled in DEC 2026-08-02c). The licence does not define `[year]`; the conservative
 * reading recorded with the ruling is THE YEAR THE DATA BELONGS TO — the model cycle's own
 * year, not "now".
 *
 * So it is derived from the catalogue künye of the ECMWF-sourced layers rather than
 * written down: a constant would be correct until 1 January and wrong afterwards, and an
 * ISR page rendered from a cached year would go on being wrong for a whole revalidate
 * window. `catalogueUpdatedAtUtc` — the provider's catalogue stamp for the ingested cycle,
 * i.e. the closest PUBLISHED proxy for the cycle's own year — is the right field;
 * `horizonEndUtc` points days into the FUTURE and would print next year's copyright at a
 * year boundary.
 *
 * `null` means no ECMWF cycle has been ingested (production's default `MARINE_ENABLED=false`,
 * or a stopped shadow run). The caller then omits the copyright LINE — never the notice
 * itself: the mandatory element is the "this service is based on…" sentence, which carries
 * no year, and inventing one to fill a template would be the one thing an attribution may
 * not do.
 */
export function ecmwfAttributionYear(layers: readonly MarineLayer[]): number | null {
  let newest: number | null = null;

  for (const layer of layers) {
    // A layer counts as ECMWF-derived through EITHER source: the wave layers fall back to
    // ECMWF where the regional model has no coverage, and the fallback's künye is ECMWF's
    // material just as much as the primary's.
    if (layer.primarySource !== "ecmwf" && layer.fallbackSource !== "ecmwf") continue;

    const cycle = parseModelInstant(layer.catalogueUpdatedAtUtc);
    if (cycle === null) continue;

    const time = cycle.getTime();
    if (newest === null || time > newest) newest = time;
  }

  // UTC, like every other instant on this page: the künye is published in UTC and the
  // hosting region is undecided, so a local-zone year could differ by one on 31 December.
  return newest === null ? null : new Date(newest).getUTCFullYear();
}
