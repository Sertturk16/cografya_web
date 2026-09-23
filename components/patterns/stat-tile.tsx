import * as React from "react";
import { cn } from "@/lib/utils";
import { MetricValue, type MetricValueProps } from "./metric-value";

/**
 * Value colour, as a closed union over bridge tokens.
 *
 * It exists because the thirteen metric strips are NOT identical: five tiles coloured their value
 * with a RAW Tailwind palette class, none of which has a `dark:` counterpart, so all five were
 * frozen at their light value on a night-sea background. A `className` passthrough would have
 * carried them straight into the shared component; a union cannot.
 *
 * TWO of the five moved onto this union (`deniz`, `deniz/kiyi-tipleri` — decoration, nothing else
 * on those pages encodes with those hues). THREE did not: `deprem/fay-hatlari`'s fault values are
 * categorical identifiers that must agree with the fault cards on the same page, so that strip
 * stays hand-rolled and belongs to T-031c. See Ruling BG in that file and `docs/design.md`.
 *
 * AND IT WAS NOT AN ACCESSIBILITY REPAIR. The value renders `text-2xl sm:text-3xl font-bold` —
 * 24/30px bold, WCAG LARGE text, floor 3:1 — and all five already cleared it. The defect was that
 * they did not follow the theme; the contrast gain is a consequence of fixing that, not the thing
 * that was broken. Stated plainly because the opposite framing is easy to reach for and wrong.
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
  /**
   * No escape hatch, for `StatGrid`'s and the `Card` variant branch's reason — and this component
   * needs it more than either, because a re-spelled tile is INVISIBLE to every counter:
   * `<StatTile className="rounded-3xl bg-muted/40 p-6" />` has no `bg-card` and no `border-border`,
   * so `components/v2/page-composition-cards.test.ts` files it as neither a card nor a well and the
   * divergence this component exists to collapse comes back unmeasured. It was open through the
   * first five commits with no consumer: `kitaplar`, the one site that wanted a per-tile hatch,
   * took `columns="2"` on the grid instead, which is the same geometry by the honest route.
   */
  readonly className?: never;
}

/** A reading. Goes through `MetricValue`, so `absent` is required and `Intl` does the formatting. */
interface StatTileMeasurement extends StatTileBase, Omit<MetricValueProps, "className"> {
  readonly fact?: never;
}

/**
 * A COMPILE-TIME LITERAL, and the reason this union exists.
 *
 * ## THE BOUNDARY IS NOT "NUMBER VERSUS NAME"
 *
 * This docblock used to say "the metric strips do not hold numbers", and review measured that
 * against the 46 `fact` values: it is true of about sixteen. **Around thirty ARE numbers**, written
 * as pre-formatted strings — `"8.333 km"`, `"783.562 km²"`, `"1.200 km"`, `"~8.1 Milyar"`,
 * `"%50"`, `"120 sn"`, `"7 Bölge"`, `"28 İl"`. A reader of the old sentence would conclude no
 * `fact` tile holds a number, and thirty of them do.
 *
 * The real line is **compile-time literal versus runtime reading**:
 *
 *   - `value` is a READING — something that arrives at request time and may not arrive at all.
 *     `provinces.length`, a summed district count, `books.length`. `absent` is required there
 *     because "what if it is not there" is a real question the caller must answer.
 *   - `fact` is a CONSTANT typed into the copy — HGM's published 8.333 km of coastline, WGS84,
 *     the 6.371 km mean earth radius. It is always present, by construction. `absent` would be
 *     decorative, and a decorative `absent={{ label: "—" }}` is exactly the dash `MetricValue`
 *     forbids, smuggled in through ceremony.
 *
 * On that boundary every call site on the surface is correct, and it is the line the contract test
 * below pins: `fact` must receive a string LITERAL, never `fact={String(x)}`, because a brace
 * expression is how a runtime reading would cross into the branch that asks no absent question.
 *
 * Widening `MetricValue.value` to `string` was the other option and it is the wrong one: it would
 * let a page print `"—"` or `"0"` as a value and satisfy every assertion T-024 left behind. So the
 * split is the guarantee, not a hole in it.
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
  // `className` is deliberately NOT read. `className?: never` stops a typed caller, but a
  // `Record<string, unknown>` spread gets past it, so the root only ever wears the literal below;
  // nothing is spread onto any element either, so `class` has no route in. Pinned at runtime by
  // `patterns-contract.test.ts`.
  const { label, hint, icon, tone = "foreground" } = props;
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-2xs">
      {/* `order-2`, and second on screen. The source order is the reading order. */}
      <div className="order-2 mt-0.5 flex items-center gap-2">
        {icon !== undefined ? (
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {/*
          `leading-5` is DELIBERATE, and it is the point of writing it down. The strips' labels
          were `text-xs` spans sitting inline in the tile's block context, so they took the body
          strut — `app/globals.css` sets `body { font-size: 16px; line-height: 1.6 }`, i.e. 25.6px
          of leading on 12px text, a ratio of 2.13 that broke a four-word Turkish label into four
          list items. Nobody chose that. Nobody chose `text-xs`'s bundled 16px either; this says
          20px out loud, which is a caption's leading for a caption that wraps.
        */}
        <span className="text-xs font-medium leading-5 text-muted-foreground">{label}</span>
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
