import { getFormatter, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pm25NoticeFlags } from "@/lib/air/notice-keys";
import { PM25_DECIMALS, pm25DisplayUnit, roundPm25 } from "@/lib/air/pm25-display";
import type { Pm25Annual } from "@/lib/api/types";
import { SOURCE_NOTE } from "@/components/patterns/source-note";
import { Pm25Chart } from "./pm25-chart";
import { Pm25Table } from "./pm25-table";

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
 * THE SECTION'S SURFACE, AS BRIDGE TOKENS (T-033).
 *
 * `air-pollution.module.css` wrote every colour in this section as a raw Terra token, and the
 * `.dark` block redefines not one of them. The section renders inside a `<Card
 * variant="panel">`, so in dark mode every line below was frozen ink on a dark panel. The
 * worst reading measured anywhere in this programme was here: the **annual-mean value, the
 * headline number of the section, at 1.14:1** (`--color-ink` #2b2622 on `--card` #121e21) —
 * present in the DOM, legible to a crawler, and invisible to a reader. Its label, unit and
 * every notice around it sat at 2.15:1 (`--color-slate` #57504a).
 *
 * Bound to `text-foreground` / `text-muted-foreground` / `border-border` the same elements
 * measure 14.73:1 and 7.79:1 in dark and 14.97:1 / 7.92:1 in light — the module's own light
 * figures to the hundredth, so nothing regressed on the theme that already worked. Figures
 * from `lib/theme/contrast.ts`, recorded in
 * `.superpowers/sdd/2026-09-19-t033-css-modules/task-3-report.md`.
 *
 * The CHART is the one thing here that is deliberately NOT theme-bound: it is a data surface
 * and `components/air/pm25-chart.tsx`'s own docblock carries the measurement that says why.
 *
 * Sizes are the module's own, to the pixel, so the conversion moves colour and not layout.
 */
/** The permanent deep-link target clears the opaque sticky header on arrival. */
const HEADING = "scroll-mt-[calc(var(--header-height)+1rem)]";
/** The headline figure's line: label, number and unit on one baseline. */
const VALUE_LINE = "mt-0 mb-2.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1";
const VALUE_LABEL = "text-xs font-semibold text-muted-foreground";
/** The 1.14:1 element. The one thing in the section that is not quiet. */
const VALUE = "font-heading text-[1.9rem] font-bold leading-[1.15] tabular-nums text-foreground";
const VALUE_UNIT = "text-[1.1rem] font-semibold text-muted-foreground";
/** The editorial notices — one voice, wherever they are placed. */
const NOTICE = "mt-0 mb-1 last:mb-0 max-w-[78ch] text-[0.8rem] leading-[1.5] text-muted-foreground";
/** A reference point rather than a property of this province's series: hence the left rule. */
const GUIDELINE =
  "mt-3.5 mb-0 border-l-2 border-border py-0.5 pl-3.5 max-w-[78ch] text-[0.8rem] leading-[1.5] text-muted-foreground";
/**
 * The trailing attribution block, at the site's footnote scale (`SOURCE_NOTE`, shared with the
 * climate section above it and every map credit). `overflow-wrap` is load-bearing: the reference
 * citation is one long unbroken string with a DOI in it, which without this can push a narrow
 * viewport into horizontal scroll (WCAG 1.4.10 reflow). Links carry no colour of their own: an
 * `<a>` reads the dark-adapted `--link` from the base layer, and `SOURCE_NOTE` underlines it.
 *
 * The provider's verbatim caveat is set in the same scale with no indent rule of its own; its
 * `lang="en"` and the Turkish sentence introducing it are what mark where our prose stops.
 */
const FOOTNOTES = "mt-5 max-w-[78ch] space-y-1.5 [overflow-wrap:anywhere]";

/**
 * THERE IS NO `hideAttribution` PROP, AND THERE MUST NOT BE ONE.
 *
 * The province page used to pass one. It dropped this component's whole attribution block —
 * the ACAG source line, the CC-BY-4.0 licence line, the reference citation AND the provider's
 * own verbatim `methodNoticeText` — and delegated the credit to a per-page sources card (since
 * deleted), where the quote sat inside a `<details>` labelled "Atıf şartı & yasal metin", CLOSED
 * BY DEFAULT.
 *
 * That contradicts the criterion `components/marine/marine-attribution.tsx` states in its own
 * docblock and that this repo applies everywhere else: the notice is "visible without a click
 * on the page that carries the derived material". A disclosure the reader has to find and open
 * is a click. CC BY 4.0 also wants the credit, the licence and the reference TOGETHER with the
 * material, which is a second reason none of it was optional. Unlike the climate section's C3S
 * notice, which now lives on `/hakkimizda` behind a link, this caveat stays beside the values:
 * its text arrives per province in the API payload, so there is no static page to move it to.
 *
 * So the three components that publish provider-licensed values now agree: `MarineAttribution`
 * has no such prop, and neither does this one nor `ClimateSection`.
 */

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
    <section className="mt-10" aria-labelledby={headingId}>
      {/* `tabIndex={-1}` makes this permanent deep-link target programmatically focusable,
          so Safari/VoiceOver actually move AT focus to the heading when the fragment is
          followed (the skip-link `<main>` fix, `ENGINEERING.md` §5). `HEADING`'s
          scroll-margin-top clears the sticky header so it is not obscured on arrival. */}
      <h2 id={headingId} tabIndex={-1} className={HEADING}>
        {tp("airPollutionHeading", { name: headingName })}
      </h2>

      {/* The headline figure. The YEAR comes from the payload, never hardcoded: `latestYear`
          is derived from the series' last entry and the contract does not promise 2024. */}
      <p className={VALUE_LINE}>
        <span className={VALUE_LABEL}>{t("valueLabel", { year: String(pm25.latestYear) })}</span>
        <span className={VALUE}>
          {latestValue} <span className={VALUE_UNIT}>{displayUnit}</span>
        </span>
      </p>

      {/* Two SEPARATE paragraphs, not two spans in one: run together in a single text node
          they would concatenate without a space ("…göstermez.Değer, il ortalaması…") for
          `Ctrl+F` and for a screen reader reading the paragraph as one string. */}
      {(notices.annualMean || notices.provinceCentrePoint) && (
        <div className="mt-0 mb-[18px] max-w-[68ch]">
          {notices.annualMean && <p className={NOTICE}>{t("notice.annualMean")}</p>}
          {notices.provinceCentrePoint && (
            <p className={NOTICE}>{t("notice.provinceCentrePoint")}</p>
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
      <p className={GUIDELINE}>{t("whoGuideline")}</p>

      <Pm25Table pm25={pm25} provinceName={provinceName} displayUnit={displayUnit} />

      {/* ALWAYS RENDERED — see the "no `hideAttribution` prop" note above. */}
      <div className={FOOTNOTES}>
        {notices.satelliteDerived && <p className={SOURCE_NOTE}>{t("notice.satelliteDerived")}</p>}

        {/* Dataset · licence · reference — the three things CC BY 4.0 asks to travel with the
            material, as ONE footnote line. Three separately-keyed runs, so each keeps its own
            ICU tag and payload fields; the `{" · "}` between them is what separates them in
            `textContent` as well as on screen.

            Every link is deliberately NOT `nofollow`: an editorial citation to the authority the
            whole section rests on. `nofollow` is for untrusted / paid / UGC links and using it
            here would understate a real attribution (the climate source line's reasoning). */}
        <p className={SOURCE_NOTE}>
          {t.rich("sourceLine", {
            provider: pm25.attribution.providerName,
            workTitle: pm25.attribution.workTitle,
            source: (chunks) => (
              <a href={pm25.attribution.datasetUrl} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
          {" · "}
          {t.rich("licenceLine", {
            licenceName: pm25.attribution.licenceName,
            licence: (chunks) => (
              <a href={pm25.attribution.licenceUrl} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
          {" · "}
          {t.rich("referenceLine", {
            citation: pm25.attribution.referenceCitation,
            ref: (chunks) => (
              <a href={pm25.attribution.referenceUrl} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
        </p>

        <p className={SOURCE_NOTE}>{t("noticeIntro")}</p>
        {/* The provider's own caveat, VERBATIM and untranslated. `lang="en"` so a screen
              reader on the Turkish page does not read it with Turkish phonemes (WCAG 3.1.2).
              The text lives ONLY in the payload — this repo keeps no second copy of it. */}
        <p className={SOURCE_NOTE} lang="en">
          {pm25.attribution.methodNoticeText}
        </p>
        {/* The Turkish explanation stands BESIDE the English caveat, never instead of it
              (`data-provenance.md` write rule, ACAG row). */}
        {notices.gridResolution && <p className={SOURCE_NOTE}>{t("notice.gridResolution")}</p>}
      </div>
    </section>
  );
}
