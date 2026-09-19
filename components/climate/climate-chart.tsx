import { getFormatter, getTranslations } from "next-intl/server";
import type { Climate } from "@/lib/api/types";
import { monthName } from "@/lib/climate/month";
import { AXIS_UNIT_DY, buildClimateChartGeometry } from "@/lib/climate/scale";

/**
 * THE PLOT IS A DATA SURFACE, AND IT IS THE ONE PART OF THIS COMPONENT T-033 DOES NOT BIND
 * TO THE THEME — plus one hazard the PM2.5 chart did not have.
 *
 * ## Why the plot stays white (the precedent, adopted rather than re-litigated)
 *
 * `docs/design.md`'s data-viz section records the ruling T-033 task 3 measured on
 * `components/air/pm25-chart.tsx`, and this chart is the same shape: two data tokens
 * (`--chart-temp-line`, `--chart-precip-bar`) declared once in `:root`, deliberately outside
 * the theme, because `docs/design.md` rule 1 is "brand chrome never encodes data". Measured
 * here with `lib/theme/contrast.ts`, on the two grounds the frame could take:
 *
 *   |                      | white plot | dark `--card` |
 *   | -------------------- | ---------- | ------------- |
 *   | `--chart-temp-line`  | 5.18:1     | 3.29:1        |
 *   | `--chart-precip-bar` | 6.88:1     | **2.47:1**    |
 *
 * Painting the frame `bg-card` would put the precipitation columns — half the figure — under
 * WCAG 1.4.11's 3:1 floor for a graphical object, and the temperature line within 0.29 of it.
 * So the frame keeps the literal white the deleted stylesheet gave it, for the reason that
 * stylesheet gave: it matches the PM2.5 plot two sections down the same page. The real fix is
 * a dark half for the three `--chart-*` tokens and it belongs to whoever owns
 * `app/globals.css`, not to this task.
 *
 * ## Why the scaffolding is `ink-dark`, and NOT `ink` like the PM2.5 chart
 *
 * A bridge token inside a frozen-white figure fails the other way — dark `--foreground` is
 * 1.16:1 on this plot and dark `--muted-foreground` 2.19:1 — so gridlines, axis numbers and
 * the frame edge are drawn as ALPHAS OF A FROZEN NEUTRAL over that white ground. `pm25-chart.tsx`
 * uses `--color-ink` for this. **That spelling is unsafe here.** `app/globals.css` carries
 * `.dark .climate-dark-scope { --color-ink: var(--color-bg); … }`, a T-018 subtree shadow, and
 * `app/[locale]/(site)/turkiye/[slug]/page.tsx` renders this chart INSIDE that wrapper — unlike
 * the air section, which sits in a sibling `<Card>`. Inside it `fill-ink/80` resolves to
 * `--color-bg` #fbf8f3 at 80% over white: **1.05:1**, i.e. an invisible axis.
 *
 * `--color-ink-dark` #211c19 is the neutral that is frozen AND unshadowed — the scope shadows
 * exactly four properties (`--color-ink`, `--color-slate`, `--color-surface`, `--color-border`)
 * and this is not one of them. `app/globals.css` defines it as the palette's darkest line ink,
 * "the ONE neutral value measured to clear WCAG 1.4.11's 3:1 graphical-object floor against EVERY
 * surface this design system can draw a meaningful line over" — ink for a surface the theme does
 * not reach, which is what a frozen plot is. Escaping the shadow follows from that meaning rather
 * than being the reason for it. NOTE for whoever retunes that token: its own docblock warns that
 * "every reader depends on the 3:1 floor, not on the shade", and this chart is the exception —
 * `/77` is tuned to a text-grade 7.97:1 grey, so it depends on the shade.
 *
 * ## What the deleted rules actually rendered, in BOTH themes
 *
 * The replacements are theme-invariant, because the plot is. The rules they replace were NOT:
 * two of the four tokens the scope shadows were exactly the two this chart's scaffolding used, so
 * inside `.dark` they resolved elsewhere. Both columns matter, and they point opposite ways —
 * measured against the plot's own white ground in both cases:
 *
 *   | element                 | deleted rule     | light  | dark (inside the scope)   | now           | both   |
 *   | ----------------------- | ---------------- | ------ | ------------------------- | ------------- | ------ |
 *   | axis numbers, months    | `--color-slate`  | 7.92:1 | `--muted-foreground` 2.19:1 | `ink-dark/77` | 7.97:1 |
 *   | 0 °C gridline           | `--color-slate`  | 7.92:1 | `--muted-foreground` 2.19:1 | `ink-dark/77` | 7.97:1 |
 *   | gridlines, frame edge   | `--color-border` | 1.45:1 | `--border` 11.09:1          | `ink-dark/15` | 1.36:1 |
 *
 * So the axis numbers, the month labels and the freezing reference were a LIVE sub-floor reading
 * in dark — 2.19:1 against a 4.5:1 text floor — and this change fixes them. In the other
 * direction the gridlines were 11.09:1 in dark, a near-black grid on a white plot, and they are
 * now the same hairline weight as light. That is deliberate and is the point of a frozen plot: a
 * figure that does not follow the theme must not have scaffolding that does, or its grid changes
 * weight under a mode switch its data never sees. "Reproduces the deleted rule" is true of the
 * LIGHT column only; the dark column is a fix in one row and an intended change in the other.
 *
 * The new values also match the PM2.5 chart's own scaffolding to within 0.11, so the two plots on
 * this page print the same greys.
 *
 * Scaffolding is not an encoding: ink on a plot says nothing about a value, so rule 1 is not in
 * play. Only the columns, the polyline, the markers and the two unit captions carry a data token.
 */
