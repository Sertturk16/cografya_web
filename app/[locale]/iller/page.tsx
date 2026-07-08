import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { getProvincesResilient } from "@/lib/api/provinces";
import type { ProvinceListItem } from "@/lib/api/types";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { collectionPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./provinces.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Provinces" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/iller",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** The localized slug (slug_tr for tr, slug_en for en). */
function slugForLocale(province: ProvinceListItem, locale: Locale): string {
  return locale === "en" ? province.slugEn : province.slugTr;
}

export default async function ProvincesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Provinces");
  const tb = await getTranslations("Breadcrumb");
  const tRegions = await getTranslations("Regions");
  const path = getPathname({ locale, href: "/iller" });

  const provinces = await getProvincesResilient();

  return (
    <div className="container page">
      <JsonLd
        schema={collectionPageJsonLd({
          name: t("heading"),
          description: t("metaDescription"),
          path,
          locale,
        })}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: t("heading"), href: "/iller" },
        ]}
      />
      <h1>{t("heading")}</h1>
      <p className="lede">{t("intro")}</p>
      <p className={styles.coverageNote}>{t("coverageNote")}</p>

      {provinces.length === 0 ? (
        <p className="section">{t("empty")}</p>
      ) : (
        <ul className="province-grid section">
          {provinces.map((province) => (
            <li key={province.plateCode}>
              <Link
                className="province-card"
                href={{
                  pathname: "/il/[slug]",
                  params: { slug: slugForLocale(province, locale) },
                }}
                // Explicit accessible name so AT reads "İstanbul, Marmara" (with a
                // pause) instead of the run-on "İstanbul Marmara" (WCAG — the two
                // adjacent spans otherwise concatenate without a separator).
                aria-label={`${province.nameTr}, ${tRegions(province.region)}`}
              >
                <span className={styles.cardBody}>
                  <span className={styles.cardName}>{province.nameTr}</span>
                  <span className={styles.cardRegion}>{tRegions(province.region)}</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
