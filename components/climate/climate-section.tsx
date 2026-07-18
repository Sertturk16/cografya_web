import { getTranslations } from "next-intl/server";
import type { Climate } from "@/lib/api/types";
import { ClimateChart } from "./climate-chart";
import { ClimateTable } from "./climate-table";
import styles from "./climate.module.css";

interface ClimateSectionProps {
  climate: Climate;
  provinceName: string;
  /** Plaka kodu — used only to keep the chart's title/desc ids unique on the page. */
  plateCode: string;
}

/**
 * The "Sıcaklık ve Yağış Grafiği" block — a new `<h3>` INSIDE the existing İklim `<h2>`
 * (PLAN §2 layout: it follows the untouchable MGM methodology `<details>` and the NOVA
 * narrative slot). It is rendered ONLY when the province has a publishable climate series
 * (`province.climate !== null`) and only on the TR locale (EN detail pages are noindex and
 * have no climate caveat text — SEO-POLICY §6). The gating lives in the page.
 *
 * Composes the chart (visual), the always-visible table (the readable numbers), and the
 * MGM source line. The source line links MGM with the per-province URL + measurement
 * period, and explicitly attributes the derived annual/seasonal figures to US, not MGM
 * (DEC 2026-07-18f binding condition — MGM's own "Yıllık" column is empty).
 */
export async function ClimateSection({ climate, provinceName, plateCode }: ClimateSectionProps) {
  const t = await getTranslations("Climate");

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{t("chartHeading")}</h3>

      <ClimateChart climate={climate} provinceName={provinceName} idSuffix={plateCode} />

      <ClimateTable climate={climate} provinceName={provinceName} />

      <p className={styles.sourceLine}>
        {t.rich("sourceLine", {
          // Strings so ICU never group-separates the years (1929, not 1.929).
          start: String(climate.periodStartYear),
          end: String(climate.periodEndYear),
          mgm: (chunks) => (
            <a href={climate.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
