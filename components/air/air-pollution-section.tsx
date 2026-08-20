import { getFormatter, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pm25NoticeFlags } from "@/lib/air/notice-keys";
import { PM25_DECIMALS, pm25DisplayUnit, roundPm25 } from "@/lib/air/pm25-display";
import type { Pm25Annual } from "@/lib/api/types";
import { Pm25Chart } from "./pm25-chart";
import { Pm25Table } from "./pm25-table";
import styles from "./air-pollution.module.css";

interface AirPollutionSectionProps {
  pm25: Pm25Annual;
  /** The province's own name, for the heading and the chart/table labels. */
  provinceName: string;
  /** The §19 entity name in the case this section's heading takes (locative on TR). */
  headingName: string;
  /** Plaka kodu — keeps the chart's title/desc ids unique on the page. */
  plateCode: string;
  locale: Locale;
}

/**
 * Permanent deep-link anchor for the section heading. Localized so a shared link always
 * lands on the right heading; stable — treat these slugs as a public API, never renamed.
 *
 * It is a FRAGMENT, not a route: it opens no IA row and it does not consume the name of the
 * future live air-quality surface (`/hava-kalitesi`), which is a different quantity — an
 * hourly index, not an annual concentration. The api's own field description forbids
 * conflating the two, so the two names stay apart on purpose.
 */
const SECTION_ANCHOR: Record<Locale, string> = {
  tr: "hava-kirliligi",
  en: "air-pollution",
};

/**
 * "{İl}'de Uzun Dönem Hava Kirliliği" — the province page's long-term PM2.5 section
 * (ACAG SatPM2.5, 1998-2024, → DEC 2026-08-19f).
 *
 * ## It is the climate section's SIBLING, not its child
 *
 * A separate `<h2>` at the same level, directly after İklim. Nesting it as an `<h3>` inside
 * İklim would imply this is climate data; it is a different fact family, a different
 * provider and a different licence.
 *
 * ## It renders in BOTH locales, unlike the prose sections above it
 *
 * The prose sections are TR-gated because they carry hand-written Turkish with no English
 * counterpart. This section is DATA plus a symmetric vocabulary — a year, a concentration
 * and a unit — and the one long text it carries (the provider's caveat) is published in
 * English, untranslated, on both locales anyway. Same reasoning as Deniz Durumu: a wave
 * height is not a translation.
 *
 * ## THE MISREADING THIS SECTION IS BUILT AGAINST
 *
 * The value is read from the ~1 km grid cell the PROVINCE CENTRE falls in. It is not a
 * provincial average, and the interface may not even imply one (→ DEC 2026-08-19d md.1 —
 * "il ortalaması" and "nüfus-ağırlıklı ortalama" were both offered to the owner and both
 * rejected). Hence `notice.provinceCentrePoint` immediately under the value, and hence the
 * phrase "il ortalaması" appears nowhere in this repo's own copy.
 *
 * ## The four contract notices are PLACED, never stacked
 *
 * The api publishes four i18n keys. Rendering them as a block of warnings would be
 * `CONTENT-STYLE.md` §7's caveat pile and §22's forbidden class, so each sits where a reader
 * needs it: the two about what the number IS go under the value, the two about how it was
 * MADE go with the licence block that explains its provenance.
 *
 * ## The licence block
 *
 * ACAG publishes under CC BY 4.0. Every element below prints EXACTLY as the payload delivers
 * it — never translated, never abbreviated, never re-punctuated. That includes the provider's
 * own reference format, which separates authors with full stops and leaves the title
 * unquoted; it is not ours to tidy. The provider's method caveat is published verbatim, in
 * English, inside `lang="en"` (WCAG 3.1.2), with the Turkish explanation ALONGSIDE it and
 * never instead of it. Nothing in or near the block says or implies that ACAG or Washington
 * University endorses this platform (`CONVENTIONS.md` §7); the labels are labels.
 *
 * The version identity is never written in this repo. It arrives inside `workTitle` and
 * `datasetVersion`, so an annual refresh cannot leave 81 pages naming last year's licensed
 * work — the failure api PR #123's own review round closed on its side of the contract.
 */
