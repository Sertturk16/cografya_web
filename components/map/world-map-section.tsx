import { getFormatter, getTranslations } from "next-intl/server";
import { byIsoCode, getCountryMapSummary } from "@/lib/api/countries";
import type { CountryMapSummary } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { FigureTextOptions, TerritoryFigure } from "@/lib/map/territories";
import { centreFor, figureText, territoryFor } from "@/lib/map/territories";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "@/lib/map/world-countries.generated";
import { MapHoverCard } from "./map-hover-card";
import { MapZoomPan } from "./map-zoom-pan";
import styles from "./map.module.css";

interface WorldMapSectionProps {
  locale: Locale;
}

/**
 * The one shape whose destination is NOT `/dunya/{slug}`: Türkiye links to the `/turkiye`
 * hub instead (→ DEC 2026-07-26 K1). Matched against the generated artifact's ISO key.
 */
const TURKIYE_ISO = "TR";

/** One label/value pair destined for a card stat row. */
interface StatSlot {
  readonly label: string;
  readonly value: string;
  /**
   * Spoken rendering of {@link value}, when it differs from the printed one. Today the only
   * difference is the approximation marker: the card shows "≈176.000 km²" but screen readers
   * do not announce U+2248, so the accessible name says "yaklaşık 176.000 km²" instead of a
   * bare — and falsely pinned — number (review finding sov-r3-m1).
   */
  readonly ariaValue?: string;
  /**
   * The value is already a full statement ("Kalıcı nüfus yok"), so the accessible name
   * speaks it alone — prefixing the label would read "Nüfus. Kalıcı nüfus yok". Carried as
   * a flag rather than re-derived by comparing the rendered value against the i18n string,
   * which a wording edit would silently break.
   */
  readonly standalone?: boolean;
}

/**
 * What a caller chooses per figure. The formatter and the "approximately" word are supplied
 * by the renderer itself, so a call site cannot accidentally render a spoken string into the
 * visible card (or a glyph into the accessible name).
 */
type FigureRenderOptions = Pick<FigureTextOptions, "noneText" | "unit">;

/**
 * REQUIRED on every `<path>` painting a `COUNTRY_SHAPES` `d`. The generator emits an enclave's
 * interior ring as an extra subpath — the hole in South Africa is Lesotho, the holes in
 * Kyrgyzstan are Uzbek and Tajik exclaves — and only the even-odd rule turns those subpaths
 * into actual holes without trusting the source's ring winding. Under SVG's default `nonzero`
 * they fill instead, and because the shapes paint in ISO order the surrounding country covers
 * the enclave: Lesotho (drawn 113 shapes before South Africa) was invisible AND unclickable
 * on the live map, its `<a>` present in the HTML but unhittable. A hole is also not painted,
 * so `pointer-events: visiblePainted` lets the click through to the enclave underneath — the
 * fill rule is what makes the link work, not just what makes it look right.
 */
const FILL_RULE = "evenodd" as const;

