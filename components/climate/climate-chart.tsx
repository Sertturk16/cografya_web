import { getFormatter, getTranslations } from "next-intl/server";
import type { Climate } from "@/lib/api/types";
import { AXIS_UNIT_DY, buildClimateChartGeometry } from "@/lib/climate/scale";
import styles from "./climate.module.css";

interface ClimateChartProps {
  climate: Climate;
  /** Province display name (proper noun, TR) — woven into the SVG title/desc. */
  provinceName: string;
  /** Unique id suffix (plaka kodu) so title/desc ids never collide across a page. */
  idSuffix: string;
}

/** A localized short/long month name via the formatter — no hardcoded month strings
 *  (day 15 avoids any TZ edge shifting the month). */
function monthName(
  format: Awaited<ReturnType<typeof getFormatter>>,
  month: number,
  style: "short" | "long",
): string {
  return format.dateTime(new Date(Date.UTC(2020, month - 1, 15)), { month: style });
}

/**
 * Province climate chart — a build-time inline-SVG climograph (server component, NO
 * `"use client"`, NO chart library — the house SVG pattern, `turkey-map-section.tsx`
 * precedent). The fixed `viewBox` + a CSS `aspect-ratio` frame reserve the space →
 * zero CLS; zero client JS → zero INP (CONVENTIONS §6 #9).
 *
 * Three series, distinguished by SHAPE (never color alone, DESIGN §6.1.3): precipitation
 * as `<rect>` columns, mean temperature as a bold `<polyline>`, the monthly max–min
 * spread as a light band. Because the axes auto-scale PER province (owner ruling 6), the
 * printed axis numbers, the `<desc>` ranges, and the annual summary beside the chart are
 * LOAD-BEARING — they are what lets a reader tell arid Konya from soaked Rize when the two
 * chart *shapes* look alike. The authoritative monthly numbers live in the always-visible
 * `<table>` (ClimateTable) — this chart is the visual summary of them.
 */
