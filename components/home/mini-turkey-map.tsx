import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { byPlateCode } from "@/lib/api/provinces";
import type { ProvinceMapSummary } from "@/lib/api/types";
import { MINI_MAP_VIEWBOX, MINI_PROVINCE_SHAPES } from "@/lib/map/tr-provinces-mini.generated";
import styles from "./home.module.css";

interface MiniTurkeyMapProps {
  /**
   * The published provinces, used ONLY to stamp `data-region` on each shape. An empty list
   * (api unreachable at build) renders the same outline without the attribute.
   */
  provinces: ProvinceMapSummary[];
}

/**
 * The homepage's Türkiye thumbnail: a picture that is ONE link, not a map of 81 links.
 *
 * ## Why one link (plan §2.6, owner-ruled)
 *
 * The interactive map already exists, one click away, on `/turkiye` — where the UX review's
 * fix also put an A→Z list beside it, so those 81 URLs are now crawlable TWICE from one page.
 * A third copy here would add nothing to the crawl graph and would cost real harm: 81 touch
 * targets at thumbnail scale reproduces, on the site's most-visited page, exactly the defect
 * the review filed against the full map on a phone ("tapping 81 provinces is physically
 * impossible"). It also measures: the links, labels and hover-card `data-*` are ~15 kB gzip
 * of payload for a surface that is a visual invitation, not a navigation surface.
 *
 * So the whole picture is one touch target — far past the 44×44 px floor at every width — and
 * the accessible name is the VISIBLE label beneath it rather than a `<title>` inside the
 * `<svg>`. Hence `aria-hidden` + `focusable="false"` on the graphic: one link, one name, no
 * double announcement.
 *
 * ## No `<use>`/`<defs>` layer stack, no water layer
 *
 * `turkey-map-section.tsx` splits geometry into `<defs>` and paints it through three layers to
 * fix hover-line paint order. There is no hover here, so a flat list of `<path>` is both
 * smaller and simpler. P6's inland-water artifact is likewise absent: at this scale nothing
 * but Tuz Gölü would resolve, and it would put a second generated artifact on the homepage's
 * byte budget to render a few unreadable pixels.
 *
 * ## `data-region` is written today; colour is NOT turned on today
 *
 * The attribute comes from the api's own `region` enum — no invented mapping — and costs
 * ~100 B gzipped. Colouring it is one CSS block away (the game map already does exactly that,
 * `[data-region="MARMARA"] { fill: … }`, Okabe-Ito, colourblind-safe). It stays off because
 * `DESIGN.md` §6.1 rule 5 requires a legend with the colour, and that legend+palette decision
 * has to be taken for `/turkiye` and this thumbnail AT ONCE or the two maps diverge.
 *
 * ## Attribution
 *
 * ODbL applies wherever the geometry is shown, so the chip renders here too — through the
 * EXISTING `Map.attribution` key, never a second copy of the text. When the queued
 * geoBoundaries re-source rewrites that credit, this surface inherits it for free. The JRC
 * water line is deliberately NOT repeated: this map draws no water, and crediting an unused
 * source is a false statement rather than a courtesy.
 */
export async function MiniTurkeyMap({ provinces }: MiniTurkeyMapProps) {
  const t = await getTranslations("Home");
  const tMap = await getTranslations("Map");

  const byPlate = byPlateCode(provinces);

  return (
    <section className={`section ${styles.mapSection}`} aria-labelledby="home-map-heading">
      <div className={styles.mapGrid}>
        {/* The picture and its label are ONE anchor: the label is the link's accessible name
            and its visible text at the same time, so a pointer user, a keyboard user and a
            screen-reader user all act on the same single target.

            `<Link>` with the UNLOCALIZED route, like the `/dunya` link beside it: the routing
            table does the localization, and the prefetch it registers is already paid for by
            the hero's own `/turkiye` button on this same page. */}
        <Link className={styles.mapLink} href="/turkiye">
          <span className={styles.mapFrame}>
            <svg
              className={styles.mapSvg}
              viewBox={MINI_MAP_VIEWBOX}
              aria-hidden="true"
              focusable="false"
            >
              {MINI_PROVINCE_SHAPES.map((shape) => (
                <path
                  key={shape.plateCode}
                  d={shape.d}
                  data-region={byPlate.get(shape.plateCode)?.region}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </span>
          <span className={styles.mapLinkLabel}>{t("mapLinkLabel")}</span>
        </Link>

        <div className={styles.mapCopy}>
          <h2 id="home-map-heading">{t("mapHeading")}</h2>
          <p>{t("mapBody")}</p>
          <p className={styles.mapAside}>
            <Link href="/dunya">{t("worldLinkLabel")}</Link>
          </p>
        </div>
      </div>

      {/* Fixed to the map column, under the frame — the chip is part of the graphic's
          obligations, not of the surrounding copy. */}
      <p className={styles.attribution}>{tMap("attribution")}</p>
    </section>
  );
}
