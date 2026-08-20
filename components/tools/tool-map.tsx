import { getTranslations } from "next-intl/server";
import { InlandWaterLayer } from "@/components/map/inland-water-layer";
import { MapZoomPan } from "@/components/map/map-zoom-pan";
import type { Locale } from "@/i18n/routing";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import type { ProvincePoint } from "@/lib/tools/province-points";
import mapStyles from "@/components/map/map.module.css";
import { ToolIslandLoader } from "./tool-island-loader";
import type { ProvinceArea, ToolMode } from "./tool-island";
import styles from "./tools.module.css";

/**
 * `id` prefix of this surface's shared `<defs>` geometry — prefixed per SURFACE
 * (`tr-map-` on `/turkiye`, `game-map-` on `/oyun`) because a `<use href>` resolves against
 * the whole document, not against its own `<svg>`.
 */
const SHAPE_ID_PREFIX = "tool-map-";

interface ToolMapProps {
  locale: Locale;
  /** Which tool the island renders on this page. */
  mode: ToolMode;
  /** The 81-province picker's options — the tool's pointer-free input path (SPEC §10.1). */
  provincePoints: readonly ProvincePoint[];
  /** Coordinate mode only: the provinces a placed point may be reported inside (SPEC §6.2). */
  provinceAreas?: readonly ProvinceArea[];
  /** File-name stem of the PNG this tool exports, e.g. `cografya-mesafe`. ASCII (SPEC §9.4). */
  downloadName: string;
}

/**
 * The measuring surface of a CBS tool page: the Türkiye map, server-rendered, WITHOUT the 81
 * province links.
 *
 * ## No `<a>` anywhere on this map, and that is structural (Atlas ruling AK-31/V-2)
 *
 * `/turkiye`'s map wraps every seeded province in a crawlable anchor; here a click PLACES A
 * POINT, and the two cannot share a surface. Guarding the conflict with `preventDefault`
 * would leave keyboard Enter, middle-click and ctrl-click navigating away from a
 * half-finished measurement, so the links are simply absent — the same answer
 * `components/game/game-map.tsx` reached, for the same reason, and its
 * `game-map.nav-guard.test.ts` docblock names the second reason too: a second crawlable link
 * cluster pointing at the same 81 URLs is a pattern to avoid, not a bonus. The province pages
 * are reached from `/turkiye` and from this page's prose (A4).
 *
 * ## What is server-rendered here
 *
 * Every outline, the inland water layer and the ODbL/JRC attribution — in the first response,
 * with JavaScript off. The island adds interaction on top and nothing else
 * (`ENGINEERING.md` §3, §4 #1).
 *
 * ## Three empty hooks the island fills, and why they are HERE
 *
 *  · `[data-tool-overlay]` is the LAST child of the `<svg>`, so the measurement line is drawn
 *    above the water layer, and it inherits the live `viewBox` — a point placed in map units
 *    pans and zooms with the map for free, with nothing to keep in sync;
 *  · `[data-tool-controls]` sits BELOW the map with its height reserved in CSS, so the
 *    controls appearing at hydration move nothing (CLS, `ENGINEERING.md` §4 #9);
 *  · `MapZoomPan` is rendered BEFORE the `<svg>` for the tab-order reason `/dunya` records,
 *    and it is what makes the precision rule visible: the scale bar and the displayed decimal
 *    both follow the current view (SPEC §6.4/§6.6).
 *
 * ## The one lookup this file must not break
 *
 * `MapZoomPan` finds the map it drives with `host.querySelector("svg")`, and so does the tool
 * island. Nothing inside `.mapRoot` may be an `<svg>` element except the map: that is why the
 * zoom cluster's reset mark is a CSS mask and why the scale bar and the controls are HTML.
 */
