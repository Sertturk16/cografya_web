import { getTranslations } from "next-intl/server";
import type { MarineLayer } from "@/lib/api/types";
import { ecmwfAttributionYear } from "@/lib/marine/attribution";
import { Card } from "@/components/ui/card";

/**
 * TAILWIND, NOT THE V1 STYLESHEET — and the reason is a contrast defect, not tidiness.
 *
 * `marine-attribution.module.css` set every paragraph to `var(--color-slate)`, a RAW Terra token.
 * Raw Terra tokens are frozen at their light values and do not redefine under `.dark`, so on the
 * V2 pages this block now renders on, the mandated licence text measured **2.34:1** against the
 * dark page (`#57504a` on `#0b1416`) — below even the 3:1 large-text floor, at 13.6px. The text a
 * licence requires to be published "prominently" was the least readable thing on the page.
 *
 * The bridge tokens (`text-foreground`, `text-muted-foreground`, `border-border`) redefine per
 * theme, which is the whole reason they exist. The V1 stylesheet also carried `className="section"`
 * — a global V1 utility on T-032 PR4's deletion list — and its `max-width: 70ch` sat on a block
 * with no page padding of its own, so the licence text ran flush to the viewport edge inside the
 * V2 layout. All three problems have the same fix.
 */
const BODY = "text-sm leading-relaxed text-muted-foreground";

/**
 * The provider's own required wording, published verbatim in English (→ DEC 2026-08-02c). Set in
 * a quieter, indented block so a Turkish reader can see where the platform's prose stops and the
 * licence text begins — still full-size body text on the page, never hidden behind a disclosure
 * ("prominently", per the licence).
 *
 * `wrap-break-word` — the same `overflow-wrap: break-word` its neighbours on `/hakkimizda`
 * already carry for the same reason (the JRC citation's DOI link, the ODbL repo address). The
 * ECMWF notice's own unbreakable URL (`https://creativecommons.org/licenses/by/4.0/`) pushed the
 * document to 328px against a 305px viewport at 320px width; `overflow-wrap` is an inherited
 * property, so setting it here on the wrapping `<div>` covers all three `<p>` children without
 * touching any of them individually — the licence text itself is untouched.
 */
const LICENCE =
  "my-3 border-l-2 border-border py-0.5 pl-3.5 text-[0.85rem] leading-relaxed text-muted-foreground space-y-2 wrap-break-word";

/**
 * The licence / educational-use notice is an UNTOUCHABLE copy class (CONTENT-STYLE §22): it stays
 * formal and complete. Set apart visually so it reads as a notice rather than as another
 * paragraph of body copy.
 */
const DISCLAIMER =
  "mt-3.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground";

interface MarineAttributionProps {
  /** The catalogue, which carries the ingested cycle the copyright year is derived from. */
  layers: MarineLayer[];
  /** `id` of this block's `<h2>`, for its `aria-labelledby`. */
  headingId?: string;
  /**
   * The block's heading. Defaults to `/deniz`'s "Kaynaklar ve kullanım"; `/hakkimizda` — the
   * one page that renders this block today — passes its own, because that page already carries
   * a sources colophon for the map and flag data and two identically-titled sources surfaces
   * would leave the reader guessing which licence covers what. ONLY the heading is overridable
   * — every licence string below is single-sourced and verbatim, and none of it is a prop.
   */
  heading?: string;
}

