import { getTranslations } from "next-intl/server";
import type { MarineLayer } from "@/lib/api/types";
import { ecmwfAttributionYear } from "@/lib/marine/attribution";
import styles from "./marine-attribution.module.css";

interface MarineAttributionProps {
  /** The catalogue, which carries the ingested cycle the copyright year is derived from. */
  layers: MarineLayer[];
  /** `id` of this block's `<h2>` — unique per page, since two surfaces render it. */
  headingId?: string;
}

/**
 * Attribution + licence + educational-use notice — ONE component, rendered wherever an
 * ECMWF- or CMEMS-derived value appears.
 *
 * WHY IT IS A COMPONENT NOW. In W1a this markup was inline in `/deniz` because `/deniz` was
 * the only page carrying derived material. W2 puts real values on the hub and, next, on 27
 * province pages; CC BY 4.0 and ECMWF's "shall be attached" wording require the notice to
 * travel WITH the material, not to stay on the page it was first written for. A second copy
 * of a verbatim licence text is a licence breach waiting for the day someone edits one of
 * them, so there is exactly one copy and two render sites.
 *
 * THE ENGLISH BLOCK IS NOT COPY — IT IS THE LICENCE (→ DEC 2026-08-02c, from NOVA's
 * first-hand reading of ECMWF's licence page). ECMWF's terms say the wording "shall be
 * attached", quote it, and — unlike the Copernicus framework — offer NO "or any similar
 * notice" escape. So it is published verbatim, in English, in both locales, and marked
 * `lang="en"` so a screen reader on the Turkish page does not read it with Turkish
 * phonetics (WCAG 3.1.2). The Turkish rendering stands ALONGSIDE it, never instead of it.
 * Shortening, restyling or translating any of it is a licence breach.
 *
 * It is also visible without a click on the page that carries the derived material, which is
 * the conservative reading of the licence's "prominently".
 *
 * Provider name, licence name and product class come from `data-provenance.md`'s ECMWF Open
 * Data entry, not from the payload: `MarineAttributionDto` is frozen in the contract but has
 * no endpoint and no seeded rows until M5. When it does, this component becomes data-driven
 * in ONE place — which is the whole reason it was extracted before the province surface
 * needed it.
 */
export async function MarineAttribution({
  layers,
  headingId = "marine-sources",
}: MarineAttributionProps) {
  const t = await getTranslations("Deniz");
  const tm = await getTranslations("Marine");

  // The year ECMWF's required copyright line states — the ingested cycle's own year, or
  // `null` when nothing has been ingested (see `lib/marine/attribution.ts`).
  const attributionYear = ecmwfAttributionYear(layers);

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className={styles.sources}>
        <h2 id={headingId}>{t("sourcesHeading")}</h2>
        <p>{t("sourceEcmwf")}</p>
        <p>{t("sourceEcmwfNoticeIntro")}</p>
        <div className={styles.licenceNotice} lang="en">
          {/* The copyright line is omitted — not faked — when no ECMWF cycle has been
              ingested and there is therefore no data year to state. The mandatory
              "this service is based on…" sentence carries no year and always shows. */}
          {attributionYear !== null && (
            <p>{tm("attribution.ecmwfCopyright", { year: attributionYear })}</p>
          )}
          <p>{tm("attribution.ecmwfNotice")}</p>
          <p>{tm("attribution.ecmwfDisclaimer")}</p>
        </div>
        <p>{t("sourceCmems")}</p>
        <p className={styles.disclaimer}>{tm("disclaimer.educationalOnly")}</p>
      </div>
    </section>
  );
}
