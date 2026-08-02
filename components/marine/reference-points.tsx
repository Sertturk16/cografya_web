import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarinePointListItem, ProvinceListItem } from "@/lib/api/types";
import { byPlateCode } from "@/lib/api/provinces";
import { basinLabel, groupPointsByBasin } from "@/lib/marine/basins";
import { MarineMap } from "./marine-map";
import styles from "./marine.module.css";

interface ReferencePointsProps {
  locale: Locale;
  points: MarinePointListItem[];
  /** The published provinces — the authoritative set of pages that exist. */
  provinces: ProvinceListItem[];
}

/** The section's heading id, and the stem of each basin sub-heading's id. */
const HEADING_ID = "deniz-reference-points";

/**
 * The 30 offshore reference points, grouped under the sea each one sits in and linked to
 * the province page it is published under (hub-and-spoke internal linking,
 * `CONVENTIONS.md` §6 #10 / `SEO-POLICY.md` §A4).
 *
 * Three provinces own two points each (İstanbul, Çanakkale, Balıkesir — they touch two
 * seas and the two points legitimately disagree), so 30 links resolve to 27 province
 * pages. The join is the api's zero-padded `plateCode`, the same string the map artifact
 * uses, so plain equality is the correct match.
 *
 * A point whose province has no published page renders as PLAIN TEXT, never a link:
 * linking to a URL that would 404 is the soft-404/dead-link rule (`ENGINEERING.md` §4 #6,
 * `SEO-POLICY.md` §A4 #3). It cannot happen with all 81 provinces seeded, and it is
 * written this way so that it still cannot happen if that ever changes.
 */
export async function ReferencePoints({ locale, points, provinces }: ReferencePointsProps) {
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

  return (
    <section className="section" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID}>{t("pointsHeading")}</h2>
      <p className={styles.hint}>{tm("point.referencePointHint")}</p>

      {/* The map is a VIEW of the list below it, not a separate topic, so the two share
          this one <h2> rather than the map opening a heading of its own — a second heading
          would claim the map is a second subject and split the section's outline. */}
      <MarineMap locale={locale} points={points} provinces={provinces} />

      <div className={styles.basinGrid}>
        {groups.map((group) => {
          const label = basinLabel(group, locale);
          if (label === null) return null;
          const headingId = `${HEADING_ID}-${group.basin}`;

          return (
            <section key={group.basin} className={styles.basin} aria-labelledby={headingId}>
              {/* The count lives INSIDE the heading so a screen reader announces
                  "Karadeniz açıkları, 15 nokta" as one landmark name. */}
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
    </section>
  );
}
