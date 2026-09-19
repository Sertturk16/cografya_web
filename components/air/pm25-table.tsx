import { getFormatter, getTranslations } from "next-intl/server";
import { PM25_DECIMALS, roundPm25 } from "@/lib/air/pm25-display";
import type { Pm25Annual } from "@/lib/api/types";

interface Pm25TableProps {
  pm25: Pm25Annual;
  provinceName: string;
  /** The unit as the reader must see it, resolved once by the section. */
  displayUnit: string;
}

/**
 * THE TABLE'S SURFACE, AS BRIDGE TOKENS (T-033).
 *
 * Every rule below used to live in `air-pollution.module.css` and read a raw Terra token the
 * `.dark` block never redefines, so the whole table was frozen at its light values on a
 * `--card` panel: the year and value cells measured **1.14:1** in dark (`--color-ink` #2b2622
 * on `--card` #121e21) and the caption 2.15:1, while the header row painted a light
 * `--color-surface` #f1e9de strip across a dark panel. Bound to the bridge tokens the same
 * elements measure 14.73:1 and 7.79:1 (`lib/theme/contrast.ts`); figures in
 * `.superpowers/sdd/2026-09-19-t033-css-modules/task-3-report.md`.
 *
 * Sizes are the module's own, to the pixel, so the conversion moves colour and not layout.
 */
/** WCAG 2.2 §2.5.8 floor is 24x24 CSS px; the row is ~37px tall at 0.85rem/1.5 plus the
 *  vertical padding, so it clears it with room. The focus ring is the site's own `--ring`,
 *  which `--color-accent` (frozen) was standing in for. */
const SUMMARY =
  "cursor-pointer py-2 text-[0.85rem] font-semibold text-link focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";
const TABLE = "w-full border-collapse border border-border rounded-lg mt-1 text-[0.85rem]";
const CAPTION = "caption-top text-left pb-2.5 text-[0.8rem] leading-[1.45] text-muted-foreground";
/** The padding and hairline every cell shares. */
const CELL = "px-3 py-1.5 border-b border-border";
/**
 * The header row's fill. The bridge mapping for `--color-surface` is `bg-card`, but this
 * table sits ON a `<Card variant="panel">`, where `bg-card` is the panel itself and a header
 * row painted with it would be invisible. `--muted` is the token `app/globals.css` already
 * names as the dark-mode stand-in for `--color-surface` in exactly this case (the
 * `.climate-dark-scope` block, whose comment calls it the "dark header-row fill").
 *
 * The metric HEADER is allowed to wrap on a phone; the data cells never do — a number must
 * not break across lines. Two columns fit a 320px viewport, which is why there is no scroll
 * region (see the docblock below).
 */
const TH_COL = `${CELL} bg-muted font-semibold text-foreground`;
const TH_YEAR = `${TH_COL} text-left`;
const TH_VALUE = `${TH_COL} text-right whitespace-normal`;
/** The data cells: tabular figures that never wrap. */
const TH_ROW = `${CELL} text-left font-semibold tabular-nums whitespace-nowrap text-foreground`;
const TD = `${CELL} text-right tabular-nums whitespace-nowrap text-foreground`;

/**
 * The full year-by-year table — the chart's text equivalent and the authoritative numbers,
 * inside a `<details>` that starts CLOSED (→ DEC 2026-08-20c md.3, owner-ruled).
 *
 * ## Closed is a layout decision, not an access one
 *
 * The rows are in the DOM either way. `<details>` hides them visually; it does not remove
 * them from the accessibility tree's content, from `Ctrl+F`, or from the raw HTML a crawler
 * reads (`SEO-POLICY.md` §B11.3 — main body content must be in the first response, and it
 * is). What the collapse buys is that a 27-row list does not become the longest block on a
 * province page. The climate table next door stays open because twelve rows fit.
 *
 * The `<summary>` is a real label — "Yıllara göre değerler (1998-2024)", built from the
 * payload's own first and last years — never a bare "Detaylar".
 *
 * ## No scroll container, deliberately
 *
 * The climate table wraps itself in a focusable `overflow-x` region because three columns
 * genuinely overflow at the 320 px reflow width. Two columns do not, so the same wrapper
 * here would add a keyboard tab-stop that leads to a region that never scrolls. The metric
 * header is allowed to wrap instead (`TH_VALUE` above), which is the ordinary data-table
 * answer at that width.
 */
export async function Pm25Table({ pm25, provinceName, displayUnit }: Pm25TableProps) {
  const t = await getTranslations("AirPollution");
  const format = await getFormatter();

  const first = pm25.years[0];
  const last = pm25.years.at(-1);
  // The section only renders with a series; an empty one has nothing to tabulate.
  if (first === undefined || last === undefined) return null;

  /** Years as STRINGS so ICU never group-separates them (1998, not 1.998). */
  const start = String(first.year);
  const end = String(last.year);
  const value = (raw: number) =>
    format.number(roundPm25(raw), {
      minimumFractionDigits: PM25_DECIMALS,
      maximumFractionDigits: PM25_DECIMALS,
    });

  return (
    <details className="mt-[18px] max-w-[420px]">
      <summary className={SUMMARY}>{t("tableSummary", { start, end })}</summary>
      <table className={TABLE}>
        <caption className={CAPTION}>
          {t("tableCaption", { name: provinceName, unit: displayUnit, start, end })}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH_YEAR}>
              {t("tableYear")}
            </th>
            <th scope="col" className={TH_VALUE}>
              {t("tableValue", { unit: displayUnit })}
            </th>
          </tr>
        </thead>
        <tbody>
          {pm25.years.map((entry) => (
            <tr key={entry.year}>
              <th scope="row" className={TH_ROW}>
                {String(entry.year)}
              </th>
              <td className={TD}>{value(entry.valueUgM3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
