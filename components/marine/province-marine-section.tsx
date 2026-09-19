import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarineConditions, MarineLayer } from "@/lib/api/types";
import { marinePointAnchorId } from "@/lib/marine/anchors";
import { maxGridDistanceKm, marineBlockValues } from "@/lib/marine/vintage";
import { ValueCell } from "./value-cell";
import { VintageLine } from "./vintage-line";

interface ProvinceMarineSectionProps {
  locale: Locale;
  /** The province's own name, for the heading. */
  provinceName: string;
  /** This province's value blocks, in the api's `displayOrder`. Never empty. */
  blocks: MarineConditions[];
  /** The measurement catalogue: every threshold and convention the cells read. */
  layers: MarineLayer[];
  /** `id` of this section's `<h2>`. */
  headingId: string;
}

/**
 * THE SECTION'S SURFACE, AS BRIDGE TOKENS (T-033).
 *
 * `marine.module.css` painted `.provinceBlock` with a literal `background: #fff` and wrote
 * every text colour as a raw Terra token the `.dark` block never redefines. That pair is
 * exactly the screenshot this work opened on: a white card on a dark page, with the one line
 * that sat OUTSIDE the card (`CAUTION`) measuring 2.15:1 and the hub link inside it 2.08:1.
 * Bound to `bg-card`/`text-foreground`/`text-muted-foreground`/`border-border` the same
 * elements measure 14.73:1, 7.79:1 and 8.20:1 in dark (`lib/theme/contrast.ts`).
 *
 * Sizes are the module's own, to the pixel, so the conversion moves colour and not layout.
 * The one deliberate exception is the block's corner — see the comment on the block itself.
 */
/** The block's `<h3>`, which exists only when there are two blocks to tell apart. */
const BLOCK_HEADING = "mt-0 mb-3 text-base text-foreground";
/** One measured quantity: a fixed term column so three rows line up without a table. */
const ROW = "grid grid-cols-[11ch_1fr] items-baseline gap-2.5";
const TERM = "text-[0.85rem] text-muted-foreground";
const DESC = "m-0 text-foreground";
/** The grid-distance line under this block's kunye. */
const GRID_DISTANCE = "mt-[5px] mb-0 text-[0.85rem] leading-[1.5] text-muted-foreground";
/** The frozen `marine.straits.lowConfidence` caution, on the page surface, not in a block. */
const CAUTION = "mt-4 mb-0 max-w-[70ch] text-[0.9rem] leading-[1.55] text-muted-foreground";
/** Hub-and-spoke links. No colour of its own: `<a>` reads `--link` from the base layer. */
const HUB_LINK = "mt-3 mb-0 text-[0.85rem]";

/**
 * "{İl} açıklarında deniz durumu" — the marine section on a coastal province page (W2b).
 *
 * WHY IT SITS WHERE IT SITS. Directly under Temel Bilgiler, above the province's prose. The
 * visitor this section exists for arrived asking "Sinop'ta deniz kaç derece" and must not
 * have to scroll past a landform essay to find out; that is the province-page half of the
 * same user-first inversion `/deniz` took in W2a.
 *
 * THE LOCKED TWO-POINT POLICY, AS MARKUP. İstanbul, Çanakkale and Balıkesir publish two
 * reference points on two different seas. The two are NEVER filled from each other and the
 * province is NEVER suppressed because one of them is short of data: each block carries its
 * own values, its own five-render states and its own künye, under its own `coastLabel`
 * heading. The whole point is that they may legitimately disagree — İstanbul's Black Sea
 * point carries a wave height while its Marmara point carries `not_supported`, permanently,
 * because CMEMS publishes no wave field inside the Marmara at all.
 *
 * A single-point province opens NO `<h3>` layer. A sub-heading over the only block on the
 * page is a hierarchy with nothing to distinguish, and it would read as though a second block
 * were missing.
 *
 * WHY `<dl>` AND NOT THE HUB'S `<table>`. Three measured quantities for ONE entity is a
 * description list, not tabular data — there is no second row to compare against and no
 * column meaning to hold in your head. The hub's table earns its semantics with fifteen rows;
 * copying it here would give a screen-reader user a one-row table to navigate.
 *
 * WHAT IS DELIBERATELY NOT HERE. No chart (W2c owns the five-day series and the
 * `series.sourceDiffersNotice` that explains it, so the notice is not born yet — a fixed
 * string about a discrepancy between a chart and a headline number has no referent on a page
 * with no chart). No meta-description layer (A3: the post-M5 FENER round owns that). No
 * marine value in the page's JSON-LD, and no `dateModified` touched by marine freshness — the
 * province's content did not change because the wind did.
 */
