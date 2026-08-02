import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarineLayer, MarineOverviewPoint, ProvinceListItem } from "@/lib/api/types";
import { marinePointAnchorId } from "@/lib/marine/anchors";
import { MODEL_INSTANT_FORMAT } from "@/lib/marine/model-run";
import { marineBlockValues, maxGridDistanceKm, oldestValidAt } from "@/lib/marine/vintage";
import { ValueCell } from "./value-cell";
import styles from "./marine.module.css";

interface BasinValuesTableProps {
  locale: Locale;
  /** The basin's own heading, read off its points' `coastLabel*` (never a web-side table). */
  basinLabel: string;
  /** The basin's value blocks, in the api's coastal-traverse order. */
  blocks: MarineOverviewPoint[];
  /** Catalogue rows by id — the source of every threshold and convention below. */
  layerById: Map<MarineLayer["id"], MarineLayer>;
  /** Published provinces by plaka, for the row-header link. */
  provincesByPlate: Map<string, ProvinceListItem>;
}

/**
 * One sea's value table: a real `<table>`, one row per reference point, four measured
 * columns and the row's own künye.
 *
 * WHY A TABLE AND NOT THE W1a LIST. The list held one fact per point (its name, linked). A
 * row now holds five, and five facts per entity across thirty entities is the definition of
 * tabular data — a `<dl>` or nested `<ul>` would force a screen-reader user to hold the
 * column meaning in their head down the whole basin. The proven pattern from the measurement
 * catalogue is reused wholesale: `<caption>`, `<th scope="col">`, a `<th scope="row">` row
 * header, and a named, keyboard-reachable horizontal scroll region.
 *
 * NO INTERNAL LINK IS LOST IN THE CONVERSION. The point's province link moves into the row
 * header, so the hub still emits its thirty descriptive anchors into twenty-seven province
 * pages (`SEO-POLICY.md` §A4). A point whose province has no published page stays plain
 * text, never a link that would 404.
 *
 * EVERY THRESHOLD AND CONVENTION IS READ FROM `layerById`. There is no calm value, no
 * direction meaning and no grid resolution written down in this component: all three are
 * provider product decisions the api publishes and can change without us.
 */
export async function BasinValuesTable({
  locale,
  basinLabel,
  blocks,
  layerById,
  provincesByPlate,
}: BasinValuesTableProps) {
  const tm = await getTranslations("Marine");
  const format = await getFormatter();

  const waveHeightLayer = layerById.get("wave_height");
  const waveDirectionLayer = layerById.get("wave_direction");
  const windSpeedLayer = layerById.get("wind_speed_10m");
  const windDirectionLayer = layerById.get("wind_direction_10m");
  const temperatureLayer = layerById.get("sea_surface_temperature");

  return (
    <div
      className={styles.tableScroll}
      role="region"
      aria-label={tm("values.scrollRegionLabel", { basin: basinLabel })}
      tabIndex={0}
    >
      <table className={styles.valuesTable}>
        <caption className={styles.caption}>{tm("values.caption", { basin: basinLabel })}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.th}>
              {tm("values.colPoint")}
            </th>
            <th scope="col" className={styles.th}>
              {tm("values.colWind")}
            </th>
            <th scope="col" className={styles.th}>
              {tm("values.colWave")}
            </th>
            <th scope="col" className={styles.th}>
              {tm("values.colSeaTemperature")}
            </th>
            <th scope="col" className={styles.th}>
              {tm("values.colVintage")}
            </th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => {
            const point = block.point;
            const name = locale === "en" ? point.nameEn : point.nameTr;
            const province = provincesByPlate.get(point.plateCode);
            const rowValues = marineBlockValues(block);
            const validAt = oldestValidAt(rowValues);
            const gridDistance = maxGridDistanceKm(rowValues);

            // The row id is what the 27 province marine sections link INTO (W2b), so it is
            // derived from the shared anchor module rather than assembled here — see
            // `lib/marine/anchors.ts` for why a template literal on each side is not enough.
            return (
              <tr key={point.slugTr} id={marinePointAnchorId(point)}>
                <th scope="row" className={styles.thRow}>
                  {province ? (
                    // The anchor text is the point's own name ("Kocaeli Açıkları"), which
                    // contains the target province's name — descriptive, never "buraya".
                    <Link
                      href={{
                        pathname: "/turkiye/[slug]",
                        params: { slug: locale === "en" ? province.slugEn : province.slugTr },
                      }}
                    >
                      {name}
                    </Link>
                  ) : (
                    <span className={styles.pointPlain}>{name}</span>
                  )}
                </th>
                <td className={styles.tdValue}>
                  <ValueCell
                    magnitude={block.windSpeed10m}
                    magnitudeLayer={windSpeedLayer}
                    direction={block.windDirection10m}
                    directionLayer={windDirectionLayer}
                  />
                </td>
                <td className={styles.tdValue}>
                  <ValueCell
                    magnitude={block.waveHeight}
                    magnitudeLayer={waveHeightLayer}
                    direction={block.waveDirection}
                    directionLayer={waveDirectionLayer}
                  />
                </td>
                <td className={styles.tdValue}>
                  {/* No direction pair: a temperature has no bearing, and the catalogue
                      carries `calmThreshold: null` for it, so no calm claim can be made. */}
                  <ValueCell
                    magnitude={block.seaSurfaceTemperature}
                    magnitudeLayer={temperatureLayer}
                  />
                </td>
                <td className={styles.tdVintage}>
                  {validAt !== null && (
                    <span className={styles.vintageInstant}>
                      {tm("values.validAt", {
                        value: format.dateTime(validAt, MODEL_INSTANT_FORMAT),
                      })}
                    </span>
                  )}
                  {/* The O3 follow-up: the offset to the model grid centre, now readable
                      from the payload. Stated as a BOUND and only when the api reports one —
                      the contract is explicit that this is an in-cell offset, so it must not
                      read like a "data is far away" warning. */}
                  {gridDistance !== null && (
                    <span className={styles.vintageGrid}>
                      {tm("values.gridDistance", {
                        km: format.number(gridDistance, { maximumFractionDigits: 1 }),
                      })}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
