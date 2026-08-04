import { getFormatter, getTranslations } from "next-intl/server";
import type { Climate, ClimateMonthlyNormal } from "@/lib/api/types";
import styles from "./climate.module.css";

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
 * The always-visible monthly climate table (server component). Months as ROWS, metrics
 * as COLUMNS (mobile-first — a horizontal scroll handles the many columns on a narrow
 * screen). THIS is the information gain over the competitor, whose figures are trapped in
 * a raster JPG: machine-readable `<td>`s in the first HTML response, so the numbers are
 * copyable, crawlable, and screen-reader navigable (PLAN §2 — never hidden in `<details>`).
 *
 * Units live only in the column headers. `<th scope>` on both axes + a `<caption>` naming
 * the province, period, and source keep the table fully associable for assistive tech.
 */
export async function ClimateTable({ climate, provinceName }: ClimateTableProps) {
  const t = await getTranslations("Climate");
  const format = await getFormatter();

  const num = (value: number, digits: number) =>
    format.number(value, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  const monthLong = (month: number) =>
    format.dateTime(new Date(Date.UTC(2020, month - 1, 15)), { month: "long" });

  return (
    <>
      <div
        className={styles.tableScroll}
        role="region"
        aria-label={t("scrollRegionLabel", { name: provinceName })}
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className={styles.tableCaption}>
            {/* Years passed as strings so ICU never group-separates them (1929, not 1.929). */}
            {t("tableCaption", {
              name: provinceName,
              start: String(climate.periodStartYear),
              end: String(climate.periodEndYear),
            })}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.thMonth}>
                {t("colMonth")}
              </th>
              {COLUMNS.map((c) => (
                <th key={c.id} scope="col" className={styles.thMetric}>
                  {t(c.headerKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {climate.months.map((m) => (
              <tr key={m.month}>
                <th scope="row" className={styles.thRow}>
                  {monthLong(m.month)}
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.id} className={styles.td}>
                    {num(c.get(m), c.digits)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
