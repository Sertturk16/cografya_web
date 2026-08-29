import { getTranslations } from "next-intl/server";
import type { EarthquakeAttribution as EarthquakeAttributionRow } from "@/lib/api/types";
import styles from "./earthquake.module.css";

interface EarthquakeAttributionProps {
  attributions: readonly EarthquakeAttributionRow[];
  /** The early-warning liability sentence (`EarthquakeMetaDto.disclaimerTr`) — owner-ruled
   *  verbatim (`DEC 2026-08-19l`), Turkish-only, no `disclaimerEn` field exists in the
   *  contract. */
  disclaimerTr: string;
  /** `id` of this block's `<h2>` — unique per page. */
  headingId?: string;
}

/**
 * Attribution + the early-warning disclaimer — rendered verbatim, never re-authored (§5.8,
 * `deprem-sayfalari` plan).
 *
 * Structurally simpler than `MarineAttribution`: unlike ECMWF/CMEMS (web-authored intro
 * sentences wrapped around an API-absent licence string), every substantive string here —
 * `providerName`, `requiredNoticeTr`, `regulationReference`, `disclaimerTr` — arrives ALREADY
 * FORMED in the api payload (`provenance/integrations.md`'s AFAD row; `EarthquakeMetaDto`'s own
 * docblock for `disclaimerTr`). This component renders them exactly as delivered; it authors
 * no attribution text and no disclaimer text of its own.
 *
 * Every TR-only string here carries `lang="tr"` unconditionally — including on `/en/earthquakes`,
 * where it is the ONLY Turkish text on an otherwise fully-indexable English page (WCAG 3.1.2:
 * a screen reader must not read Turkish text with English phonetics). This is the mirror image
 * of `MarineAttribution`'s `lang="en"` blocks, same reasoning, opposite direction.
 *
 * SERVER-ONLY on purpose, unlike `EarthquakeMap`/`EarthquakeList`: attribution and the
 * disclaimer never change with the client filter island's re-fetch (§5.5 filters only the
 * event window, never the source), so this block stays outside that island and keeps its
 * server-only `getTranslations` call.
 */
export async function EarthquakeAttribution({
  attributions,
  disclaimerTr,
  headingId = "deprem-sources",
}: EarthquakeAttributionProps) {
  const t = await getTranslations("Earthquake");

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className={styles.sources}>
        <h2 id={headingId}>{t("sourcesHeading")}</h2>
        {attributions.map((attribution) => (
          <p key={attribution.providerId} lang="tr">
            {attribution.requiredNoticeTr}
            {attribution.regulationReference !== "" && (
              <span className={styles.regulationReference}>
                {" "}
                ({attribution.regulationReference})
              </span>
            )}
          </p>
        ))}
        <p className={styles.disclaimer} lang="tr">
          {disclaimerTr}
        </p>
      </div>
    </section>
  );
}
