import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/seo/site";
import { LocaleSwitcher } from "./locale-switcher";
import styles from "./site-header.module.css";

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.glyph} aria-hidden="true">
            ◭
          </span>
          {siteConfig.name}
        </Link>
        <nav aria-label={t("label")} className={styles.nav}>
          <Link href="/">{t("home")}</Link>
          <Link href="/iller">{t("provinces")}</Link>
          <Link href="/hakkimizda">{t("about")}</Link>
        </nav>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
