import * as React from "react";
import { cn } from "@/lib/utils";
import { MetricValue, type MetricValueProps } from "./metric-value";

/**
 * Value colour, as a closed union over bridge tokens.
 *
 * It exists because the thirteen metric strips are NOT identical: five of them coloured a tile
 * with a RAW Tailwind palette class — `text-teal-600`, `text-cyan-600`, `text-red-600`,
 * `text-blue-600`, `text-emerald-600` — none of which has a `dark:` counterpart, so all five were
 * frozen at their light value on a night-sea background. That is the same class of defect as
 * `marine-attribution.module.css` shipping a licence notice at 2.34:1. A `className` passthrough
 * would have carried those five straight into the shared component; a union cannot.
 */
const TONE = {
  /** The default. No hue — the tile states a fact, it does not classify one. */
  foreground: "text-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  destructive: "text-destructive",
} as const;

export type StatTone = keyof typeof TONE;

interface StatTileBase {
  readonly label: string;
  /** A short qualifier under the number — a source, a period, a caveat. */
  readonly hint?: string;
  readonly icon?: React.ReactNode;
  readonly tone?: StatTone;
  readonly className?: string;
}

/** A reading. Goes through `MetricValue`, so `absent` is required and `Intl` does the formatting. */
interface StatTileMeasurement extends StatTileBase, Omit<MetricValueProps, "className"> {
  readonly fact?: never;
}

/**
 * A LITERAL, and the reason this union exists.
 *
 * `MetricValue` takes `value: number`. The metric strips do not hold numbers: they hold
 * `"WGS84"`, `"Haversine"`, `"L'Huilier"`, `"M 1.0 - 7.0+"`, `"ÖSYM / MEB"`, `"%28 Eğim"`. Those
 * are named constants and specification facts, not readings, and there is no honest
 * `Intl.NumberFormat` call for any of them. Widening `MetricValue.value` to `string` was the
 * other option and it is the wrong one: it would let a page print `"—"` or `"0"` as a value and
 * satisfy every assertion T-024 left behind.
 *
 * So the split is the guarantee, not a hole in it. `absent` stays REQUIRED wherever a number is
 * rendered, and a caller that reaches for `fact` is saying, in the type, that this tile is not
 * reporting a measurement — which is checkable, and which `absent={{ label: "—" }}` on a widened
 * `value` would not have been.
 */
interface StatTileFact extends StatTileBase {
  readonly fact: string;
  readonly value?: never;
  readonly unit?: never;
  readonly precision?: never;
  readonly locale?: never;
  readonly absent?: never;
}

export type StatTileProps = StatTileMeasurement | StatTileFact;

/**
 * Label, value, optional hint — the shape the metric strips and the stat grids were writing by
 * hand on 35 files.
 *
 * ## DOM ORDER AND VISUAL ORDER ARE DIFFERENT THINGS, AND BOTH ARE DELIBERATE
 *
 * The label comes FIRST IN THE DOM. A screen-reader user hearing "18,2 °C" with no idea what it
 * measures is told nothing.
 *
 * The value renders ON TOP, because that is what 13 metric strips and the book facts sheet
 * already do and there is no reader benefit in flipping them. The flip is carried by `order-*`
 * utilities, so the accessible order and the visual order are set independently — which is the
 * whole point of having both. Anyone "fixing" the visual order by moving the JSX around instead
 * breaks the DOM guarantee silently, so `components/patterns/patterns-contract.test.ts` pins
 * both halves.
 *
 * ## THE GUARANTEE IT CARRIES DOWN
 *
 * It composes `MetricValue` rather than formatting numbers itself, which is what makes the
 * required `absent` prop reach every measurement on the site: a tile cannot render a reading it
 * does not have without first saying what "no value" looks like. `fact` is the other branch of
 * that same rule — see {@link StatTileFact}.
 */
export function StatTile(props: StatTileProps) {
  const { label, hint, icon, tone = "foreground", className } = props;
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card p-4 shadow-2xs",
        className,
      )}
    >
      {/* `order-2`, and second on screen. The source order is the reading order. */}
      <div className="order-2 mt-0.5 flex items-center gap-2">
        {icon !== undefined ? (
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {props.fact !== undefined ? (
        <span
          className={cn("order-1 block font-heading text-2xl font-bold sm:text-3xl", TONE[tone])}
        >
          {props.fact}
        </span>
      ) : (
        <MetricValue
          value={props.value}
          unit={props.unit}
          precision={props.precision}
          locale={props.locale}
          absent={props.absent}
          className={cn("order-1", TONE[tone])}
        />
      )}
      {hint !== undefined ? (
        <p className="order-3 mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
