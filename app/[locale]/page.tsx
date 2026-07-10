import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TurkeyMapSection } from "@/components/map/turkey-map-section";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/",
    title: t("metaTitle"),
    titleAbsolute: true,
    description: t("metaDescription"),
  });
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <div className="container page">
      <JsonLd schema={[websiteJsonLd(locale), organizationJsonLd()]} />

      <section className="hero">
        <h1>{t("heading")}</h1>
        <p className="lede">{t("lede")}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/iller">
            {t("ctaProvinces")}
          </Link>
          <Link className="btn btn-ghost" href="/hakkimizda">
            {t("ctaAbout")}
          </Link>
        </div>
      </section>

      <TurkeyMapSection locale={locale} />

      <section className="section">
        <h2>{t("provincesTitle")}</h2>
        <p>{t("provincesBody")}</p>
      </section>
    </div>
  );
}