/** The plot: a frozen white data ground, sized by aspect ratio so it reserves space pre-paint. */
const FRAME =
  "flex-[1_1_420px] min-w-[min(300px,100%)] aspect-[720/340] rounded-lg border border-ink-dark/15 bg-white p-1";
/** Temperature gridlines, one per left-axis tick. */
const GRID = "stroke-ink-dark/15 [stroke-width:1]";
/** The 0 °C reference — heavier, so a freezing line reads at a glance (Erzurum). */
const GRID_ZERO = "stroke-ink-dark/77 [stroke-width:1.4]";
/** The two series. Data tokens, never bridge tokens (see the docblock). */
const PRECIP_BAR = "fill-[var(--chart-precip-bar)]";
const TEMP_LINE =
  "fill-none stroke-[var(--chart-temp-line)] [stroke-width:2.6] [stroke-linejoin:round] [stroke-linecap:round]";
const TEMP_MARKER = "fill-[var(--chart-temp-line)]";
/**
 * Axis text. The SVG scales with its frame, so in-viewBox px are NOT CSS px: at 390px the frame
 * is ~350px wide and the 720-unit viewBox scales ~0.49x, rendering 15px axis text at ~7px. No
 * WCAG SC sets a minimum font size and the table + summary carry every number at full size, but
 * the axis numbers are load-bearing under the per-province auto-scaled axes (owner ruling 6), so
 * they scale up on narrow viewports to land near ~9-10 CSS px. 19 units is the ceiling that still
 * fits the 36-unit left gutter ("-10") and the 52-unit month slot.
 */
const AXIS_TYPE = "font-sans text-[15px] max-[700px]:text-[19px]";
const AXIS = `${AXIS_TYPE} fill-ink-dark/77`;
const AXIS_LABEL_LEFT = `${AXIS} [text-anchor:end]`;
const AXIS_LABEL_RIGHT = `${AXIS} [text-anchor:start]`;
/**
 * Each unit caption is its own series' NAME, so it takes that series' colour — which is why the
 * two build on `AXIS_TYPE` rather than on `AXIS`. Appending a second `fill-*` to `AXIS` does not
 * override the first: two utilities of one property are ordered by Tailwind's own emit order, not
 * by their position in the string, and `fill-ink-dark/77` won. Measured on the rendered page
 * before this was split out. The deleted stylesheet got the override for free from CSS source
 * order; a class string does not, so the conflict is removed rather than out-specified.
 */
const AXIS_UNIT = `${AXIS_TYPE} [text-anchor:end] font-bold fill-[var(--chart-temp-line)]`;
const AXIS_UNIT_RIGHT = `${AXIS_TYPE} [text-anchor:start] font-bold fill-[var(--chart-precip-bar)]`;
const MONTH_LABEL = `${AXIS} [text-anchor:middle]`;

/**
 * The annual summary beside the plot. It is real DOM text on `--card`, NOT on the frozen plot,
 * so it binds to the bridge like every other piece of prose in the section: measured in dark,
 * `text-foreground` is 14.73:1 and `text-muted-foreground` 7.79:1 on `--card`.
 */
