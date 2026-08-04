import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { brandGlyphSvg } from "@/lib/brand/glyph";
import { siteConfig } from "@/lib/seo/site";
import { LocaleSwitcher } from "./locale-switcher";
import { SiteSearch } from "./site-search/site-search";
import styles from "./site-header.module.css";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const locale = (await getLocale()) as Locale;

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          {/* Single-sourced placeholder brand mark (Terra globe); decorative, the
              adjacent brand name is the accessible label. */}
          <span
            className={styles.glyph}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: brandGlyphSvg({ size: 28, radiusRatio: 0.29 }) }}
          />
          {siteConfig.name}
        </Link>
        {/* Placed between the brand and the nav ON PURPOSE. `.inner` is `flex-wrap`, so at
            390px the brand and this 44px trigger share the FIRST row — the nav still wraps
            to rows two and three exactly as before and the header height is unchanged. It
            also puts search early in the tab order, ahead of six nav links. When the mobile
            header is reworked into a hamburger, the nav items move inside it and this
            trigger stays where it is. */}
        <SiteSearch locale={locale} />
        <nav aria-label={t("label")} className={styles.nav}>
          <Link href="/">{t("home")}</Link>
          <Link href="/turkiye">{t("turkiye")}</Link>
          <Link href="/dunya">{t("dunya")}</Link>
          {/* The marine hub sits with the two map hubs, not under `/turkiye`: it spans 27
              provinces and four seas, so no single province owns it. A nav link is also
              what keeps it from being an orphan page (`SEO-POLICY.md` §B8) — the second
              entry point is the cross-link on `/turkiye` (owner answer S8: both). */}
          <Link href="/deniz">{t("deniz")}</Link>
          {/* The game is a primary surface, not a sub-page of the map hub (owner answer
              S4, → DEC 2026-07-30c) — so it sits in the top nav, after the two map hubs
              and before the site-info link. */}
          <Link href="/oyun">{t("game")}</Link>
          <Link href="/hakkimizda">{t("about")}</Link>
        </nav>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