export async function AirPollutionSection({
  pm25,
  provinceName,
  headingName,
  plateCode,
  locale,
}: AirPollutionSectionProps) {
  const t = await getTranslations("AirPollution");
  const tp = await getTranslations("ProvinceDetail");
  const format = await getFormatter();

  const headingId = SECTION_ANCHOR[locale];
  const notices = pm25NoticeFlags(pm25.attribution.noticeKeys);
  const displayUnit = pm25DisplayUnit(pm25.unit, t("unit"));
  const latestValue = format.number(roundPm25(pm25.latestValueUgM3), {
    minimumFractionDigits: PM25_DECIMALS,
    maximumFractionDigits: PM25_DECIMALS,
  });

  return (
    <section className="section" aria-labelledby={headingId}>
      {/* `tabIndex={-1}` makes this permanent deep-link target programmatically focusable,
          so Safari/VoiceOver actually move AT focus to the heading when the fragment is
          followed (the skip-link `<main>` fix, `ENGINEERING.md` §5). `.heading`'s
          scroll-margin-top clears the sticky header so it is not obscured on arrival. */}
      <h2 id={headingId} tabIndex={-1} className={styles.heading}>
        {tp("airPollutionHeading", { name: headingName })}
      </h2>

      {/* The headline figure. The YEAR comes from the payload, never hardcoded: `latestYear`
          is derived from the series' last entry and the contract does not promise 2024. */}
      <p className={styles.valueLine}>
        <span className={styles.valueLabel}>
          {t("valueLabel", { year: String(pm25.latestYear) })}
        </span>
        <span className={styles.value}>
          {latestValue} <span className={styles.valueUnit}>{displayUnit}</span>
        </span>
      </p>

      {/* Two SEPARATE paragraphs, not two spans in one: run together in a single text node
          they would concatenate without a space ("…göstermez.Değer, il ortalaması…") for
          `Ctrl+F` and for a screen reader reading the paragraph as one string. */}
      {(notices.annualMean || notices.provinceCentrePoint) && (
        <div className={styles.notices}>
          {notices.annualMean && <p className={styles.notice}>{t("notice.annualMean")}</p>}
          {notices.provinceCentrePoint && (
            <p className={styles.notice}>{t("notice.provinceCentrePoint")}</p>
          )}
        </div>
      )}

      <Pm25Chart
        pm25={pm25}
        provinceName={provinceName}
        idSuffix={plateCode}
        displayUnit={displayUnit}
      />

      {/* The WHO annual guideline level, as a PLAIN SENTENCE under the chart and never as a
          line inside it (→ DEC 2026-08-20d md.1). Our own wording around a number: WHO's
          guidelines are CC BY-NC-SA 3.0 IGO and this platform is commercial, so no WHO
          sentence may be quoted here and none may be translated (translation is an
          adaptation under that licence). There is no WHO logo and no CC-style credit block
          either — a credit block would imply we reused WHO text. The source is named inside
          the sentence and nowhere else.

          It carries no second caveat about the method mismatch between a ground-station
          guideline and a satellite-derived series: `notice.satelliteDerived` and
          `notice.gridResolution` already say exactly that, and one fact gets one home. */}
      <p className={styles.guideline}>{t("whoGuideline")}</p>

      <Pm25Table pm25={pm25} provinceName={provinceName} displayUnit={displayUnit} />

      <div className={styles.attribution}>
        {notices.satelliteDerived && (
          <p className={styles.notice}>{t("notice.satelliteDerived")}</p>
        )}

        <p className={styles.sourceLine}>
          {t.rich("sourceLine", {
            provider: pm25.attribution.providerName,
            workTitle: pm25.attribution.workTitle,
            // Deliberately NOT `nofollow`: an editorial citation to the authority the whole
            // section rests on. `nofollow` is for untrusted / paid / UGC links and using it
            // here would understate a real attribution (the climate source line's reasoning).
            source: (chunks) => (
              <a href={pm25.attribution.datasetUrl} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
        </p>

        <p className={styles.sourceLine}>
          {t.rich("licenceLine", {
            licenceName: pm25.attribution.licenceName,
            licence: (chunks) => (
              <a href={pm25.attribution.licenceUrl} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
        </p>

        <p className={styles.sourceLine}>
          {t.rich("referenceLine", {
            citation: pm25.attribution.referenceCitation,
            ref: (chunks) => (
              <a href={pm25.attribution.referenceUrl} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
        </p>

        <p className={styles.sourceLine}>{t("noticeIntro")}</p>
        {/* The provider's own caveat, VERBATIM and untranslated. `lang="en"` so a screen
            reader on the Turkish page does not read it with Turkish phonemes (WCAG 3.1.2).
            The text lives ONLY in the payload — this repo keeps no second copy of it. */}
        <p className={styles.licenceNotice} lang="en">
          {pm25.attribution.methodNoticeText}
        </p>
        {/* The Turkish explanation stands BESIDE the English caveat, never instead of it
            (`data-provenance.md` write rule, ACAG row). */}
        {notices.gridResolution && <p className={styles.notice}>{t("notice.gridResolution")}</p>}
      </div>
    </section>
  );
}
