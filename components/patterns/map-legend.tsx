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
 * ## Why the swatch border is `--muted-foreground`, and why it must follow the theme
 *
 * Every swatch carries a border, because these scales include members that vanish against the
 * card at either end — a pale yellow on white, a near-black magnitude class on the night-sea
 * card. The first version used `--border`, which cannot do that job: it measures 1.45:1 in
 * light and 1.53:1 in dark, so the mitigation was decorative. Measured against `--card`, three
 * of the seven region colours and the top three earthquake classes came out under the 3:1 that
 * WCAG 1.4.11 asks of a graphical object — the darkest at 1.01:1.
 *
 * The obvious next move is wrong, and was measured before it was believed: binding the border
 * to Terra's fixed `--color-ink-dark` gives 16.87:1 on the white card and **1.01:1 on the dark
 * one**, which is the same defect with the themes swapped. `docs/design.md`'s line about
 * ink-dark is about a line drawn over a data FILL, on a map surface that does not change. This
 * border has a different job: it separates the swatch from the CARD, and the card does change.
 *
 * So the border is theme-aware even though the fills are not. `--muted-foreground` measures
 * 7.92:1 against the light card and 7.79:1 against the dark one — verified across all 24
 * swatches the showcase renders, not derived — so the swatch is identifiable as a shape in
 * both panels whatever its fill happens to be.
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
              className="size-3.5 shrink-0 rounded-[3px] border border-muted-foreground"
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
            className="size-3 shrink-0 rounded-[3px] border border-muted-foreground"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-xs text-foreground">{category.label}</span>
        </li>
      ))}
    </ul>
  );
}
