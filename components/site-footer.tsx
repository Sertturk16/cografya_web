import { getTranslations } from "next-intl/server";
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
        <p className={styles.copyright}>{t("copyright", { year, siteName: siteConfig.name })}</p>
      </div>
    </footer>
  );
}