export async function ClimateChart({ climate, provinceName, idSuffix }: ClimateChartProps) {
  const t = await getTranslations("Climate");
  const format = await getFormatter();
  const g = buildClimateChartGeometry(climate.months);
  const d = climate.derived;

  const num = (value: number, digits = 1) =>
    format.number(value, { maximumFractionDigits: digits });
  /** Locale-correct percent (TR "%29", EN "29%") — never a hardcoded "%" glyph, whose
   *  position differs between the two locales. */
  const pct = (value: number) =>
    format.number(value / 100, { style: "percent", maximumFractionDigits: 0 });

  // Real DATA ranges (not the padded axis domain) for the honest <desc> text.
  // The sentence says "aylık ORTALAMA sıcaklık", so these must come from `tempMeanC` —
  // NOT the mean-low/mean-high envelope (tempMinMeanC/tempMaxMeanC), which would announce
  // a wider range than the one it names (Rize: real 6,8–23,3 °C vs envelope 3,7–26,6 °C).
  // The envelope is described separately, in words, by the desc's third sentence.
  const meanVals = climate.months.map((m) => m.tempMeanC).filter((v): v is number => v !== null);
  const precipVals = climate.months
    .map((m) => m.precipitationMm)
    .filter((v): v is number => v !== null);
  const tempMinData = meanVals.length ? Math.min(...meanVals) : d.annualMeanTempC;
  const tempMaxData = meanVals.length ? Math.max(...meanVals) : d.annualMeanTempC;
  // The precipitation floor is COMPUTED, never assumed to be 0 — Rize's driest month is
  // 96,5 mm, and a hardcoded "0" would erase the arid-vs-humid distinction the <desc>
  // exists to carry under the per-province auto-scaled axes (owner ruling 6).
  const precipMinData = precipVals.length ? Math.min(...precipVals) : 0;
  const precipMaxData = precipVals.length ? Math.max(...precipVals) : 0;

  const titleId = `climate-chart-title-${idSuffix}`;
  const descId = `climate-chart-desc-${idSuffix}`;

  const desc = t("chartDesc", {
    tempMin: num(tempMinData),
    tempMax: num(tempMaxData),
    precipMin: num(precipMinData, 0),
    precipMax: num(precipMaxData, 0),
    hottest: monthName(format, d.hottestMonth, "long"),
    coldest: monthName(format, d.coldestMonth, "long"),
    wettest: monthName(format, d.wettestMonth, "long"),
    driest: monthName(format, d.driestMonth, "long"),
  });

  return (
    <figure className={styles.chartFigure}>
      <div className={styles.chartLayout}>
        <div className={styles.chartFrame}>
          <svg
            className={styles.svg}
            viewBox={`0 0 ${g.width} ${g.height}`}
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <title id={titleId}>{t("chartTitle", { name: provinceName })}</title>
            <desc id={descId}>{desc}</desc>

            {/* Temperature gridlines (one per left-axis tick); the 0 °C line is drawn
                heavier so a freezing reference reads at a glance. */}
            {g.tempTicks.map((tick) => (
              <line
                key={`grid-${tick.value}`}
                className={tick.value === 0 ? styles.gridZero : styles.grid}
                x1={g.plot.x0}
                x2={g.plot.x1}
                y1={tick.y}
                y2={tick.y}
              />
            ))}

            {/* Max–min band (light warm, supplementary — exact values are in the table).
                Drawn first so the opaque precipitation bars sit cleanly in front of it. */}
            {g.bandPath && <path className={styles.tempBand} d={g.bandPath} />}

            {/* Precipitation columns (cool) — grow from the precip 0 baseline. */}
            {g.columns.map(
              (col) =>
                col.bar && (
                  <rect
                    key={`bar-${col.month}`}
                    className={styles.precipBar}
                    x={col.bar.x}
                    y={col.bar.y}
                    width={col.bar.w}
                    height={col.bar.h}
                  />
                ),
            )}

            {/* Mean-temp polyline(s) (bold warm) + point markers. */}
            {g.meanRuns.map((points, i) => (
              <polyline key={`mean-${i}`} className={styles.tempLine} points={points} />
            ))}
            {g.columns.map(
              (col) =>
                col.meanPoint && (
                  <circle
                    key={`pt-${col.month}`}
                    className={styles.tempMarker}
                    cx={col.meanPoint.x}
                    cy={col.meanPoint.y}
                    r={2.6}
                  />
                ),
            )}

            {/* Left axis: temperature tick numbers (°C). */}
            {g.tempTicks.map((tick) => (
              <text
                key={`tl-${tick.value}`}
                className={styles.axisLabelLeft}
                x={g.plot.x0 - 6}
                y={tick.y + 4}
              >
                {num(tick.value, 0)}
              </text>
            ))}
            {/* Right axis: precipitation tick numbers (mm). */}
            {g.precipTicks.map((tick) => (
              <text
                key={`tr-${tick.value}`}
                className={styles.axisLabelRight}
                x={g.plot.x1 + 6}
                y={tick.y + 4}
              >
                {num(tick.value, 0)}
              </text>
            ))}

            {/* Axis unit captions — parked in the top margin, AXIS_UNIT_DY above the plot
                edge, so their glyph box clears the topmost tick number's at every
                viewport (review I3: they overprinted it on mobile at the old offset). */}
            <text className={styles.axisUnit} x={g.plot.x0 - 6} y={g.plot.y0 - AXIS_UNIT_DY}>
              {t("axisTempUnit")}
            </text>
            <text className={styles.axisUnitRight} x={g.plot.x1 + 6} y={g.plot.y0 - AXIS_UNIT_DY}>
              {t("axisPrecipUnit")}
            </text>

            {/* Month labels under each column. */}
            {g.columns.map((col) => (
              <text
                key={`m-${col.month}`}
                className={styles.monthLabel}
                x={col.cx}
                y={g.plot.y1 + 18}
              >
                {monthName(format, col.month, "short")}
              </text>
            ))}
          </svg>
        </div>

        {/* Annual summary — real DOM text (always legible, the robust cross-province
            comparison surface). All figures are the api's DERIVED values, consumed
            as-is (never recomputed). */}
        <dl className={styles.summary}>
          <div className={styles.summaryItem}>
            <dt>{t("annualMeanTemp")}</dt>
            <dd>{num(d.annualMeanTempC)} °C</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>{t("annualPrecip")}</dt>
            <dd>{num(d.annualPrecipitationMm, 0)} mm</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>{t("annualTempRange")}</dt>
            <dd>{num(d.annualTempRangeC)} °C</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>{t("hottestMonth")}</dt>
            <dd>{monthName(format, d.hottestMonth, "long")}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>{t("coldestMonth")}</dt>
            <dd>{monthName(format, d.coldestMonth, "long")}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>{t("wettestMonth")}</dt>
            <dd>{monthName(format, d.wettestMonth, "long")}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>{t("driestMonth")}</dt>
            <dd>{monthName(format, d.driestMonth, "long")}</dd>
          </div>
          <div className={styles.summarySeasons}>
            <dt>{t("seasonalHeading")}</dt>
            <dd>
              {t("seasonWinter")} {pct(d.seasonalPrecipitation.winterPct)} · {t("seasonSpring")}{" "}
              {pct(d.seasonalPrecipitation.springPct)} · {t("seasonSummer")}{" "}
              {pct(d.seasonalPrecipitation.summerPct)} · {t("seasonAutumn")}{" "}
              {pct(d.seasonalPrecipitation.autumnPct)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Legend — shape-coded swatches (bars / band / line), reinforcing the
          shape-not-color distinction. */}
      <figcaption className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchPrecip}`} aria-hidden="true" />
          {t("legendPrecip")}
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchLine}`} aria-hidden="true" />
          {t("legendTemp")}
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchBand}`} aria-hidden="true" />
          {t("legendTempBand")}
        </span>
      </figcaption>
    </figure>
  );
}
