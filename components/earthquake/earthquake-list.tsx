import type { EarthquakeEvent } from "@/lib/api/types";
import { bindingSentenceKey } from "@/lib/earthquake/binding-sentence";
import { formatEarthquakeOccurredAt } from "@/lib/earthquake/time";
import { MagnitudeBadge } from "./magnitude-badge";

/**
 * THE 520px TABLE FLOOR, AND WHY IT IS A HOISTED CONSTANT RATHER THAN AN INLINE CLASS.
 *
 * `earthquake.module.css`'s `.table` carried `min-width: 520px`, and that declaration had an
 * entry in `components/css-module-fixed-widths.test.ts` — the census of fixed-`px` inline-axis
 * declarations, which exists because one such declaration scrolled a province page sideways at
 * 320. The census could read it while it was CSS; it cannot read a Tailwind class in JSX, and
 * `pnpm sweep:overflow` is NOT in `.github/workflows/ci.yml`, so deleting the stylesheet would
 * have left the floor covered only by a command a human has to remember.
 *
 * So the pin moves to `earthquake.structure.test.ts`, per `lib/test-support/converted-floor.ts`.
 * That extractor reads a top-level `const NAME = "…";` — a value left inline on a `className`
 * hands it back `null` and the pin asserts nothing, QUIETLY. Hence `TABLE` below, rendered as a
 * bare `className={TABLE}` so `renderSites` can prove the constant the pin inspects is the one
 * the table actually wears.
 *
 * The floor itself is not incidental. Three columns of event data do not fit in 288px of
 * content box at a 320px viewport, so the table is meant to scroll INSIDE `SCROLL` rather than
 * squeeze; `SCROLL`'s `overflow-x-auto` is the other half of that pair and the stylesheet's own
 * comment said so ("`overflow-x` stays for the `min-width: 520px` table on narrow viewports").
 * Remove the floor and the columns crush instead of scrolling; remove `overflow-x-auto` and the
 * 520px escapes the card and scrolls the page.
 */
const TABLE = "w-full min-w-[520px] border-collapse text-[0.9rem]";

/**
 * The scroll box, and `max-h-[min(60vh,600px)]` is a FIX, not decoration — it moved here with
 * the rule, from `earthquake.module.css`'s own owner-verified note
 * (`cografya-editor-notlari/deprem-notlar.txt` madde 3). The box carried `overflow-x: auto` but
 * no height ceiling, so `overflow-y` computed to `auto` per the CSS overflow spec (an axis left
 * unset while the other is non-`visible` computes to `auto`, never `visible`) and yet never
 * triggered: with nothing to overflow, the box simply grew with its content — ~2300px at 50
 * rows — and dragged the whole page down with it. The ceiling is what gives `overflow-y`
 * something to act on. It follows this repo's `min(vh, px)` scrollable-list convention and is
 * deliberately TALLER than a search dropdown's result list: this is the page's primary content
 * list, up to 50 rows, not a small transient popover.
 *
 * `rounded-lg` is `var(--radius-lg)`, which `app/globals.css` defines as `var(--radius)` — the
 * exact value the stylesheet wrote.
 *
 * THE FOCUS RING. The stylesheet painted `outline: 3px solid var(--color-accent)` here, a raw
 * Terra token frozen at its light value: #276b70 measures **2.78:1 on dark `--card`**, under
 * WCAG 1.4.11's 3:1 floor for the one reader who cannot do without a ring. `outline-ring` is
 * `--ring`, which IS redefined in `.dark` — **5.44:1 on dark `--card`, 6.13:1 on light**.
 *
 * These three utilities are belt-and-braces rather than load-bearing today, and that is worth
 * stating rather than implying: `app/globals.css`'s `:focus-visible { outline: 3px solid
 * var(--ring); outline-offset: 2px }` sits OUTSIDE every `@layer`, so it beats any layered
 * utility whatever its specificity, and it already paints these exact three values on a
 * `tabIndex={0}` element. The stylesheet's rule won over it only because a CSS-Module selector
 * is unlayered too, at (0,2,0). Writing the intent here keeps the ring from depending on a
 * global rule this file does not own.
 */
const SCROLL =
  "max-h-[min(60vh,600px)] overflow-x-auto overflow-y-auto rounded-lg border border-border " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** `caption-side: top`, `text-align: left`, `padding: 10px 12px`, `0.8rem`, secondary ink. */
const CAPTION = "caption-top px-3 py-2.5 text-left text-[0.8rem] text-muted-foreground";

/**
 * The padding and hairline every cell shares — the stylesheet's `.table th, .table td`.
 *
 * `text-[0.9rem]` lives on `TABLE`, not here, and the sizes throughout this file are arbitrary
 * values rather than `text-sm`/`text-xs` on purpose: a named Tailwind size carries a
 * line-height the stylesheet never set. The table inherits 1.6 from `body`, so `0.9rem` renders
 * at 14.4px/23.04px; `text-sm` would have made it 14px/20px and reflowed every row.
 */
const CELL = "border-b border-border px-3 py-2 text-left align-top";

