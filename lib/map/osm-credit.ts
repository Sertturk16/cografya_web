/**
 * The OSM credit's two constants, in one place because it has two very different renderers.
 *
 * `Map.attribution` is written once, in the message catalogues, and read by:
 *
 *  - `components/patterns/map-attribution.tsx`, which renders it as HTML and turns the
 *    `<osm>…</osm>` span into an `<a>` through next-intl's `t.rich`; and
 *  - `lib/map/base-map-svg.ts`, which draws it as an SVG `<text>` node inside its own `<a>` and
 *    therefore needs the words WITHOUT the markup.
 *
 * The second one is why this file exists. Making the message rich broke the SVG artifact
 * silently-looking: the builder escapes what it is given, so `<osm>` was drawn on the map as the
 * literal text `&lt;osm&gt;`. `lib/map/base-map-svg.test.ts` caught it, and the fix is one reader
 * of the markup rather than a second regex living next to the first.
 */

/** The page OSM's attribution guidance names as the link target. */
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

/**
 * `Map.attribution` with the link markers removed — the credit as plain words.
 *
 * Deliberately narrow: it strips exactly the one tag the catalogues use, so a second tag added to
 * the message later would show up as literal text in the SVG rather than being silently dropped
 * here. That failure is visible; a permissive `<[^>]*>` strip would hide it.
 */
export function plainAttribution(rich: string): string {
  return rich.replace(/<\/?osm>/g, "");
}
