import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { brandGlyphSvg } from "@/lib/brand/glyph";
import { siteConfig } from "@/lib/seo/site";
import { SiteNav } from "./site-nav/site-nav";
import { SiteSearch } from "./site-search/site-search";
import styles from "./site-header.module.css";

export async function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <span
            className={styles.glyph}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: brandGlyphSvg({ size: 28, radiusRatio: 0.29 }) }}
          />
          <span className={styles.brandName}>{siteConfig.name}</span>
        </Link>
        <SiteSearch locale={locale} />
        <SiteNav />
      </div>
    </header>
  );
}
