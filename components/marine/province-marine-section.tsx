import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarineConditions, MarineLayer } from "@/lib/api/types";
import { marinePointAnchorId } from "@/lib/marine/anchors";
import { maxGridDistanceKm, marineBlockValues } from "@/lib/marine/vintage";
import { ValueCell } from "./value-cell";
import { VintageLine } from "./vintage-line";
import styles from "./marine.module.css";

interface ProvinceMarineSectionProps {
  locale: Locale;
  /** The province's own name, for the heading. */
  provinceName: string;
  /** This province's value blocks, in the api's `displayOrder`. Never empty. */
  blocks: MarineConditions[];
  /** The measurement catalogue: every threshold and convention the cells read. */
  layers: MarineLayer[];
  /** `id` of this section's `<h2>`. */
  headingId: string;
}

/**
 * "{İl} açıklarında deniz durumu" — the marine section on a coastal province page (W2b).
 *
 * WHY IT SITS WHERE IT SITS. Directly under Temel Bilgiler, above the province's prose. The
 * visitor this section exists for arrived asking "Sinop'ta deniz kaç derece" and must not
 * have to scroll past a landform essay to find out; that is the province-page half of the
 * same user-first inversion `/deniz` took in W2a.
 *
 * THE LOCKED TWO-POINT POLICY, AS MARKUP. İstanbul, Çanakkale and Balıkesir publish two
 * reference points on two different seas. The two are NEVER filled from each other and the
 * province is NEVER suppressed because one of them is short of data: each block carries its
 * own values, its own five-render states and its own künye, under its own `coastLabel`
 * heading. The whole point is that they may legitimately disagree — İstanbul's Black Sea
 * point carries a wave height while its Marmara point carries `not_supported`, permanently,
 * because CMEMS publishes no wave field inside the Marmara at all.
 *
 * A single-point province opens NO `<h3>` layer. A sub-heading over the only block on the
 * page is a hierarchy with nothing to distinguish, and it would read as though a second block
 * were missing.
 *
 * WHY `<dl>` AND NOT THE HUB'S `<table>`. Three measured quantities for ONE entity is a
 * description list, not tabular data — there is no second row to compare against and no
 * column meaning to hold in your head. The hub's table earns its semantics with fifteen rows;
 * copying it here would give a screen-reader user a one-row table to navigate.
 *
 * WHAT IS DELIBERATELY NOT HERE. No chart (W2c owns the five-day series and the
 * `series.sourceDiffersNotice` that explains it, so the notice is not born yet — a fixed
 * string about a discrepancy between a chart and a headline number has no referent on a page
 * with no chart). No meta-description layer (A3: the post-M5 FENER round owns that). No
 * marine value in the page's JSON-LD, and no `dateModified` touched by marine freshness — the
 * province's content did not change because the wind did.
 */
