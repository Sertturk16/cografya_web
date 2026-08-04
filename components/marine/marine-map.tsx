import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { byPlateCode } from "@/lib/api/provinces";
import type { MarinePointListItem, ProvinceListItem } from "@/lib/api/types";
import {
  DEFAULT_LABEL_LAYOUT,
  frameForLabelledPoints,
  placePointLabels,
  type LabelledPointInput,
} from "@/lib/map/point-labels";
import { formatViewBox, parseViewBox, projectToMapPoint } from "@/lib/map/projection";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { InlandWaterLayer } from "@/components/map/inland-water-layer";
import styles from "./marine.module.css";

interface MarineMapProps {
  locale: Locale;
  points: MarinePointListItem[];
  /** The published provinces — the source of each marker's short label. */
  provinces: ProvinceListItem[];
}

const TITLE_ID = "deniz-map-title";
const DESC_ID = "deniz-map-desc";

/**
 * The 30 offshore reference points, drawn on the Türkiye map (W1b).
 *
 * WHAT IT IS. A server-rendered inline SVG — the same build-time artifact the `/turkiye`
 * hub and the game draw (`lib/map/tr-provinces.generated.ts`, raw GeoJSON never ships,
 * SPEC §5.2 / DEC 2026-07-10). No client component, no zoom, no pan, no fetch: the markup
 * is complete in the first response, so it costs one paint and zero INP.
 *
 * WHAT IT IS NOT. It renders no VALUE — no wind speed, no wave height, no sea-surface
 * temperature, no direction arrow. Those endpoints are frozen in the contract but not
 * mounted until M4, and a marker sized, coloured or rotated by a number we do not have
 * would be an invention. Every marker here is identical on purpose: the map answers
 * "WHERE are the 30 points", nothing else.
 *
 * HOW THE POINTS LAND IN THE RIGHT PLACE. `projectToMapPoint` replays the generator's own
 * projection constants (`MAP_PROJECTION`, emitted by `scripts/generate-map-paths.mjs`), so
 * the markers share one coordinate space with the province outlines. Those constants are
 * generated rather than hand-copied precisely so a refreshed ODbL snapshot cannot leave a
 * stale copy behind — `pnpm generate:map:check` fails on drift.
 *
 * WHY THE FRAME IS WIDER THAN `MAP_VIEWBOX`. The points sit OFFSHORE, i.e. outside the
 * landmass bounding box the projection was framed on, and their labels are pushed further
 * out still. `frameForLabelledPoints` widens the viewBox to contain everything, so nothing
 * is ever clipped at the panel edge. The extra margin reads as open water, which is what
 * it is.
 *
 * LABEL TEXT. Each marker is labelled with its PROVINCE name, not the point's full name.
 * "Kocaeli" is legible at map scale; "Kocaeli Açıkları" repeated thirty times is not a map,
 * it is a word cloud — and the word "Açıkları" carries no information once the section
 * heading and the hint sentence have established that every point is offshore. The full
 * name stays one hover (and one screen-reader stop) away as the marker's `<title>`, and the
 * complete list with its province links sits directly below. İstanbul, Çanakkale and
 * Balıkesir each appear twice because they genuinely own two points on two different seas —
 * that duplication is the lesson, not a defect.
 */
