import { getFormatter, getTranslations } from "next-intl/server";
import type { Climate } from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";
import { cellFallbackDisplayKm } from "@/lib/climate/cell-fallback";
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
 * Which climate sources owe the fixed model/reading-method disclosure (SPEC §9.2-1/§9.2-2).
 *
 * The disclosure is not rendered unconditionally, because it is not a property of this
 * component — it is a CONSTANT OF THE SOURCE, and SPEC §9.2 says so in as many words:
 * "çözünürlük/yöntem, kaynağın sabitleridir ve web copy'sinde `source` token'ına
 * anahtarlanır." Keying it to the token is what stops ERA5-Land's reading method from being
 * claimed for a series that is read some other way.
 *
 * A `Record` over the token type rather than an `if`, deliberately: `ClimateDto.source` is a
 * closed enum, so the day the contract carries a second source id this object stops
 * compiling and a human decides what that source owes. An `if` would just fall through and
 * publish nothing, which is the quieter and worse failure. There is no dead branch here —
 * one source exists today and it has one entry.
 */
const SOURCE_OWES_METHOD_DISCLOSURE: Record<Climate["source"], boolean> = {
  era5_land_monthly: true,
};

/**
 * D2 — the wide-screen dead space under the climate table (UX tour D2, frames `11`/`13`).
 *
 * At 1440 the page's content column is 1080 px. The chart row fills it, then `.tableScroll`
 * stops at its deliberate 560 px cap and leaves ~520 × 500 px of empty parchment to its right,
 * while the "Benzer İklime Sahip İller" grid below fills 1080 again — one page, two rhythms.
 * The 560 px cap itself is CORRECT and stays (a 3-column table sprayed across 1080 px pulls
 * each number away from its month label; the reason is written next to the rule).
 *
 * Two treatments go to the owner as rendered samples; the plan deliberately does NOT pick one
 * (→ DEC 2026-08-08a md.4). The LOSER IS DELETED BEFORE MERGE — two implementations of the
 * same decision never land together (DEC 2026-08-05g md.1).
 *
 * - **`rails`** — at ≥ 1024 px the trailing content becomes a two-column row whose columns use
 *   the SAME flex basis as the chart row above, so the table lands directly under the chart at
 *   the same edges and the source + licence blocks fill what used to be dead space. DOM order
 *   is untouched (table, source, notice), and left→right reading order equals DOM order, so
 *   WCAG 1.3.2 holds by construction rather than by argument.
 * - **`minimal`** — one line: the table cap moves 560 → 720 px. It SHRINKS the dead space
 *   without closing it, and takes no structural risk at all. Still far below 1080, so the
 *   number-to-label association the 560 px cap protects is intact.
 */
/**
 * The shipped D2 treatment. `minimal` — the one-line variant that moved the table cap
 * 560 → 720 px — is DELETED rather than merged alongside it (DEC 2026-08-05g md.1), which is
 * the rule the docblock above already quoted.
 */
export const D2_VARIANT = "rails" as const;

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
 * Composes five things, in this order: the chart (visual), the always-visible table (the
 * readable numbers), the source line, the fixed model/reading-method disclosure, and the
 * provider's mandatory licence notice.
 *
 * ## The disclosure is a RULING's condition, not a footnote
 *
 * SPEC §9.2-1 and §9.2-2 require the series to declare, where a reader can see it, that these
 * are model values rather than station measurements and which point they are read at. The
 * second half is sharper than it looks: A-1 permits five coastal provinces to be read from the
 * nearest LAND cell instead of the cell their own administrative point falls in, and permits it
 * only on condition that the shift is DECLARED — a condition that "ancak kullanıcı yüzeyinde
 * görünürse sağlanır" (SPEC §9.2-2). Until this block existed, Antalya published numbers
 * sampled 7,55 km from its administrative point and said nothing about it.
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
  const format = await getFormatter();
  // `null` for 76 of 81 — those provinces have no declared shift, which is a fact about them
  // and not a gap in the data (see `cell-fallback.ts`).
  const fallbackKm = cellFallbackDisplayKm(plateCode);

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

      {/* D2 — see the D2_VARIANT docblock. `.detailRow` carries NO layout of its own below the
          1024 px breakpoint, so narrow viewports render exactly today's single-column stack.
          Nothing here reorders the DOM. */}
      <div className={`${styles.detailRow} ${styles.d2Rails}`}>
        <ClimateTable climate={climate} provinceName={provinceName} />

        <div className={styles.detailAside}>
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

          {/* SPEC §9.2-1 / §9.2-2 — the model + reading-method disclosure, in the FIXED
          provenance block rather than in body prose, because §9.2-1 puts it there in as many
          words ("sabit provenance/caveat bloğunda (gövde prose'unda DEĞİL)") and §9.2-2 asks
          for the reading-method line in that SAME block.

          Two sentences, and neither is decoration. `climate.sourceUrl` is a single dataset
          page shared by all 81 provinces and every number above is sampled from a grid cell,
          so without these a reader has nothing on the page telling them the values are
          neither a station reading nor a provincial average. The wording deliberately follows
          the two blocks that already sit on this same page — `Deniz.sourceCmems` ("…istasyon
          ölçümü değildir") and `AirPollution.notice.provinceCentrePoint` ("Değer, il
          ortalaması değildir…") — so one page does not describe the same class of fact in
          three different vocabularies.

          The ~0,1° figure in `notice.reanalysis` comes from the provenance ledger and from
          nowhere else. It was withheld from the first draft of this block precisely because
          the ledger did not carry it yet and `SPEC.md` and the api README are not substitutes
          for a ledger row; it landed as the C3S/ERA5-Land addendum in
          `provenance/integrations.md` (NOVA, 2026-08-21, measured from the publisher's own
          dataset page) and only then was written here.

          Two things that row settles, and that a later edit must not undo:
          1. **`~0,1°` is the regridded lat-lon product we actually consume.** The publisher
             also states a `9 km` NATIVE Gaussian-grid resolution; that is not our grid and it
             does not belong in this copy.
          2. **No kilometre equivalent of 0,1° may be written here.** It varies with latitude,
             so it would be our derived number wearing the publisher's authority.

          The period is a separate fact from the resolution and is already handled correctly by
          the source line above: 1991-2020 is OUR chosen WMO normal window, not the dataset's
          coverage (which starts in 1950), and the copy says "referans dönemi" rather than
          claiming a dataset period. */}
          {SOURCE_OWES_METHOD_DISCLOSURE[climate.source] && (
            <div className={styles.notices}>
              <p className={styles.notice}>{t("notice.reanalysis")}</p>
              <p className={styles.notice}>{t("notice.readingPoint")}</p>
              {/* A-1's declared shift, on the five provinces it applies to (A-5 ruled: static
                  web copy, `lib/climate/cell-fallback.ts`). The other 76 render nothing here —
                  the line above already describes them correctly, and an "eksik veri"
                  placeholder for a province that HAS no shift would be a CONTENT-STYLE §22
                  violation as well as false.

                  The distance is rounded ONCE, inside the lookup, and the formatter is asked
                  for nothing but the locale's decimal separator. Passing the already-formatted
                  string keeps ICU from touching the number a second time — the same reason the
                  source line above passes its years as strings. */}
              {fallbackKm !== null && (
                <p className={styles.notice}>
                  {t("notice.cellFallback", {
                    km: format.number(fallbackKm, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }),
                  })}
                </p>
              )}
            </div>
          )}

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
      </div>
    </div>
  );
}
