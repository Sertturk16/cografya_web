import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { EarthquakeList } from "@/lib/api/types";
import { EarthquakeList as EarthquakeListTable } from "./earthquake-list";
import styles from "./earthquake.module.css";

interface ProvinceEarthquakeSectionProps {
  locale: Locale;
  /** The province's own name, for the heading and the empty-state line. */
  provinceName: string;
  /** This province's own two-digit plate code — every item in `list.items` is bound to it
   *  (§2: the province route is "filtered to the events bound to this province"), so it is the
   *  only key the binding-sentence lookup below ever needs. */
  plateCode: string;
  /** `getProvinceEarthquakesSafe`'s successful result — never called with `null`; the caller
   *  gates rendering on that (mirrors `ProvinceMarineSection`'s own `showMarine` gate). */
  list: EarthquakeList;
  /** `id` of this section's `<h2>`. */
  headingId: string;
}

/**
 * "{İl} yakınında son depremler" — the earthquake section on every province page (§5.12,
 * `deprem-sayfalari` plan, PR-B).
 *
 * UNLIKE `ProvinceMarineSection`, THIS SECTION IS NOT RESTRICTED TO A SUBSET OF PROVINCES.
 * Marine is coastal-only because the sea genuinely does not reach every province; an
 * earthquake can be recorded near any of the 81. The section therefore renders for every
 * successful `getProvinceEarthquakesSafe` read — including a genuinely empty one, which is the
 * honest "no events matched the default window" answer, not a failure. The caller (the page)
 * still gates on the read succeeding at all, the same fail-soft posture
 * `getMarineProvinceConditionsSafe` already established: a provider/DB hiccup degrades the
 * section, never the page.
 *
 * REUSES `EarthquakeList` AS-IS rather than a `<dl>` of fixed fields: unlike marine's three
 * measured quantities per point, an earthquake section's content is a variable-length list of
 * discrete events — exactly the hub's own shape, just filtered to one province. Reusing the
 * table keeps the binding-sentence logic (`bindingSentenceKey`, §5.7) and the magnitude
 * badge/`lang="tr"` place-name handling single-sourced rather than re-implemented here.
 *
 * NO MAP INSTANCE (§5.13's own "ordinary implementation choice", left open by the plan). A
 * province typically bounds a handful of events at most, and the unconditional hub-link below
 * already gives the full national picture including the map; adding a second, smaller
 * `EarthquakeMap` render on all 81×2 pages would repeat `MarineMap`'s decision the OTHER way
 * for no reader benefit `ProvinceMarineSection` itself did not already forgo (that section
 * renders no `MarineMap` either, only values + a hub-link).
 *
 * ATTRIBUTION IS NOT RENDERED HERE. The mandatory AFAD attribution that travels with this
 * section's own events is `list.meta.attributions` — rendered by the page itself via
 * `EarthquakeAttribution` (mirroring exactly where `MarineAttribution` sits: a separate block
 * near the page's own Kaynaklar line, not nested inside this section's `<h2>`), gated on the
 * SAME successful-read signal as this section, so the two cannot come apart.
 */
export async function ProvinceEarthquakeSection({
  locale,
  provinceName,
  plateCode,
  list,
  headingId,
}: ProvinceEarthquakeSectionProps) {
  const t = await getTranslations("ProvinceDetail");
  const te = await getTranslations("Earthquake");

  // Every item in `list.items` is already bound to THIS province (see the prop docblock
  // above), so a one-entry map resolves every `bindingKind` sentence's `{province}`
  // placeholder without a second province-list fetch.
  const provinceNameByPlateCode = new Map([[plateCode, provinceName]]);

  const listStrings = {
    tableSummary: te("list.tableSummary"),
    scrollRegionLabel: te("list.scrollRegionLabel"),
    colMagnitude: te("list.colMagnitude"),
    colPlace: te("list.colPlace"),
    colTime: te("list.colTime"),
    // Province-specific, unlike the hub's generic `list.emptyState` — the plan's own copy
    // shape (§5.12): "{province} yakınında son 7 günde kaydedilmiş deprem yok."
    emptyState: t("earthquakeEmptyState", { name: provinceName }),
    bindingOffshoreNear: (province: string) => te("binding.offshoreNear", { province }),
    bindingAcrossBorder: (province: string) => te("binding.acrossBorder", { province }),
  };

  // PR #114 fix round (FENER114-I1, not independently validated but well-evidenced): the
  // empty-state sentence above ("no earthquakes near {name} in the last 7 days") reads as an
  // absolute "no seismic activity" claim unless the reader also knows it is filtered to
  // `minMagnitude`+ — the SAME gap `/deprem`'s own `meta.magnitudeFloorLabel`/`Value` block
  // exists to close (`app/[locale]/deprem/page.tsx`). No new copy is authored: this reuses that
  // EXACT established i18n pair verbatim (CONTENT-STYLE.md §22's own instruction against
  // inventing new wording for a fact already phrased once), formatted the same way the three
  // other magnitude displays on this feature already do (`magnitude-badge.tsx`,
  // `earthquake-map.tsx`, `earthquake-filters.tsx`) — one decimal, locale-formatted. The value
  // itself is `list.meta.filter.minMagnitude`, already on the page as a prop; no new fetch.
  // Rendered UNCONDITIONALLY (populated or empty), directly under the heading: it is equally
  // true, and equally missing without this line, whether the table has rows or not.
  const minMagnitudeLabel = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(list.meta.filter.minMagnitude);

  return (
    <section className="section" aria-labelledby={headingId}>
      <h2 id={headingId}>{t("earthquakeHeading", { name: provinceName })}</h2>

      <p className={styles.magnitudeFloorNote}>
        <span className={styles.magnitudeFloorLabel}>{te("meta.magnitudeFloorLabel")}:</span>{" "}
        {te("meta.magnitudeFloorValue", { value: minMagnitudeLabel })}
      </p>

      <EarthquakeListTable
        locale={locale}
        events={list.items}
        provinceNameByPlateCode={provinceNameByPlateCode}
        strings={listStrings}
      />

      {/* Hub-and-spoke, unconditional regardless of this province's own event count — the
          static internal link every province page carries independently of nav
          (`SEO-POLICY.md` §B8.1, §5.12's own reachability mechanism), mirroring
          `ProvinceMarineSection`'s own unconditional `hubLinkAll`. */}
      <p className={styles.provinceHubLink}>
        <Link href="/deprem">{t("earthquakeHubLink")}</Link>
      </p>
    </section>
  );
}
