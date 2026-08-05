import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { VintageLine } from "@/components/marine/vintage-line";
import type {
  MarineHomeSummary,
  MarineMetricSummary,
  MarineScope,
} from "@/lib/home/marine-summary";
import { marineSummaryShowsValues } from "@/lib/home/marine-summary";
import { MARINE_UNIT_KEY, MARINE_VALUE_FRACTION_DIGITS } from "@/lib/marine/units";
import styles from "./home.module.css";

interface SeaTodayProps {
  /** The four-basin digest. Its emptiness IS the section's state — see the docblock. */
  summary: MarineHomeSummary;
  /** Published marine scope, for the value-less card's counts. */
  scope: MarineScope;
}

const HEADING_ID = "home-sea-heading";

/**
 * "Bugün denizler" — the homepage's marine digest, in TWO shapes.
 *
 * ## The binding rule this component is written against
 *
 * No homepage surface may PROMISE live values it cannot show. `MARINE_ENABLED=false`, a cold
 * cache and a provider outage all reach this component the same way — as an empty
 * `summary.basins` — and in that state the section does not render a skeleton, a dash or an
 * empty cell. It becomes a navigational card whose every word is **permanently true**: the
 * heading drops "bugün" entirely, the body states counts the api published, and the link to
 * `/deniz` is the same link either way. So even if the flag never flips, the homepage carries
 * no unkept promise and no §B12.2.a empty-promise section.
 *
 * ## One signal, read once
 *
 * `marineSummaryShowsValues(summary)` decides the heading, the body, the künye and — at the
 * page level — whether the licence block renders. That is the `/deniz` lesson applied
 * literally (`lib/marine/overview.ts`): a lede and an `<h2>` that computed the same question
 * separately are how a page ends up promising numbers the section below it cannot show.
 *
 * ## Nothing here reaches the head
 *
 * `<title>`, the meta description and the `<h1>` never mention the sea. A title that flips
 * between two strings across ISR windows is a worse SEO failure than a transient overpromise,
 * and the SERP would show whichever one the last crawl caught — the same reasoning `/deniz`
 * records for its own head.
 *
 * ## The künye reuses `/deniz`'s component, not a copy of its wording
 *
 * `<VintageLine>` receives exactly the values that fed the printed medians, so the per-provider
 * lines describe the numbers on screen and nothing else. Reusing it also means the homepage
 * cannot drift from `/deniz` on how a model instant is worded or formatted (absolute UTC,
 * `null` omitted rather than filled).
 */
export async function SeaToday({ summary, scope }: SeaTodayProps) {
  const t = await getTranslations("Home");
  const showValues = marineSummaryShowsValues(summary);

  return (
    <section className="section" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID}>{showValues ? t("seaHeadingValues") : t("seaHeadingNoValues")}</h2>

      {showValues ? (
        <>
          <ul className={styles.basinGrid}>
            {summary.basins.map((basin) => (
              <li key={basin.basin} className={styles.basinCard}>
                <span className={styles.basinLabel}>{basin.label}</span>
                <MetricRow label={t("seaTemperature")} metric={basin.seaSurfaceTemperature} />
                <MetricRow label={t("seaWave")} metric={basin.waveHeight} />
              </li>
            ))}
          </ul>
          <div className={styles.seaVintage}>
            <VintageLine values={summary.values} />
          </div>
        </>
      ) : (
        <p className={styles.seaScope}>
          {/* Counted from the payload, never written down — and the count-less sentence is
              what renders when even the point list is unreachable, so this paragraph can
              never read "0 denizde 0 nokta". */}
          {scope.pointCount > 0
            ? t("seaScope", {
                basins: scope.basinCount,
                points: scope.pointCount,
                provinces: scope.provinceCount,
              })
            : t("seaScopeFallback")}
        </p>
      )}

      <p className={styles.seaLink}>
        <Link href="/deniz">{t("seaLink")}</Link>
      </p>
    </section>
  );
}

/**
 * One quantity's row, or nothing at all.
 *
 * `null` covers three different contract states — `not_supported` (the Marmara has no wave
 * field, permanently), `no_data` and `unavailable` — and this surface renders all three the
 * same way: absent. A four-card digest has no room to explain a status, and printing a dash
 * would make a permanent product truth look like a fault. `/deniz` distinguishes all three
 * properly, and it is one click away.
 */
async function MetricRow({ label, metric }: { label: string; metric: MarineMetricSummary | null }) {
  if (metric === null) return null;

  // `Marine` for the unit SYMBOL (shared with `/deniz`, single-sourced), `Home` for the
  // median note (a homepage concept — `/deniz` prints per-point values and needs no such
  // caveat, so the string does not belong in the shared namespace).
  const tm = await getTranslations("Marine");
  const t = await getTranslations("Home");
  const format = await getFormatter();

  // Widened deliberately, exactly as the value cells on `/deniz` do it: `tsc` covers the units
  // the COMMITTED spec knows about, this local covers a unit that reached the payload before
  // the web regenerated its types. An unnameable unit prints no symbol rather than a
  // namespace path.
  const unitKey: string | undefined = MARINE_UNIT_KEY[metric.unit];
  const digits = MARINE_VALUE_FRACTION_DIGITS[metric.unit];

  return (
    <span className={styles.basinRow}>
      <span className={styles.basinRowLabel}>{label}</span>
      <span className={styles.basinRowValue}>
        {format.number(metric.median, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })}
        {unitKey !== undefined && <> {tm(unitKey)}</>}
      </span>
      {/* The median is labelled as a median. Without this the number reads as a measurement
          taken somewhere, which is not what it is. */}
      <span className={styles.basinRowNote}>{t("seaMedian", { count: metric.pointCount })}</span>
    </span>
  );
}
