import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "../locale-switcher";
import { NavDisclosure } from "./nav-disclosure";
import styles from "./site-nav.module.css";

/**
 * The header's primary navigation. Server half: it resolves the six labels and hands the
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
        <Link href="/hakkimizda">{t("about")}</Link>
      </nav>
      <LocaleSwitcher />
    </NavDisclosure>
  );
}
