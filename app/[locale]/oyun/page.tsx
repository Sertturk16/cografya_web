import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { LayersIcon, MapIcon, PinIcon } from "@/components/game/game-icons";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./game.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Game" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/oyun",
    title: t("metaTitle", { brand: t("brandName") }),
    description: t("metaDescription"),
    // Deliberate departure from the `%s · {brand}` root template (SPEC §10.1). With the
    // suffix the title reads "Kâşif — Coğrafya Harita Oyunu · Coğrafya Platformu": 43 % of
    // it is the word "coğrafya" three times over, well past the width a SERP shows. The
    // pattern the owner locked (DEC 2026-07-30b) is the suffix-LESS one.
    titleAbsolute: true,
  });
}

/**
 * `/oyun` ↔ `/en/game` — the game's shop window (→ DEC 2026-07-30p/30q/30r).
 *
 * WHAT THIS PAGE IS NOW. A heading, one sentence, and three cards. The lede, the "how to
 * play" steps and the FAQ that PR-1 shipped here are GONE — the owner ruled the page was
 * talking far more than any comparable product does, and the text benchmark against
 * Seterra, World Geography Games and the reference app agreed on every count
 * (`Owner's Inbox/oyun-metin-benchmark/brief.md`). The FAQPage JSON-LD left with the
 * visible FAQ, deliberately: structured data whose content is not on the page is a spam
 * signal, not a bonus (SEO-POLICY §B5 5.7).
 *
 * WHAT THAT COSTS AND WHY IT IS STILL FINE. This is now a thin page by word count, and it
 * is the ONLY indexable page of the game: the three play screens it links to are `noindex`
 * (→ DEC 2026-07-30p), because each is an application screen whose crawlable body would be
 * a map plus a control strip. So the search query is carried by the title, the description,
 * the H1, the mode names and the site's own navigation — an owner-ruled trade, recorded
 * here rather than argued each time someone reads the file.
 *
 * The surface stays `"localized"` (the default): the copy is short, hand-written in both
 * languages and owes nothing to the api's TR-only narrative fields, so the page carries the
 * full tr/en/x-default cluster and is indexable in both locales — the same class as the
 * `/turkiye` and `/dunya` hubs.
 */
export default async function GamePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");
  const tb = await getTranslations("Breadcrumb");
  const brand = t("brandName");
  const path = getPathname({ locale, href: "/oyun" });

  // An explicit tuple, not a generated key list: next-intl types message keys, and a
  // template-built key would silently opt out of that check. Each card is a REAL link to
  // that mode's own page — no JavaScript is involved in choosing a mode any more.
  const modes = [
    { href: "/oyun/bolge-bulma", name: t("mode1Name"), body: t("mode1Body"), Icon: MapIcon },
    { href: "/oyun/81-il", name: t("mode2Name"), body: t("mode2Body"), Icon: PinIcon },
    {
      href: "/oyun/bolge-bolge-il",
      name: t("mode3Name"),
      body: t("mode3Body"),
      Icon: LayersIcon,
    },
  ] as const;

  return (
    <div className="container page">
      <JsonLd
        schema={learningResourceJsonLd({
          name: t("heading", { brand }),
          description: t("metaDescription"),
          path,
          locale,
          learningResourceType: "Game",
          teaches: t("teaches"),
        })}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("game"), href: "/oyun" },
        ]}
      />

      <div className={styles.intro}>
        <p className={styles.introBadge} aria-hidden="true">
          <MapIcon size={26} />
        </p>
        <h1 className={styles.title}>{t("heading", { brand })}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>

      <ul className={styles.modeGrid}>
        {modes.map((mode) => (
          <li key={mode.href} className={styles.modeCard}>
            <p className={styles.modeBadge} aria-hidden="true">
              <mode.Icon size={24} />
            </p>
            <h2 className={styles.modeName}>{mode.name}</h2>
            <p className={styles.modeBody}>{mode.body}</p>
            {/* The visible word is "Başla" on all three cards, so the accessible name adds
                which mode it starts — and CONTAINS the visible label, which is what
                WCAG 2.5.3 asks of a control whose visible text is repeated. */}
            <Link
              href={mode.href}
              className={styles.modeAction}
              aria-label={t("modeStartLabel", { mode: mode.name })}
            >
              {t("modeStart")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