export async function ProvinceMarineSection({
  locale,
  provinceName,
  blocks,
  layers,
  headingId,
}: ProvinceMarineSectionProps) {
  const t = await getTranslations("ProvinceDetail");
  const tm = await getTranslations("Marine");
  const format = await getFormatter();

  const layerById = new Map<MarineLayer["id"], MarineLayer>(
    layers.map((layer) => [layer.id, layer]),
  );
  const waveHeightLayer = layerById.get("wave_height");
  const waveDirectionLayer = layerById.get("wave_direction");
  const windSpeedLayer = layerById.get("wind_speed_10m");
  const windDirectionLayer = layerById.get("wind_direction_10m");
  const temperatureLayer = layerById.get("sea_surface_temperature");

  // The `<h3>` layer exists only to tell two blocks apart (see the block comment above).
  const labelled = blocks.length > 1;

  return (
    <section className="mt-10" aria-labelledby={headingId}>
      <h2 id={headingId}>{t("marineHeading", { name: provinceName })}</h2>

      {/* One column on a phone; two side by side once there is room, which is what makes the
          two-point provinces (Istanbul, Canakkale, Balikesir) show their two seas as a genuine
          comparison rather than as one block above another. The upper bound is what keeps the
          24 single-point provinces honest: an unbounded `1fr` stretched three short rows across
          the full page width and read as a half-empty table.

          `min(280px, 100%)` rather than a bare `280px`: a fixed track minimum cannot shrink
          below itself, so at the 320px reflow reference width (WCAG 1.4.10) the block would sit
          at exactly the 280px the 20px container padding leaves — no overflow today, but with
          zero slack, and any future padding change would push the page into horizontal scroll.
          The `min()` caps the minimum at the space actually available and changes nothing at
          any width where 280px fits. */}
      <div className="grid items-start justify-start gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),520px))]">
        {blocks.map((block) => {
          const point = block.point;
          const label = locale === "en" ? point.coastLabelEn : point.coastLabelTr;
          const blockHeadingId = `${headingId}-${point.slugTr}`;
          const rowValues = marineBlockValues(block);
          const gridDistance = maxGridDistanceKm(rowValues);

          return (
            <div
              key={point.slugTr}
              /* HAND-DRAWN, AND SPELLED SO THE CENSUS CAN SEE IT. Not a `<Card variant>`:
                 both call sites in `app/[locale]/(site)/turkiye/[slug]/page.tsx` already wrap
                 this whole section in `<Card variant="panel">`, so a nested `panel` would put
                 `p-6 sm:p-8` inside `p-6 sm:p-8` — at the 320px reflow reference width (WCAG
                 1.4.10) that is 12px off the `11ch 1fr` track pair below, on the side the
                 `whitespace-nowrap` "5,8 m/s (21 km/h)" line lives, which `pnpm
                 sweep:overflow` passes with little to spare. `glass` is the only variant whose
                 geometry fits and it is documented as the hero strip, which this is not.
                 So the surface stays local, at the module's own padding — but written INLINE
                 in the site's own card spelling (`rounded-2xl border border-border bg-card`,
                 the same one `marine-data-notice.tsx` uses one file over), not hoisted behind
                 an identifier and not at an off-language radius, so
                 `components/v2/page-composition-cards.test.ts` counts it like every other
                 hand-drawn card instead of being dodged. The corner moves 10px -> 18px; that
                 is the adoption, and it is the only geometry this conversion changes. */
              className="rounded-2xl border border-border bg-card px-[18px] py-4"
              // Grouped and named ONLY when there are two: that is when a screen-reader user
              // needs to know which sea the numbers they are hearing belong to. A group of
              // one, named after the only thing on offer, is noise.
              {...(labelled ? { role: "group" as const, "aria-labelledby": blockHeadingId } : {})}
            >
              {/* The province name is already in the `<h2>`; repeating it here would be
                  noise, which is exactly why the contract publishes a province-relative
                  `coastLabel` ("Marmara açıkları") alongside the standalone `nameTr`. */}
              {labelled && (
                <h3 id={blockHeadingId} className={BLOCK_HEADING}>
                  {label}
                </h3>
              )}

              <dl className="m-0 flex flex-col gap-3">
                <div className={ROW}>
                  <dt className={TERM}>{tm("values.colWind")}</dt>
                  <dd className={DESC}>
                    <ValueCell
                      magnitude={block.windSpeed10m}
                      magnitudeLayer={windSpeedLayer}
                      direction={block.windDirection10m}
                      directionLayer={windDirectionLayer}
                    />
                  </dd>
                </div>
                <div className={ROW}>
                  <dt className={TERM}>{tm("values.colWave")}</dt>
                  <dd className={DESC}>
                    <ValueCell
                      magnitude={block.waveHeight}
                      magnitudeLayer={waveHeightLayer}
                      direction={block.waveDirection}
                      directionLayer={waveDirectionLayer}
                    />
                  </dd>
                </div>
                <div className={ROW}>
                  <dt className={TERM}>{tm("values.colSeaTemperature")}</dt>
                  <dd className={DESC}>
                    {/* No direction pair: a temperature has no bearing, and the catalogue
                        carries no calm threshold for it, so no calm claim can be made. */}
                    <ValueCell
                      magnitude={block.seaSurfaceTemperature}
                      magnitudeLayer={temperatureLayer}
                    />
                  </dd>
                </div>
              </dl>

              {/* This block's OWN künye — one line per provider, absolute UTC, oldest instant
                  wins. Two points of one province can sit on two different model instants, so
                  a single section-wide line would be a small lie about one of them. */}
              <div className="mt-3.5 border-t border-border pt-3">
                <VintageLine values={rowValues} />
                {gridDistance !== null && (
                  <p className={GRID_DISTANCE}>
                    {tm("values.gridDistance", {
                      km: format.number(gridDistance, { maximumFractionDigits: 1 }),
                    })}
                  </p>
                )}
              </div>

              {/* Hub-and-spoke: straight to this point's own row in the four-sea table, using
                  the row ids `/deniz` has emitted since W2a (`lib/marine/anchors.ts`). */}
              <p className={HUB_LINK}>
                <Link href={{ pathname: "/deniz", hash: marinePointAnchorId(point) }}>
                  {tm("hubLinkPoint", { label })}
                </Link>
              </p>
            </div>
          );
        })}
      </div>

      {/* The frozen `marine.straits.lowConfidence` key, born here with the surface it
          annotates. Shown for EVERY coastal province and written to be true of every one of
          them: "which provinces are strait provinces" is a geographic fact with no field in
          the contract, and hand-marking İstanbul and Çanakkale on the web side would create
          exactly the second source of geography this repo forbids. A per-province caution
          needs an api field (`straitsCaution`), which is a follow-up, not a guess. */}
      <p className={CAUTION}>{tm("straits.lowConfidence")}</p>

      <p className={HUB_LINK}>
        <Link href="/deniz">{tm("hubLinkAll")}</Link>
      </p>
    </section>
  );
}
