import * as React from "react";
import { cn } from "@/lib/utils";

/** One class in a classed (sequential) scale. `from`/`to` state the break. */
export interface LegendBin {
  readonly color: string;
  readonly from: number;
  readonly to: number | null;
  readonly unit?: string;
}

/** One member of a categorical set. */
export interface LegendCategory {
  readonly color: string;
  readonly label: string;
}

interface ClassedProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant: "classed";
  readonly title: string;
  /** REQUIRED. See the docblock: a classed map that does not state its breaks is unreadable. */
  readonly bins: readonly LegendBin[];
  readonly locale?: string;
}

interface CategoricalProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant: "categorical";
  readonly title: string;
  readonly categories: readonly LegendCategory[];
}

export type MapLegendProps = ClassedProps | CategoricalProps;

/**
 * The key beside a map.
 *
 * ## Why `bins` is required on the classed variant
 *
 * `docs/design.md`'s data-viz doctrine, rule 5: "Classed maps state their breaks; legend
 * always present." A sequential ramp without its breaks tells the reader that darker means
 * more and nothing else — they cannot read a value off the map, which is what the map is
 * for. Making it a required prop means an unlabelled classed legend cannot be built.
 *
 * ## Why the swatches take a colour rather than a token name
 *
 * A legend describes a DATA scale, and `docs/design.md`'s first rule is brand ≠ data: Terra
 * chrome tokens never encode a value. The colours here come from the data token sets —
 * `--eq-mag-1..5`, `--region-*`, `--map-1..6` — which live in `:root` and are deliberately
 * NOT redefined under `.dark`, because their contrast was measured against fixed map
 * surfaces. The caller passes the same token the map drew with, so the two cannot drift.
 *
 * Every swatch carries a border: several of these scales include a pale member, and a pale
 * square on a pale card is invisible without one.
 */
export function MapLegend(props: MapLegendProps) {
  const { title, className } = props;

  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-3.5", className)}
      role="group"
      aria-label={title}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {props.variant === "classed" ? (
        <ClassedBody bins={props.bins} locale={props.locale ?? "tr"} />
      ) : (
        <CategoricalBody categories={props.categories} />
      )}
    </div>
  );
}

function ClassedBody({ bins, locale }: { bins: readonly LegendBin[]; locale: string }) {
  const nf = new Intl.NumberFormat(locale);
  return (
    <ul role="list" className="space-y-1">
      {bins.map((bin) => {
        const unit = bin.unit !== undefined ? ` ${bin.unit}` : "";
        const label =
          bin.to === null
            ? `${nf.format(bin.from)}${unit} ve üzeri`
            : `${nf.format(bin.from)} – ${nf.format(bin.to)}${unit}`;
        return (
          <li key={`${bin.from}-${bin.to ?? "up"}`} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-[3px] border border-border"
              style={{ backgroundColor: bin.color }}
            />
            <span className="text-xs tabular-nums text-foreground">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function CategoricalBody({ categories }: { categories: readonly LegendCategory[] }) {
  return (
    <ul role="list" className="flex flex-wrap gap-x-3 gap-y-1.5">
      {categories.map((category) => (
        <li key={category.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-[3px] border border-border"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-xs text-foreground">{category.label}</span>
        </li>
      ))}
    </ul>
  );
}
