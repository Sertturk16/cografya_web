import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/seo/site";
import styles from "./site-footer.module.css";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.tagline}>
          {siteConfig.name} — {t("tagline")}
        </p>
        <p className={styles.note}>{t("note")}</p>
        {/* The site's auth entry points (UYELIK-04,
            `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md` §4.6). The
            FOOTER, not the header: `DESIGN.md` §4's eight-link measurement (1051.2px in
            Turkish against 1056px at `66rem`) leaves no headroom for a ninth item. It is
            also where the precedent puts this class of link (`DEC 2026-08-20g` md.5): the
            legal pair will join this same region when it exists (plan §13 Stop 1) — no
            legal entry, no placeholder, ships here today.

            `Giriş yap` landed in PR-1; `Üye ol` lands here in PR-2, WITH `/kayit` — the same
            "a link lands with its page" rule the CBS tool tier records for itself
            (`i18n/routing.ts`); a link to a route that does not exist yet is
            `SEO-POLICY.md` §B8 8.8/8.9. */}
        <nav aria-label={t("authLabel")} className={styles.auth}>
          <Link href="/giris" className={styles.authLink}>
            {t("login")}
          </Link>
          <Link href="/kayit" className={styles.authLink}>
            {t("register")}
          </Link>
        </nav>
        <p className={styles.copyright}>{t("copyright", { year, siteName: siteConfig.name })}</p>
      </div>
    </footer>
  );
}
