import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MapIcon } from "@/components/game/game-icons";
import { getRegionLabels } from "@/components/game/region-labels";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { REGION_KEYS, regionSlug } from "@/lib/game/region-slug";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "../game.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Game" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/oyun/bolge-bolge-il",
    title: t("modeMetaTitle", { mode: t("mode3Name"), brand: t("brandName") }),
    description: t("mode3Body"),
    titleAbsolute: true,
    // See `bolge-bulma/page.tsx` — every screen under `/oyun` is `noindex` in both
    // locales (→ DEC 2026-07-30p).
    surface: "noindex",
  });
}

/**
 * Mode 3, step 1 — pick a bölge.
 *
 * Its own screen rather than a fold-out on the shop window, following the reference app's
 * structure (the owner's stated model): a mode card leads to a mode screen, and this mode's
 * first screen is a choice. Every card is a real link, so this step works with no
 * JavaScript at all and each region's round has a shareable URL of its own.
 *
 * No il counts on the cards. The reference app shows them ("11 il") and it is a defensible
 * pattern — but the owner removed the question-count badges from the mode cards
 * (→ DEC 2026-07-30q), and a count here would be the same badge one level down.
 */
export default async function RegionPickerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");
  const regionLabels = await getRegionLabels();

  return (
    <div className="container page">
      <p className={styles.backRow}>
        <Link href="/oyun" className={styles.back}>
          <span aria-hidden="true">←</span> {t("backToHub")}
        </Link>
      </p>

      <div className={styles.intro}>
        <p className={styles.introBadge} aria-hidden="true">
          <MapIcon size={26} />
        </p>
        <h1 className={styles.title}>{t("regionPickerHeading")}</h1>
        <p className={styles.subtitle}>{t("regionPickerSubtitle")}</p>
      </div>

      <ul className={styles.modeGrid}>
        {REGION_KEYS.map((region) => (
          <li key={region} className={styles.modeCard}>
            <h2 className={styles.modeName}>{regionLabels[region]}</h2>
            <Link
              href={{
                pathname: "/oyun/bolge-bolge-il/[bolge]",
                params: { bolge: regionSlug(region) },
              }}
              className={styles.modeAction}
              aria-label={t("modeStartLabel", { mode: regionLabels[region] })}
            >
              {t("modeStart")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