export async function ProvinceMarineSection({
  locale,
  provinceName,
  blocks,
  layers,
  headingId,
}: ProvinceMarineSectionProps) {
  const t = await getTranslations("ProvinceDetail");
  const tm = await getTranslations("Marine");
  const format = await getFormatter();

  const layerById = new Map<MarineLayer["id"], MarineLayer>(
    layers.map((layer) => [layer.id, layer]),
  );
  const waveHeightLayer = layerById.get("wave_height");
  const waveDirectionLayer = layerById.get("wave_direction");
  const windSpeedLayer = layerById.get("wind_speed_10m");
  const windDirectionLayer = layerById.get("wind_direction_10m");
  const temperatureLayer = layerById.get("sea_surface_temperature");

  // The `<h3>` layer exists only to tell two blocks apart (see the block comment above).
  const labelled = blocks.length > 1;

  return (
    <section className="section" aria-labelledby={headingId}>
      <h2 id={headingId}>{t("marineHeading", { name: provinceName })}</h2>

      <div className={styles.provinceBlocks}>
        {blocks.map((block) => {
          const point = block.point;
          const label = locale === "en" ? point.coastLabelEn : point.coastLabelTr;
          const blockHeadingId = `${headingId}-${point.slugTr}`;
          const rowValues = marineBlockValues(block);
          const gridDistance = maxGridDistanceKm(rowValues);

          return (
            <div
              key={point.slugTr}
              className={styles.provinceBlock}
              // Grouped and named ONLY when there are two: that is when a screen-reader user
              // needs to know which sea the numbers they are hearing belong to. A group of
              // one, named after the only thing on offer, is noise.
              {...(labelled ? { role: "group" as const, "aria-labelledby": blockHeadingId } : {})}
            >
              {/* The province name is already in the `<h2>`; repeating it here would be
                  noise, which is exactly why the contract publishes a province-relative
                  `coastLabel` ("Marmara açıkları") alongside the standalone `nameTr`. */}
              {labelled && (
                <h3 id={blockHeadingId} className={styles.provinceBlockHeading}>
                  {label}
                </h3>
              )}

              <dl className={styles.provinceValues}>
                <div className={styles.provinceValue}>
                  <dt>{tm("values.colWind")}</dt>
                  <dd>
                    <ValueCell
                      magnitude={block.windSpeed10m}
                      magnitudeLayer={windSpeedLayer}
                      direction={block.windDirection10m}
                      directionLayer={windDirectionLayer}
                    />
                  </dd>
                </div>
                <div className={styles.provinceValue}>
                  <dt>{tm("values.colWave")}</dt>
                  <dd>
                    <ValueCell
                      magnitude={block.waveHeight}
                      magnitudeLayer={waveHeightLayer}
                      direction={block.waveDirection}
                      directionLayer={waveDirectionLayer}
                    />
                  </dd>
                </div>
                <div className={styles.provinceValue}>
                  <dt>{tm("values.colSeaTemperature")}</dt>
                  <dd>
                    {/* No direction pair: a temperature has no bearing, and the catalogue
                        carries no calm threshold for it, so no calm claim can be made. */}
                    <ValueCell
                      magnitude={block.seaSurfaceTemperature}
                      magnitudeLayer={temperatureLayer}
                    />
                  </dd>
                </div>
              </dl>

              {/* This block's OWN künye — one line per provider, absolute UTC, oldest instant
                  wins. Two points of one province can sit on two different model instants, so
                  a single section-wide line would be a small lie about one of them. */}
              <div className={styles.provinceVintage}>
                <VintageLine values={rowValues} />
                {gridDistance !== null && (
                  <p className={styles.provinceGrid}>
                    {tm("values.gridDistance", {
                      km: format.number(gridDistance, { maximumFractionDigits: 1 }),
                    })}
                  </p>
                )}
              </div>

              {/* Hub-and-spoke: straight to this point's own row in the four-sea table, using
                  the row ids `/deniz` has emitted since W2a (`lib/marine/anchors.ts`). */}
              <p className={styles.provinceHubLink}>
                <Link href={{ pathname: "/deniz", hash: marinePointAnchorId(point) }}>
                  {tm("hubLinkPoint", { label })}
                </Link>
              </p>
            </div>
          );
        })}
      </div>

      {/* The frozen `marine.straits.lowConfidence` key, born here with the surface it
          annotates. Shown for EVERY coastal province and written to be true of every one of
          them: "which provinces are strait provinces" is a geographic fact with no field in
          the contract, and hand-marking İstanbul and Çanakkale on the web side would create
          exactly the second source of geography this repo forbids. A per-province caution
          needs an api field (`straitsCaution`), which is a follow-up, not a guess. */}
      <p className={styles.provinceCaution}>{tm("straits.lowConfidence")}</p>

      <p className={styles.provinceHubLink}>
        <Link href="/deniz">{tm("hubLinkAll")}</Link>
      </p>
    </section>
  );
}