/**
 * Attribution + licence + educational-use notice — ONE component, rendered wherever an
 * ECMWF- or CMEMS-derived value appears.
 *
 * WHERE IT RENDERS, AND THE READING THAT WAS CORRECTED.
 *
 * The earlier reading, recorded here and acted on for seven releases, was:
 *
 *   "CC BY 4.0 and ECMWF's 'shall be attached' wording require the notice to travel WITH the
 *   material, not to stay on the page it was first written for."
 *
 * That is more conservative than the licence requires, and the licence says so in terms. CC BY
 * 4.0 §3(a)(2): "You may satisfy the conditions in Section 3(a)(1) in any reasonable manner
 * based on the medium, means, and context in which You Share the Licensed Material. For
 * example, it may be reasonable to satisfy the conditions by providing a URI or hyperlink to a
 * resource that includes the required information." ECMWF Open Data IS CC BY 4.0, and the
 * Copernicus Marine framework is looser still. A hyperlink to a page that publishes the notice
 * is a compliant way to attach it.
 *
 * So on the owner's decision the licence notices CENTRALIZE: this block renders EXACTLY ONCE,
 * on `/hakkimizda` (`/en/about`), and the seven surfaces that publish a derived value carry
 * `components/marine/marine-data-notice.tsx` — the safety disclaimer plus a link to that page.
 * The old sentence is kept above rather than deleted because it is the reasoning a future
 * reader will otherwise re-derive: the conclusion changed, the licence did not.
 *
 * WHAT DID NOT MOVE. `Marine.disclaimer.educationalOnly` — "not for maritime, navigational or
 * safety-of-life decisions" — is NOT a licence notice, no licence clause governs where it goes,
 * and a reader looking at a sea temperature needs it beside the numbers. It travels with every
 * value, and `MarineDataNotice` is what carries it there. This block renders it too, on the one
 * page it now lives on, because there is no prop here that could switch it off and there must
 * not be one.
 *
 * NOR DID THE MAP CREDITS, NOR THE CLIMATE AND AIR NOTICES. OpenStreetMap's guidance asks for
 * the credit ON a browsable map, which is a different requirement from CC BY 4.0's, so
 * `MapAttribution` is untouched. `ClimateSection` and `AirPollutionSection` keep their inline
 * ERA5-Land and ACAG blocks: the decision recorded here was taken about the marine licences and
 * was not extended to them, and the criterion those two files cite from this docblock — visible
 * without a click on the page carrying the values — still governs them.
 *
 * A second copy of a verbatim licence text is a licence breach waiting for the day someone edits
 * one of them, so there is exactly ONE copy of each string, in `messages/{tr,en}.json`, read
 * here and nowhere else.
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
 * They are visible without a click on the page that publishes them — no disclosure, no
 * `<details>` — which is what "prominently" asks of the page that carries the notice. Under the
 * corrected reading above, that page is `/hakkimizda` rather than every value surface.
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
    <Card as="section" variant="panel" space="3" aria-labelledby={headingId}>
      <div className="max-w-[70ch] space-y-3">
        <h2 id={headingId} className="font-heading text-xl font-bold text-foreground">
          {heading ?? t("sourcesHeading")}
        </h2>
        <p className={BODY}>{t("sourceEcmwf")}</p>
        <p className={BODY}>{t("sourceEcmwfNoticeIntro")}</p>
        <div className={LICENCE} lang="en">
          {/* The copyright line is omitted — not faked — when no ECMWF cycle has been
              ingested and there is therefore no data year to state. The mandatory
              "this service is based on…" sentence carries no year and always shows. */}
          {attributionYear !== null && (
            <p>{tm("attribution.ecmwfCopyright", { year: attributionYear })}</p>
          )}
          <p>{tm("attribution.ecmwfNotice")}</p>
          <p>{tm("attribution.ecmwfDisclaimer")}</p>
        </div>
        <p className={BODY}>{t("sourceCmems")}</p>
        <p className={BODY}>{t("sourceCmemsNoticeIntro")}</p>
        <div className={LICENCE} lang="en">
          {/* One sentence, and it is the whole obligation. No copyright year: the Copernicus
              Marine licence attaches its notice to the SERVICE, not to a data year, so there
              is nothing here to derive from an ingested cycle and nothing to omit when there
              is none. */}
          <p>{tm("attribution.cmemsNotice")}</p>
        </div>
        <p className={DISCLAIMER}>{tm("disclaimer.educationalOnly")}</p>
      </div>
    </Card>
  );
}