/**
 * The header row's fill. The bridge mapping for `--color-surface` is `bg-card`, but this table
 * sits ON a `<Card variant="panel">`, where `bg-card` IS the panel — a header band painted in
 * it would vanish. `bg-muted` is the same substitution `pm25-table.tsx` made and the same one
 * `app/globals.css`'s own `.climate-dark-scope` block writes (`--color-surface → var(--muted)`,
 * "dark header-row fill"). Measured: `--foreground` on `--muted` is **12.67:1 dark, 12.44:1
 * light**, and the band itself separates from `--card` at 1.16:1 dark / 1.20:1 light — a fill,
 * not a boundary; `border-b border-border` is what draws the edge. In light mode nothing moves
 * at all: `--muted` and the retired `--color-surface` are both #f1e9de.
 */
const HEAD_CELL = `${CELL} bg-muted font-semibold text-foreground`;

/** The event's own place name: its own block line, primary ink. */
const PLACE_NAME = "block text-foreground";

/** The §5.7 binding sentence under it — a second line at 0.82rem, secondary ink. */
const BINDING_NOTE = "mt-0.5 block text-[0.82rem] text-muted-foreground";

/**
 * The no-events line. `py-4` is the stylesheet's `padding: 16px 0`; no margin utility, because
 * `app/globals.css`'s base `p { margin: 0 0 1rem }` supplied the 16px bottom margin this
 * paragraph already had and a layered `mt-*`/`mb-*` here would either duplicate or drop it.
 */
const EMPTY_STATE = "py-4 text-muted-foreground";

export interface EarthquakeListStrings {
  tableSummary: string;
  scrollRegionLabel: string;
  colMagnitude: string;
  colPlace: string;
  colTime: string;
  emptyState: string;
  /** `Earthquake.binding.offshoreNear`, already given `{province}`. */
  bindingOffshoreNear: (province: string) => string;
  /** `Earthquake.binding.acrossBorder`, already given `{province}`. */
  bindingAcrossBorder: (province: string) => string;
}

interface EarthquakeListProps {
  locale: string;
  events: readonly EarthquakeEvent[];
  /** `bindingPlateCode` → the province's `nameTr`, for the binding-sentence context (§5.7). */
  provinceNameByPlateCode: ReadonlyMap<string, string>;
  strings: EarthquakeListStrings;
}

/**
 * The default-view event list (§5.11, `deprem-sayfalari` plan): a server-rendered `<table>`,
 * newest first (the api's own order), one row per event.
 *
 * THE `bindingKind` SENTENCE (§5.7/§10) renders ONLY for `offshore_near`/`across_border` rows,
 * and only when the bound province can actually be named — never "an earthquake occurred in
 * {province}" for these two states, because the provider's `province` field means "nearest
 * Turkish province", not "where this happened". `"inside"` rows print no extra sentence:
 * `placeNameTr` already carries the province in parentheses for that case, so a second
 * sentence saying the same thing would be the mechanical/redundant copy `CONTENT-STYLE.md`
 * §22 bars.
 *
 * A plain, hook-free presentational component for the same dual-context reason
 * `EarthquakeMap` states in full: the client filter island re-renders this exact shape after
 * a fetch (§5.5), so it cannot depend on a server-only translation hook.
 */
export function EarthquakeList({
  locale,
  events,
  provinceNameByPlateCode,
  strings,
}: EarthquakeListProps) {
  if (events.length === 0) {
    return <p className={EMPTY_STATE}>{strings.emptyState}</p>;
  }

  return (
    <div className={SCROLL} role="region" aria-label={strings.scrollRegionLabel} tabIndex={0}>
      <table className={TABLE}>
        <caption className={CAPTION}>{strings.tableSummary}</caption>
        <thead>
          <tr>
            <th scope="col" className={HEAD_CELL}>
              {strings.colMagnitude}
            </th>
            <th scope="col" className={HEAD_CELL}>
              {strings.colPlace}
            </th>
            <th scope="col" className={HEAD_CELL}>
              {strings.colTime}
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const key = bindingSentenceKey(event.bindingKind);
            const province =
              event.bindingPlateCode !== null
                ? (provinceNameByPlateCode.get(event.bindingPlateCode) ?? null)
                : null;
            const bindingNote =
              key !== null && province !== null
                ? key === "offshoreNear"
                  ? strings.bindingOffshoreNear(province)
                  : strings.bindingAcrossBorder(province)
                : null;

            return (
              <tr key={event.id}>
                <td className={CELL}>
                  <MagnitudeBadge
                    magnitude={event.magnitude}
                    magnitudeType={event.magnitudeType}
                    locale={locale}
                  />
                </td>
                <td className={CELL}>
                  {/* `placeNameTr` is Turkish in BOTH locales (§5.7's own docblock) —
                      `lang="tr"` so `/en/earthquakes` (`<html lang="en">`) never reads it with
                      English phonetics (WCAG 3.1.2, review VAL104-M1). */}
                  <span className={PLACE_NAME} lang="tr">
                    {event.placeNameTr}
                  </span>
                  {bindingNote !== null && <span className={BINDING_NOTE}>{bindingNote}</span>}
                </td>
                <td className={CELL}>{formatEarthquakeOccurredAt(event.occurredAtUtc, locale)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
