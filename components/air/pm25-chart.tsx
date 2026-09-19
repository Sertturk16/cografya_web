import { getFormatter, getTranslations } from "next-intl/server";
import { buildPm25ChartGeometry, PM25_AXIS_UNIT_DY } from "@/lib/air/pm25-scale";
import { PM25_DECIMALS, roundPm25 } from "@/lib/air/pm25-display";
import type { Pm25Annual } from "@/lib/api/types";

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
 * THE FIGURE IS A DATA SURFACE, AND IT IS THE ONE PART OF THIS SECTION T-033 DOES NOT
 * BIND TO THE THEME.
 *
 * Everything else in `components/air` moved from frozen raw Terra tokens onto the bridge
 * tokens, because those elements sit on `--card` and a frozen colour there is invisible in
 * dark (the headline value measured 1.14:1). The plot is the opposite case, and the reason
 * is the series, not taste:
 *
 *   - `--chart-pm25-line` (#4a3b6b) is the section's ONE data token. `docs/design.md` rule 1
 *     is "brand chrome never encodes data", so it may not be rebound to `text-primary` or to
 *     any other bridge token, and there is no dark-mode value for it — data tokens are
 *     declared once, in `:root`, deliberately outside the theme.
 *   - Measured with `lib/theme/contrast.ts`: that line is **9.86:1 on the white plot** and
 *     **1.73:1 on `--card`**. Painting the plot with `bg-card` would therefore take the one
 *     mark the figure exists to show from comfortably above WCAG 1.4.11's 3:1 floor for a
 *     graphical object to comfortably below it. A dark-adapted PM2.5 token would be the fix
 *     and it does not exist; inventing one here is out of scope.
 *
 * So the plot stays white in both themes — which is also what keeps it matching the climate
 * chart's own plot two sections up on the same page, the reason the deleted stylesheet gave
 * for the literal in the first place. Its scaffolding (gridlines, axis numbers, frame edge)
 * is drawn as ALPHAS OF `--color-ink` over that white ground rather than as bridge tokens:
 * a bridge token inside a frozen-white figure is the same defect as a frozen token on a
 * themed card, pointing the other way (`--foreground` is #e8f0f1 in dark — 1.16:1 on this
 * plot). The alphas reproduce the deleted rules to within an imperceptible delta and are
 * measured in `.superpowers/sdd/2026-09-19-t033-css-modules/task-3-report.md`.
 *
 * Scaffolding is not an encoding: ink on a plot says nothing about a value, so rule 1 is not
 * in play. Only the polyline, the markers and the unit caption carry the data token.
 */
/** The plot: a frozen white data ground, sized by aspect ratio so it reserves space pre-paint. */
const FRAME = "max-w-[720px] aspect-[720/300] rounded-lg p-1 bg-white border border-ink/15";
/** Horizontal tick gridlines and the strong per-year hairlines. */
const GRID = "stroke-ink/15 [stroke-width:1]";
/** The quiet per-year hairline: the deleted rule's 0.6 width and 0.55 opacity, as one alpha. */
const GRID_YEAR = "stroke-ink/8 [stroke-width:0.6]";
/** The ONE series. Data token, never a bridge token (see the docblock). */
const LINE =
  "fill-none stroke-[var(--chart-pm25-line)] [stroke-width:2.6] [stroke-linejoin:round] [stroke-linecap:round]";
const MARKER = "fill-[var(--chart-pm25-line)]";
/**
 * Axis text. The SVG scales with its frame, so in-viewBox px are NOT CSS px: at 390px the
 * frame is ~350px wide and the 720-unit viewBox scales ~0.49x, rendering 15px axis text at
 * ~7px. The axis numbers are load-bearing under the per-province auto-scaled axis (DEC
 * 2026-08-20c md.2), so they scale up on narrow viewports — the climate chart's measured fix,
 * at the same breakpoint and for the same reason.
 */
const AXIS = "font-sans fill-ink/80 text-[15px] max-[700px]:text-[19px]";
const AXIS_LABEL_LEFT = `${AXIS} [text-anchor:end]`;
/** The unit caption is the series' own name, so it takes the series' own colour. */
const AXIS_UNIT = `${AXIS} [text-anchor:end] font-bold fill-[var(--chart-pm25-line)]`;
const YEAR_LABEL = `${AXIS} [text-anchor:middle]`;

/**
 * The long-term PM2.5 chart — a build-time inline-SVG line chart (server component, NO
 * `"use client"`, NO chart library — the house pattern, `components/climate/climate-chart.tsx`
 * precedent). Fixed `viewBox` + a CSS `aspect-ratio` frame reserve the space before paint →
 * zero CLS; zero client JS → zero INP (`ENGINEERING.md` §4 #9).
 *
 * The frame is CAPPED AT THE viewBox WIDTH, and that is a measured choice rather than a
 * leftover. The full 1080px content column was tried and rejected on rendered frames for two
 * reasons: the viewBox then scales 1.5x, so 15-unit axis text prints LARGER than the page's
 * own body copy; and every other block in this section caps at 78ch (~700px), so a 1080px
 * chart would be the only thing in it reaching the column edge. At 720 the section reads as
 * one measure, and the chart matches the width the climate chart's own flex row resolves to
 * (~690px) — two charts on one page at one size. This is NOT the UX tour's D2 dead space:
 * there the table stopped at 560px while the grid below it filled 1080, giving one page two
 * rhythms. Here the whole section is one width.
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
 *
 * **The axis does not start at zero, and that is why every tick is labelled.** Its floor is
 * the province's own minimum rounded down (`lib/air/pm25-scale.ts` carries the rule and the
 * measurement); a truncated axis exaggerates variation, so the floor is drawn and printed
 * exactly like every other tick — the tick loop below is what stops this chart from reading
 * as a zero-based one, and dropping the first label would be a correctness regression, not a
 * tidy-up. The magnitude itself is carried in words and figures: the value line, the
 * `<desc>` sentence naming the min and the max, and the year table.
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
    <figure className="m-0">
      <div className={FRAME}>
        <svg
          className="block h-full w-full"
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
              className={GRID}
              x1={geometry.plot.x0}
              x2={geometry.plot.x1}
              y1={axisTick.y}
              y2={axisTick.y}
            />
          ))}

          {/* One vertical hairline per YEAR, so the 27 readings are countable as positions
              even where the axis prints no label. The labelled years read slightly stronger
              so the eye can anchor a reading to a printed year without counting. */}
          {geometry.points.map((point) => (
            <line
              key={`vgrid-${point.year}`}
              className={point.labelled ? GRID : GRID_YEAR}
              x1={point.x}
              x2={point.x}
              y1={geometry.plot.y0}
              y2={geometry.plot.y1}
            />
          ))}

          <polyline className={LINE} points={geometry.line} />

          {/* Dots on the first, last, lowest and highest years only — 27 markers would be
              noise, and these four are exactly the years the <desc> names. */}
          {geometry.points
            .filter((point) => point.marker)
            .map((point) => (
              <circle
                key={`pt-${point.year}`}
                className={MARKER}
                cx={point.x}
                cy={point.y}
                r={2.8}
              />
            ))}

          {/* Left axis: concentration tick numbers — EVERY tick, floor included. The floor
              is not zero (see the header), so this is the label that tells the reader which
              range they are looking at. */}
          {geometry.ticks.map((axisTick) => (
            <text
              key={`tl-${axisTick.value}`}
              className={AXIS_LABEL_LEFT}
              x={geometry.plot.x0 - 6}
              y={axisTick.y + 4}
            >
              {tick(axisTick.value)}
            </text>
          ))}

          {/* Unit caption, parked in the top margin above the highest tick number (the
              climate chart's measured fix for mobile overprinting). */}
          <text
            className={AXIS_UNIT}
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
                className={YEAR_LABEL}
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
