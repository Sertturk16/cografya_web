import type { MarineLayer } from "@/lib/api/types";

/**
 * How a catalogue row is presented on `/deniz`.
 *
 * - `"live"` — the layer's model künye (cycle frequency, forecast horizon, catalogue
 *   timestamp) is fully resolved, so the row can show it.
 * - `"nextPhase"` — no künye to show. Today that is every CMEMS-primary layer (the CMEMS
 *   catalogue is resolved in M4), and it is ALSO what a stopped ingest or the production
 *   default `MARINE_ENABLED=false` looks like. The row says so in words; it never invents
 *   a date, a "coming soon", or a value.
 */
export type MarineLayerState = "live" | "nextPhase";

/**
 * Classifies a catalogue layer from the NULLNESS of its three künye fields — nothing else.
 *
 * **All three must be present.** A partially-resolved layer is `"nextPhase"`, not a
 * half-live row: showing "cycle: four-times-daily" next to an absent horizon would read as
 * a live feed whose horizon we just forgot to print. The contract makes the three move
 * together (they are all resolved from the newest ingested cycle and all fall back to null
 * past the 24 h cycle-age ceiling), so an all-or-nothing rule matches the data's own shape.
 *
 * **`primarySource` is deliberately NOT consulted.** Deriving "cmems ⇒ not live yet" would
 * hardcode today's rollout state into the web app: the day the CMEMS catalogue resolves,
 * this file would have to be edited for the page to tell the truth. Reading only the künye
 * means the page follows the api with no redeploy.
 */
export function marineLayerState(layer: MarineLayer): MarineLayerState {
  const resolved =
    layer.horizonEndUtc !== null &&
    layer.updateFrequency !== null &&
    layer.catalogueUpdatedAtUtc !== null;

  return resolved ? "live" : "nextPhase";
}
