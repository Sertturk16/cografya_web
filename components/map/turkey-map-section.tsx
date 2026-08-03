import { getFormatter, getTranslations } from "next-intl/server";
import { byPlateCode, getMapSummary } from "@/lib/api/provinces";
import type { ProvinceMapSummary } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { InlandWaterLayer } from "./inland-water-layer";
import { MapHoverCard } from "./map-hover-card";
import styles from "./map.module.css";

interface TurkeyMapSectionProps {
  locale: Locale;
}

/**
 * `id` prefix of this map's shared `<defs>` geometry.
 *
 * Prefixed per SURFACE (`tr-map-` here, `world-map-` on `/dunya`, `game-map-` on `/oyun`) so
 * two maps could sit on one document without their fragment ids colliding — a `<use href>`
 * resolves against the whole document, not against its own `<svg>`.
 */
const SHAPE_ID_PREFIX = "tr-map-";

/**
 * Interactive Türkiye map (server component — SPEC / DEC 2026-07-10). Since the IA
 * restructure (→ DEC 2026-07-13) this is the primary content of the dedicated
 * `/turkiye` hub page (it previously lived on the homepage; the retired `/iller`
 * plain list is gone).
 *
 * Renders all 81 il outlines from the committed, build-time-generated SVG paths
 * (`lib/map/tr-provinces.generated.ts` — raw GeoJSON never ships). A shape becomes
 * an interactive, crawlable `<a>` (hub-and-spoke, CONVENTIONS §6 #10) with a stat
 * card ONLY when the api's map-summary carries its plaka kodu — i.e. the province is
 * seeded and has a published `/turkiye/{slug}` page. The rest render as inert backdrop
 * and light up automatically as more il are seeded. So the map never links to a
 * not-yet-published (soft-404) page (SEO §6 #6), and degrades to a static map picture
 * if the summary is unreachable — the interactivity is progressive enhancement over
 * the always-present crawlable `<a>` links.
 *
 * The card's numbers (nüfus / yüzölçümü / ilçe) come from the single purpose-built
 * `/api/provinces/map-summary` payload, formatted server-side and pre-embedded as
 * `data-*` on each link (no per-hover fetch — INP, SPEC §1.6).
 *
 * THREE PAINT LAYERS OVER ONE COPY OF THE GEOMETRY (owner report 2026-08-02; the measured
 * design study is `Owner's Inbox/ui-cila-arastirma/hover-overlay-plan.md`). The owner's
 * complaint was that a hovered province's border is thick on one side and half-eaten on the
 * other — Konya's west edge full weight, its east edge a hairline. That is not a styling bug,
 * it is PAINT ORDER: shapes are drawn in plaka order, so every neighbour drawn AFTER the
 * hovered one paints its own fill and its own 1px border over the hover line's inner half.
 * SVG has no `z-index` (document order wins, verified), and a mirror `<use>` copy of the
 * shape does NOT track the original's `:hover`, so neither shortcut exists. The fix is
 * structural:
 *
 *   <defs>                 81 UNSTYLED <path id> — the geometry MOVES here, it is not copied
 *   <g data-map-layer=base>  today's painted map, byte-identical in appearance; inert to the
 *                            pointer and hidden from AT
 *   <g data-map-layer=hit>   the crawlable <a> wrappers + a <use> unpainted at rest
 *                            that carries ONLY the hover/focus line — above every fill and
 *                            every resting border on the map
 *   <InlandWaterLayer>       P6's lakes, still the LAST child (see the note at the call site):
 *                            it masks the boundary running across a lake and it swallows the
 *                            mid-lake click, and both of those ARE its paint position
 *
 * So no province can eat the hover line: Konya's east and west edges are now pixel-identical.
 * (The one thing painted over it is the water, on the few borders a lake crosses — which is
 * exactly what already happens to the resting border, and is the cartographic rule P6
 * implements: the administrative line stops at the shore.) It costs ONE css rule (down from a
 * family of them), and it is measurably CHEAPER per pointer move than what it replaces
 * (1.71ms → 1.50ms).
 *
 * PAGE WEIGHT — the honest number, because an earlier draft of this note had it backwards.
 * The SVG MARKUP does get smaller gzipped (−338 B: 81 `<use href="#tr-map-42"/>` compress
 * better than 81 inline `<path class d>`), but that is not what ships. Next serializes the
 * same markup a SECOND time into the RSC flight payload, so the real gzipped total for
 * `/turkiye` is **+1,419 B (+1.8%)** — measured end-to-end on one running build, not
 * inferred. (`/dunya` +5,657 B / +3.0%; `/oyun/81-il` +5,765 B / +8.2%.) Small in absolute
 * terms and per-pointer-move work goes down, so it was accepted — but it is a growth, and a
 * comment that claims a shrink is worse than no comment.
 *
 * THREE `<use>` BEHAVIOURS THAT ARE LOAD-BEARING HERE, each one measured:
 *  1. A `<use>` clone takes the CSS that matched the REFERENCED element, so the geometry in
 *     `<defs>` has to stay CLASSLESS. Everything visual is set on the `<use>` and reaches the
 *     clone by INHERITANCE (`fill`, `stroke`, `stroke-*`, `fill-rule`, `pointer-events` are
 *     all inherited properties).
 *  2. `vector-effect` is NOT an inherited property. Declared on the `<use>` it never reaches
 *     the clone, and province borders then thicken with zoom (measured: a 1px border became
 *     a ~12px grey band at 12×). It therefore sits as a presentation attribute ON THE
 *     GEOMETRY, which is the one place a clone reads it from.
 *  3. A clone does not track the original's `:hover` — which is why the `<a>` and its `<use>`
 *     both live in the hit layer rather than mirroring the base one.
 *
 * SEO SURFACE: UNCHANGED. The same 81 crawlable `<a>`, the same `href`s, the same order, in
 * the same first-response HTML. No metadata, canonical, hreflang, JSON-LD or sitemap surface
 * is touched, and not one visible string moves.
 */
