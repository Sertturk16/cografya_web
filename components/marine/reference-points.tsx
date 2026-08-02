import { getTranslations } from "next-intl/server";
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
import { basinLabel, groupPointsByBasin } from "@/lib/marine/basins";
import { MARINE_VALUE_STATUS_KEY } from "@/lib/marine/value-state";
import { marineBlockValues } from "@/lib/marine/vintage";
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

/** The section's heading id, and the stem of each basin sub-heading's id. */
const HEADING_ID = "deniz-reference-points";

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
 * The layout authority stays the `/points` list, not the value payload: a point with no
 * value block simply gets no row, because a gap in the value feed is not a reason to drop a
 * reference point from the page.
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

  // `dataAvailable: false` is the contract's "do not publish this render" signal — it marks
  // the narrow window where the api's cache is genuinely empty. The closest honest thing a
  // Next render can do is refuse to build a band out of it: an empty value table baked into
  // the static output is exactly what the flag exists to prevent.
  const blocks: MarineOverviewPoint[] =
    overview !== null && overview.dataAvailable ? overview.points : [];
  const blockBySlug = new Map(blocks.map((block) => [block.point.slugTr, block]));
  const showValues = blocks.length > 0;

  const layerById = new Map<MarineLayer["id"], MarineLayer>(
    layers.map((layer) => [layer.id, layer]),
  );

  return (
    <section className="section" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID}>{showValues ? t("valuesHeading") : t("pointsHeading")}</h2>
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

              const headingId = `${HEADING_ID}-${group.basin}`;

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
                    idStem={headingId}
                    blocks={groupBlocks}
                    layerById={layerById}
                    provincesByPlate={provincesByPlate}
                  />
                </section>
              );
            })}
          </div>

          <div className={styles.readingKey}>
            <h3 className={styles.subHeading}>{tm("values.readingKeyHeading")}</h3>
            <ul className={styles.noteList}>
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
            <VintageLine values={blocks.flatMap(marineBlockValues)} />
          </div>
        </>
      ) : (
        <div className={styles.basinGrid}>
          {groups.map((group) => {
            const label = basinLabel(group, locale);
            if (label === null) return null;
            const headingId = `${HEADING_ID}-${group.basin}`;

            return (
              <section key={group.basin} className={styles.basin} aria-labelledby={headingId}>
                <h3 id={headingId} className={styles.basinHeading}>
                  {label}
                  <span className={styles.basinCount}>
                    {tm("basinPointCount", { count: group.points.length })}
                  </span>
                </h3>
                <ul className={styles.pointList}>
                  {group.points.map((point) => {
                    const name = locale === "en" ? point.nameEn : point.nameTr;
                    const province = provincesByPlate.get(point.plateCode);

                    return (
                      <li key={point.slugTr}>
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
