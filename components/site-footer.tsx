import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/seo/site";
import { SiteFooterWrapper } from "./site-header-wrapper";
import styles from "./site-footer.module.css";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const year = new Date().getFullYear();

  return (
    <SiteFooterWrapper>
      <footer className={styles.footer}>
        <div className={`container ${styles.inner}`}>
          <p className={styles.tagline}>
            {siteConfig.name} — {t("tagline")}
          </p>
          <p className={styles.note}>{t("note")}</p>
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
    </SiteFooterWrapper>
  );
}

