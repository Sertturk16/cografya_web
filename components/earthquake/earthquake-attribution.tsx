import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import type { EarthquakeAttribution as EarthquakeAttributionRow } from "@/lib/api/types";
import { SOURCE_NOTE } from "@/components/patterns/source-note";
/**
 * NO STYLESHEET IMPORT, AND THERE IS NO LONGER A STYLESHEET TO IMPORT. `earthquake.module.css`
 * used to style this block's paragraphs with `var(--color-slate)` and `var(--color-ink)` — RAW
 * Terra tokens, frozen at their light values and never redefined under `.dark`. Measured on
 * dark `--card` (#121e21): `--color-slate` #57504a is **2.15:1** and `--color-ink` #2b2622 is
 * **1.14:1**, so the mandated AFAD notice was effectively unreadable on a dark page. This
 * component moved to bridge tokens first; `text-muted-foreground` is **7.79:1** and
 * `text-foreground` **14.73:1** on the same backdrop.
 *
 * T-033 task 6 finished the job: it deleted the three classes this block had abandoned
 * (`.sources`, `.regulationReference`, `.disclaimer`), converted the file's other three
 * consumers — the list, the magnitude badge, the province section — and removed the stylesheet.
 * The badge's `--eq-mag-*` ramp is the one thing that did not move: it is a data token set, and
 * `magnitude-badge.tsx` carries its measurement and whose branch owns the dark half.
 */

interface EarthquakeAttributionProps {
  attributions: readonly EarthquakeAttributionRow[];
  /**
   * The early-warning liability sentence (`EarthquakeMetaDto.disclaimerTr`) — owner-ruled
   * verbatim (`DEC 2026-08-19l`), Turkish-only, no `disclaimerEn` field exists in the contract.
   * The api's own docblock for this field: "Render it wherever earthquake data is shown; never
   * translate, shorten or re-word it."
   *
   * REQUIRED (PR #114 fix round, FENER114-C1/CODE114-C1, validated). `disclaimerTr` used to be
   * optional here because it lives only on `GET /api/earthquakes/meta`, not on
   * `EarthquakeListDto.meta` (the shape the province route returns) — and PR-B's province call
   * site omitted the prop rather than pay a second fetch, reasoning the hub already carries the
   * sentence one click away via the section's own unconditional hub-link. That left every one
   * of 81 provinces × 2 locales showing real AFAD earthquake data with the mandatory
   * non-early-warning disclaimer nowhere on the page itself — the exact liability gap
   * DEC 2026-08-19l's "wherever earthquake data is shown" wording exists to close, and "one
   * click away" does not satisfy it (CONTENT-STYLE.md §22's litmus: the reader does not know
   * this boundary AT THE POINT they see the data). The province page now sources the value from
   * the already-existing, ISR-cached `getEarthquakeMetaSafe()` (`lib/api/earthquakes.ts`) —
   * validator-measured as a cache hit, not a new per-page fetch — and BOTH call sites
   * (`/deprem` and the province route) supply it, so the prop is required rather than optional:
   * a future caller that forgets it now fails to compile instead of silently shipping the same
   * gap again.
   */
  disclaimerTr: string;
  /**
   * The block's accessible name (`aria-label` on its `<aside>`; there is no visible heading any
   * more). Defaults to `Earthquake.sourcesHeading` ("Kaynaklar") for the hub; the
   * province page passes its own (`ProvinceDetail.earthquakeSourcesHeading`), because that page
   * already carries a Kaynaklar line for its own facts — the identical reuse-with-its-own-
   * heading pattern `MarineAttribution` already establishes for its own two render sites. ONLY
   * the heading is overridable; every licence string below is single-sourced and verbatim.
   */
  heading?: string;
}

/**
 * The disclaimer's own class: footnote-sized like the notices, but `text-foreground` rather than
 * muted. It is not a credit — it tells the reader this data is not an early-warning system — so
 * it stays the most readable line in the block even though the box around it is gone.
 */
const DISCLAIMER = "m-0 text-xs leading-snug text-foreground";

/**
 * Attribution + the early-warning disclaimer — rendered verbatim, never re-authored (§5.8,
 * `deprem-sayfalari` plan).
 *
 * A FOOTNOTE, NOT A PANEL. It used to be a `Card` with a `text-xl` `<h2>` and a boxed disclaimer,
 * the heaviest attribution on the site. A mandated notice has to be visible without a click, not
 * loud, so it is now an `<aside>` at the site's footnote scale (`SOURCE_NOTE`), named by
 * `aria-label` instead of a heading. Nothing in it is hidden, collapsed or switchable.
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
 * SECOND CONSUMER (PR-B): the province pages (`app/[locale]/(site)/turkiye/[slug]/page.tsx`) render
 * this same component for the mandatory AFAD attribution that travels with the province
 * section's own events — `heading`/`disclaimerTr` above are what changed to support that.
 */
export async function EarthquakeAttribution({
  attributions,
  disclaimerTr,
  heading,
}: EarthquakeAttributionProps) {
  const t = await getTranslations("Earthquake");

  return (
    <aside aria-label={heading ?? t("sourcesHeading")} className="max-w-[70ch] space-y-1.5">
      {attributions.map((attribution) => (
        <p key={attribution.providerId} lang="tr" className={SOURCE_NOTE}>
          {attribution.requiredNoticeTr}
          {attribution.regulationReference !== "" && (
            <span> ({attribution.regulationReference})</span>
          )}
        </p>
      ))}
      <p lang="tr" className={DISCLAIMER}>
        {disclaimerTr}
      </p>
    </aside>
  );
}

/**
 * The same AFAD notice as a line of the map's fullscreen credit (T-119): in fullscreen the block
 * above is off screen, so the map credit carries it (`MapAttribution`'s `dataCredit`). Beside
 * `EarthquakeAttribution` so the notice's format has one home; strings verbatim from the payload.
 * Sync and hook-free, so the server page renders it and hands the result to the client explorer.
 */
export function EarthquakeMapCredit({
  attributions,
}: {
  attributions: readonly EarthquakeAttributionRow[];
}) {
  // `{" "}` between rows for the reason `MapAttribution`'s own lines carry one: the panel's flex
  // gap separates them on screen only, and `textContent` would weld two notices into one run.
  return attributions.map((attribution) => (
    <Fragment key={attribution.providerId}>
      <span lang="tr">
        {attribution.requiredNoticeTr}
        {attribution.regulationReference !== "" && ` (${attribution.regulationReference})`}
      </span>{" "}
    </Fragment>
  ));
}
