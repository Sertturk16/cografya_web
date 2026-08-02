import { getTranslations } from "next-intl/server";
import type { MarineLayer } from "@/lib/api/types";
import { ecmwfAttributionYear } from "@/lib/marine/attribution";
import styles from "./marine-attribution.module.css";

interface MarineAttributionProps {
  /** The catalogue, which carries the ingested cycle the copyright year is derived from. */
  layers: MarineLayer[];
  /** `id` of this block's `<h2>` — unique per page, since two surfaces render it. */
  headingId?: string;
  /**
   * The block's heading. Defaults to `/deniz`'s "Kaynaklar ve kullanım"; the province page
   * passes its own, because that page already carries a Kaynaklar line for its own facts and
   * two identically-titled sources surfaces would leave the reader guessing which is which.
   * ONLY the heading is overridable — every licence string below is single-sourced and
   * verbatim, and none of it is a prop.
   */
  heading?: string;
}

/**
 * Attribution + licence + educational-use notice — ONE component, rendered wherever an
 * ECMWF- or CMEMS-derived value appears.
 *
 * WHY IT IS A COMPONENT. In W1a this markup was inline in `/deniz` because `/deniz` was the
 * only page carrying derived material. W2a put real values on the hub and W2b put them on the
 * 27 coastal province pages; CC BY 4.0 and ECMWF's "shall be attached" wording require the
 * notice to travel WITH the material, not to stay on the page it was first written for. A
 * second copy of a verbatim licence text is a licence breach waiting for the day someone edits
 * one of them, so there is exactly one copy and two render sites — and the province site is
 * gated on the SAME signal as the values it accompanies (`provinceShowsMarine`), so the notice
 * can neither go missing where a value appears nor appear where none does.
 *
 * THE ENGLISH BLOCKS ARE NOT COPY — THEY ARE THE LICENCE (→ DEC 2026-08-02c, from NOVA's
 * first-hand reading of ECMWF's licence page). ECMWF's terms say the wording "shall be
 * attached", quote it, and — unlike the Copernicus framework — offer NO "or any similar
 * notice" escape. So it is published verbatim, in English, in both locales, and marked
 * `lang="en"` so a screen reader on the Turkish page does not read it with Turkish
 * phonetics (WCAG 3.1.2). The Turkish rendering stands ALONGSIDE it, never instead of it.
 * Shortening, restyling or translating any of it is a licence breach.
 *
 * THE SAME RULE NOW COVERS COPERNICUS MARINE (added in the PR #36 review round; Atlas ruling
 * 2026-08-02 on M4a's machine-verified licence record). W1a's Turkish sentence truthfully
 * said no CMEMS-derived VALUE was on the page; W2a puts sea surface temperature and part of
 * the wave field on it, and the licence's attribution obligation travels with the derived
 * material. The required notice is the single sentence
 * "Generated using E.U. Copernicus Marine Service Information" — published verbatim, in
 * English, `lang="en"`, exactly like the ECMWF block, with the Turkish explanation alongside
 * rather than instead. The per-dataset DOIs are the reference layer and live in
 * `data-provenance.md`, not on the page: five DOI strings in a reader-facing block would
 * crowd out the notice that is actually mandatory.
 *
 * NO ENDORSEMENT, EITHER DIRECTION (`CONVENTIONS.md` §7, from ADS ToS art. 5). These blocks
 * state the SOURCE of the data. Nothing here may read as "ECMWF onaylı", "resmî Copernicus
 * verisi" or any other claim that a provider or the EU endorses this platform.
 *
 * They are also visible without a click on the page that carries the derived material, which
 * is the conservative reading of the licence's "prominently".
 *
 * Provider names, licence names and product classes come from `data-provenance.md`, not from
 * the payload: `MarineAttributionDto` is frozen in the contract but has no endpoint and no
 * seeded rows until M5. When it does, this component becomes data-driven in ONE place —
 * which is the whole reason it was extracted before the province surface needed it.
 */
export async function MarineAttribution({
  layers,
  headingId = "marine-sources",
  heading,
}: MarineAttributionProps) {
  const t = await getTranslations("Deniz");
  const tm = await getTranslations("Marine");

  // The year ECMWF's required copyright line states — the ingested cycle's own year, or
  // `null` when nothing has been ingested (see `lib/marine/attribution.ts`).
  const attributionYear = ecmwfAttributionYear(layers);

  return (
    <section className="section" aria-labelledby={headingId}>
      <div className={styles.sources}>
        <h2 id={headingId}>{heading ?? t("sourcesHeading")}</h2>
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
        <p>{t("sourceCmemsNoticeIntro")}</p>
        <div className={styles.licenceNotice} lang="en">
          {/* One sentence, and it is the whole obligation. No copyright year: the Copernicus
              Marine licence attaches its notice to the SERVICE, not to a data year, so there
              is nothing here to derive from an ingested cycle and nothing to omit when there
              is none. */}
          <p>{tm("attribution.cmemsNotice")}</p>
        </div>
        <p className={styles.disclaimer}>{tm("disclaimer.educationalOnly")}</p>
      </div>
    </section>
  );
}
