import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { MarinePointListItem, ProvinceListItem } from "@/lib/api/types";
import { byPlateCode } from "@/lib/api/provinces";
import { basinLabel, groupPointsByBasin } from "@/lib/marine/basins";
import styles from "./marine.module.css";

interface ReferencePointsProps {
  locale: Locale;
  points: MarinePointListItem[];
  /** The published provinces — the authoritative set of pages that exist. */
  provinces: ProvinceListItem[];
}

/** The section's heading id, so the page and the landmark label stay in step. */
export const REFERENCE_POINTS_HEADING_ID = "deniz-reference-points";

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

  return (
    <section className="section" aria-labelledby={REFERENCE_POINTS_HEADING_ID}>
      <h2 id={REFERENCE_POINTS_HEADING_ID}>{t("pointsHeading")}</h2>
      <p className={styles.hint}>{tm("point.referencePointHint")}</p>

      <div className={styles.basinGrid}>
        {groups.map((group) => {
          const label = basinLabel(group, locale);
          if (label === null) return null;
          const headingId = `${REFERENCE_POINTS_HEADING_ID}-${group.basin}`;

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
