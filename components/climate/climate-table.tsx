import { getFormatter, getTranslations } from "next-intl/server";
import type { Climate, ClimateMonthlyNormal } from "@/lib/api/types";

/**
 * The scroll container. Every colour here is a bridge token: this table sits on `--card`, not on
 * the chart's frozen plot, so it themes. Measured in dark with `lib/theme/contrast.ts`:
 * `text-foreground` 14.73:1 on `--card`, 12.67:1 on the `--muted` header row, and
 * `text-muted-foreground` 7.79:1 on `--card` for the caption.
 *
 * `max-w-[560px]` matters now that the table carries three columns instead of nine. Left to
 * stretch the full content width, a 3-column table sprays "Ay | Ortalama sıcaklık | Toplam yağış"
 * across the whole column (`--container-max: 1120px` minus the 20px inline padding ≈ 1080px),
 * pushing each number so far from its month label that the row stops reading as a row. 560px is
 * about the natural width of the widest header plus the month column.
 *
 * The `lg:` trio is the D2 "rails" variant's override, which lived in a `@media (min-width: 1024px)`
 * block and lands on the same breakpoint here: inside the ~640px rail the 560px cap's reason still
 * holds, so the cap moves to the RAIL rather than to 1080.
 */
const SCROLL =
  "mt-[22px] max-w-[560px] overflow-x-auto rounded-lg border border-border " +
  "focus-visible:outline-[3px] focus-visible:outline-accent focus-visible:outline-offset-[-3px] " +
  "lg:flex-[1_1_420px] lg:min-w-[300px] lg:max-w-none";

/**
 * `min-w-[320px]` was 640px when the table carried nine columns and horizontal scroll was the
 * point. It now carries three (month + the ERA5-Land core pair), and 640px would have forced a
 * scrollbar on a phone for a table that fits. 320px keeps the columns from crushing while letting
 * the table fit a 390px viewport — and it is also what still makes the container genuinely
 * scrollable at the 320px reflow width, which is why the scroll region stays focusable.
 */
const TABLE = "w-full border-collapse text-[0.85rem] min-w-[320px]";
const CAPTION =
  "caption-top text-left px-3.5 pt-3 pb-2.5 text-[0.85rem] leading-[1.45] text-muted-foreground";
/** Shared cell geometry. A number must never break across lines, so data cells stay `nowrap`. */
const CELL = "px-3 py-[7px] border-b border-border whitespace-nowrap";
/**
 * NOTE: no `sticky` here. The scroll container scrolls HORIZONTALLY only, so `top: 0` on a column
 * header could never engage — it was dead code in the stylesheet this replaced. Making the ROW
 * header sticky under horizontal scroll is the change that would actually help, and it alters the
 * rendered surface, so it stays a follow-up.
 */
const TH_MONTH = `${CELL} bg-muted font-semibold text-foreground text-left`;
/**
 * Let the two metric HEADERS wrap on a phone. "Ortalama sıcaklık (°C)" held on one line is what
 * pushed the 3-column table past a 390px viewport, hiding the precipitation column behind a
 * scroll for no reason.
 */
const TH_METRIC = `${CELL} bg-muted font-semibold text-foreground text-right max-[700px]:whitespace-normal`;
const TH_ROW = `${CELL} text-left font-semibold text-foreground`;
const TD = `${CELL} text-right text-foreground tabular-nums`;

interface ClimateTableProps {
  climate: Climate;
  provinceName: string;
}

/** One data column: its header key, decimals, and how to read the value off a month. */
interface ColumnDef {
  id: string;
  headerKey: "colTempMean" | "colPrecip";
  digits: number;
  get: (m: ClimateMonthlyNormal) => number;
}

/**
 * The CORE PAIR, and deliberately nothing else (api #87 / DEC 2026-08-01o).
 *
 * ERA5-Land monthly means publish exactly two quantities per month, so the six MGM-era
 * columns (mean-max, mean-min, sunshine, rainy days, record max/min) are gone — not
 * hidden behind a null check, gone, because the fields no longer exist in the contract.
 *
 * Both getters return a NON-nullable `number`: the DTO types them required. The old
 * "drop an all-null column" filter and the em-dash no-data cell were removed with them —
 * with two guaranteed columns neither branch could ever run, and a silent em-dash would
 * have HIDDEN a contract violation instead of surfacing it.
 */
const COLUMNS: ColumnDef[] = [
  { id: "tempMean", headerKey: "colTempMean", digits: 1, get: (m) => m.tempMeanC },
  { id: "precip", headerKey: "colPrecip", digits: 1, get: (m) => m.precipitationMm },
];

/**
 * The always-visible monthly climate table (server component). Months as ROWS, the two
 * metrics as COLUMNS. THIS is the information gain over the competitor, whose figures are
 * trapped in a raster JPG: machine-readable `<td>`s in the first HTML response, so the
 * numbers are copyable, crawlable, and screen-reader navigable (PLAN §2 — never hidden in
 * `<details>`).
 *
 * Units live only in the column headers. `<th scope>` on both axes + a `<caption>` naming
 * the province, period, and source keep the table fully associable for assistive tech.
 *
 * ## Why the scroll container is still here with only three columns
 *
 * At normal widths this table no longer scrolls — three columns fit inside the `SCROLL`
 * container's 560px cap, and below 700px the metric headers wrap so it fits a 390px phone
 * exactly. But `TABLE` keeps a 320px `min-width`, so at the WCAG 1.4.10 reflow width (a 320px viewport,
 * or equivalently 400% zoom) the content box IS narrower than the table and the container
 * genuinely scrolls. A scrollable container that keyboard users cannot reach fails WCAG
 * 2.1.1, so `tabIndex={0}` stays.
 *
 * Its LABEL, however, no longer claims scrolling as a fact: it used to end with "(yatay
 * kaydırılabilir)", which was a false statement to a screen reader at every width where the
 * table fits. The region is now named by what it contains.
 */
export async function ClimateTable({ climate, provinceName }: ClimateTableProps) {
  const t = await getTranslations("Climate");
  const format = await getFormatter();

  const num = (value: number, digits: number) =>
    format.number(value, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  const monthLong = (month: number) =>
    format.dateTime(new Date(Date.UTC(2020, month - 1, 15)), { month: "long" });

  return (
    <div
      className={SCROLL}
      role="region"
      aria-label={t("scrollRegionLabel", { name: provinceName })}
      tabIndex={0}
    >
      <table className={TABLE}>
        <caption className={CAPTION}>
          {/* Years passed as strings so ICU never group-separates them (1991, not 1.991). */}
          {t("tableCaption", {
            name: provinceName,
            start: String(climate.periodStartYear),
            end: String(climate.periodEndYear),
          })}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH_MONTH}>
              {t("colMonth")}
            </th>
            {COLUMNS.map((c) => (
              <th key={c.id} scope="col" className={TH_METRIC}>
                {t(c.headerKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {climate.months.map((m) => (
            <tr key={m.month}>
              <th scope="row" className={TH_ROW}>
                {monthLong(m.month)}
              </th>
              {COLUMNS.map((c) => (
                <td key={c.id} className={TD}>
                  {num(c.get(m), c.digits)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
