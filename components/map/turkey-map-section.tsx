import { getFormatter, getTranslations } from "next-intl/server";
import { byIsoCode, getCountryMapSummary } from "@/lib/api/countries";
import { byPlateCode, getMapSummary } from "@/lib/api/provinces";
import type { CountryMapSummary, ProvinceMapSummary } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES, TR_CONTEXT_VIEWBOX } from "@/lib/map/tr-context.generated";
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
 * The geographic-context ISO join key drawn as the CASING (turkiye-yenileme PR-B, plan
 * §5.4) rather than as a labelled neighbour — Türkiye's own Natural Earth outline, used
 * only to close the seam between it and the 81-province union. Never labelled: the `<h1>`
 * already says "Türkiye" (plan §5.6).
 */
const CONTEXT_CASING_ISO = "TR";

/** Sizes in TR-frame svg units (plan §5.6) — at a 1080 px content column these are
 *  ≈ 15.3 px (country) and ≈ 22.1 px (sea); the `<text>` `fontSize` attribute, not CSS, so
 *  they scale with the map exactly the way `marine-map.tsx`'s own point labels do. */
const CONTEXT_COUNTRY_LABEL_SIZE = 18;
const CONTEXT_SEA_LABEL_SIZE = 26;

/**
 * Sea names — four hand-picked anchors (a sea has no polygon to derive a centre from),
 * projected with `projectToFrame()` in the TR-frame coordinate space and verified to fall
 * on open water inside `TR_CONTEXT_FRAME` (plan §5.6). Names come from `Map.sea*`
 * (`GLOSSARY.md` §6's canonical TR/EN sea-name rows), never invented here.
 */
const SEA_LABELS = [
  { key: "seaBlackSea", x: 461, y: -27 },
  { key: "seaMarmara", x: 137, y: 102 },
  { key: "seaAegean", x: -13, y: 258 },
  { key: "seaMediterranean", x: 281, y: 464 },
] as const;

/**
 * Per-ISO label anchor overrides (plan §5.6: "a country whose wrapped label cannot fit its
 * labelRadius gets a per-ISO anchor override in the component, recorded with the
 * measurement that forced it" — the same shape `generate-world-map-paths.mjs` uses for its
 * own per-ISO exceptions). Each was measured against the DEFAULT rendering — the
 * generator's own `labelPoint` at `text-anchor="middle"` — using the same conservative
 * `charWidthRatio` `lib/map/point-labels.ts` documents (0.56 × fontSize × character count):
 *
 *   AZ — default (1083.5, 110.8) overflows the frame's EAST edge (x 1120) by ≈ 13.9 u.
 *   MK — default anchor="middle" overflows the WEST edge (x -150) by ≈ 66.7 u.
 *   RS — default overflows the WEST edge by ≈ 40.8 u AND the TOP edge (y -60) by ≈ 9.4 u.
 *   GR — default anchor="middle" overflows the WEST edge by ≈ 18.1 u (the mainland's
 *        pole of inaccessibility sits near the frame's own cut edge).
 *
 * Verified by rendering: every override keeps its label fully inside the frame and clear
 * of every other label at 1440px, both locales (labels are locale-length-sensitive, but
 * both TR and EN country names for these four are short enough not to reopen the
 * overflow the override fixes).
 */
const LABEL_ANCHOR_OVERRIDES: Partial<
  Record<string, { readonly x: number; readonly y: number; readonly anchor: "start" | "middle" }>
> = {
  AZ: { x: 1025, y: 175, anchor: "middle" },
  MK: { x: -138, y: 33, anchor: "start" },
  RS: { x: -142, y: -46, anchor: "start" },
  GR: { x: -105, y: 130, anchor: "start" },
};

/**
 * The KKTC/Cyprus paired label placement (plan §5.6). Both entities' inscribed radii
 * (QN 11.1 u, CY 15.2 u) are far too small to hold their own names — `Kuzey Kıbrıs Türk
 * Cumhuriyeti` alone needs ≈ 292 u — so both are named in a two-line block placed in open
 * Mediterranean water between Türkiye's south coast and the Cyprus shapes (verified by
 * rendering: clear of the Akdeniz sea label, the Syria/Lebanon coastline and the shapes
 * themselves), each with a short leader line to its own shape. `CONVENTIONS.md` §5's
 * paired-precision rule is why this is one block, not two independently placed labels: the
 * pair is decided together (§5.6), and both leader lines get the identical treatment.
 */
