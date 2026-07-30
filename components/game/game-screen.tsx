import { getTranslations } from "next-intl/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { GeographicRegion } from "@/lib/api/types";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import type { Locale } from "@/i18n/routing";
import type { GameModeId } from "@/lib/game/config";
import { viewBoxForPaths } from "@/lib/game/map-bbox";
import { buildGameShapes, toTargetEntries } from "@/lib/game/map-shapes";
import { SLUG_PLACEHOLDER } from "@/lib/game/province-url";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { GameIslandLoader } from "./game-island-loader";
import { GameMap } from "./game-map";
import { getRegionLabels } from "./region-labels";
import styles from "./game-screen.module.css";

interface GameScreenProps {
  locale: Locale;
  mode: GameModeId;
  /** Heading of THIS screen — the mode's name, or the region's in mode 3. */
  modeName: string;
  /**
   * Restricts the map, and therefore the question pool, to one bölge (→ DEC 2026-07-30p).
   * `null` on the two whole-country modes.
   */
  region?: GeographicRegion | null;
}

/**
 * One playable game screen (→ DEC 2026-07-30p — every mode has its own page now).
 *
 * The layout is the owner's design direction, top to bottom: a back link to the shop
 * window, the mode's name, the live question, two small pills, the map, and the round's
 * controls under it. Everything except the map and the back link is the island's, mounted
 * into two pre-sized slots so the map never moves when it arrives (CLS).
 *
 * These pages are `noindex` by construction (`surface: "noindex"` in each route's
 * metadata), which is why there is no lede, no FAQ and no JSON-LD here: the indexable copy
 * lives once, on `/oyun`. What is here is the game.
 */
export async function GameScreen({ locale, mode, modeName, region = null }: GameScreenProps) {
  const t = await getTranslations("Game");
  const summaries = await getMapSummaryResilient();
  const regionLabels = await getRegionLabels();

  const allShapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  // Region mode draws ONE region. An unseeded plate has no region, so it is absent here
  // too — it could never be an answer, and drawing it would put an inert shape inside a
  // frame that is meant to hold nothing but the round's own targets.
  const shapes = region ? allShapes.filter((shape) => shape.target?.region === region) : allShapes;

  // The frame: the whole country, or the subset's OWN bounds. A region that somehow has no
  // shapes falls back to the full map rather than to a degenerate box.
  const viewBox = (region ? viewBoxForPaths(shapes.map((shape) => shape.d)) : null) ?? MAP_VIEWBOX;

  // Resolved ONCE here, through `getPathname`, and handed to the client as a template. The
  // end-of-round "provinces you missed" list substitutes a slug into it, so the localized
  // province URL is built in exactly one place on the site (SEO-POLICY §B7 7.4).
  const provinceUrlTemplate = getPathname({
    locale,
    href: { pathname: "/turkiye/[slug]", params: { slug: SLUG_PLACEHOLDER } },
  });
  const hubUrl = getPathname({ locale, href: "/oyun" });

  return (
    <div className={styles.screen}>
      <p className={styles.backRow}>
        <Link href="/oyun" className={styles.back}>
          <span aria-hidden="true">←</span> {t("backToHub")}
        </Link>
      </p>

      {/* The page's own name. Small on purpose: the live question below it is the thing
          being read, and a screen cannot have two headline-sized headings without one of
          them being noise. It is a real <h1> because it is what this document is about,
          and it is what a JavaScript-less visitor is left with. */}
      <h1 className={styles.kicker}>{modeName}</h1>

      {/* HEAD SLOT — question + pills + the round's live region. Pre-sized, so the island
          mounts into it without pushing the map down (CLS budget, CONVENTIONS §6 #9). With
          JavaScript off it is not dead space: it says, in one sentence, why nothing is
          happening. */}
      <div className={styles.headSlot} data-game-head>
        <p className={styles.headFallback}>{t("noScript")}</p>
        <GameIslandLoader
          mode={mode}
          shapes={toTargetEntries(shapes)}
          regionLabels={regionLabels}
          provinceUrlTemplate={provinceUrlTemplate}
          hubUrl={hubUrl}
        />
      </div>

      <GameMap shapes={shapes} viewBox={viewBox} title={t("mapTitle", { mode: modeName })} />

      {/* ACTION SLOT — the island portals its controls here, so they sit under the map (the
          thumb's half of a phone screen) while staying part of one island's state. Its
          height is RESERVED rather than grown into: the round starts itself, so the
          controls arrive with the island and a zero-height box would move the page under
          the reader (CLS budget, CONVENTIONS §6 #9). */}
      <div className={styles.actionSlot} data-game-actions />
    </div>
  );
}
