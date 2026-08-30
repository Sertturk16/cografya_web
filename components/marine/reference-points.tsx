import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type {
  MarineLayer,
  MarineOverview,
  MarineOverviewPoint,
  MarinePointListItem,
  ProvinceListItem,
} from "@/lib/api/types";
import { byPlateCode } from "@/lib/api/provinces";
import {
  MARINE_POINTS_SECTION_ID,
  marineBasinAnchorId,
  marinePointAnchorId,
} from "@/lib/marine/anchors";
import { basinLabel, groupPointsByBasin } from "@/lib/marine/basins";
import { MODEL_INSTANT_FORMAT } from "@/lib/marine/model-run";
import { marinePublishableBlocks } from "@/lib/marine/overview";
import { MARINE_VALUE_STATUS_KEY } from "@/lib/marine/value-state";
import { marineBlockValues, oldestValidAt } from "@/lib/marine/vintage";
import { BasinValuesTable } from "./basin-values-table";
import { MarineMap } from "./marine-map";
import { VintageLine } from "./vintage-line";
import styles from "./marine.module.css";

interface ReferencePointsProps {
  locale: Locale;
  points: MarinePointListItem[];
  /** The published provinces — the authoritative set of pages that exist. */
  provinces: ProvinceListItem[];
  /** The measurement catalogue: every threshold and convention the tables read. */
  layers: MarineLayer[];
  /** The value payload, or `null` when there is nothing publishable this render. */
  overview: MarineOverview | null;
}

/**
 * The section's heading id, and the stem of each basin sub-heading's id.
 *
 * Both come from `lib/marine/anchors.ts` rather than from a template literal here: since W2b
 * the 27 province pages link INTO these ids, and two independently-written template strings
 * would drift into a link that silently lands at the top of the page.
 */
const HEADING_ID = MARINE_POINTS_SECTION_ID;

/**
 * THE VALUE BAND — the page's first section and, since W2a, its subject.
 *
 * `/deniz` used to open with an explanation and keep the data underneath. The spine is
 * inverted: a reader who arrives asking "how is the sea right now" gets the map and the
 * numbers before anything else, and the explanations sit below as the supporting layer they
 * are. This component is the top of that spine.
 *
 * TWO SHAPES, ONE SECTION:
 *
 * - **With values** — four sea tables, one row per reference point, plus the reading key and
 *   the per-provider künye. The heading says "deniz durumu", because the page then really
 *   answers that.
 * - **Without values** — the W1a shape: the map and the four linked point lists. The heading
 *   falls back to the reference-point wording, because a "deniz durumu" heading over no
 *   values would be a promise the page does not keep.
 *
 * WHY THE SECTION SURVIVES A MISSING PAYLOAD AT ALL. The contract says a
 * `dataAvailable: false` response must not be committed by ISR, and the page honours that by
 * not rendering the BAND. It does not drop the SECTION: those thirty links are the hub's
 * internal-linking job (`SEO-POLICY.md` §A4), they have nothing to do with the provider
 * chain, and a hub that silently lost its outbound links whenever an upstream model ran late
 * would be a much worse failure than a table missing for one revalidate window.
 *
 * WHICH LIST DRIVES THE ROWS, PRECISELY. The `/points` list drives the ORDER and the basin
 * grouping; the value payload drives which rows exist. A point that `/points` publishes and
 * `/overview` does not carry gets no row in the value render — and, with it, no province
 * link — because a row assembled out of five absent values would say nothing a reader could
 * use, and inventing a status the api did not send is the one thing this whole surface is
 * written against.
 *
 * That divergence is not reachable against today's api: `/overview` is assembled from the
 * same reference-point table `/points` serves, so the two sets are equal by construction.
 * The residual is a cache-skew window — the points read is cached for 24 h, the value read
 * for 900 s — so a point RETIRED from the probe set could sit in the stale `/points` list
 * for up to a day without a matching value block. It would then be missing from the table
 * for that window, which is the correct outcome for a retired point. The value-less render
 * below takes the opposite path and lists all thirty, because there it is the only list
 * there is.
 *
 * ONE INTRO SENTENCE INSTEAD OF FOUR REPEATS (deniz-notlar.txt madde 3 / deniz-yeni.txt). Each
 * basin table used to carry its own `<caption>` — "{Deniz} açıkları: referans noktalarında
 * yayımlanan son değerler." — four times, word for word except the sea name, directly under a
 * basin heading that already states the sea name and the point count. `t("valuesIntro")`
 * replaces all four with the owner's own approved sentence, said once, right under THIS
 * section's own `<h2>`; `BasinValuesTable` no longer renders a `<caption>` at all (see its own
 * docblock for what replaced it).
 */
