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
          {/* Single-sourced placeholder brand mark (Terra globe); decorative, the
              adjacent brand name is the accessible label. */}
          <span
            className={styles.glyph}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: brandGlyphSvg({ size: 28, radiusRatio: 0.29 }) }}
          />
          {siteConfig.name}
        </Link>
        {/* Placed between the brand and the nav ON PURPOSE. It puts search early in the tab
            order, ahead of six nav links. The hamburger reworking anticipated in this
            comment has now happened: the nav items moved inside `SiteNav`'s panel and this
            trigger stayed exactly where it was, sharing the header's first row with the
            brand and the menu button. */}
        <SiteSearch locale={locale} />
        {/* Renders the six hub links as server-side `<a href>` at every viewport; below
            64rem a client disclosure hides or reveals that subtree. Order matters here:
            the menu button is the last control on the first row, after the search
            trigger. */}
        <SiteNav />
      </div>
    </header>
  );
}