const SUMMARY = "m-0 flex-[1_1_220px] min-w-[200px] grid grid-cols-2 gap-x-4 gap-y-2.5";
/**
 * `text-[0.75rem]`, not `text-xs`. Same font size, but `text-xs` also sets `line-height: 1rem`,
 * and the deleted `.summaryItem dt` set none — so it inherited the body's 1.6 and rendered at
 * 19.2px. Measured on the rendered page: `text-xs` shortened the whole summary by 15.94px at
 * desktop and 19.12px at 320, which is a layout change smuggled in by a shorthand.
 */
const SUMMARY_TERM = "text-[0.75rem] font-semibold text-muted-foreground mb-0.5";
const SUMMARY_VALUE = "m-0 font-heading text-[1.15rem] font-bold leading-[1.2] text-foreground";

/**
 * The legend swatches keep the two data tokens, because a legend that did not match the marks
 * it names would be worse than a quiet one. On `--card` in dark that costs them —
 * `--chart-precip-bar` measures 2.47:1 and `--chart-temp-line` 3.29:1 there — which is the SAME
 * frozen-token residue the plot's docblock describes, pointing outward instead of inward, and it
 * is unchanged from what the deleted stylesheet rendered. Neither swatch is the sole carrier:
 * each sits beside its own name in `text-muted-foreground` (7.79:1) and the two differ in SHAPE,
 * a filled column against a rule. The fix is the same dark half for the `--chart-*` tokens that
 * the plot is waiting on.
 */
const SWATCH = "inline-block w-5 shrink-0";
const SWATCH_PRECIP = `${SWATCH} h-3 rounded-[2px] bg-[var(--chart-precip-bar)]`;
/**
 * A short bold rule — mirrors the mean-temp line's SHAPE, not just its colour. The height and the
 * radius live on each swatch rather than on `SWATCH`, for the reason `AXIS_UNIT` gives: `h-0`
 * appended after `h-3` is a coin toss, not an override.
 */
const SWATCH_LINE = `${SWATCH} h-0 border-t-[3px] border-t-[var(--chart-temp-line)]`;

interface ClimateChartProps {
  climate: Climate;
  /** Province display name (proper noun, TR) — woven into the SVG title/desc. */
  provinceName: string;
  /** Unique id suffix (plaka kodu) so title/desc ids never collide across a page. */
  idSuffix: string;
}

