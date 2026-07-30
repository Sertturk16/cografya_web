import { getTranslations } from "next-intl/server";
import type { Climate } from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";
import { ClimateChart } from "./climate-chart";
import { ClimateTable } from "./climate-table";
import styles from "./climate.module.css";

interface ClimateSectionProps {
  climate: Climate;
  provinceName: string;
  /** Plaka kodu — used only to keep the chart's title/desc ids unique on the page. */
  plateCode: string;
  /** Active locale — selects the permanent deep-link anchor slug. */
  locale: Locale;
}

/**
 * Permanent deep-link anchor for the chart heading (PLAN §2). Localized so a shared
 * link always lands on the right heading; stable — treat these slugs as a public API,
 * never renamed. The section is TR-gated today, so the `en` slug is future-facing.
 */
const CHART_ANCHOR: Record<Locale, string> = {
  tr: "sicaklik-ve-yagis-grafigi",
  en: "temperature-and-precipitation-chart",
};

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
export async function ClimateSection({
  climate,
  provinceName,
  plateCode,
  locale,
}: ClimateSectionProps) {
  const t = await getTranslations("Climate");

  return (
    <div className={styles.section}>
      {/* tabIndex={-1} makes this permanent deep-link target programmatically focusable,
          so Safari/VoiceOver actually move AT focus to (and announce) the heading when the
          fragment is followed — matching the skip-link `<main>` fix (ENGINEERING.md §5, PR#2).
          `.heading`'s scroll-margin-top clears the sticky header so it is not visually
          obscured on arrival. */}
      <h3 id={CHART_ANCHOR[locale]} tabIndex={-1} className={styles.heading}>
        {t("chartHeading")}
      </h3>

      <ClimateChart climate={climate} provinceName={provinceName} idSuffix={plateCode} />

      <ClimateTable climate={climate} provinceName={provinceName} />

      <p className={styles.sourceLine}>
        {t.rich("sourceLine", {
          // Strings so ICU never group-separates the years (1929, not 1.929).
          start: String(climate.periodStartYear),
          end: String(climate.periodEndYear),
          // Deliberately NOT `nofollow`: this is an editorial citation to the authoritative
          // source the whole section's information-gain thesis rests on. `nofollow` is for
          // untrusted / paid / UGC links; using it here would understate a real attribution.
          mgm: (chunks) => (
            <a href={climate.sourceUrl} target="_blank" rel="noopener noreferrer">
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
