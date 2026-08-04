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
 * (PLAN §2 layout: it follows the untouchable MGM classification `<details>` (Köppen
 * caveat) and the NOVA narrative slot). MGM still supplies the climate CLASSIFICATION
 * (K1 / DEC 2026-08-04a); this component's series is what moved to ERA5-Land, and the two
 * are separately sourced on purpose. It is rendered ONLY when the province has a
 * publishable climate series
 * (`province.climate !== null`) and only on the TR locale (EN detail pages are noindex and
 * have no climate caveat text — SEO-POLICY §6). The gating lives in the page.
 *
 * Composes four things, in this order: the chart (visual), the always-visible table (the
 * readable numbers), the source line, and the provider's mandatory licence notice.
 *
 * ## The series is ERA5-Land, and the copy below is licence-bearing
 *
 * The source is **ERA5-Land monthly averaged data (C3S / Copernicus)**, not MGM — the MGM
 * series was retired from production by api #87 (DEC 2026-08-01o). Three consequences the
 * copy in this file depends on, each of which someone will eventually be tempted to "fix"
 * back:
 *
 * 1. **One dataset URL for all 81 provinces.** `climate.sourceUrl` is a single Copernicus
 *    Climate Data Store dataset page; there is no per-province source page to link, and the
 *    ICU tag is `<source>` (it was `<mgm>`).
 * 2. **1991-2020 is a REFERENCE period, not a measurement period.** ERA5-Land is a
 *    reanalysis; calling it "ölçüm dönemi" would claim station observation this data does
 *    not carry (owner-ruled with the ERA5 web leg, 2026-08-04).
 * 3. **The derived annual/seasonal figures are OURS, not the provider's** — C3S publishes a
 *    grid, never a per-province average. The source line says so explicitly, and that
 *    sentence is a binding condition carried over from the W1 ruling (DEC 2026-07-18f),
 *    re-pointed from MGM to C3S.
 *
 * The `lang="en"` block at the end is CC-BY-4.0's REQUIRED attribution notice
 * (`data-provenance.md` §0b), published verbatim and untranslated, with the Turkish
 * explanation **alongside it, never instead of it** — the same obligation and the same
 * treatment as `components/marine/marine-attribution.tsx`. Shortening, restyling or
 * translating it is a licence breach. It is byte-pinned in
 * `lib/climate/attribution-notice.test.ts`, which also asserts this component still renders
 * it — so deleting the block here fails CI rather than silently publishing derived
 * Copernicus material with no attribution.
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
          // Strings so ICU never group-separates the years (1991, not 1.991).
          start: String(climate.periodStartYear),
          end: String(climate.periodEndYear),
          // Deliberately NOT `nofollow`: this is an editorial citation to the authoritative
          // source the whole section's information-gain thesis rests on. `nofollow` is for
          // untrusted / paid / UGC links; using it here would understate a real attribution.
          // The api now serves ONE dataset URL for all 81 provinces (there is no per-province
          // page in the Copernicus Climate Data Store), so this link points at the dataset.
          source: (chunks) => (
            <a href={climate.sourceUrl} target="_blank" rel="noopener noreferrer">
              {chunks}
            </a>
          ),
        })}
      </p>

      {/* CC-BY-4.0's required notice for the ERA5-Land series (data-provenance.md §0b).
          Published VERBATIM, in English, in BOTH locales and marked `lang="en"` so a screen
          reader on the Turkish page does not read it with Turkish phonemes — the same
          treatment, and the same obligation, as the marine provider notices
          (`components/marine/marine-attribution.tsx`). The Turkish sentence above it
          EXPLAINS the notice; it never replaces it. Shortening, restyling or translating
          any of it is a licence breach.

          The year is part of the pinned text rather than a wall-clock read: it states when
          the Copernicus information was generated, and this series comes from a committed
          2026 artifact. `new Date().getFullYear()` would silently claim a later year for
          data that did not change. */}
      <p className={styles.sourceLine}>{t("sourceC3sNoticeIntro")}</p>
      <p className={styles.licenceNotice} lang="en">
        {t("attribution.c3sNotice")}
      </p>
    </div>
  );
}
