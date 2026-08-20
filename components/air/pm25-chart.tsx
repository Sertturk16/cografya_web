import { getFormatter, getTranslations } from "next-intl/server";
import { buildPm25ChartGeometry, PM25_AXIS_UNIT_DY } from "@/lib/air/pm25-scale";
import { PM25_DECIMALS, roundPm25 } from "@/lib/air/pm25-display";
import type { Pm25Annual } from "@/lib/api/types";
import styles from "./air-pollution.module.css";

interface Pm25ChartProps {
  pm25: Pm25Annual;
  /** Province display name (proper noun, TR) — woven into the SVG title/desc. */
  provinceName: string;
  /** Unique id suffix (plaka kodu) so title/desc ids never collide across a page. */
  idSuffix: string;
  /** The unit as the reader must see it, resolved once by the section. */
  displayUnit: string;
}

/**
 * The long-term PM2.5 chart — a build-time inline-SVG line chart (server component, NO
 * `"use client"`, NO chart library — the house pattern, `components/climate/climate-chart.tsx`
 * precedent). Fixed `viewBox` + a CSS `aspect-ratio` frame reserve the space before paint →
 * zero CLS; zero client JS → zero INP (`ENGINEERING.md` §4 #9).
 *
 * ## What is deliberately NOT here
 *
 * **No horizontal reference line, for the WHO guideline or for its interim targets**
 * (→ DEC 2026-08-20d md.1/md.2). This was ruled twice: the first ruling put the line in, and
 * the sourcing tour changed the ground under it. Two measured reasons, so nobody re-adds it
 * as an improvement: all 2 187 published values sit above 5 µg/m³ (lowest ever 10,4150), so
 * the line would cross no curve on any of the 81 pages; and forcing the axis to reach down to
 * it squeezed a narrow-range province's whole 27-year trend into a fraction of the chart
 * height, which is the very thing the per-province axis exists to protect. The value is given
 * as a plain sentence under the chart instead (`AirPollution.whoGuideline`).
 *
 * **No colour band, no green/yellow/red scale, no "good/moderate/poor" badge.** An annual
 * mean concentration is not an index, and EPA AQI / EEA EAQI bands are defined on short-term
 * concentrations. Painting one in the other's colours would claim an index membership this
 * number does not have — `DESIGN.md` §6.2's value violated from the opposite direction.
 *
 * ## Where the numbers actually live
 *
 * The chart is the visual summary. The authoritative figures are the always-visible value
 * line above it and the full year-by-year `<table>` below it, which is why the axis ticks
 * carry real numbers and the `<desc>` states the range in words: the axis auto-scales PER
 * province (→ DEC 2026-08-20c md.2), so two provinces' chart SHAPES are not comparable and
 * the printed numbers are what carry the comparison.
 */
export async function Pm25Chart({ pm25, provinceName, idSuffix, displayUnit }: Pm25ChartProps) {
  const t = await getTranslations("AirPollution");
  const format = await getFormatter();
  const geometry = buildPm25ChartGeometry(pm25.years);
  // Contract-legal but never observed: an empty series has no geometry to draw. The section
  // keeps its value line, its table and its licence block — see `buildPm25ChartGeometry`.
  if (geometry === null) return null;

  /** Years are STRINGS so ICU never group-separates them (1998, not 1.998). */
  const year = (value: number) => String(value);
  const value = (raw: number) =>
    format.number(roundPm25(raw), {
      minimumFractionDigits: PM25_DECIMALS,
      maximumFractionDigits: PM25_DECIMALS,
    });
  const tick = (raw: number) => format.number(raw, { maximumFractionDigits: 0 });

  const titleId = `pm25-chart-title-${idSuffix}`;
  const descId = `pm25-chart-desc-${idSuffix}`;

  return (
    <figure className={styles.chartFigure}>
      <div className={styles.chartFrame}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <title id={titleId}>
            {t("chartTitle", {
              name: provinceName,
              start: year(geometry.first.year),
              end: year(geometry.last.year),
            })}
          </title>
          {/* The text equivalent (WCAG 1.1.1). It names the SAME extreme years the chart
              marks with dots, because both come from one pass over the data in the scale
              module — a screen reader and the picture can never describe different years. */}
          <desc id={descId}>
            {t("chartDesc", {
              min: value(geometry.lowest.value),
              max: value(geometry.highest.value),
              unit: displayUnit,
              minYear: year(geometry.lowest.year),
              maxYear: year(geometry.highest.year),
              start: year(geometry.first.year),
              end: year(geometry.last.year),
            })}
          </desc>

          {/* Horizontal gridlines, one per axis tick. */}
          {geometry.ticks.map((axisTick) => (
            <line
              key={`grid-${axisTick.value}`}
              className={styles.grid}
              x1={geometry.plot.x0}
              x2={geometry.plot.x1}
              y1={axisTick.y}
              y2={axisTick.y}
            />
          ))}

          {/* One vertical hairline per YEAR, so the 27 readings are countable as positions
              even where the axis prints no label. */}
          {geometry.points.map((point) => (
            <line
              key={`vgrid-${point.year}`}
              className={point.labelled ? styles.gridYearStrong : styles.gridYear}
              x1={point.x}
              x2={point.x}
              y1={geometry.plot.y0}
              y2={geometry.plot.y1}
            />
          ))}

          <polyline className={styles.line} points={geometry.line} />

          {/* Dots on the first, last, lowest and highest years only — 27 markers would be
              noise, and these four are exactly the years the <desc> names. */}
          {geometry.points
            .filter((point) => point.marker)
            .map((point) => (
              <circle
                key={`pt-${point.year}`}
                className={styles.marker}
                cx={point.x}
                cy={point.y}
                r={2.8}
              />
            ))}

          {/* Left axis: concentration tick numbers. */}
          {geometry.ticks.map((axisTick) => (
            <text
              key={`tl-${axisTick.value}`}
              className={styles.axisLabelLeft}
              x={geometry.plot.x0 - 6}
              y={axisTick.y + 4}
            >
              {tick(axisTick.value)}
            </text>
          ))}

          {/* Unit caption, parked in the top margin above the highest tick number (the
              climate chart's measured fix for mobile overprinting). */}
          <text
            className={styles.axisUnit}
            x={geometry.plot.x0 - 6}
            y={geometry.plot.y0 - PM25_AXIS_UNIT_DY}
          >
            {displayUnit}
          </text>

          {/* Year labels under the axis — first, last and the spaced multiples of five the
              scale module selected from the payload's own years. */}
          {geometry.points
            .filter((point) => point.labelled)
            .map((point) => (
              <text
                key={`yr-${point.year}`}
                className={styles.yearLabel}
                x={point.x}
                y={geometry.plot.y1 + 20}
              >
                {year(point.year)}
              </text>
            ))}
        </svg>
      </div>
    </figure>
  );
}
