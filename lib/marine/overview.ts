import type { MarineOverview, MarineOverviewPoint } from "@/lib/api/types";

/**
 * THE ONE SIGNAL that decides whether `/deniz` is a page WITH values this render.
 *
 * Two places on the page must agree about it — the lede and the value section's heading —
 * and W2a's first cut computed it in only one of them, which let the page open with a
 * promise ("rüzgâr, dalga ve deniz suyu sıcaklığı") that the section below it then failed
 * to keep. Splitting one decision across two components is how that happens, so the
 * decision lives here and both call sites read it.
 *
 * TWO CONDITIONS, ONE ANSWER:
 *
 * 1. `dataAvailable: false` is the contract's explicit "do not publish this render" gate —
 *    the narrow window where the api's cache is genuinely empty. A band built out of it is
 *    exactly what the flag exists to prevent, so the payload is treated as absent.
 * 2. `null` is `getMarineOverviewSafe`'s fail-soft answer: an outage, a 5xx, or simply this
 *    branch running against an api that does not serve the route yet.
 *
 * Both collapse to "no blocks", and no blocks means no values — never "no values exist".
 */
export function marinePublishableBlocks(overview: MarineOverview | null): MarineOverviewPoint[] {
  return overview !== null && overview.dataAvailable ? overview.points : [];
}

/**
 * Whether this render may make a value claim in prose.
 *
 * Deliberately `blocks.length > 0` rather than the flag alone: a publishable payload that
 * happens to carry no blocks renders no table, and a lede announcing values over an empty
 * section is the same broken promise by a different route.
 */
export function marineShowsValues(overview: MarineOverview | null): boolean {
  return marinePublishableBlocks(overview).length > 0;
}
