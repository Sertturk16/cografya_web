import { getFormatter, getTranslations } from "next-intl/server";
import { PM25_DECIMALS, roundPm25 } from "@/lib/air/pm25-display";
import type { Pm25Annual } from "@/lib/api/types";
import styles from "./air-pollution.module.css";

interface Pm25TableProps {
  pm25: Pm25Annual;
  provinceName: string;
  /** The unit as the reader must see it, resolved once by the section. */
  displayUnit: string;
}

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
 * header is allowed to wrap instead (`air-pollution.module.css`), which is the ordinary
 * data-table answer at that width.
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
    <details className={styles.disclosure}>
      <summary className={styles.summary}>{t("tableSummary", { start, end })}</summary>
      <table className={styles.table}>
        <caption className={styles.tableCaption}>
          {t("tableCaption", { name: provinceName, unit: displayUnit, start, end })}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.thYear}>
              {t("tableYear")}
            </th>
            <th scope="col" className={styles.thValue}>
              {t("tableValue", { unit: displayUnit })}
            </th>
          </tr>
        </thead>
        <tbody>
          {pm25.years.map((entry) => (
            <tr key={entry.year}>
              <th scope="row" className={styles.thRow}>
                {String(entry.year)}
              </th>
              <td className={styles.td}>{value(entry.valueUgM3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
