import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { placeholderProvinces } from "@/lib/geo/placeholder-provinces";
import { collectionPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";

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

export default async function ProvincesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Provinces");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: "/iller" });

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
      <p className="placeholder-note">
        <span className="chip">placeholder</span> {t("placeholderNote")}
      </p>

      <ul className="province-grid section">
        {placeholderProvinces.map((province) => (
          <li key={province.id}>
            <Link
              className="province-card"
              href={{
                pathname: "/il/[slug]",
                params: { slug: province.slug[locale] },
              }}
            >
              <span>{province.name[locale]}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
