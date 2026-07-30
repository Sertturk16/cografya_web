import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { GameMap } from "@/components/game/game-map";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { faqPageJsonLd, type FaqEntry, JsonLd, learningResourceJsonLd } from "@/lib/seo/json-ld";
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
 * `/oyun` ↔ `/en/game` — the map game hub (→ DEC 2026-07-30b/30c; SPEC
 * `Owner's Inbox/kasif-oyunu/SPEC.md`).
 *
 * PR-1 is the SHELL: everything indexable about the game is here and server-rendered —
 * heading, lede, the three mode descriptions, a real 81-province map, how-to-play, FAQ,
 * breadcrumb and hub links. With JavaScript switched off the page still answers "what is
 * this game, what are its modes, how is it played" completely (CONVENTIONS §6 #1). The
 * client island that turns the map into a playable round lands in PR-2 and adds nothing
 * to the indexable surface; that is the whole point of splitting them.
 *
 * The surface is `"localized"` (the default), not `"trNarrative"`: unlike a province or
 * country page, none of this page's value comes from TR-only api narrative — the copy is
 * short, hand-written in both languages, and the game itself is language-independent. So
 * it carries the full tr/en/x-default cluster and is indexable in both locales, the same
 * class as the `/turkiye` and `/dunya` hubs (SPEC §2.3).
 */
export default async function GamePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Game");
  const tb = await getTranslations("Breadcrumb");
  const brand = t("brandName");
  const path = getPathname({ locale, href: "/oyun" });

  // Modes are an explicit tuple, not a generated key list: next-intl types message keys,
  // and a template-built key would silently opt out of that check.
  const modes = [
    { name: t("mode1Name"), count: t("mode1Count"), body: t("mode1Body") },
    { name: t("mode2Name"), count: t("mode2Count"), body: t("mode2Body") },
    { name: t("mode3Name"), count: t("mode3Count"), body: t("mode3Body") },
  ];

  // ONE source for the visible FAQ and its FAQPage markup, so the two can never drift —
  // structured data that is not visible on the page is a policy violation, not a detail
  // (SEO-POLICY §B5 5.7).
  const faq: FaqEntry[] = [
    { question: t("faq1Question"), answer: t("faq1Answer") },
    { question: t("faq2Question"), answer: t("faq2Answer") },
    { question: t("faq3Question"), answer: t("faq3Answer") },
    { question: t("faq4Question"), answer: t("faq4Answer") },
  ];

  return (
    <div className="container page">
      <JsonLd
        schema={[
          learningResourceJsonLd({
            name: t("heading", { brand }),
            description: t("metaDescription"),
            path,
            locale,
            learningResourceType: "Game",
            teaches: t("teaches"),
          }),
          faqPageJsonLd(faq),
        ]}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("game"), href: "/oyun" },
        ]}
      />
      <h1>{t("heading", { brand })}</h1>
      <p className="lede">{t("lede", { brand })}</p>

      <section className="section" aria-labelledby="game-modes-heading">
        <h2 id="game-modes-heading">{t("modesHeading")}</h2>
        <ul className={styles.modeGrid}>
          {modes.map((mode) => (
            <li key={mode.name} className={styles.modeCard}>
              <h3 className={styles.modeName}>{mode.name}</h3>
              <p className={styles.modeCount}>{mode.count}</p>
              <p className={styles.modeBody}>{mode.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="game-map-heading">
        <h2 id="game-map-heading">{t("mapHeading")}</h2>
        <p className={styles.sectionIntro}>{t("mapBody")}</p>
        <GameMap locale={locale} />
      </section>

      <section className="section" aria-labelledby="game-how-heading">
        <h2 id="game-how-heading">{t("howHeading")}</h2>
        <ol className={styles.steps}>
          <li>{t("howStep1")}</li>
          <li>{t("howStep2")}</li>
          <li>{t("howStep3")}</li>
        </ol>
      </section>

      <section className="section" aria-labelledby="game-faq-heading">
        <h2 id="game-faq-heading">{t("faqHeading")}</h2>
        <div className={styles.faq}>
          {faq.map((entry) => (
            <details key={entry.question} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>{entry.question}</summary>
              <p className={styles.faqAnswer}>{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="game-links-heading">
        <h2 id="game-links-heading">{t("linksHeading")}</h2>
        <ul className={styles.linkGrid}>
          <li className={styles.linkCard}>
            <Link href="/turkiye" className={styles.linkTitle}>
              {t("linkTurkiye")}
            </Link>
            <p className={styles.linkBody}>{t("linkTurkiyeBody")}</p>
          </li>
          <li className={styles.linkCard}>
            <Link href="/dunya" className={styles.linkTitle}>
              {t("linkDunya")}
            </Link>
            <p className={styles.linkBody}>{t("linkDunyaBody")}</p>
          </li>
        </ul>
      </section>
    </div>
  );
}
