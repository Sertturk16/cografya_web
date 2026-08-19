import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "../locale-switcher";
import { NavDisclosure } from "./nav-disclosure";
import styles from "./site-nav.module.css";

/**
 * The header's primary navigation. Server half: it resolves the seven labels and hands the
 * finished `<nav>` — real `<a href>` elements, one per hub — to the client disclosure as
 * children. The island never sees a route or a label, only a subtree it may show or hide,
 * which is what keeps the link graph identical at every viewport (`SEO-POLICY.md` §B8.1/8.2).
 *
 * The locale switcher travels with the nav into the panel. It is the whole of today's header
 * that moves, so nothing a reader had at 390px is lost — it is the same set of controls, one
 * tap away instead of three wrapped rows tall.
 */
export async function SiteNav() {
  const t = await getTranslations("Nav");

  return (
    <NavDisclosure>
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
        {/* The book hub (owner ruling V-6, → DEC 2026-08-15g). It sits here rather than
            being reached only from the home page because §B8 8.1 wants every indexable page
            behind at least one static internal link, and a nav link is the one entry point
            that exists on every page. The ruling carried a measured cost and it is paid in
            `DESIGN.md` §4: a seventh link moves the width at which the header collapses to
            one row, so both locales were re-measured on the running build and the numbers
            in that section are this link's, not the six-link ones. */}
        <Link href="/kitaplar">{t("kitaplar")}</Link>
        {/* The CBS tool hub (owner ruling O-1, → DEC 2026-08-19g md.1). The EIGHTH link, and
            it did not fit: at 64rem the Turkish row went to two rows because the locale
            switcher was pushed off the end (104.2px against 57.5px, measured on frames the
            owner ruled on). The nav-collapse breakpoint moved to 66rem in the same change —
            `DESIGN.md` §4 carries the measurement and the accepted 1024-1055px cost. */}
        <Link href="/araclar">{t("araclar")}</Link>
        <Link href="/hakkimizda">{t("about")}</Link>
      </nav>
      <LocaleSwitcher />
    </NavDisclosure>
  );
}
