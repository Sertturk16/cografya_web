import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { locatorRingCenter, type ShapeBounds } from "@/lib/map/shape-geometry";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";
import { WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";
import styles from "./locator-map.module.css";

/**
 * The locator mini-map: "where is this place", answered visually, on every province and
 * country detail page.
 *
 * ## Shape of the thing
 *
 * A shared, cached base silhouette (`/maps/*.svg`, one file per map per locale) loaded as a
 * plain `<img>`, with ONLY the entity's own outline inlined on top as an overlay `<svg>`. The
 * page's HTML therefore grows by ~0.7 KB gzip instead of the 42.7–112.2 KB a whole inline map
 * would cost on each of the 280 indexable detail pages (plan §3, measured; corpus re-counted
 * 2026-08-08 — see the closing summary).
 *
 * ## Why a bare `<img>` and not `next/image`
 *
 * `ENGINEERING.md` §4 #9 otherwise requires `next/image` always; the exception sentence for
 * static, build-emitted SVG lands in that file WITH this code (→ DEC 2026-08-08a md.3). The
 * reason is that `next/image`'s whole value here is negative: it cannot optimise SVG (it
 * passes them through unchanged, or refuses them without `dangerouslyAllowSVG`), while its
 * runtime wrapper adds a client component and a sizing layer to a file that already carries
 * its own intrinsic ratio in its `viewBox`. What `next/image` protects — CLS — is held here by
 * explicit `width`/`height` plus a fixed `aspect-ratio` box, which is the same guarantee by a
 * cheaper route.
 *
 * ## Why the credit is fetched HERE and not passed in
 *
 * The ODbL credit is a licence obligation that must not be able to go missing from a page that
 * draws OSM-derived geometry. If the caller passed the string, a later edit could drop it and
 * nothing would break. Reading it inside the component means the chip travels with the figure
 * by construction — the same single-signal discipline `showMarine`/`marineBlocks` uses on the
 * province page. `locator-attribution.test.ts` pins it.
 *
 * The chip is IN ADDITION to the credit drawn inside the Türkiye base file itself
 * (`lib/map/base-map-svg.ts`): the drawn text answers "the file was opened on its own", the
 * chip answers "the image failed to load, or the reader is on the page". Two layers, two
 * failure modes, two tests.
 *
 * ## A11y
 *
 * The composite carries ONE accessible name (`role="img"` + `aria-label`) and both children
 * are hidden from assistive technology: a screen-reader user should hear "Van's location on
 * the map of Türkiye", not a base map and an unnamed path. The map is not interactive — there
 * is no link, so SEO-POLICY §A5's clickable-region rule does not apply — and the alt text
 * states the INFORMATION the figure carries rather than naming its type.
 */

export type LocatorKind = "province" | "country";

interface LocatorMapProps {
  kind: LocatorKind;
  locale: Locale;
  /** The entity's own outline, straight from the committed artifact. */
  d: string;
  /** Localized alt text describing what the figure shows (SEO-POLICY §A5). */
  alt: string;
}

/** `{ viewBox, base file, rendered width }` per map, keyed by locale for the base file. */
const BASE_MAP = {
  province: {
    viewBox: MAP_VIEWBOX,
    src: { tr: "/maps/tr-provinces.svg", en: "/maps/tr-provinces.en.svg" },
  },
  country: {
    viewBox: WORLD_MAP_VIEWBOX,
    src: { tr: "/maps/world-countries.svg", en: "/maps/world-countries.en.svg" },
  },
} as const satisfies Record<LocatorKind, { viewBox: string; src: Record<Locale, string> }>;

/** Ring radius in viewBox units — comfortably larger than the threshold it marks. */
const RING_RADIUS_UNITS = 14;

/**
 * Desktop discovery without making the below-fold mobile image eager.
 *
 * The lower measured desktop case was 1440 × 722: the province locator starts 53 px inside
 * that viewport and the country locator 5 px below it. At 1440 × 900 and 1920 × 1080 the
 * locator is substantially visible. Mobile evidence puts it around y=1298 at 390 × 844.
 * These media floors therefore cover the measured desktop-LCP candidates and exclude the
 * measured mobile/off-screen layout without hydration or a client viewport branch.
 */
export const LOCATOR_DESKTOP_PRELOAD_MEDIA = "(min-width: 90rem) and (min-height: 45rem)";

function viewBoxBounds(viewBox: string): ShapeBounds {
  const [minX = 0, minY = 0, width = 0, height = 0] = viewBox.split(" ").map(Number);
  return { minX, minY, maxX: minX + width, maxY: minY + height, width, height };
}

export async function LocatorMap({ kind, locale, d, alt }: LocatorMapProps) {
  const map = BASE_MAP[kind];
  const bounds = viewBoxBounds(map.viewBox);
  const t = await getTranslations(kind === "province" ? "Map" : "WorldMap");

  // A locator ring, on the country map only and only where the highlight alone cannot be
  // found. The largest land piece answers both halves: its bounds decide whether to ring, and
  // a scan-line interior point positions the marker. Radius-aware clamping keeps the complete
  // circle visible at the date-line edge. Measured on the live seed: 101 of 199 countries
  // (51 %) take a ring under this reading, up from 92.
  const ringCenter = kind === "country" ? locatorRingCenter(d, bounds, RING_RADIUS_UNITS) : null;

  return (
    <>
      <link rel="preload" as="image" href={map.src[locale]} media={LOCATOR_DESKTOP_PRELOAD_MEDIA} />
      <figure className={styles.figure} data-kind={kind}>
        <div className={styles.frame} role="img" aria-label={alt}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9
              exception (→ DEC 2026-08-08a md.3): next/image cannot optimise SVG, and the CLS
              guarantee it exists to provide is held here by the explicit width/height plus the
              fixed aspect-ratio box on .frame. */}
          <img
            className={styles.base}
            src={map.src[locale]}
            alt=""
            width={bounds.width}
            height={bounds.height}
            loading="lazy"
            decoding="async"
          />
          <svg
            className={styles.overlay}
            viewBox={map.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            {/* `evenodd` matters on the world artifact (enclave holes are extra subpaths) and is
                a no-op on the Türkiye one, so it is set unconditionally rather than branched. */}
            <path className={styles.highlight} d={d} fillRule="evenodd" />
            {ringCenter !== null && (
              <circle
                className={styles.ring}
                cx={ringCenter.x}
                cy={ringCenter.y}
                r={RING_RADIUS_UNITS}
              />
            )}
          </svg>
        </div>
        {/* ODbL / Natural Earth credit. Visible without interaction, and it survives the image
            failing to load — which is the half of the obligation the drawn text cannot cover. */}
        <figcaption className={styles.credit}>{t("attribution")}</figcaption>
      </figure>
    </>
  );
}