const CY_QN_LABEL_BLOCK = {
  qn: { x: 480, y: 386, leaderFrom: { x: 480, y: 380 } },
  cy: { x: 480, y: 416, leaderFrom: { x: 480, y: 410 } },
} as const;

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
 *   <InlandWaterLayer>       P6's lakes, still the LAST PAINTED map layer (see the note at
 *                            the call site): it masks the boundary running across a lake and
 *                            it swallows the mid-lake click, and both of those ARE its paint
 *                            position
 *
 * WIDENED, turkiye-yenileme PR-B (plan §5.4): three GEOGRAPHIC CONTEXT groups joined this
 * stack — `context-casing` and `context-land` BEFORE `base` (so a province's own fill always
 * wins over the backdrop, never the reverse), and `context-labels` AFTER `InlandWaterLayer`
 * (so no fill ever covers a name). None of the three is a province: they add no `<a>`, no
 * `tabIndex`, no `data-shape`, and all three (labels included) are `pointer-events: none` —
 * the SAME regression class the paragraph above this one exists to prevent, re-verified for
 * this change by the same `elementFromPoint` occlusion probe (§11 of the plan; see the PR's
 * completion report for the actual re-run numbers). `MAP_VIEWBOX` and its nine other
 * consumers are UNTOUCHED — this component alone widens to `TR_CONTEXT_VIEWBOX`, a second,
 * independent frame in the same coordinate space (`scripts/lib/tr-frame.mjs`).
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
  // `WorldMap.attribution` ONLY, for the third credit line below (plan §5.7 recommendation
  // 1) — reusing `/dunya`'s exact Natural Earth courtesy-credit bytes, never a new string.
  const tWorldMap = await getTranslations("WorldMap");
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

  // Country names for the geographic-context labels (plan §5.6) come from the SAME
  // `/api/countries/map-summary` endpoint `/dunya` already reads — never from
  // `messages/*.json` (CONVENTIONS.md §5: sovereignty-sensitive status framing is
  // represented by the api, not a frontend-maintained entity list). Best-effort, same
  // posture as the province summary above: a failure means the context countries draw
  // unlabelled, not that the map breaks.
  let countrySummaries: CountryMapSummary[] = [];
  try {
    countrySummaries = await getCountryMapSummary();
  } catch (error) {
    console.warn(
      `[map] country map-summary unavailable; context draws unlabelled. ${String(error)}`,
    );
  }
  const byIso = byIsoCode(countrySummaries);

  const contextCasing = CONTEXT_SHAPES.find((shape) => shape.iso === CONTEXT_CASING_ISO);
  const contextLand = CONTEXT_SHAPES.filter((shape) => shape.iso !== CONTEXT_CASING_ISO);

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
      {/* .trContextRoot = flat sea backdrop (turkiye-yenileme PR-B, plan §5.5): the map now
          draws real sea, so the panel background switches from the warm parchment gradient
          `/dunya`'s own `.worldRoot` modifier already establishes the pattern for — a
          class of its own on [data-map-root], never an edit to `.mapRoot` itself, because
          `tool-map.tsx` shares that base rule and would otherwise gain a sea background
          nobody asked for. */}
      <div className={`${styles.mapRoot} ${styles.trContextRoot}`} data-map-root>
        <svg className={styles.svg} viewBox={TR_CONTEXT_VIEWBOX} aria-labelledby={titleId}>
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

          {/* CONTEXT LAYERS — geographic backdrop (turkiye-yenileme PR-B, plan §5.4). Drawn
              FIRST, before the province `base`/`hit` layers, so a province's own fill and
              hover/focus line always paint over the context — the paint-order stack this
              file's own docblock already documents is now: casing → land → base (unchanged)
              → hit (unchanged) → InlandWaterLayer (unchanged, still last PAINTED layer) →
              labels (last of all, so nothing covers a name). All three context groups are
              `pointer-events: none` WITHOUT EXCEPTION — this is the exact shape of the
              62%-of-the-map credit-plate regression this docblock records above (an overlay
              without it returned the credit instead of the map for 59/81 province centres at
              320px); none of the three carries an `<a>`, a `tabIndex` or a `data-shape`, so
              the hit layer stays the only thing on this map that scores a hit. */}

          {/* Türkiye's own Natural Earth outline, filled + self-coloured-stroked UNDER
              everything else. Its fill covers every point where NE-Türkiye's generalisation
              reaches outside the 81-province union (measured, plan §5.0-3: p99 2.47 u, max
              4.60 u) — closing the seam by construction, not by a tuned number. Its stroke is
              a SCALING one (no `vectorEffect`, deliberately — plan §5.4): the halo has to stay
              proportional to the map at every container width, unlike the province hairlines,
              which stay a constant device-pixel width via `non-scaling-stroke`. */}
          <g data-map-layer="context-casing" className={styles.contextCasing} aria-hidden="true">
            {contextCasing && <path d={contextCasing.d} />}
          </g>

          {/* The 14 neighbour/near-neighbour countries whose Natural Earth outline has any
              visible area inside the widened frame (`lib/map/tr-context.generated.ts` —
              every survivor is drawn, no hand-kept "immediate neighbours" list, plan §5.3).
              Each carries its own hairline coastline/border (`--map-context-line`,
              non-scaling so it stays a hairline at every rendered size, matching every other
              boundary line on this map) over the shared `--map-context-land` fill. */}
          <g data-map-layer="context-land" className={styles.contextLand} aria-hidden="true">
            {contextLand.map((contextShape) => (
              // `contextShape`, deliberately NOT `shape`: keeping the province `<defs>` loop's
              // `d={shape.d}` the ONLY match for that pattern is what lets
              // `map-layers.test.ts`'s "geometry written once" guard stay a single,
              // unambiguous regex rather than something a differently-named loop variable could
              // satisfy by accident (plan §5.4) — the context array gets its OWN explicit
              // "written once" assertion instead, matching this variable name.
              <path key={contextShape.iso} d={contextShape.d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

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

          {/* Still the LAST PAINTED map layer (turkiye-yenileme PR-B moved the true last CHILD
              to the label group below it): opaque water painted after every province layer is
              what hides the boundary segments crossing a lake, and what makes a mid-lake click
              hit the water instead of the hit layer's link (→ DEC 2026-08-02k md. 5 — a click
              on water does nothing). Moving it under the hit layer would restore the
              navigation it exists to swallow. See components/map/inland-water-layer.tsx. */}
          <InlandWaterLayer />

          {/* CONTEXT LABELS — drawn LAST of everything so no fill ever covers a name (plan
              §5.4/§5.6). Unlike the two shape groups above, this group is NOT `aria-hidden`:
              it is real geographic text — fourteen short country names plus four sea names,
              not forty-three tab stops — and hiding visible words from AT to keep a group
              tidy is the wrong trade (the `inland-water-layer.tsx` "decorative, no page, no
              label, no action" precedent does not transfer to a name). `pointer-events: none`
              still applies (the shared `.contextGroup` rule), same as the two shape groups:
              a label is never a hit target. Hidden entirely below 720px
              (`@media (max-width: 720px)` in map.module.css) — reusing `marine.module.css`'s
              own breakpoint for the identical problem: at that width no font size or
              placement rule makes fourteen names readable. */}
          <g data-map-layer="context-labels" className={styles.contextLabels}>
            {SEA_LABELS.map((sea) => (
              <text
                key={sea.key}
                x={sea.x}
                y={sea.y}
                textAnchor="middle"
                fontSize={CONTEXT_SEA_LABEL_SIZE}
                className={`${styles.contextLabel} ${styles.contextSeaLabel}`}
              >
                {tMap(sea.key)}
              </text>
            ))}

            {contextLand
              .filter((shape) => shape.iso !== "QN" && shape.iso !== "CY")
              .map((shape) => {
                const country = byIso.get(shape.iso);
                if (!country) return null; // R10: an ISO the api has not published draws unlabelled
                const name = locale === "en" ? country.nameEn : country.nameTr;
                const override = LABEL_ANCHOR_OVERRIDES[shape.iso];
                const x = override ? override.x : shape.labelPoint.x;
                const y = override ? override.y : shape.labelPoint.y;
                const anchor = override ? override.anchor : "middle";
                return (
                  <text
                    key={shape.iso}
                    x={x}
                    y={y}
                    textAnchor={anchor}
                    fontSize={CONTEXT_COUNTRY_LABEL_SIZE}
                    className={styles.contextLabel}
                  >
                    {name}
                  </text>
                );
              })}

            {/* KKTC/Cyprus — labelled as a pair or not at all (plan §5.6, CONVENTIONS.md §5).
                Both names come from the live api (never hardcoded), verified against
                `GLOSSARY.md` §7.3's locked `Kuzey Kıbrıs Türk Cumhuriyeti` /
                `Turkish Republic of Northern Cyprus` form before shipping — see the
                completion report. If either is not (yet) published by the api, NEITHER is
                labelled, so the pair is never asymmetric. */}
            {(() => {
              const qn = byIso.get("QN");
              const cy = byIso.get("CY");
              const qnShape = contextLand.find((shape) => shape.iso === "QN");
              const cyShape = contextLand.find((shape) => shape.iso === "CY");
              if (!qn || !cy || !qnShape || !cyShape) return null;
              const qnName = locale === "en" ? qn.nameEn : qn.nameTr;
              const cyName = locale === "en" ? cy.nameEn : cy.nameTr;
              return (
                <g>
                  <line
                    className={styles.contextLeader}
                    x1={CY_QN_LABEL_BLOCK.qn.leaderFrom.x}
                    y1={CY_QN_LABEL_BLOCK.qn.leaderFrom.y}
                    x2={qnShape.labelPoint.x}
                    y2={qnShape.labelPoint.y}
                  />
                  <line
                    className={styles.contextLeader}
                    x1={CY_QN_LABEL_BLOCK.cy.leaderFrom.x}
                    y1={CY_QN_LABEL_BLOCK.cy.leaderFrom.y}
                    x2={cyShape.labelPoint.x}
                    y2={cyShape.labelPoint.y}
                  />
                  <text
                    x={CY_QN_LABEL_BLOCK.qn.x}
                    y={CY_QN_LABEL_BLOCK.qn.y}
                    textAnchor="middle"
                    fontSize={CONTEXT_COUNTRY_LABEL_SIZE}
                    className={styles.contextLabel}
                  >
                    {qnName}
                  </text>
                  <text
                    x={CY_QN_LABEL_BLOCK.cy.x}
                    y={CY_QN_LABEL_BLOCK.cy.y}
                    textAnchor="middle"
                    fontSize={CONTEXT_COUNTRY_LABEL_SIZE}
                    className={styles.contextLabel}
                  >
                    {cyName}
                  </text>
                </g>
              );
            })()}
          </g>
        </svg>

        <MapHoverCard />
      </div>

      {/* BELOW THE MAP BOX, NOT ON IT (`FU-TURKIYE-ATIF-ORTUSU`; owner-ruled from a rendered
          frame — → DEC 2026-08-21d md.2). This surface is the fourth to make the move — the
          game did it first, then the CBS tool pages, then `/dunya` in PR #77 — but NOT the last
          map in the repo that needs it: `/deniz` still plates its credit from
          `marine.module.css`, tracked as `FU-MARINE-ATIF-PLAKASI`.

          WHAT IT FIXES, RE-MEASURED ON THIS BUILD RATHER THAN QUOTED. The plate was
          `position: absolute; right: 14px; bottom: 10px` inside `[data-map-root]`, and at
          phone widths it is not a corner chip at all — with no `left` offset it stretches
          from the panel's inner left edge to 14px off its right, so at 320px it measures
          264 × 79.69 over a 280 × 121.25 panel: **62.0% of the map**. Hit-testing each of the
          81 links at its own bounding-box centre with `elementFromPoint`, **59 of 81 il
          centres return the credit, not the map** at 320px, and 36 of 81 at 360px — identical
          in both locales. That is a navigation defect, not a cosmetic one: `.attribution`
          carried no `pointer-events: none`, so the plate ATE the click on those 59 shapes.
          The same probe reads 0 of 81 with the credit in flow, at every width and in both
          locales.

          The credit stays VISIBLE and stays INSIDE the map component — it moves out of the
          bordered box into this component's own flow, under the map, which is the sentence
          DEC 2026-07-10 md.4 asks for ("visible (map footer/component)"). In flow it needs no
          scrim to stay legible: `--color-slate` on `--color-bg` is 7.48:1 (`DESIGN.md` §5),
          against a plate that only existed to survive being over the map.

          THE PANEL DOES NOT MOVE. An absolutely positioned plate never contributed to
          `.mapRoot`'s height, so the box stays at exactly the height it has today (measured:
          121.25px at 320, 138.42 at 360, 313.45 at 768, 464.45 at 1440 — unchanged) and the
          map inside it is not relaid out. What grows is the `<section>`, by the credit's own
          flow height, in the first-response HTML — so nothing shifts after paint (CWV/CLS,
          `ENGINEERING.md` §4 #9).

          NOT ONE CHARACTER OF EITHER LICENCE STRING MOVED: the two message keys, their order,
          the `lang="en"` wrapper and the `{" "}` below are exactly as they were.

          TWO obligations, one credit. OSM's ODbL covers the dams and permanent lakes; the
          seasonal and salt lakes come from JRC Global Surface Water, whose terms require
          both the dataset credit and, on /hakkimizda, the journal citation.

          `Source: EC JRC/Google` is the licensor's own wording: VERBATIM in both locales,
          never translated, shortened or expanded (→ DEC 2026-08-02q §F). It therefore sits
          in its own `lang="en"` span — the `marine-attribution.tsx` pattern, for the same
          reason (WCAG 3.1.2): a Turkish-voice screen reader must not read an English
          licence string with Turkish phonetics. The Turkish label stands ALONGSIDE it.

          ONE paragraph, TWO block spans WITH A REAL SPACE BETWEEN THEM — and the reason is
          no longer the layout. It used to be: the plate was `position: absolute; bottom:
          10px`, so a second `<p>` would have landed on top of the first. In flow that
          constraint is gone and two paragraphs would stack correctly. It stays one paragraph
          because the two notices are ONE credit for ONE water layer, which is the same
          reasoning `game-map.tsx` records for the same markup; `attribution-separation.test.ts`
          guards the shape on all three surfaces and is indifferent to which reason holds.

          The two notices used to be split by a `<br>`, which left them a SINGLE text run:
          the DOM read "…ODbLMevsimlik göl sınırları:…" with the two licences welded
          together (UX tour B26). Block spans alone do NOT fix that — `textContent`
          concatenates regardless of layout, MEASURED on the running build — so the
          separating space below is load-bearing, not formatting. With it, all three text
          APIs agree: `textContent` separates the licences, `innerText` still breaks the
          line, and AT gets two block boxes instead of one run. The space itself never
          renders: whitespace between two block-level boxes is collapsed away, so the credit
          is pixel-identical to the `<br>` version.

          NOT on the world map: it draws Natural Earth countries, not this water layer, and
          crediting a source a surface does not use is a false claim, not a courtesy.

          A THIRD `.attributionLine` joined this paragraph in turkiye-yenileme PR-B (plan
          §5.7 recommendation 1), and the converse of the note directly above is exactly why
          it is now correct here: this component draws Natural Earth country boundaries as
          its geographic context (`lib/map/tr-context.generated.ts`), so `/turkiye` now
          genuinely uses the data `/dunya`'s own credit names. `provenance/datasets.md` line
          51 still rules `ATIF: borçlu değildir` — Natural Earth is public domain and owes no
          attribution — so this line is the SAME product choice `/dunya` already makes, not a
          new licence obligation. `WorldMap.attribution`'s exact TR/EN bytes are reused
          verbatim (no new string minted), so no `CONTENT-STYLE.md`/`GLOSSARY.md` surface is
          touched by this line. `attribution-separation.test.ts` was extended for this file's
          case (2 → 3 `.attributionLine` spans) rather than left silently out of step. */}
      <p className={styles.attributionFlow}>
        <span className={styles.attributionLine}>{tMap("attribution")}</span>{" "}
        <span className={styles.attributionLine}>
          {tMap("attributionJrcLabel")} <span lang="en">{tMap("attributionJrcEnglish")}</span>
        </span>{" "}
        <span className={styles.attributionLine}>{tWorldMap("attribution")}</span>
      </p>
    </section>
  );
}