export async function TurkeyMapSection({ locale }: TurkeyMapSectionProps) {
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
  // ENGINEERING.md §5), matching the generated artifact — same posture as the existing
  // neighbour-code join.
  const byPlate = byPlateCode(summaries);

  const titleId = "turkey-map-title";

  return (
    // The "Haritadan bir il seçin" <h2> and its instruction paragraph were removed by
    // the site-wide frame-copy trim (→ DEC 2026-07-30t/u, CONTENT-STYLE §22): the
    // heading restated what the map itself shows, and the paragraph both narrated the
    // interaction and carried a stale claim ("kalan iller içerik doğrulandıkça
    // eklenir" — all 81 are live). The region keeps an accessible name via aria-label
    // (same string as the <svg> <title>) rather than a visually-hidden heading: an
    // equivalent landmark name with no hidden text on the page.
    <section className="section" aria-label={tMap("mapTitle")}>
      <div className={styles.mapRoot} data-map-root>
        <svg className={styles.svg} viewBox={MAP_VIEWBOX} aria-labelledby={titleId}>
          <title id={titleId}>{tMap("mapTitle")}</title>

          {/* THE GEOMETRY, ONCE. Classless on purpose (note 1 in the component docblock);
              `vector-effect` is here rather than in the stylesheet because it is the one
              stroke property a `<use>` clone cannot inherit (note 2). */}
          <defs>
            {PROVINCE_SHAPES.map((shape) => (
              <path
                key={shape.plateCode}
                id={`${SHAPE_ID_PREFIX}${shape.plateCode}`}
                d={shape.d}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </defs>

          {/* LAYER 1 — the map as it has always looked: fill + 1px resting border, all 81
              shapes in plaka order. Decorative by construction (every accessible name lives
              in the hit layer), and inert to the pointer so a hit can only ever be scored by
              the layer that owns the links. */}
          <g data-map-layer="base" className={styles.mapBase} aria-hidden="true">
            {PROVINCE_SHAPES.map((shape) => (
              <use
                key={shape.plateCode}
                href={`#${SHAPE_ID_PREFIX}${shape.plateCode}`}
                className={byPlate.has(shape.plateCode) ? styles.province : styles.provinceInert}
              />
            ))}
          </g>

          {/* LAYER 2 — the crawlable links and NOTHING ELSE that paints. A not-yet-published
              province has no twin up here at all: it is backdrop, so it gets no link, no
              card, no tab stop and no hover line. */}
          <g data-map-layer="hit">
            {PROVINCE_SHAPES.map((shape) => {
              const province = byPlate.get(shape.plateCode);
              if (!province) return null;
              const region = tRegions(province.region);
              const href = getPathname({
                locale,
                href: {
                  pathname: "/turkiye/[slug]",
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
              const areaLabel = areaValue ? tDetail("area") : undefined;
              const districtValue =
                province.districtCount !== null ? format.number(province.districtCount) : undefined;
              const districtLabel = districtValue ? tDetail("districtCount") : undefined;
              // Accessible-name parity (a11y, PR#6 round-2): the hover card is a
              // pointer-only visual surface (aria-hidden), so keyboard/AT users reach
              // the province only through this <a>'s name. Fold the same stat rows the
              // sighted card shows into the label — but ONLY the non-null ones, so the
              // 76 unseeded il stay a clean "name, region" and the 5 seeded ones read
              // "name, region. Nüfus … Yüzölçümü … İlçe Sayısı …" with no "null" leaking.
              const statPhrases: string[] = [];
              if (popLabel && popValue) statPhrases.push(`${popLabel} ${popValue}`);
              if (areaLabel && areaValue) statPhrases.push(`${areaLabel} ${areaValue}`);
              if (districtLabel && districtValue)
                statPhrases.push(`${districtLabel} ${districtValue}`);
              const ariaLabel =
                statPhrases.length > 0
                  ? `${province.nameTr}, ${region}. ${statPhrases.join(". ")}.`
                  : `${province.nameTr}, ${region}`;
              return (
                // A plain SVG <a> with a server-computed localized next-intl pathname:
                // a real crawlable link in the first-response HTML, reliable inside
                // <svg> (Next's <Link> component targets the HTML anchor, not the SVG
                // namespace). Navigation is a full load — fine for a hub map. The
                // `data-*` are the shared, entity-agnostic hover-card contract (see
                // map-hover-card.tsx): badge = plaka, subtitle = bölge, three stat slots.
                <a
                  key={shape.plateCode}
                  className={styles.provinceLink}
                  href={href}
                  aria-label={ariaLabel}
                  data-shape={province.plateCode}
                  data-name={province.nameTr}
                  data-subtitle={region}
                  data-badge={tMap("plateLabel", { code: province.plateCode })}
                  data-href={href}
                  data-stat1-label={popLabel}
                  data-stat1-value={popValue}
                  data-stat2-label={areaLabel}
                  data-stat2-value={areaValue}
                  data-stat3-label={districtLabel}
                  data-stat3-value={districtValue}
                >
                  {/* Paints NOTHING at rest — no fill, no stroke — and still takes every
                    pointer event (`pointer-events: all`). It exists so the hover/focus line
                    has somewhere to be drawn ABOVE the whole base layer. */}
                  <use href={`#${SHAPE_ID_PREFIX}${shape.plateCode}`} className={styles.hitEdge} />
                </a>
              );
            })}
          </g>

          {/* LAST child on purpose, and it stays last now that there is a layer stack above
              the base map: opaque water painted after every province layer is what hides the
              boundary segments crossing a lake, and what makes a mid-lake click hit the water
              instead of the hit layer's link (→ DEC 2026-08-02k md. 5 — a click on water does
              nothing). Moving it under the hit layer would restore the navigation it exists to
              swallow. See components/map/inland-water-layer.tsx. */}
          <InlandWaterLayer />
        </svg>

        <MapHoverCard />

        {/* TWO obligations, one chip. OSM's ODbL covers the dams and permanent lakes; the
            seasonal and salt lakes come from JRC Global Surface Water, whose terms require
            both the dataset credit and, on /hakkimizda, the journal citation. `Source: EC
            JRC/Google` is the licensor's own wording and is VERBATIM in both locales — it is
            never translated, shortened or expanded (→ DEC 2026-08-02q §F), which is why
            `lib/map/tr-inland-water-jrc.test.ts` asserts the substring in tr AND en.

            One paragraph with a break rather than two absolutely-positioned siblings: the
            chip is `position: absolute; bottom: 10px`, so a second `<p>` would land on top of
            the first. This keeps the stylesheets closed (P6 kept them closed on purpose).

            NOT on the world map: it draws Natural Earth countries, not this water layer, and
            crediting a source a surface does not use is a false claim, not a courtesy. */}
        <p className={styles.attribution}>
          {tMap("attribution")}
          <br />
          {tMap("attributionJrc")}
        </p>
      </div>
    </section>
  );
}
