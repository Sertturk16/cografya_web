import { getFormatter, getTranslations } from "next-intl/server";
import { byPlateCode, getMapSummary } from "@/lib/api/provinces";
import type { ProvinceMapSummary } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { MapHoverCard } from "./map-hover-card";
import styles from "./turkey-map.module.css";

interface TurkeyMapSectionProps {
  locale: Locale;
}

/**
 * Homepage-hero interactive Türkiye map (server component — SPEC / DEC 2026-07-10).
 *
 * Renders all 81 il outlines from the committed, build-time-generated SVG paths
 * (`lib/map/tr-provinces.generated.ts` — raw GeoJSON never ships). A shape becomes
 * an interactive, crawlable `<a>` (hub-and-spoke, CONVENTIONS §6 #10) with a stat
 * card ONLY when the api's map-summary carries its plaka kodu — i.e. the province is
 * seeded and has a published `/il/{slug}` page. The rest render as inert backdrop
 * and light up automatically as more il are seeded. So the homepage never links to
 * a not-yet-published (soft-404) page (SEO §6 #6), and degrades to a static map
 * picture if the summary is unreachable — the map is progressive enhancement over
 * the always-present `/iller` text hub, never the sole navigation path.
 *
 * The card's numbers (nüfus / yüzölçümü / ilçe) come from the single purpose-built
 * `/api/provinces/map-summary` payload, formatted server-side and pre-embedded as
 * `data-*` on each link (no per-hover fetch — INP, SPEC §1.6).
 */
export async function TurkeyMapSection({ locale }: TurkeyMapSectionProps) {
  const tHome = await getTranslations("Home");
  const tMap = await getTranslations("Map");
  const tRegions = await getTranslations("Regions");
  const tDetail = await getTranslations("ProvinceDetail");
  const format = await getFormatter();

  // Best-effort: the map is a homepage enhancement, so a summary-fetch failure hides
  // the interactivity (all shapes inert) rather than breaking the homepage — the
  // same discipline as the detail page's neighbour block.
  let summaries: ProvinceMapSummary[] = [];
  try {
    summaries = await getMapSummary();
  } catch (error) {
    console.warn(`[map] map-summary unavailable; rendering inert map. ${String(error)}`);
  }
  // Raw plateCode join: both sides are the api's 2-digit zero-padded codes (api
  // CLAUDE.md §5), matching the generated artifact — same posture as the existing
  // neighbour-code join.
  const byPlate = byPlateCode(summaries);

  const titleId = "turkey-map-title";

  return (
    <section className="section" aria-labelledby="turkey-map-heading">
      <h2 id="turkey-map-heading">{tHome("mapHeading")}</h2>
      <p className={styles.intro}>{tHome("mapBody")}</p>

      <div className={styles.mapRoot} data-map-root>
        <svg className={styles.svg} viewBox={MAP_VIEWBOX} aria-labelledby={titleId}>
          <title id={titleId}>{tMap("mapTitle")}</title>
          {PROVINCE_SHAPES.map((shape) => {
            const province = byPlate.get(shape.plateCode);
            if (!province) {
              // Not-yet-published province: geographic backdrop only (no link, no
              // card, hidden from AT — it is not actionable).
              return (
                <path
                  key={shape.plateCode}
                  className={styles.provinceInert}
                  d={shape.d}
                  aria-hidden="true"
                />
              );
            }
            const region = tRegions(province.region);
            const href = getPathname({
              locale,
              href: {
                pathname: "/il/[slug]",
                params: { slug: locale === "en" ? province.slugEn : province.slugTr },
              },
            });
            // Stat-chip rows, formatted server-side; a null stat omits its row
            // (honest — never a placeholder dash). Labels reuse the ProvinceDetail
            // namespace so the card and the detail page read identically.
            const popLabel =
              province.population !== null
                ? province.populationYear
                  ? tDetail("populationWithYear", { year: province.populationYear })
                  : tDetail("population")
                : undefined;
            const popValue =
              province.population !== null ? format.number(province.population) : undefined;
            const areaValue =
              province.areaKm2 !== null
                ? `${format.number(province.areaKm2)} ${tDetail("areaUnit")}`
                : undefined;
            const districtValue =
              province.districtCount !== null ? format.number(province.districtCount) : undefined;
            return (
              // A plain SVG <a> with a server-computed localized next-intl pathname:
              // a real crawlable link in the first-response HTML, reliable inside
              // <svg> (Next's <Link> component targets the HTML anchor, not the SVG
              // namespace). Navigation is a full load — fine for a homepage map.
              <a
                key={shape.plateCode}
                className={styles.provinceLink}
                href={href}
                aria-label={`${province.nameTr}, ${region}`}
                data-province={province.plateCode}
                data-name={province.nameTr}
                data-region={region}
                data-plate-label={tMap("plateLabel", { code: province.plateCode })}
                data-href={href}
                data-pop-label={popLabel}
                data-pop-value={popValue}
                data-area-label={areaValue ? tDetail("area") : undefined}
                data-area-value={areaValue}
                data-district-label={districtValue ? tDetail("districtCount") : undefined}
                data-district-value={districtValue}
              >
                <path className={styles.province} d={shape.d} />
              </a>
            );
          })}
        </svg>

        <MapHoverCard ctaLabel={tMap("cta")} />

        <p className={styles.attribution}>{tMap("attribution")}</p>
      </div>
    </section>
  );
}