export async function ReferencePoints({
  locale,
  points,
  provinces,
  layers,
  overview,
}: ReferencePointsProps) {
  const t = await getTranslations("Deniz");
  const tm = await getTranslations("Marine");
  const format = await getFormatter();

  const groups = groupPointsByBasin(points);
  const provincesByPlate = byPlateCode(provinces);

  // The link-less render is a legitimate state (no published province page) AND the exact
  // shape of a degraded one: if the province read fails during `next build` while the point
  // read succeeds, every point silently loses its link and the hub caches a dead-ended page
  // that looks intentional. Nothing here can repair that, but it must not pass in silence —
  // same treatment as the fetch wrappers' build-time warnings (`lib/api/provinces.ts`).
  if (points.length > 0 && points.every((point) => !provincesByPlate.has(point.plateCode))) {
    console.warn(
      `[marine] ${points.length} reference points resolved to 0 province pages ` +
        `(${provinces.length} provinces loaded); the hub is rendering without internal links.`,
    );
  }

  // The publish gate lives in ONE function (`lib/marine/overview.ts`) because the page's
  // lede reads the same answer: two components deciding separately whether this render has
  // values is how a lede ends up promising numbers the section below it cannot show.
  const blocks: MarineOverviewPoint[] = marinePublishableBlocks(overview);
  const blockBySlug = new Map(blocks.map((block) => [block.point.slugTr, block]));
  const showValues = blocks.length > 0;

  const layerById = new Map<MarineLayer["id"], MarineLayer>(
    layers.map((layer) => [layer.id, layer]),
  );

  // The one sentence that replaces the four repeated table captions (see the docblock above).
  // Gated on `showValues`: it names "the tables below", which do not exist in the value-less
  // render.
  const windWaveValidAt = showValues
    ? oldestValidAt(
        blocks.flatMap((block) => [
          block.windSpeed10m,
          block.windDirection10m,
          block.waveHeight,
          block.waveDirection,
        ]),
      )
    : null;
  const seaTemperatureValidAt = showValues
    ? oldestValidAt(blocks.map((block) => block.seaSurfaceTemperature))
    : null;

  return (
    <section className="section" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID}>{showValues ? t("valuesHeading") : t("pointsHeading")}</h2>
      {showValues && <p className={styles.hint}>{t("valuesIntro")}</p>}
      <p className={styles.hint}>{tm("point.referencePointHint")}</p>

      {/* The map is a VIEW of what follows it, not a separate topic, so the two share this
          one <h2> rather than the map opening a heading of its own — a second heading would
          claim the map is a second subject and split the section's outline. */}
      <MarineMap locale={locale} points={points} provinces={provinces} />

      {showValues ? (
        <>
          <div className={styles.basinTables}>
            {groups.map((group) => {
              const label = basinLabel(group, locale);
              if (label === null) return null;

              const groupBlocks = group.points
                .map((point) => blockBySlug.get(point.slugTr))
                .filter((block): block is MarineOverviewPoint => block !== undefined);
              if (groupBlocks.length === 0) return null;

              const headingId = marineBasinAnchorId(group.basin);

              return (
                <section
                  key={group.basin}
                  className={styles.basinBlock}
                  aria-labelledby={headingId}
                >
                  {/* The count lives INSIDE the heading so a screen reader announces
                      "Karadeniz açıkları, 15 nokta" as one landmark name. */}
                  <h3 id={headingId} className={styles.basinHeading}>
                    {label}
                    <span className={styles.basinCount}>
                      {tm("basinPointCount", { count: groupBlocks.length })}
                    </span>
                  </h3>
                  <BasinValuesTable
                    locale={locale}
                    basinLabel={label}
                    blocks={groupBlocks}
                    layerById={layerById}
                    provincesByPlate={provincesByPlate}
                    headingId={headingId}
                  />
                </section>
              );
            })}
          </div>

          <div className={styles.readingKey}>
            <h3 className={styles.subHeading}>{tm("values.readingKeyHeading")}</h3>
            <ul role="list" className={styles.noteList}>
              <li>{tm("values.readingKeyArrow")}</li>
              <li>{tm("values.readingKeyCalm", { term: tm("calm.label") })}</li>
              <li>{tm("values.readingKeyStale")}</li>
              {/* The three non-numeric states, each named with the SAME string the table
                  cell prints, so the key and the table can never drift apart. */}
              <li>{tm("values.readingKeyNoData", { term: tm(MARINE_VALUE_STATUS_KEY.noData) })}</li>
              <li>
                {tm("values.readingKeyNotSupported", {
                  term: tm(MARINE_VALUE_STATUS_KEY.notSupported),
                })}
              </li>
              <li>
                {tm("values.readingKeyUnavailable", {
                  term: tm(MARINE_VALUE_STATUS_KEY.unavailable),
                })}
              </li>
            </ul>
          </div>

          <div className={styles.vintage}>
            <h3 className={styles.subHeading}>{tm("vintage.heading")}</h3>
            {/* THE COMBINED SENTENCE (deniz-notlar.txt madde 2 / deniz-yeni.txt), replacing
                the 30-times-repeated per-row instant. Wind+wave and sea temperature genuinely
                carry two different instants (different providers, different publication
                cadence — see `Deniz.q5`/the new `Deniz.a8`), so ONE sentence names both,
                computed live from the same data the per-row cells used to read — never the
                owner's own hand-written example dates, which are already stale the day after
                they were written. `oldestValidAt` is the SAME "never overstate freshness" rule
                the per-row cell used, applied to the wind/wave family and the sea-temperature
                family SEPARATELY rather than to all five fields at once.

                Falls back to the general per-provider list (`VintageLine`, unchanged, still
                used as-is on the 27 province pages) whenever either family has no visible
                instant at all — a genuine but rare case (e.g. every wind/wave value on screen
                is `no_data`/`unavailable`) where naming a family with nothing to date would be
                inventing an instant instead of reporting one. */}
            {windWaveValidAt !== null && seaTemperatureValidAt !== null ? (
              <p className={styles.vintageCombined}>
                {tm("vintage.combined", {
                  windWave: format.dateTime(windWaveValidAt, MODEL_INSTANT_FORMAT),
                  seaTemperature: format.dateTime(seaTemperatureValidAt, MODEL_INSTANT_FORMAT),
                })}
              </p>
            ) : (
              <VintageLine values={blocks.flatMap(marineBlockValues)} />
            )}
          </div>
        </>
      ) : (
        <div className={styles.basinGrid}>
          {groups.map((group) => {
            const label = basinLabel(group, locale);
            if (label === null) return null;
            const headingId = marineBasinAnchorId(group.basin);

            return (
              <section key={group.basin} className={styles.basin} aria-labelledby={headingId}>
                <h3 id={headingId} className={styles.basinHeading}>
                  {label}
                  <span className={styles.basinCount}>
                    {tm("basinPointCount", { count: group.points.length })}
                  </span>
                </h3>
                <ul role="list" className={styles.pointList}>
                  {group.points.map((point) => {
                    const name = locale === "en" ? point.nameEn : point.nameTr;
                    const province = provincesByPlate.get(point.plateCode);

                    return (
                      // THE SAME per-point id the value branch puts on its table row, emitted
                      // HERE TOO — the branch fix from the PR #37 review. The 27 province
                      // sections link to `#…-{slug}` unconditionally, but `/conditions` and
                      // `/overview` are different endpoints with independent cache entries, so
                      // a province page can very reasonably show values while this page is
                      // rendering its value-less shape. Emitting the ids in one branch only
                      // meant those links landed at the top of the page — silently, which is
                      // the exact failure `lib/marine/anchors.ts` exists to prevent. Both
                      // branches list the point, so both can name it.
                      // `tabIndex={-1}` for the same reason the climate anchor carries one:
                      // Safari/VoiceOver only move AT focus to a followed fragment when its
                      // target is programmatically focusable (ENGINEERING.md §5).
                      <li key={point.slugTr} id={marinePointAnchorId(point)} tabIndex={-1}>
                        {province ? (
                          // The visible link text is the point's own name ("Kocaeli
                          // Açıkları"), which contains the target province's name — a
                          // descriptive anchor, never "buraya" (SEO-POLICY §A4 #5).
                          <Link
                            href={{
                              pathname: "/turkiye/[slug]",
                              params: {
                                slug: locale === "en" ? province.slugEn : province.slugTr,
                              },
                            }}
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className={styles.pointPlain}>{name}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