/**
 * Interactive full-world map (server component) — the `/dunya` hub's primary content,
 * mirroring `TurkeyMapSection` one level up (country, not province). It reuses the exact same
 * mechanism: build-time-generated inline SVG country paths (`lib/map/world-countries.generated.ts`
 * — raw GeoJSON never ships), a real crawlable `<a>` per SEEDED country (hub-and-spoke,
 * CONVENTIONS §6 #10), pure-CSS hover/focus highlight, and the shared client hover-card island.
 *
 * SCOPE (full world): every Natural Earth Admin-0 entity is drawn (~190 seeded countries plus
 * the de-facto backdrop). A shape becomes interactive ONLY when the api's country-map-summary
 * carries its ISO code (i.e. it has a published `/dunya/{slug}` page); the rest render as inert
 * backdrop and light up automatically as the api seeds them. This is purely data-driven off the
 * live summary, so it scales unchanged from the original 8-country pilot to the full seeded set
 * (incl. the Cyprus split: CY and QN are two independent shapes, each interactive once seeded).
 * So the map never links to a not-yet-published (soft-404) country (SEO §6 #6), and degrades to
 * a static picture if the summary is unreachable — interactivity is progressive enhancement over
 * the always-present links.
 *
 * The card's numbers (nüfus / yüzölçümü / komşu ülke sayısı — the locked country-scale
 * stat trio) come from the purpose-built `/api/countries/map-summary` payload, formatted
 * server-side and pre-embedded as the shared entity-agnostic `data-*` on each link (no
 * per-hover fetch — INP).
 *
 * NON-COUNTRY SHAPES (the 43 territories, `lib/map/territories.ts`) get a hover card too,
 * but never a link: they have no detail page and none is planned in this initiative
 * (→ DEC 2026-07-26 K2, spec-first, not yet spec'd). They render as a `<g role="img">` with
 * the full card content in its accessible name, carrying the SAME `data-*` contract the card
 * island reads. No `href` ⇒ nothing to navigate to, and zero SEO surface: no new URL, no
 * sitemap entry, no JSON-LD, no change to the internal link graph.
 *
 * They ARE keyboard-reachable (`tabIndex={0}`, → DEC 2026-08-01g item 4). The first round
 * left them out of the tab order on the teshis.md §5 argument that 43 non-actionable stops
 * on top of ~190 country links cost more than they give; the owner ruled the other way and
 * accepted the 43 stops, because without them a SIGHTED keyboard user could never see a card
 * that a mouse user gets for free. Focus opens the card through the same delegation as hover
 * and is mirrored by a `:focus-visible` stroke, so the visible state matches what the card
 * shows. `MapZoomPan`'s focus-follows-view now covers them too (it keys off `[tabindex]`),
 * which is the behaviour a focusable shape should have — verified against a zoomed view. A seeded country ALWAYS wins over a territory entry, so the day the api publishes a
 * page for one of these shapes it becomes a normal link and the card disappears on its own.
 * Every territory now has card content in BOTH locales, so all 43 open a card on both maps:
 * the label is required in each locale and `territories.test.ts` pins that (the earlier
 * "nothing publishable ⇒ inert backdrop" fallback existed only for Siachen on the label-less
 * English map and went away with the English labels → DEC 2026-08-01p).
 *
 * ONE shape is wired by hand: Türkiye. It is a country on the world map, but the site's
 * Türkiye surface is the dedicated `/turkiye` hub — there is no `/dunya/turkiye` page and
 * none is planned (IA → DEC 2026-07-13). So the TR shape is interactive and points at the
 * hub (→ DEC 2026-07-26 K1), with a deliberately minimal card (name + where it goes, no
 * stats): a hole in the middle of the map for the site's own country would be the worst
 * possible dead spot. KKTC (QN) is untouched — it is a normal seeded country shape.
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
  const instructionsId = "world-map-instructions";
  const zoomLabels = {
    zoomIn: tMap("zoomIn"),
    zoomOut: tMap("zoomOut"),
    reset: tMap("resetView"),
    instructions: tMap("keyboardInstructions"),
    controls: tMap("zoomControls"),
  };

  return (
    // Heading + instruction paragraph removed by the site-wide frame-copy trim
    // (→ DEC 2026-07-30t/u, CONTENT-STYLE §22), mirroring the Türkiye map: the <h2>
    // restated the map, and the paragraph narrated the interaction and leaked internal
    // state ("kalan ülke ve bölgeler içerik eklendikçe canlanır"). The region keeps an
    // accessible name via aria-label (the same string as the <svg> <title>).
    <section className="section" aria-label={tMap("mapTitle")}>
      {/* .worldRoot = flat cool SEA (the il map keeps the warm parchment gradient): a
          gradient backdrop makes land/sea fill contrast depend on latitude, which is what
          made Greenland vanish at the top of the map (→ --map-sea, globals.css). */}
      <div className={`${styles.mapRoot} ${styles.worldRoot}`} data-map-root>
        {/* Rendered BEFORE the <svg> so the zoom controls sit ahead of the ~190 crawlable
            country links in tab order (review I3) — keyboard users reach +/−/reset without
            tabbing through every country. Visual position is unaffected (the layer is
            position:absolute); the island still reaches the <svg> via querySelector. */}
        <MapZoomPan
          viewBox={WORLD_MAP_VIEWBOX}
          instructionsId={instructionsId}
          labels={zoomLabels}
        />

        <svg className={styles.svg} viewBox={WORLD_MAP_VIEWBOX} aria-labelledby={titleId}>
          <title id={titleId}>{tMap("mapTitle")}</title>
          {COUNTRY_SHAPES.map((shape) => {
            // Türkiye first, BEFORE the map-summary lookup: if the api ever seeds TR into
            // the summary, this map must still never manufacture a `/dunya/turkiye` link to
            // a page the IA says does not exist (that would be a soft-404 waiting to happen,
            // SEO §6 #6). The hub link is the fixed answer for this shape.
            if (shape.iso === TURKIYE_ISO) {
              const turkiyeHref = getPathname({ locale, href: "/turkiye" });
              return (
                <a
                  key={shape.iso}
                  className={styles.provinceLink}
                  href={turkiyeHref}
                  aria-label={tMap("turkiyeLinkLabel")}
                  data-shape={TURKIYE_ISO}
                  data-name={tMap("turkiyeName")}
                  data-subtitle={tMap("turkiyeCardSubtitle")}
                  data-badge={TURKIYE_ISO}
                  data-href={turkiyeHref}
                >
                  <path className={styles.province} d={shape.d} fillRule={FILL_RULE} />
                </a>
              );
            }
            const country = byIso.get(shape.iso);
            if (!country) {
              const territory = territoryFor(shape.iso);
              if (territory) {
                // A known non-country place: informational hover card, NO link. Checked
                // AFTER the map summary on purpose — if the api ever publishes a page for
                // this shape, the real link wins and this branch stops running for it.
                const stats: StatSlot[] = [];
                // Wrapped, not passed by reference: `format.number` is a method on the
                // next-intl formatter and must keep its receiver.
                const formatNumber = (value: number) => format.number(value);
                const noPopulation = tMap("territoryNoPopulation");
                // Printed vs spoken rendering of one figure. They are identical except for
                // an `approx` figure, where the printed "≈" becomes a spoken word — so the
                // second call is what keeps the accessible name from pinning a rounded
                // number (see StatSlot.ariaValue).
                const render = (figure: TerritoryFigure, opts: FigureRenderOptions) => {
                  const value = figureText(figure, { formatNumber, ...opts });
                  if (value === undefined) return undefined;
                  const spoken = figureText(figure, {
                    formatNumber,
                    approxWord: tMap("territoryApproximate"),
                    ...opts,
                  });
                  return { value, ariaValue: spoken ?? value };
                };
                const population = render(territory.population, { noneText: noPopulation });
                if (population) {
                  stats.push({
                    label: tDetail("population"),
                    ...population,
                    standalone: territory.population.kind === "none",
                  });
                }
                // No `noneText`: "there is no area" is not a fact an area row can state.
                const area = render(territory.areaKm2, { unit: tDetail("areaUnit") });
                if (area) stats.push({ label: tDetail("area"), ...area });
                const centre = centreFor(territory, locale);
                if (centre) {
                  stats.push({ label: tMap("territoryCentre"), value: centre });
                }
                const territoryName = locale === "en" ? territory.nameEn : territory.nameTr;
                // Both locales, picked the same way as the name above. The English labels are
                // the owner-approved column of the same table as the Turkish ones (→ DEC
                // 2026-08-01p) — including the English form of the six sovereignty-locked
                // ones — so this slot is filled on `/en/dunya` exactly as the continent name
                // fills it on an English country card. It is never a fallback to `labelTr`:
                // no Turkish reaches the English map.
                const label = locale === "en" ? territory.labelEn : territory.labelTr;
                // The card is pointer-only (aria-hidden), so this name is the ONLY way AT
                // reaches the content. Same composition as a country link. Each part has a
                // trailing full stop normalised away before the parts are joined with one,
                // so no part can produce a doubled stop. Stats speak `ariaValue`, which
                // differs from the printed value exactly where a glyph would go unspoken.
                const ariaLabel = `${[
                  territoryName,
                  label,
                  ...stats.map((s) =>
                    s.standalone
                      ? (s.ariaValue ?? s.value)
                      : `${s.label} ${s.ariaValue ?? s.value}`,
                  ),
                ]
                  .filter((part): part is string => part !== undefined)
                  .map((part) => part.replace(/\.$/, ""))
                  .join(". ")}.`;
                return (
                  <g
                    key={shape.iso}
                    className={styles.territory}
                    role="img"
                    // Focusable, not actionable: the shape has no destination, so it stays
                    // role="img" (a labelled graphic) rather than pretending to be a button
                    // whose activation does nothing. Tab reaches it, the card opens on
                    // focus, Escape dismisses it (→ DEC 2026-08-01g item 4).
                    tabIndex={0}
                    aria-label={ariaLabel}
                    data-shape={shape.iso}
                    data-name={territoryName}
                    data-subtitle={label}
                    data-badge={territory.badge}
                    data-stat1-label={stats[0]?.label}
                    data-stat1-value={stats[0]?.value}
                    data-stat2-label={stats[1]?.label}
                    data-stat2-value={stats[1]?.value}
                    data-stat3-label={stats[2]?.label}
                    data-stat3-value={stats[2]?.value}
                  >
                    <path className={styles.landInert} d={shape.d} fillRule={FILL_RULE} />
                  </g>
                );
              }
              // Not-yet-seeded country with no territory entry either: geographic backdrop
              // only — no link, no card, hidden from AT (it is not actionable). It IS land,
              // so .landInert paints it in the SAME land tone as a clickable country (owner
              // ruling 2026-07-26) — never the il map's "not published yet" tint, which was
              // the map background's own top gradient stop and rendered Greenland invisible
              // (/dunya audit 2026-07-26).
              return (
                <path
                  key={shape.iso}
                  className={styles.landInert}
                  d={shape.d}
                  fillRule={FILL_RULE}
                  aria-hidden="true"
                />
              );
            }
            const continent = tContinents(country.continent);
            // Locale-aware display name (country DTOs carry both nameTr and nameEn) — used
            // for BOTH the visible card name and the AT label, so the EN map never shows a
            // Turkish name next to the already-localized continent (i18n symmetry).
            const name = locale === "en" ? country.nameEn : country.nameTr;
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
            const ariaLabel = `${name}, ${continent}. ${statPhrases.join(". ")}.`;
            return (
              <a
                key={shape.iso}
                className={styles.provinceLink}
                href={href}
                aria-label={ariaLabel}
                data-shape={country.isoCode}
                data-name={name}
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
                <path className={styles.province} d={shape.d} fillRule={FILL_RULE} />
              </a>
            );
          })}
        </svg>

        <MapHoverCard />

        {/* Keyboard-controls description the zoomable SVG points to via aria-describedby
            (set client-side, SPEC §5). Visually hidden — the always-visible +/− buttons
            carry the sighted affordance. */}
        <p id={instructionsId} className={styles.srOnly}>
          {tMap("keyboardInstructions")}
        </p>

        <p className={styles.attribution}>{tMap("attribution")}</p>
      </div>
    </section>
  );
}
