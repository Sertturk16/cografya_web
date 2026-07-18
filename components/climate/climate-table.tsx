import { getFormatter, getTranslations } from "next-intl/server";
import type { Climate, ClimateExtremeRecord, ClimateMonthlyNormal } from "@/lib/api/types";
import styles from "./climate.module.css";

interface ClimateTableProps {
  climate: Climate;
  provinceName: string;
}

/** One data column: its header key, decimals, and how to read the value off a month. */
interface ColumnDef {
  id: string;
  headerKey:
    | "colTempMean"
    | "colTempMax"
    | "colTempMin"
    | "colPrecip"
    | "colSunshine"
    | "colRainyDays"
    | "colRecordMax"
    | "colRecordMin";
  digits: number;
  get: (m: ClimateMonthlyNormal) => number | null;
}

const COLUMNS: ColumnDef[] = [
  { id: "tempMean", headerKey: "colTempMean", digits: 1, get: (m) => m.tempMeanC },
  { id: "tempMax", headerKey: "colTempMax", digits: 1, get: (m) => m.tempMaxMeanC },
  { id: "tempMin", headerKey: "colTempMin", digits: 1, get: (m) => m.tempMinMeanC },
  { id: "precip", headerKey: "colPrecip", digits: 1, get: (m) => m.precipitationMm },
  { id: "sunshine", headerKey: "colSunshine", digits: 1, get: (m) => m.sunshineHours },
  { id: "rainyDays", headerKey: "colRainyDays", digits: 1, get: (m) => m.rainyDays },
  { id: "recordMax", headerKey: "colRecordMax", digits: 1, get: (m) => m.tempRecordMaxC },
  { id: "recordMin", headerKey: "colRecordMin", digits: 1, get: (m) => m.tempRecordMinC },
];

/**
 * The always-visible monthly climate table (server component). Months as ROWS, metrics
 * as COLUMNS (mobile-first — a horizontal scroll handles the many columns on a narrow
 * screen). THIS is the information gain over the competitor, whose figures are trapped in
 * a raster JPG: machine-readable `<td>`s in the first HTML response, so the numbers are
 * copyable, crawlable, and screen-reader navigable (PLAN §2 — never hidden in `<details>`).
 *
 * A column whose 12 values are all null is dropped entirely. Units live only in the
 * column headers. `<th scope>` on both axes + a `<caption>` naming the province, period,
 * and source keep the table fully associable for assistive tech.
 */
export async function ClimateTable({ climate, provinceName }: ClimateTableProps) {
  const t = await getTranslations("Climate");
  const format = await getFormatter();

  const num = (value: number, digits: number) =>
    format.number(value, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  const monthLong = (month: number) =>
    format.dateTime(new Date(Date.UTC(2020, month - 1, 15)), { month: "long" });

  // Drop any column that is all-null across the 12 months (PLAN §2).
  const columns = COLUMNS.filter((c) => climate.months.some((m) => c.get(m) !== null));

  const records = buildRecords(climate);

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
              {columns.map((c) => (
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
                {columns.map((c) => {
                  const v = c.get(m);
                  return (
                    <td key={c.id} className={styles.td}>
                      {v !== null ? num(v, c.digits) : <span aria-hidden="true">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {records.length > 0 && (
        <div className={styles.records}>
          <h4 className={styles.recordsHeading}>{t("recordsHeading")}</h4>
          <dl className={styles.recordsList}>
            {records.map((r) => (
              <div key={r.labelKey} className={styles.recordItem}>
                <dt>{t(r.labelKey)}</dt>
                <dd>
                  {t(r.valueKey, { value: r.record.value })}
                  {r.record.date !== null && (
                    <span className={styles.recordDate}>
                      {" "}
                      ({format.dateTime(new Date(r.record.date), { dateStyle: "long" })})
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}

interface RecordRow {
  labelKey: "recordDailyMaxPrecip" | "recordFastestWind" | "recordMaxSnow";
  valueKey: "recordValuePrecip" | "recordValueWind" | "recordValueSnow";
  record: ClimateExtremeRecord;
}

/** Collect the present all-time records (each is independently nullable). */
function buildRecords(climate: Climate): RecordRow[] {
  const rows: RecordRow[] = [];
  const r = climate.records;
  if (r.dailyMaxPrecipitationMm !== null) {
    rows.push({
      labelKey: "recordDailyMaxPrecip",
      valueKey: "recordValuePrecip",
      record: r.dailyMaxPrecipitationMm,
    });
  }
  if (r.fastestWindMs !== null) {
    rows.push({
      labelKey: "recordFastestWind",
      valueKey: "recordValueWind",
      record: r.fastestWindMs,
    });
  }
  if (r.maxSnowDepthCm !== null) {
    rows.push({ labelKey: "recordMaxSnow", valueKey: "recordValueSnow", record: r.maxSnowDepthCm });
  }
  return rows;
}
