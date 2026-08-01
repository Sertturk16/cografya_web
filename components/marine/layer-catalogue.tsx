import { getFormatter, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { MarineLayer } from "@/lib/api/types";
import { marineLayerState } from "@/lib/marine/layer-state";
import { MODEL_INSTANT_FORMAT, parseModelInstant } from "@/lib/marine/model-run";
import styles from "./marine.module.css";

interface LayerCatalogueProps {
  locale: Locale;
  layers: MarineLayer[];
}

/** The section's heading id — the `<h2>` and this section's `aria-labelledby`. */
const HEADING_ID = "deniz-layer-catalogue";

/**
 * Exhaustive enum → message-key maps.
 *
 * `Record<Union, …>` rather than a template literal (`t(`unit.${layer.unit}`)`) on purpose:
 * a template key compiles no matter what, so an enum value added to the contract would ship
 * a missing-key crash. These maps fail at `tsc` instead — the same reason the `/oyun` page
 * spells its mode tuple out by hand.
 *
 * `tsc` only guards the values the COMMITTED spec knows about, though. Between an api
 * deploy that adds an enum value and the web regenerating its types, the api can send one
 * these maps have never heard of; the lookup is then `undefined` at runtime and next-intl
 * renders the namespace name ("Marine") into an indexable table cell. So every lookup below
 * is read into a `string | undefined` local and falls back to the empty-cell treatment —
 * a value we cannot label honestly is shown as absent, never as a nonsense word.
 */
const UNIT_KEY: Record<MarineLayer["unit"], string> = {
  m: "unit.m",
  celsius: "unit.celsius",
  degree_true: "unit.degree_true",
  meter_per_second: "unit.meter_per_second",
};

const DIRECTION_KEY: Record<"from" | "towards", string> = {
  from: "direction.from",
  towards: "direction.towards",
};

const SOURCE_KEY: Record<"cmems" | "ecmwf", string> = {
  cmems: "source.cmems",
  ecmwf: "source.ecmwf",
};

/**
 * The measurement catalogue — what the platform measures, in which unit, from which
 * provider, and (for the layers whose model cycle has actually been ingested) the model
 * künye behind it.
 *
 * THIS TABLE PUBLISHES NO VALUE. There is no wind speed, wave height or sea temperature on
 * this page: the value endpoints are frozen in the contract but not mounted until M4, and
 * inventing, estimating or rounding one here would be the exact failure the whole marine
 * SPEC is written against. What it publishes is the künye — cycle frequency, forecast
 * horizon, catalogue timestamp — which is derived from ECMWF Open Data and therefore
 * attributed in the page's "Kaynaklar" block (CC BY 4.0, `data-provenance.md`).
 *
 * Three honesty rules are implemented here rather than argued each time:
 *
 * 1. **Absolute UTC instants, never relative.** On an ISR page "2 hours ago" is computed
 *    once and then cached into being wrong; an absolute stamp only gets older
 *    (`lib/marine/model-run.ts`).
 * 2. **Null is a state, not an unknown.** A layer with no ingested cycle says so in words
 *    ("Sıradaki aşama" + "Model künyesi sıradaki aşamada yayımlanacak") — no invented date,
 *    no "coming soon", no estimate.
 * 3. **The all-null render is a first-class case, not an edge case.** With
 *    `MARINE_ENABLED=false` (today's production default) or a stopped ingest, EVERY row is
 *    in that state and the table must still read correctly.
 *
 * The provider `colorStops` are deliberately unused: there is no value to paint, and when
 * there is, those are public-safety data ramps that stay standard (`DESIGN.md` §6.2).
 */
export async function LayerCatalogue({ locale, layers }: LayerCatalogueProps) {
  const t = await getTranslations("Deniz");
  const tm = await getTranslations("Marine");
  const format = await getFormatter();

  const notApplicable = tm("catalogue.notApplicable");

  /** An empty cell that announces WHY it is empty (an em-dash is invisible to AT). */
  const emptyCell = (
    <>
      <span aria-hidden="true">—</span>
      <span className={styles.srOnly}>{notApplicable}</span>
    </>
  );

  const instant = (value: Date) => format.dateTime(value, MODEL_INSTANT_FORMAT);

  /** Resolves a catalogue enum, or `null` when the contract has moved ahead of this build. */
  const label = (key: string | undefined): string | null => (key === undefined ? null : tm(key));

  return (
    <section className="section" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID}>{t("catalogueHeading")}</h2>

      <div
        className={styles.tableScroll}
        role="region"
        aria-label={tm("catalogue.scrollRegionLabel")}
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className={styles.caption}>{tm("catalogue.caption")}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.th}>
                {tm("catalogue.colQuantity")}
              </th>
              <th scope="col" className={styles.th}>
                {tm("catalogue.colUnit")}
              </th>
              <th scope="col" className={styles.th}>
                {tm("catalogue.colDirection")}
              </th>
              <th scope="col" className={styles.th}>
                {tm("catalogue.colCalm")}
              </th>
              <th scope="col" className={styles.th}>
                {tm("catalogue.colSource")}
              </th>
              <th scope="col" className={styles.th}>
                {tm("catalogue.colStatus")}
              </th>
              <th scope="col" className={styles.th}>
                {tm("catalogue.colModelRun")}
              </th>
            </tr>
          </thead>
          <tbody>
            {layers.map((layer) => {
              const state = marineLayerState(layer);
              // Widened to `string | undefined` deliberately: `tsc` proves the maps cover
              // today's contract, these locals cover tomorrow's payload.
              const unitKey: string | undefined = UNIT_KEY[layer.unit];
              const directionKey: string | undefined =
                layer.directionConvention === null
                  ? undefined
                  : DIRECTION_KEY[layer.directionConvention];
              const sourceKey: string | undefined = SOURCE_KEY[layer.primarySource];
              const fallbackKey: string | undefined =
                layer.fallbackSource === null ? undefined : SOURCE_KEY[layer.fallbackSource];

              const unit = label(unitKey);
              const direction = label(directionKey);
              const source = label(sourceKey);
              const fallback = label(fallbackKey);
              const horizon = parseModelInstant(layer.horizonEndUtc);
              const catalogueUpdated = parseModelInstant(layer.catalogueUpdatedAtUtc);

              return (
                <tr key={layer.id}>
                  <th scope="row" className={styles.thRow}>
                    {locale === "en" ? layer.labelEn : layer.labelTr}
                  </th>
                  <td className={styles.td}>{unit ?? emptyCell}</td>
                  <td className={styles.td}>{direction ?? emptyCell}</td>
                  <td className={`${styles.td} ${styles.tdNumeric}`}>
                    {layer.calmThreshold !== null && unit !== null
                      ? `${format.number(layer.calmThreshold, { maximumFractionDigits: 2 })} ${unit}`
                      : emptyCell}
                  </td>
                  <td className={styles.td}>
                    {source ?? emptyCell}
                    {fallback !== null && (
                      <span className={styles.sourceFallback}>
                        {tm("source.fallback", { source: fallback })}
                      </span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className={state === "live" ? styles.statusLive : styles.statusNext}>
                      {state === "live" ? tm("status.live") : tm("status.notSupported")}
                    </span>
                  </td>
                  <td className={styles.td}>
                    {state === "live" ? (
                      <ul className={styles.runList}>
                        {layer.updateFrequency !== null && (
                          <li>{tm("catalogue.cycle", { value: layer.updateFrequency })}</li>
                        )}
                        {horizon !== null && (
                          <li>{tm("catalogue.horizon", { value: instant(horizon) })}</li>
                        )}
                        {catalogueUpdated !== null && (
                          <li>
                            {tm("catalogue.catalogueUpdated", {
                              value: instant(catalogueUpdated),
                            })}
                          </li>
                        )}
                      </ul>
                    ) : (
                      tm("catalogue.noModelRun")
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.tableNote}>{tm("catalogue.calmNote")}</p>
    </section>
  );
}