/**
 * Province climate chart — a build-time inline-SVG climograph (server component, NO
 * `"use client"`, NO chart library — the house SVG pattern, `turkey-map-section.tsx`
 * precedent). The fixed `viewBox` + a CSS `aspect-ratio` frame reserve the space →
 * zero CLS; zero client JS → zero INP (CONVENTIONS §6 #9).
 *
 * Two series, distinguished by SHAPE (never color alone, DESIGN §6.1.3): precipitation
 * as `<rect>` columns and mean temperature as a bold `<polyline>`. (A third series — the
 * light monthly mean-max/mean-min band — was dropped with the MGM series: ERA5-Land
 * publishes no such envelope, → api #87 / DEC 2026-08-01o.) Because the axes auto-scale
 * PER province (owner ruling 6), the
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

  // Real DATA ranges (not the padded axis domain) for the honest <desc> text. The sentence
  // says "aylık ORTALAMA sıcaklık", and `tempMeanC` is exactly that. (It used to be spelled
  // out that these must NOT come from the mean-low/mean-high envelope, which would announce
  // a wider range than the one it names; that envelope no longer exists in the contract.)
  const meanVals = climate.months.map((m) => m.tempMeanC);
  const precipVals = climate.months.map((m) => m.precipitationMm);
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
    <figure className="m-0">
      <div className="flex flex-wrap items-start gap-x-7 gap-y-5">
        <div className={FRAME}>
          <svg
            className="block h-full w-full"
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
                className={tick.value === 0 ? GRID_ZERO : GRID}
                x1={g.plot.x0}
                x2={g.plot.x1}
                y1={tick.y}
                y2={tick.y}
              />
            ))}

            {/* Precipitation columns (cool) — grow from the precip 0 baseline. */}
            {g.columns.map((col) => (
              <rect
                key={`bar-${col.month}`}
                className={PRECIP_BAR}
                x={col.bar.x}
                y={col.bar.y}
                width={col.bar.w}
                height={col.bar.h}
              />
            ))}

            {/* Mean-temp polyline (bold warm) + point markers. */}
            <polyline className={TEMP_LINE} points={g.meanLine} />
            {g.columns.map((col) => (
              <circle
                key={`pt-${col.month}`}
                className={TEMP_MARKER}
                cx={col.meanPoint.x}
                cy={col.meanPoint.y}
                r={2.6}
              />
            ))}

            {/* Left axis: temperature tick numbers (°C). */}
            {g.tempTicks.map((tick) => (
              <text
                key={`tl-${tick.value}`}
                className={AXIS_LABEL_LEFT}
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
                className={AXIS_LABEL_RIGHT}
                x={g.plot.x1 + 6}
                y={tick.y + 4}
              >
                {num(tick.value, 0)}
              </text>
            ))}

            {/* Axis unit captions — parked in the top margin, AXIS_UNIT_DY above the plot
                edge, so their glyph box clears the topmost tick number's at every
                viewport (review I3: they overprinted it on mobile at the old offset). */}
            <text className={AXIS_UNIT} x={g.plot.x0 - 6} y={g.plot.y0 - AXIS_UNIT_DY}>
              {t("axisTempUnit")}
            </text>
            <text className={AXIS_UNIT_RIGHT} x={g.plot.x1 + 6} y={g.plot.y0 - AXIS_UNIT_DY}>
              {t("axisPrecipUnit")}
            </text>

            {/* Month labels under each column. */}
            {g.columns.map((col) => (
              <text key={`m-${col.month}`} className={MONTH_LABEL} x={col.cx} y={g.plot.y1 + 18}>
                {monthName(format, col.month, "short")}
              </text>
            ))}
          </svg>
        </div>

        {/* Annual summary — real DOM text (always legible, the robust cross-province
            comparison surface). All figures are the api's DERIVED values, consumed
            as-is (never recomputed). */}
        <dl className={SUMMARY}>
          <div>
            <dt className={SUMMARY_TERM}>{t("annualMeanTemp")}</dt>
            <dd className={SUMMARY_VALUE}>{num(d.annualMeanTempC)} °C</dd>
          </div>
          <div>
            <dt className={SUMMARY_TERM}>{t("annualPrecip")}</dt>
            <dd className={SUMMARY_VALUE}>{num(d.annualPrecipitationMm, 0)} mm</dd>
          </div>
          <div>
            <dt className={SUMMARY_TERM}>{t("annualTempRange")}</dt>
            <dd className={SUMMARY_VALUE}>{num(d.annualTempRangeC)} °C</dd>
          </div>
          <div>
            <dt className={SUMMARY_TERM}>{t("hottestMonth")}</dt>
            <dd className={SUMMARY_VALUE}>{monthName(format, d.hottestMonth, "long")}</dd>
          </div>
          <div>
            <dt className={SUMMARY_TERM}>{t("coldestMonth")}</dt>
            <dd className={SUMMARY_VALUE}>{monthName(format, d.coldestMonth, "long")}</dd>
          </div>
          <div>
            <dt className={SUMMARY_TERM}>{t("wettestMonth")}</dt>
            <dd className={SUMMARY_VALUE}>{monthName(format, d.wettestMonth, "long")}</dd>
          </div>
          <div>
            <dt className={SUMMARY_TERM}>{t("driestMonth")}</dt>
            <dd className={SUMMARY_VALUE}>{monthName(format, d.driestMonth, "long")}</dd>
          </div>
          <div className="col-span-full">
            <dt className={SUMMARY_TERM}>{t("seasonalHeading")}</dt>
            <dd className="m-0 text-[0.9rem] leading-[1.5] text-foreground">
              {t("seasonWinter")} {pct(d.seasonalPrecipitation.winterPct)} · {t("seasonSpring")}{" "}
              {pct(d.seasonalPrecipitation.springPct)} · {t("seasonSummer")}{" "}
              {pct(d.seasonalPrecipitation.summerPct)} · {t("seasonAutumn")}{" "}
              {pct(d.seasonalPrecipitation.autumnPct)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Legend — shape-coded swatches (bars / line), reinforcing the
          shape-not-color distinction. */}
      <figcaption className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.85rem] text-muted-foreground">
        <span className="inline-flex items-center gap-[7px]">
          <span className={SWATCH_PRECIP} aria-hidden="true" />
          {t("legendPrecip")}
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className={SWATCH_LINE} aria-hidden="true" />
          {t("legendTemp")}
        </span>
      </figcaption>
    </figure>
  );
}
