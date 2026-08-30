import { getTranslations } from "next-intl/server";
import type { EarthquakeAttribution as EarthquakeAttributionRow } from "@/lib/api/types";
import styles from "./earthquake.module.css";

interface EarthquakeAttributionProps {
  attributions: readonly EarthquakeAttributionRow[];
  /**
   * The early-warning liability sentence (`EarthquakeMetaDto.disclaimerTr`) — owner-ruled
   * verbatim (`DEC 2026-08-19l`), Turkish-only, no `disclaimerEn` field exists in the
   * contract. OPTIONAL (PR-B): `disclaimerTr` lives only on `GET /api/earthquakes/meta`, not on
   * `EarthquakeListDto.meta` (the shape `getProvinceEarthquakesSafe` returns), so the province
   * section — which renders the mandatory `attributions` that travel with every AFAD-derived
   * value it shows, the same "attribution may not go missing where a derived value appears"
   * rule `MarineAttribution` already applies — omits it rather than paying a second, dedicated
   * `/meta` fetch on all 81 province pages for a sentence the hub already carries and this
   * section's own unconditional hub-link (`ProvinceEarthquakeSection`) makes one click away.
   */
  disclaimerTr?: string;
  /** `id` of this block's `<h2>` — unique per page. */
  headingId?: string;
  /**
   * The block's heading. Defaults to `Earthquake.sourcesHeading` ("Kaynaklar") for the hub; the
   * province page passes its own (`ProvinceDetail.earthquakeSourcesHeading`), because that page
   * already carries a Kaynaklar line for its own facts — the identical reuse-with-its-own-
   * heading pattern `MarineAttribution` already establishes for its own two render sites. ONLY
   * the heading is overridable; every licence string below is single-sourced and verbatim.
   */
  heading?: string;
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
 *
 * SECOND CONSUMER (PR-B): the province pages (`app/[locale]/turkiye/[slug]/page.tsx`) render
 * this same component for the mandatory AFAD attribution that travels with the province
 * section's own events — `heading`/`disclaimerTr` above are what changed to support that.
 */
export async function EarthquakeAttribution({
  attributions,
  disclaimerTr,
  headingId = "deprem-sources",
  heading,
}: EarthquakeAttributionProps) {
  const t = await getTranslations("Earthquake");

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className={styles.sources}>
        <h2 id={headingId}>{heading ?? t("sourcesHeading")}</h2>
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
        {disclaimerTr !== undefined && (
          <p className={styles.disclaimer} lang="tr">
            {disclaimerTr}
          </p>
        )}
      </div>
    </section>
  );
}
