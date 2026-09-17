import * as React from "react";
import { cn } from "@/lib/utils";

/** The sources a map in this repo can be built from. */
export type MapSource = "osm" | "naturalEarth" | "osmAndNaturalEarth";

/**
 * Attribution strings, per source and locale.
 *
 * The English wording is "contributors", not the Turkish "katkıcıları" — a distinction
 * `app/maps/tr-provinces.en.svg/route.ts` already makes for the same reason. An attribution
 * that names the licence in one language and the contributors in another is not an
 * attribution anyone can act on.
 */
const CREDIT: Record<MapSource, Record<"tr" | "en", string>> = {
  osm: {
    tr: "© OpenStreetMap katkıcıları, ODbL",
    en: "© OpenStreetMap contributors, ODbL",
  },
  naturalEarth: {
    tr: "Natural Earth, kamu malı",
    en: "Natural Earth, public domain",
  },
  osmAndNaturalEarth: {
    tr: "© OpenStreetMap katkıcıları (ODbL) · Natural Earth, kamu malı",
    en: "© OpenStreetMap contributors (ODbL) · Natural Earth, public domain",
  },
};

export interface MapAttributionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  readonly source: MapSource;
  readonly locale?: "tr" | "en";
}

/**
 * The licence line that belongs beside every map.
 *
 * ## This closes a compliance gap, not a style gap
 *
 * `docs/design.md` requires "© OpenStreetMap katkıcıları, ODbL" beside every map, and V1's
 * `components/map/turkey-map-section.tsx` carried it. Measured across V2: **none of its seven
 * map components had it**. ODbL requires attribution on a derived database or a produced
 * work — this is a licence term, not a house style rule.
 *
 * It is a real paragraph in the document flow rather than an overlay, so it survives a
 * screenshot, a print stylesheet, and a reader who never hovers the map.
 *
 * Small and muted, but NOT `--color-taupe`: `docs/design.md` pins taupe as
 * placeholder/decorative only, since it measures 3.9:1 on white and misses the 4.5:1 floor
 * for body text. `--muted-foreground` is the token for secondary text that still has to be
 * read, and it follows the theme.
 */
export function MapAttribution({
  source,
  locale = "tr",
  className,
  ...props
}: MapAttributionProps) {
  return (
    <p className={cn("mt-2 text-xs text-muted-foreground", className)} {...props}>
      {CREDIT[source][locale]}
    </p>
  );
}

export { CREDIT as MAP_ATTRIBUTION_CREDIT };
