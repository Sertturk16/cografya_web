import { getTranslations } from "next-intl/server";
import type { EarthquakeAttribution as EarthquakeAttributionRow } from "@/lib/api/types";
/**
 * NO STYLESHEET IMPORT. `earthquake.module.css` styles this block's paragraphs with
 * `var(--color-slate)` and `var(--color-ink)` — RAW Terra tokens, frozen at their light values
 * and never redefined under `.dark`. On the V2 pages this component now renders on, that put the
 * mandated AFAD notice at roughly 2.3:1 against the dark page. The bridge tokens used below
 * redefine per theme, which is what they are for.
 *
 * The stylesheet is left in place for its three remaining consumers (the list, the magnitude
 * badge, the province section) — they have the same latent problem and it is T-035/T-033's to
 * fix, not this component's to fix on their behalf. It used to have five; T-036 deleted the
 * map and the filter island, and the rules that only they used went with them. The three
 * classes this block itself abandoned (`.sources`, `.regulationReference`, `.disclaimer`) are
 * still in the file: they predate T-036 and removing them is this note's own debt to settle,
 * not a side effect of deleting someone else's component.
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
 * SECOND CONSUMER (PR-B): the province pages (`app/[locale]/(site)/turkiye/[slug]/page.tsx`) render
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
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm"
    >
      <div className="max-w-[70ch] space-y-3">
        <h2 id={headingId} className="font-heading text-xl font-bold text-foreground">
          {heading ?? t("sourcesHeading")}
        </h2>
        {attributions.map((attribution) => (
          <p
            key={attribution.providerId}
            lang="tr"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {attribution.requiredNoticeTr}
            {attribution.regulationReference !== "" && (
              <span className="text-muted-foreground"> ({attribution.regulationReference})</span>
            )}
          </p>
        ))}
        <p
          lang="tr"
          className="mt-3.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground"
        >
          {disclaimerTr}
        </p>
      </div>
    </section>
  );
}
