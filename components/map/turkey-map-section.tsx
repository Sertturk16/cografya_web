import { getTranslations } from "next-intl/server";
import { getProvinces } from "@/lib/api/provinces";
import type { ProvinceListItem } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { normalizePlate } from "@/lib/map/plate";
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
 * an interactive, crawlable `<Link>`-equivalent `<a>` (hub-and-spoke, CONVENTIONS
 * §6 #10) ONLY when the live API province list includes its plaka kodu; the rest
 * render as inert backdrop and light up automatically as more il are seeded. This
 * keeps the homepage from ever linking to a not-yet-published (soft-404) province
 * page (SEO §6 #6), and degrades to a static map picture if the list is
 * unreachable — the map is progressive enhancement over the always-present `/iller`
 * text hub, never the sole navigation path.
 *
 * v0 card = name + region + plaka + "Detaya git →". The numeric stat rows
 * (population / area / district) slot in as v1 once the API's map-summary fields
 * land (SPEC §1.6) — same card, three more rows.
 */
export async function TurkeyMapSection({ locale }: TurkeyMapSectionProps) {
  const tHome = await getTranslations("Home");
  const tMap = await getTranslations("Map");
  const tRegions = await getTranslations("Regions");

  // Best-effort: the map is a homepage enhancement, so a list-fetch failure hides
  // the interactivity (all shapes inert) rather than breaking the homepage — the
  // same discipline as the detail page's neighbour block.
  let provinces: ProvinceListItem[] = [];
  try {
    provinces = await getProvinces();
  } catch (error) {
    console.warn(`[map] province list unavailable; rendering inert map. ${String(error)}`);
  }
  const byPlate = new Map(provinces.map((p) => [normalizePlate(p.plateCode), p]));

  const titleId = "turkey-map-title";

  return (
    <section className="section" aria-labelledby="turkey-map-heading">
      <h2 id="turkey-map-heading">{tHome("mapHeading")}</h2>
      <p className={styles.intro}>{tHome("mapBody")}</p>

      <div className={styles.mapRoot} data-map-root>
        <svg className={styles.svg} viewBox={MAP_VIEWBOX} aria-labelledby={titleId}>
          <title id={titleId}>{tMap("mapTitle")}</title>
          {PROVINCE_SHAPES.map((shape) => {
            const province = byPlate.get(normalizePlate(shape.plateCode));
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
