/**
 * The one-way camera contract between the game island and the shared map zoom/pan island
 * (→ DEC 2026-08-17g md. 4: "Cevabı göster = yalnız kaydırma").
 *
 * WHY AN EVENT AND NOT A PROP. The two islands do not know each other and deliberately never
 * have: `game-island.tsx` and `map-zoom-pan.tsx` both enrich the SAME server-rendered `<svg>`
 * imperatively, from separate React trees, and everything they already say to one another is
 * said through the DOM (`data-state`, `data-panning`, `data-zoom-radius`). Lifting a shared
 * handle into a common parent would mean re-rendering the map island from game state — 81
 * shapes per answer, the exact INP problem the imperative design exists to avoid.
 *
 * The `<svg>` itself is the bus: both islands already hold it, so there is no ancestor to
 * agree on and no timing question about which container exists first. The event does not
 * bubble — dispatcher and listener are the same element.
 *
 * WHAT IT MAY ASK FOR is deliberately narrow: "bring these shapes into view". Not a zoom, not
 * a centre, not a viewBox. The map island answers with `viewToIncludeShape`, which never
 * zooms IN — Kâşif SPEC §7.2 bars auto-zooming to a target because that would hand the player
 * the answer, and the ruling only relaxes the PAN half, after the answer is already shown.
 */

/** Event name, namespaced so it can never collide with a UA or library event. */
export const MAP_CAMERA_EVENT = "cografya:map-camera";

export interface MapCameraEventDetail {
  /**
   * The shapes to bring into view. Live elements rather than plate codes: geometry is the map
   * island's business, and `getBBox()` is the only thing it needs from them — which keeps the
   * game's layer structure (`[data-map-layer="hit"]`) out of the shared island.
   */
  readonly shapes: readonly SVGGraphicsElement[];
}

/** Ask the map to bring `shapes` into view. No-op for an empty list. */
export function dispatchMapCamera(
  target: EventTarget,
  shapes: readonly SVGGraphicsElement[],
): void {
  if (shapes.length === 0) return;
  target.dispatchEvent(
    new CustomEvent<MapCameraEventDetail>(MAP_CAMERA_EVENT, { detail: { shapes } }),
  );
}

/**
 * Narrow a listener's `Event` to the camera event. A type predicate rather than a cast: the
 * listener receives `Event`, and asserting the detail's shape instead of checking it is how a
 * future third dispatcher would reach `detail.shapes` on an object that has none.
 *
 * WHAT IT PROMISES, EXACTLY (review CODE69-M4): that `detail.shapes` is an array — not that
 * its members are elements. Naming `SVGGraphicsElement` here would tie this module to a DOM
 * global it does not otherwise touch, and it is the one half of the contract that runs under
 * `node` in the unit suite. The member check belongs to the listener, which only ever runs in
 * a browser, and `map-zoom-pan.tsx` carries it.
 */
export function isMapCameraEvent(event: Event): event is CustomEvent<MapCameraEventDetail> {
  if (!(event instanceof CustomEvent)) return false;
  const detail: unknown = event.detail;
  return (
    typeof detail === "object" &&
    detail !== null &&
    Array.isArray((detail as { shapes?: unknown }).shapes)
  );
}