export async function ToolMap({
  locale,
  mode,
  provincePoints,
  provinceAreas,
  downloadName,
}: ToolMapProps) {
  const tMap = await getTranslations("Map");
  const tToolMap = await getTranslations("Tools.map");

  const titleId = "tool-map-title";
  const instructionsId = "tool-map-instructions";

  return (
    <>
      <div className={mapStyles.mapRoot} data-map-root>
        <MapZoomPan
          viewBox={MAP_VIEWBOX}
          instructionsId={instructionsId}
          labels={{
            zoomIn: tToolMap("zoomIn"),
            zoomOut: tToolMap("zoomOut"),
            reset: tToolMap("zoomReset"),
            instructions: tToolMap("zoomInstructions"),
            controls: tToolMap("zoomControls"),
          }}
        />

        <svg className={mapStyles.svg} viewBox={MAP_VIEWBOX} aria-labelledby={titleId}>
          <title id={titleId}>{tMap("mapTitle")}</title>

          {/* Classless geometry, once — a `<use>` clone takes the CSS that matched the
              REFERENCED element, and `vector-effect` is the one stroke property it cannot
              inherit from the `<use>` (the full measurement is in `turkey-map-section.tsx`).

              `data-plate-code` is what makes these outlines READABLE by the island's
              point-in-province lookup (SPEC §6.2) without either file knowing the other's `id`
              prefix, and without the 64 KB artifact being shipped a second time as JavaScript.
              It is emitted on all three tool pages rather than only the coordinate one: a
              conditional attribute would make the pages' server HTML diverge for no measurable
              saving — the name repeats 81 times and compresses to almost nothing. */}
          <defs>
            {PROVINCE_SHAPES.map((shape) => (
              <path
                key={shape.plateCode}
                id={`${SHAPE_ID_PREFIX}${shape.plateCode}`}
                data-plate-code={shape.plateCode}
                d={shape.d}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </defs>

          {/* ONE painted layer, not the three `/turkiye` needs: with no links there is no hit
              twin to carry a hover line and no state to paint. Every province takes the
              published `.province` fill — the `.provinceInert` tone means "no page yet" on
              the navigation map, and repeating it here would say something untrue about all
              81 of them. */}
          <g data-map-layer="base" className={mapStyles.mapBase} aria-hidden="true">
            {PROVINCE_SHAPES.map((shape) => (
              <use
                key={shape.plateCode}
                href={`#${SHAPE_ID_PREFIX}${shape.plateCode}`}
                className={mapStyles.province}
              />
            ))}
          </g>

          {/* Wrapped so the PNG export can find the water paths by NAME rather than by
              position. The layer itself is shared by four surfaces and is not opened for a
              consumer's convenience; a wrapper here costs one inert `<g>` and removes a
              structural selector that a future child would break silently. */}
          <g data-tool-water>
            <InlandWaterLayer />
          </g>

          {/* The island's portal target. Empty in the first response and inert to the
              pointer: every click on this map belongs to the map, and a point is removed from
              the list below it rather than by hitting a 6px dot. */}
          <g data-tool-overlay className={styles.overlay} aria-hidden="true" />
        </svg>

        <ToolIslandLoader
          mode={mode}
          provincePoints={provincePoints}
          provinceAreas={provinceAreas}
          downloadName={downloadName}
          baseViewBox={MAP_VIEWBOX}
        />

        {/* Keyboard-controls description the zoomable SVG points at via `aria-describedby`
            (set client-side by `MapZoomPan`). Visually hidden — the +/− buttons carry the
            sighted affordance. */}
        <p id={instructionsId} className={mapStyles.srOnly}>
          {tToolMap("zoomInstructions")}
        </p>

        {/* The SAME two obligations `/turkiye` carries, from the SAME message keys: this map
            draws the same OSM boundaries and the same JRC water layer, so no new attribution
            string is minted (SPEC §8.4, `plan-web.md` §9.3). `Source: EC JRC/Google` is the
            licensor's own wording — verbatim, never translated, in its own `lang="en"` span
            (→ DEC 2026-08-02q §F, WCAG 3.1.2). The real space between the two block spans is
            load-bearing: without it `textContent` welds the two licences into one run. */}
        <p className={mapStyles.attribution} data-tool-attribution>
          <span className={mapStyles.attributionLine}>{tMap("attribution")}</span>{" "}
          <span className={mapStyles.attributionLine}>
            {tMap("attributionJrcLabel")} <span lang="en">{tMap("attributionJrcEnglish")}</span>
          </span>
        </p>
      </div>

      {/* Height reserved in CSS so the island lands without moving the prose below it. The
          reserved box is the strip's EMPTY state; it grows only when the reader places a
          point, which is a user-initiated change and not a layout shift. */}
      <div className={styles.controlsSlot} data-tool-controls data-locale={locale} />
    </>
  );
}
