import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LOCATOR_DESKTOP_PRELOAD_MEDIA } from "@/lib/map/locator-preload";
import { locatorRingCenter, type ShapeBounds } from "@/lib/map/shape-geometry";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";
import { WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";

/**
 * The locator mini-map: "where is this place", answered visually.
 *
 * ## Where it renders, measured rather than assumed
 *
 * ONE call site: the country detail page, `app/[locale]/(site)/dunya/[slug]/page.tsx`, with
 * `kind="country"`. The province detail page draws its own inline SVG (`V2ProvinceLocatorMap`)
 * and does not reach this file at all, so the `province` half of {@link LocatorKind} is
 * reachable code that no route renders — the same shape T-054 owns for the header combobox's
 * pre-V2 branch. It is converted faithfully rather than deleted, because deleting it would
 * change this component's `kind` contract and `locator-attribution.test.ts` pins both halves
 * of the `Map` / `WorldMap` namespace split.
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
 * explicit `width`/`height` plus a fixed aspect-ratio box, which is the same guarantee by a
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

/* ── Geometry and paint, hoisted so a test can read them ──────────────────────────────
 *
 * T-033 task 9 retired `locator-map.module.css`, the last CSS Module in the tree. Every
 * declaration below is that stylesheet's, translated; the constants are top-level so
 * `lib/test-support/converted-floor.ts`'s extractor can reach them, which it cannot do for a
 * value left inline on a `className`. `components/map/locator-map-floors.test.ts` pins them.
 *
 * ## The paint splits in two, and the split is the whole ruling of this conversion
 *
 * The base map is an isolated `<img>` document: it cannot see this page's CSS, so its ink is
 * literal hex written by `lib/map/base-map-svg.ts` and frozen in both themes — white land
 * (#ffffff), taupe hairlines (#8a8078) and, on the world file, its own painted sea (#dbe7e8).
 *
 * So the overlay's ink is measured against a backdrop that does NOT follow the theme, and a
 * theme-aware token there fails in whichever theme it was not chosen for. Measured with
 * `lib/theme/contrast.ts`, naming the backdrop each time:
 *
 *   FROZEN, which is what ships — the Terra terracotta re-exported by `@theme inline`:
 *     on the artifact's own white land   8.36 light · 8.36 dark
 *     on the artifact's painted sea      6.61 light · 6.61 dark
 *   THEME-AWARE, the tempting reading of the bridge table, in dark:
 *     on that same white land            2.08   — the highlight disappears into its neighbours
 *     on that same painted sea           1.64   — and into the water
 *
 * The ground under the artifact is frozen for the same reason and to the same token the world
 * file paints itself, so the rounded corners are sea rather than a strip of another palette
 * while the image loads. A theme-aware ground under this frozen ink measures 2.23 in dark
 * against the highlight's seaward edge (on `--background`) and 2.15 against the credit drawn
 * into the Türkiye file (on `--card`) — below WCAG 1.4.11's 3:1 for both. A dark-adapted
 * ARTIFACT is the fix, and it is T-031d's, with the other map surfaces
 * `components/ui/token-binding.test.ts` exempts for this exact reason.
 *
 * Everything OUTSIDE the artifact is ordinary page chrome and takes a bridge token: the
 * frame's hairline and the visible credit below it.
 */

/**
 * 460 px on the province figure, 560 px on the country one — the widths the readability
 * measurements in plan §4.2/§5.1 were taken at. Never wider: the base map is a shared file, so
 * a bigger figure buys no more detail, only more empty parchment. `min(100%, …)` and not a bare
 * cap, so the figure cannot push a 320 px viewport sideways.
 *
 * Neither cap binds at any swept viewport — the country column measures 238 px at 320 and
 * 438 px at 1440 — so this is a ceiling on a wider container, not a floor on this one.
 */
const FIGURE = {
  province: "m-0 w-[min(100%,460px)]",
  country: "m-0 w-[min(100%,560px)]",
} as const;

/**
 * The panel language of `/turkiye`: hairline, large radius, and the map's own sea behind the
 * artifact. The reader has usually just come from that map, so this reads as the same object at
 * another scale.
 *
 * The aspect ratio is set from the artifact's own viewBox by the `<img>`'s width/height
 * attributes below; stated here too so the box reserves its height before the file arrives
 * (CLS = 0, SEO §6 #9).
 *
 * MEASURED, so it is not re-derived: `box-sizing: border-box` + a fixed ratio constrains the
 * BORDER box here, so the content box is 1 px smaller on each side than the ratio implies. The
 * consequence was checked in a browser rather than argued from the spec — the UA sizes the
 * overlay `<svg>` as a replaced element from its own viewBox, so base and overlay land on
 * identical boxes. Re-measured 2026-09-19 on the one route that renders this, at the real
 * column width rather than at the cap the retired stylesheet's note assumed: 306.000 × 159.422
 * at a 390 px viewport and 436.000 × 227.141 at 1440, horizontal offset 0.0000 px, scale
 * difference 0.0000 %. Co-registration holds exactly.
 *
 * The base image is ~1 px taller than the content box and its bottom edge is clipped — that
 * lands in empty viewBox margin BELOW the drawn credit and clips the overlay by the same
 * amount, so nothing shifts relative to anything. Left as is deliberately: a content-box
 * sizing would resize every figure on 280 pages for no visible gain.
 *
 * The two rows differ in the ratio and in nothing else; the pin asserts that as an equality,
 * because a hairline or a radius that drifted on one kind alone would be invisible on a route
 * that only ever renders the other.
 *
 * ONE THING WAS NOT A STRAIGHT TRANSLATION, and it is named here rather than left for someone to
 * diff: the retired stylesheet gave the frame a
 * `linear-gradient(180deg, var(--color-surface), var(--color-bg))` parchment wash and overrode it
 * to the map's sea for `country` ONLY. Both rows now take the sea, so the PROVINCE figure lost
 * that gradient. It is deliberate and it is what the frozen-ground ruling above is about: those
 * two tokens are the theme-aware pair, and a theme-aware ground under this frozen ink is the
 * 2.23 / 2.15 pair — while `app/globals.css` carries no frozen parchment token to keep it at,
 * and the Türkiye artifact paints no sea of its own, so the frame IS that map's ground. Nothing
 * renders the province kind today, so nothing regresses; T-054, which owns that branch, inherits
 * one ground for both kinds rather than two that could drift.
 */
const FRAME = {
  province:
    "relative block overflow-hidden rounded-[var(--radius-lg)] border border-border bg-[var(--map-sea)] aspect-[1000/429]",
  country:
    "relative block overflow-hidden rounded-[var(--radius-lg)] border border-border bg-[var(--map-sea)] aspect-[1000/521]",
} as const;

/** The shared base silhouette. */
const BASE = "block h-auto w-full";

/**
 * The highlight is drawn in the SAME coordinate space as the base file, so the two are
 * co-registered by construction — the overlay is stacked exactly on top, never scaled
 * independently.
 */
const OVERLAY = "absolute inset-0 block h-auto w-full";

/**
 * The entity's own outline. Colour is ONE of the two signals: the second is the heavier stroke,
 * so the highlight is not carried by hue alone (WCAG 1.4.1). The stroke keeps a constant device
 * width no matter how the figure is scaled, so a small country's outline does not thin away to
 * nothing.
 *
 * Frozen on purpose — see the ruling above. 8.36:1 against the artifact's white land and 6.61:1
 * against its painted sea, in both themes.
 */
const HIGHLIGHT =
  "fill-primary-dark stroke-primary-dark [stroke-width:2px] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]";

/**
 * Locator ring — country map only, and only under the measured size threshold
 * (`lib/map/shape-geometry.ts`). It marks WHERE to look; the fill inside it is the answer.
 * Germany is over the threshold and takes none, so this was measured on Malta.
 */
const RING =
  "fill-none stroke-primary-dark [stroke-width:1.5px] [vector-effect:non-scaling-stroke]";

/**
 * Visible licence credit. Inside the figure but OUTSIDE the frame, so it survives the image
 * failing to load — the state in which the credit drawn into the file itself is invisible.
 *
 * Real text, so it takes the bridge's muted ink rather than the frozen Terra one the stylesheet
 * read: 7.92 light / 7.79 dark against the `--card` surface this figure sits on, where the
 * retired token measured 7.92 light and **2.15 dark** on that same card.
 *
 * The size is spelled in rem rather than taken from a named step: the named one carries a
 * line-height the stylesheet never set (16 px against this 16.8 px), which would reflow the
 * caption on every country page.
 */
const CREDIT = "mt-1.5 text-[0.75rem] leading-[1.4] text-muted-foreground";

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
 * The page's fixed outer column starts at 1120 CSS px; the lower measured height remains
 * 720px. This includes the visible 1120–1439px desktop band (including 1366 × 768) while
 * excluding the below-fold 390 × 844 mobile layout. The shared pure policy is emitted as a
 * media query without hydration or a client viewport branch.
 */
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
      <figure className={FIGURE[kind]} data-kind={kind}>
        <div className={FRAME[kind]} role="img" aria-label={alt}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ENGINEERING.md §4 #9
              exception (→ DEC 2026-08-08a md.3): next/image cannot optimise SVG, and the CLS
              guarantee it exists to provide is held here by the explicit width/height plus the
              fixed ratio on the frame. */}
          <img
            className={BASE}
            src={map.src[locale]}
            alt=""
            width={bounds.width}
            height={bounds.height}
            loading="lazy"
            decoding="async"
          />
          <svg
            className={OVERLAY}
            viewBox={map.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            {/* `evenodd` matters on the world artifact (enclave holes are extra subpaths) and is
                a no-op on the Türkiye one, so it is set unconditionally rather than branched. */}
            <path className={HIGHLIGHT} d={d} fillRule="evenodd" />
            {ringCenter !== null && (
              <circle className={RING} cx={ringCenter.x} cy={ringCenter.y} r={RING_RADIUS_UNITS} />
            )}
          </svg>
        </div>
        {/* ODbL / Natural Earth credit. Visible without interaction, and it survives the image
            failing to load — which is the half of the obligation the drawn text cannot cover. */}
        <figcaption className={CREDIT}>{t("attribution")}</figcaption>
      </figure>
    </>
  );
}
