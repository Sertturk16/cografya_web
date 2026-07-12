import { getFormatter, getTranslations } from "next-intl/server";
import { byIsoCode, getCountryMapSummary } from "@/lib/api/countries";
import type { CountryMapSummary } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";
import { MapHoverCard } from "./map-hover-card";
import styles from "./map.module.css";

interface WorldMapSectionProps {
  locale: Locale;
}

/**
 * Interactive world (regional) map (server component) — the `/dunya` hub's primary content,
 * mirroring `TurkeyMapSection` one level up (country, not province). It reuses the exact same
 * mechanism: build-time-generated inline SVG country paths (`lib/map/world-countries.generated.ts`
 * — raw GeoJSON never ships), a real crawlable `<a>` per SEEDED country (hub-and-spoke,
 * CONVENTIONS §6 #10), pure-CSS hover/focus highlight, and the shared client hover-card island.
 *
 * SCOPE (Faz-2 pilot): only 8 countries are seeded, so this is a REGIONAL map framed on them
 * (Balkans → Caucasus → Middle East). A shape becomes interactive ONLY when the api's
 * country-map-summary carries its ISO code (i.e. it has a published `/dunya/{slug}` page); the
 * rest — including Türkiye, the central anchor — render as inert backdrop and light up
 * automatically as more countries are seeded. So the map never links to a not-yet-published
 * (soft-404) country (SEO §6 #6), and degrades to a static picture if the summary is
 * unreachable — interactivity is progressive enhancement over the always-present links.
 *
 * The card's numbers (nüfus / yüzölçümü / komşu ülke sayısı — the locked country-scale
 * stat trio) come from the purpose-built `/api/countries/map-summary` payload, formatted
 * server-side and pre-embedded as the shared entity-agnostic `data-*` on each link (no
 * per-hover fetch — INP).
 */
export async function WorldMapSection({ locale }: WorldMapSectionProps) {
  const tMap = await getTranslations("WorldMap");
  const tContinents = await getTranslations("Continents");
  const tDetail = await getTranslations("CountryDetail");
  const format = await getFormatter();

  // Best-effort: the map is an enhancement, so a summary-fetch failure hides the
  // interactivity (all shapes inert) rather than breaking the page.
  let summaries: CountryMapSummary[] = [];
  try {
    summaries = await getCountryMapSummary();
  } catch (error) {
    console.warn(`[world-map] map-summary unavailable; rendering inert map. ${String(error)}`);
  }
  const byIso = byIsoCode(summaries);

  const titleId = "world-map-title";

  return (
    <section className="section" aria-labelledby="world-map-heading">
      <h2 id="world-map-heading">{tMap("sectionHeading")}</h2>
      <p className={styles.intro}>{tMap("sectionBody")}</p>

      <div className={styles.mapRoot} data-map-root>
        <svg className={styles.svg} viewBox={WORLD_MAP_VIEWBOX} aria-labelledby={titleId}>
          <title id={titleId}>{tMap("mapTitle")}</title>
          {COUNTRY_SHAPES.map((shape) => {
            const country = byIso.get(shape.iso);
            if (!country) {
              // Not-yet-seeded (or backdrop-context) country: geographic backdrop only —
              // no link, no card, hidden from AT (it is not actionable).
              return (
                <path
                  key={shape.iso}
                  className={styles.provinceInert}
                  d={shape.d}
                  aria-hidden="true"
                />
              );
            }
            const continent = tContinents(country.continent);
            const href = getPathname({
              locale,
              href: {
                pathname: "/dunya/[slug]",
                params: { slug: locale === "en" ? country.slugEn : country.slugTr },
              },
            });
            // Stat-chip rows, formatted server-side; a null stat omits its row (honest —
            // never a placeholder dash). Labels reuse the CountryDetail namespace so the
            // card and the detail page read identically. populationYear is null at world
            // scale (owner ruling), so the population label carries no year.
            const popLabel = country.population !== null ? tDetail("population") : undefined;
            const popValue =
              country.population !== null ? format.number(country.population) : undefined;
            const areaValue =
              country.areaKm2 !== null
                ? `${format.number(country.areaKm2)} ${tDetail("areaUnit")}`
                : undefined;
            const areaLabel = areaValue ? tDetail("area") : undefined;
            // neighborCount is a required non-null number (0 for a hypothetical island —
            // a correct fact, shown as such), so it always fills the third stat slot.
            const neighborLabel = tDetail("neighborCount");
            const neighborValue = format.number(country.neighborCount);
            // Accessible-name parity: the hover card is pointer-only (aria-hidden), so
            // keyboard/AT users reach the country only through this <a>'s name. Fold the
            // same stat rows into the label — only the non-null ones.
            const statPhrases: string[] = [];
            if (popLabel && popValue) statPhrases.push(`${popLabel} ${popValue}`);
            if (areaLabel && areaValue) statPhrases.push(`${areaLabel} ${areaValue}`);
            statPhrases.push(`${neighborLabel} ${neighborValue}`);
            const ariaLabel = `${country.nameTr}, ${continent}. ${statPhrases.join(". ")}.`;
            return (
              <a
                key={shape.iso}
                className={styles.provinceLink}
                href={href}
                aria-label={ariaLabel}
                data-shape={country.isoCode}
                data-name={country.nameTr}
                data-subtitle={continent}
                data-badge={country.isoCode}
                data-href={href}
                data-stat1-label={popLabel}
                data-stat1-value={popValue}
                data-stat2-label={areaLabel}
                data-stat2-value={areaValue}
                data-stat3-label={neighborLabel}
                data-stat3-value={neighborValue}
              >
                <path className={styles.province} d={shape.d} />
              </a>
            );
          })}
        </svg>

        <MapHoverCard />

        <p className={styles.attribution}>{tMap("attribution")}</p>
      </div>
    </section>
  );
}