export async function MarineMap({ locale, points, provinces }: MarineMapProps) {
  const t = await getTranslations("Marine");
  const tMap = await getTranslations("Map");

  const provincesByPlate = byPlateCode(provinces);
  const base = parseViewBox(MAP_VIEWBOX);

  /** Marker geometry + the short visible label, in the api's coastal-traverse order. */
  const inputs: LabelledPointInput[] = [];
  /** The full accessible name for each marker, keyed the same way. */
  const accessibleNames = new Map<string, string>();

  for (const point of [...points].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const { x, y } = projectToMapPoint(point.longitude, point.latitude);
    const fullName = locale === "en" ? point.nameEn : point.nameTr;
    const coast = locale === "en" ? point.coastLabelEn : point.coastLabelTr;
    // Province names are identical in both locales (Turkish proper nouns), so the api's
    // list DTO carries only `nameTr`. Falling back to the point's own full name keeps an
    // unpublished province labelled rather than anonymous.
    const province = provincesByPlate.get(point.plateCode);
    inputs.push({ key: point.slugTr, label: province?.nameTr ?? fullName, x, y });
    accessibleNames.set(point.slugTr, `${fullName} — ${coast}`);
  }

  if (base === null || inputs.length === 0) return null;

  const placed = placePointLabels(inputs, base);
  // A single non-finite coordinate would poison the whole union frame (`Math.min`/`Math.max`
  // propagate NaN) and emit a `viewBox` the browser rejects — which collapses the ENTIRE map
  // to the 150px default, not just one marker. The contract makes that unreachable
  // (`latitude`/`longitude` are non-nullable numbers), but the api response is trusted by
  // TYPE, not validated at runtime (`lib/api/client.ts` casts), so the frame falls back to
  // the base viewBox rather than taking the map down with it.
  const computed = formatViewBox(frameForLabelledPoints(base, placed));
  const frame = parseViewBox(computed) === null ? MAP_VIEWBOX : computed;

  return (
    <figure className={styles.mapFigure}>
      <div className={styles.mapRoot}>
        <svg
          className={styles.mapSvg}
          viewBox={frame}
          aria-labelledby={TITLE_ID}
          aria-describedby={DESC_ID}
        >
          <title id={TITLE_ID}>{t("map.title")}</title>
          <desc id={DESC_ID}>{t("map.description", { count: points.length })}</desc>

          {/* Geographic backdrop only. The province outlines carry no link and no card on
              this page — the map's subject is the points, and 81 extra tab stops would
              bury the 30 that matter. AT reaches every province from `/turkiye`. */}
          <g aria-hidden="true">
            {PROVINCE_SHAPES.map((shape) => (
              <path key={shape.plateCode} className={styles.mapLand} d={shape.d} />
            ))}
          </g>

          {/* The lakes belong here more than anywhere else: this is the water page, and a
              Türkiye drawn without Van Gölü next to a section about seas is the exact gap the
              layer exists to close (→ DEC 2026-08-02k md. 4). Painted after the land, before
              the markers — a marker must never disappear under a lake. */}
          <InlandWaterLayer />

          {placed.map((item) => (
            // `role="img"` + a `<title>` child gives the marker ONE accessible name that is
            // also the browser's tooltip — the visible short label and the announced full
            // name can never drift apart, because there is only one string.
            <g key={item.key} className={styles.mapPoint} role="img">
              <title>{accessibleNames.get(item.key)}</title>
              {item.leader !== null && (
                <line
                  className={styles.mapLeader}
                  x1={item.leader.x1}
                  y1={item.leader.y1}
                  x2={item.leader.x2}
                  y2={item.leader.y2}
                />
              )}
              <circle
                className={styles.mapMarker}
                cx={item.x}
                cy={item.y}
                r={DEFAULT_LABEL_LAYOUT.markerRadius}
              />
              <text
                className={styles.mapLabel}
                x={item.labelX}
                y={item.labelY}
                textAnchor={item.anchor}
                fontSize={DEFAULT_LABEL_LAYOUT.fontSize}
              >
                {item.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Both source credits, required visibly next to the map (SPEC §5.2 / DEC 2026-07-10)
            — see components/map/turkey-map-section.tsx for the full note, including why the
            English licence string carries its own `lang="en"`. Same strings and same corner as
            every other TR-frame surface: one `Map` namespace. */}
        <p className={styles.mapAttribution}>
          {tMap("attribution")}
          <br />
          {tMap("attributionJrcLabel")} <span lang="en">{tMap("attributionJrcEnglish")}</span>
        </p>
      </div>
      <figcaption className={styles.mapCaption}>{t("map.caption")}</figcaption>
    </figure>
  );
}
